import 'dotenv/config';
import express, { NextFunction, Request, Response } from 'express';
import fs from 'fs';
import https from 'https';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import crypto from 'crypto';
import { z } from 'zod';
import {
  initDatabase, getAllCats, getBootstrapData, saveCat, deleteCat,
  getAllApplications, getApplicationsForOwner, createApplication, updateApplication, deleteApplication,
  getAllArticles, createArticle, updateArticle, deleteArticle, toggleArticleLike,
  getShelterStats, setShelterStats,
  getSiteContacts, setSiteContacts,
  getDonationSettings, setDonationSettings,
  getPreferences, setPreference, getCatRatings, recordSiteVisit, getVisitAnalytics, verifyAdminPassword, changeAdminPassword,
  createAdminSession, hasAdminSession, deleteAdminSession,
  getDatabaseStats, getMediaAsset, setDatabaseBackupSettings,
} from './server/db';
import {
  assertBackupDirectoryWritable,
  browseServerDirectories,
  createServerDirectory,
  createPostgresBackup,
  removeTemporaryBackup,
  restorePostgresBackup,
} from './server/postgresBackup';
import {
  getAutomaticBackupStatus,
  reloadAutomaticBackupScheduler,
  startAutomaticBackupScheduler,
} from './server/backupScheduler';
import type { Cat, ShelterArticle } from './src/types';
import {
  articleSeoPath,
  articleTagPath,
  articleTagSlug,
  catSeoPath,
  findArticleTagBySlug,
  findBySeoSlug,
  normalizeArticleTag,
} from './src/utils/seo';

const ADMIN_COOKIE = 'shelter_admin_session';
const VISITOR_COOKIE = 'shelter_visitor';
const SESSION_MS = 12 * 60 * 60 * 1000;
const COOKIE_SECRET = process.env.COOKIE_SECRET;
const isProduction = process.env.NODE_ENV === 'production' || process.argv.includes('--production');
const httpsEnabled = process.env.HTTPS_ENABLED === 'true';
const listenHost = process.env.HOST || '127.0.0.1';
if (!COOKIE_SECRET || COOKIE_SECRET.length < 32) throw new Error('COOKIE_SECRET must contain at least 32 characters');

type ShelterRequest = Request & { visitorId?: string; adminTokenHash?: string };

const objectSchema = z.object({}).passthrough();
const shelterStatsSchema = z.object({
  adoptedCount: z.number().int().min(0).max(1000000),
  currentCount: z.number().int().min(0).max(1000000),
});
const optionalUrlSchema = z.string().trim().max(500).refine(
  (value) => value === '' || z.string().url().safeParse(value).success,
  'Укажите корректную ссылку',
);
const siteContactsSchema = z.object({
  address: z.string().trim().min(1).max(300),
  visitingHours: z.string().trim().min(1).max(300),
  phone: z.string().trim().max(100),
  telegram: z.string().trim().min(1).max(120),
  telegramUrl: z.string().trim().url().max(500),
  maxUrl: optionalUrlSchema.optional().default(''),
  vkUrl: optionalUrlSchema.optional().default(''),
  youtubeUrl: optionalUrlSchema.optional().default(''),
  rutubeUrl: optionalUrlSchema.optional().default(''),
});
const donationSettingsSchema = z.object({
  title: z.string().trim().min(1).max(150),
  description: z.string().trim().min(1).max(1000),
  image: z.string().min(1).max(14000000),
});
const passwordSchema = z.string().min(8).max(200);
const databaseBackupSettingsSchema = z.object({
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  retentionCount: z.number().int().min(1).max(90),
  directory: z.string().trim().min(1).max(1000),
});
const createBackupDirectorySchema = z.object({
  parentPath: z.string().min(1).max(1000),
  name: z.string().min(1).max(255),
});
const preferenceKeys = new Set(['favorites', 'likedArticleIds']);
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

function parseCookies(req: Request): Record<string, string> {
  const result: Record<string, string> = {};
  for (const part of (req.headers.cookie || '').split(';')) {
    const index = part.indexOf('=');
    if (index > 0) result[part.slice(0, index).trim()] = decodeURIComponent(part.slice(index + 1));
  }
  return result;
}

function sign(value: string): string {
  return crypto.createHmac('sha256', COOKIE_SECRET as string).update(value).digest('hex');
}

function signedVisitor(value?: string): { id: string; cookie: string } {
  if (value) {
    const [id, signature] = value.split('.');
    if (id && signature) {
      const expected = sign(id);
      if (signature.length === expected.length && crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return { id, cookie: value };
    }
  }
  const id = crypto.randomBytes(24).toString('hex');
  return { id, cookie: id + '.' + sign(id) };
}

function tokenHash(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function setCookie(res: Response, name: string, value: string, maxAge: number): void {
  const secure = process.env.COOKIE_SECURE === 'true' ? '; Secure' : '';
  res.append('Set-Cookie', name + '=' + encodeURIComponent(value) + '; Path=/; HttpOnly; SameSite=Strict; Max-Age=' + Math.floor(maxAge / 1000) + secure);
}

function clearCookie(res: Response, name: string): void {
  res.append('Set-Cookie', name + '=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0');
}

function visitorMiddleware(req: ShelterRequest, res: Response, next: NextFunction): void {
  const visitor = signedVisitor(parseCookies(req)[VISITOR_COOKIE]);
  req.visitorId = visitor.id;
  if (!parseCookies(req)[VISITOR_COOKIE]) setCookie(res, VISITOR_COOKIE, visitor.cookie, 365 * 24 * 60 * 60 * 1000);
  next();
}

async function requireAdmin(req: ShelterRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const token = parseCookies(req)[ADMIN_COOKIE];
    if (!token) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    const hash = tokenHash(token);
    if (!(await hasAdminSession(hash))) {
      clearCookie(res, ADMIN_COOKIE);
      res.status(401).json({ error: 'Session expired' });
      return;
    }
    req.adminTokenHash = hash;
    next();
  } catch (error) {
    next(error);
  }
}

function validate<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new Error(result.error.issues.map((issue) => issue.message).join(', '));
  return result.data;
}

const PUBLIC_ORIGIN = 'https://kind4cat.ru';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function plainText(value: string, maxLength = 190): string {
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function publicImageUrl(value?: string): string {
  if (!value || value.startsWith('data:') || value.includes('/src/assets/')) {
    return PUBLIC_ORIGIN + '/default_cat.jpg';
  }
  try {
    const url = new URL(value, PUBLIC_ORIGIN);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : PUBLIC_ORIGIN + '/default_cat.jpg';
  } catch {
    return PUBLIC_ORIGIN + '/default_cat.jpg';
  }
}

type SeoPage = {
  title: string;
  description: string;
  canonical: string;
  image: string;
  pageType: 'profile' | 'article' | 'collection';
  heading: string;
  eyebrow: string;
  body: string;
  keywords?: string[];
  tagLinks?: Array<{ label: string; url: string }>;
  relatedLinks?: Array<{ label: string; description: string; url: string }>;
  indexable?: boolean;
  structuredData: Record<string, unknown>;
};

function renderSeoDocument(template: string, page: SeoPage): string {
  const title = escapeHtml(page.title);
  const description = escapeHtml(page.description);
  const canonical = escapeHtml(page.canonical);
  const image = escapeHtml(page.image);
  const structuredData = JSON.stringify(page.structuredData).replace(/<\//g, '<\\/');
  const keywords = (page.keywords || []).map(normalizeArticleTag).filter(Boolean);
  const tags = page.tagLinks?.length
    ? '<nav aria-label="Темы публикации" style="display:flex;flex-wrap:wrap;gap:.5rem;margin:1rem 0">' + page.tagLinks.map((tag) =>
        '<a href="' + escapeHtml(tag.url) + '" style="padding:.4rem .65rem;border-radius:.5rem;background:#f5f5f4;color:#57534e">#' + escapeHtml(tag.label) + '</a>'
      ).join('') + '</nav>'
    : '';
  const related = page.relatedLinks?.length
    ? '<section aria-label="Публикации по теме"><h2>Публикации по теме</h2><ul>' + page.relatedLinks.map((link) =>
        '<li style="margin:.75rem 0"><a href="' + escapeHtml(link.url) + '"><strong>' + escapeHtml(link.label) + '</strong></a><br />' + escapeHtml(link.description) + '</li>'
      ).join('') + '</ul></section>'
    : '';
  const robots = page.indexable === false
    ? 'noindex, follow'
    : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1';
  const prerender = [
    '<section id="seo-prerender" data-page-type="' + page.pageType + '" style="max-width:72rem;margin:0 auto;padding:2rem 1rem;font-family:Arial,sans-serif;color:#292524">',
    '<p style="color:#b45309;font-weight:700">' + escapeHtml(page.eyebrow) + '</p>',
    '<h1>' + escapeHtml(page.heading) + '</h1>',
    '<img src="' + image + '" alt="' + escapeHtml(page.heading) + '" style="max-width:38rem;width:100%;height:auto;border-radius:1.5rem" />',
    '<p style="max-width:52rem;line-height:1.7">' + escapeHtml(page.body) + '</p>',
    tags,
    related,
    '<p><a href="/">Все котики и новости фонда «Доброта для кота»</a></p>',
    '</section>',
  ].join('');

  return template
    .replace(/<title>[\s\S]*?<\/title>/i, '<title>' + title + '</title>')
    .replace(/<meta name="description"[^>]*>/i, '<meta name="description" content="' + description + '" />')
    .replace(/<meta name="robots"[^>]*>/i, '<meta name="robots" content="' + robots + '" />')
    .replace(/<meta name="googlebot"[^>]*>/i, '<meta name="googlebot" content="' + robots + '" />')
    .replace(/<meta name="yandex"[^>]*>/i, '<meta name="yandex" content="' + (page.indexable === false ? 'noindex, follow' : 'index, follow') + '" />')
    .replace(/<link rel="canonical"[^>]*>/i, '<link rel="canonical" href="' + canonical + '" />')
    .replace(/<meta property="og:title"[^>]*>/i, '<meta property="og:title" content="' + title + '" />')
    .replace(/<meta property="og:description"[^>]*>/i, '<meta property="og:description" content="' + description + '" />')
    .replace(/<meta property="og:type"[^>]*>/i, '<meta property="og:type" content="' + (page.pageType === 'article' ? 'article' : 'website') + '" />')
    .replace(/<meta property="og:url"[^>]*>/i, '<meta property="og:url" content="' + canonical + '" />')
    .replace(/<meta property="og:image"[^>]*>/i, '<meta property="og:image" content="' + image + '" />')
    .replace('</head>', (keywords.length ? '<meta name="keywords" content="' + escapeHtml(keywords.join(', ')) + '" />' : '') + '<script type="application/ld+json">' + structuredData + '</script></head>')
    .replace('<div id="root"></div>', prerender + '<div id="root"></div>');
}

function catSeoPage(cat: Cat, cats: Cat[]): SeoPage {
  const canonical = PUBLIC_ORIGIN + catSeoPath(cat, cats);
  const description = plainText(cat.story || (cat.breed + ', ' + cat.age + '. Котик ищет ответственную семью в Санкт-Петербурге.'));
  const image = publicImageUrl(cat.photos?.[0]);
  return {
    title: cat.name + ' ищет дом в Санкт-Петербурге — Доброта для кота',
    description,
    canonical,
    image,
    pageType: 'profile',
    heading: cat.name + ' ищет дом',
    eyebrow: 'Анкета подопечного фонда «Доброта для кота»',
    body: description,
    structuredData: {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: cat.name + ' ищет дом',
      description,
      url: canonical,
      primaryImageOfPage: image,
      about: {
        '@type': 'Thing',
        name: cat.name,
        description,
        image,
      },
      isPartOf: { '@type': 'WebSite', name: 'Доброта для кота', url: PUBLIC_ORIGIN + '/' },
    },
  };
}

function articleSeoPage(article: ShelterArticle, articles: ShelterArticle[]): SeoPage {
  const canonical = PUBLIC_ORIGIN + articleSeoPath(article, articles);
  const description = plainText(article.summary || article.content);
  const body = plainText(article.content, 1000) || description;
  const image = publicImageUrl(article.coverImage);
  const tags = Array.from(new Map(
    (article.tags || [])
      .map(normalizeArticleTag)
      .filter(Boolean)
      .map((tag) => [articleTagSlug(tag), tag]),
  ).values());
  return {
    title: article.title + ' — Доброта для кота',
    description,
    canonical,
    image,
    pageType: 'article',
    heading: article.title,
    eyebrow: 'Новости и истории фонда «Доброта для кота»',
    body,
    keywords: tags,
    tagLinks: tags.map((tag) => ({ label: tag, url: articleTagPath(tag) })),
    structuredData: {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: article.title,
      description,
      keywords: tags,
      image: [image],
      datePublished: article.publishedAt,
      author: { '@type': 'Person', name: article.author },
      publisher: {
        '@type': 'Organization',
        name: 'Доброта для кота',
        logo: { '@type': 'ImageObject', url: PUBLIC_ORIGIN + '/favicon.svg' },
      },
      mainEntityOfPage: canonical,
    },
  };
}

function articleTagSeoPage(tag: string, articles: ShelterArticle[]): SeoPage {
  const normalizedTag = normalizeArticleTag(tag);
  const matchingArticles = articles.filter((article) =>
    (article.tags || []).some((candidate) => articleTagSlug(candidate) === articleTagSlug(normalizedTag)),
  );
  const canonical = PUBLIC_ORIGIN + articleTagPath(normalizedTag);
  const description = 'Новости, истории и мероприятия фонда «Доброта для кота» по теме «' + normalizedTag + '».';
  const itemList = matchingArticles.map((article, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    url: PUBLIC_ORIGIN + articleSeoPath(article, articles),
    name: article.title,
  }));

  return {
    title: '#' + normalizedTag + ' — новости фонда «Доброта для кота»',
    description,
    canonical,
    image: publicImageUrl(matchingArticles[0]?.coverImage),
    pageType: 'collection',
    heading: 'Публикации по теме #' + normalizedTag,
    eyebrow: 'Новости и истории фонда «Доброта для кота»',
    body: description,
    keywords: [normalizedTag],
    indexable: matchingArticles.length >= 2,
    relatedLinks: matchingArticles.map((article) => ({
      label: article.title,
      description: plainText(article.summary, 240),
      url: articleSeoPath(article, articles),
    })),
    structuredData: {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: 'Публикации по теме ' + normalizedTag,
      description,
      url: canonical,
      isPartOf: { '@type': 'WebSite', name: 'Доброта для кота', url: PUBLIC_ORIGIN + '/' },
      mainEntity: { '@type': 'ItemList', numberOfItems: itemList.length, itemListElement: itemList },
    },
  };
}

function collectArticleTags(articles: ShelterArticle[]): Array<{ label: string; slug: string; count: number }> {
  const tags = new Map<string, { label: string; slug: string; articleIds: Set<string> }>();
  for (const article of articles) {
    for (const rawTag of article.tags || []) {
      const label = normalizeArticleTag(rawTag);
      if (!label) continue;
      const slug = articleTagSlug(label);
      const existing = tags.get(slug) || { label, slug, articleIds: new Set<string>() };
      existing.articleIds.add(article.id);
      tags.set(slug, existing);
    }
  }
  return Array.from(tags.values()).map((tag) => ({
    label: tag.label,
    slug: tag.slug,
    count: tag.articleIds.size,
  }));
}

async function startServer() {
  const app = express();
  // Caddy terminates HTTPS on this computer and forwards requests over loopback.
  // Trust only local proxy addresses so req.protocol reflects X-Forwarded-Proto.
  app.set('trust proxy', 'loopback');
  const port = Number(process.env.PORT) || 3000;
  const databaseAttempts = 30;
  let stats: Awaited<ReturnType<typeof initDatabase>> | undefined;
  for (let attempt = 1; attempt <= databaseAttempts; attempt += 1) {
    try {
      stats = await initDatabase();
      break;
    } catch (error) {
      if (attempt === databaseAttempts) throw error;
      const message = error instanceof Error ? error.message : String(error);
      console.warn('[Database] Not ready (' + attempt + '/' + databaseAttempts + '): ' + message + '. Retrying in 2 seconds.');
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
  if (!stats) throw new Error('PostgreSQL initialization did not complete');
  console.log('[Database] PostgreSQL ready. Cats: ' + stats.catsCount + ', applications: ' + stats.appsCount + ', articles: ' + stats.articlesCount);
  await startAutomaticBackupScheduler();

  app.disable('x-powered-by');
  app.use(express.json({ limit: '60mb' }));
  app.use(express.urlencoded({ extended: true, limit: '60mb' }));
  app.get('/media/:fileName', async (req, res, next) => {
    try {
      const asset = await getMediaAsset(req.params.fileName);
      if (!asset) {
        res.status(404).type('text/plain').send('Медиафайл не найден');
        return;
      }

      const etag = `"${asset.fileName.split('.')[0]}"`;
      res.setHeader('Content-Type', asset.mimeType);
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.setHeader('ETag', etag);
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      if (req.headers['if-none-match'] === etag) {
        res.status(304).end();
        return;
      }

      const range = req.headers.range;
      if (range) {
        const match = /^bytes=(\d*)-(\d*)$/.exec(range);
        if (!match) {
          res.status(416).setHeader('Content-Range', `bytes */${asset.content.length}`).end();
          return;
        }
        const start = match[1] ? Number(match[1]) : 0;
        const end = match[2] ? Number(match[2]) : asset.content.length - 1;
        if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end < start || end >= asset.content.length) {
          res.status(416).setHeader('Content-Range', `bytes */${asset.content.length}`).end();
          return;
        }
        res.status(206);
        res.setHeader('Content-Range', `bytes ${start}-${end}/${asset.content.length}`);
        res.setHeader('Content-Length', String(end - start + 1));
        res.end(asset.content.subarray(start, end + 1));
        return;
      }

      res.setHeader('Content-Length', String(asset.content.length));
      res.end(asset.content);
    } catch (error) { next(error); }
  });
  app.get('/sitemap.xml', async (_req, res, next) => {
    try {
      const [cats, articles] = await Promise.all([getAllCats(), getAllArticles()]);
      const lastModified = new Date().toISOString().slice(0, 10);
      const urls = [
        PUBLIC_ORIGIN + '/',
        ...cats.map((cat) => PUBLIC_ORIGIN + catSeoPath(cat, cats)),
        ...articles.map((article) => PUBLIC_ORIGIN + articleSeoPath(article, articles)),
        ...collectArticleTags(articles)
          .filter((tag) => tag.count >= 2)
          .map((tag) => PUBLIC_ORIGIN + articleTagPath(tag.label)),
      ];
      const xml = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        ...urls.map((url, index) => [
          '  <url>',
          '    <loc>' + escapeHtml(url) + '</loc>',
          '    <lastmod>' + lastModified + '</lastmod>',
          '    <changefreq>' + (index === 0 ? 'daily' : 'weekly') + '</changefreq>',
          '    <priority>' + (index === 0 ? '1.0' : '0.8') + '</priority>',
          '  </url>',
        ].join('\n')),
        '</urlset>',
      ].join('\n');
      res.type('application/xml').set('Cache-Control', 'public, max-age=3600').send(xml);
    } catch (error) {
      next(error);
    }
  });
  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Referrer-Policy', 'same-origin');
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.headers.origin) {
      const expected = req.protocol + '://' + req.get('host');
      if (req.headers.origin !== expected) {
        res.status(403).json({ error: 'Invalid request origin' });
        return;
      }
    }
    next();
  });
  app.use('/api', visitorMiddleware);

  app.get('/api/health', async (_req, res, next) => {
    try { res.json({ status: 'ok', storage: 'postgresql', stats: await getDatabaseStats() }); } catch (error) { next(error); }
  });
  app.post('/api/analytics/visit', async (req: ShelterRequest, res, next) => {
    try {
      await recordSiteVisit(req.visitorId as string);
      res.json({ success: true });
    } catch (error) { next(error); }
  });

  app.get('/api/bootstrap', async (req: ShelterRequest, res, next) => {
    try { res.json(await getBootstrapData(req.visitorId as string)); } catch (error) { next(error); }
  });

  app.get('/api/cats', async (_req, res, next) => {
    try { res.json(await getAllCats()); } catch (error) { next(error); }
  });
  app.post('/api/cats', requireAdmin, async (req, res, next) => {
    try { res.status(201).json(await saveCat(validate(objectSchema, req.body))); } catch (error) { next(error); }
  });
  app.put('/api/cats/:id', requireAdmin, async (req, res, next) => {
    try { res.json(await saveCat({ ...validate(objectSchema, req.body), id: req.params.id })); } catch (error) { next(error); }
  });
  app.delete('/api/cats/:id', requireAdmin, async (req, res, next) => {
    try { res.json({ success: await deleteCat(req.params.id) }); } catch (error) { next(error); }
  });

  app.get('/api/my/applications', async (req: ShelterRequest, res, next) => {
    try { res.json(await getApplicationsForOwner(req.visitorId as string)); } catch (error) { next(error); }
  });
  app.post('/api/applications', async (req: ShelterRequest, res, next) => {
    try {
      const data = validate(objectSchema, req.body);
      if (typeof data.applicantName !== 'string' || typeof data.phone !== 'string') return res.status(400).json({ error: 'Applicant name and phone are required' });
      const catId = typeof data.catId === 'string' ? data.catId : '';
      const cat = (await getAllCats()).find((candidate) => candidate.id === catId);
      if (!cat) return res.status(400).json({ error: 'Выберите котика из каталога' });
      if (cat.status !== 'available') {
        const message = cat.status === 'reserved'
          ? 'Этот котик сейчас на бронировании. Приём заявок закрыт.'
          : cat.status === 'trial'
            ? 'Этот котик сейчас на испытательном сроке. Приём заявок закрыт.'
            : 'Этот котик уже дома. Приём заявок закрыт.';
        return res.status(409).json({ error: message });
      }
      res.status(201).json(await createApplication(req.visitorId as string, data as never));
    } catch (error) { next(error); }
  });
  app.get('/api/applications', requireAdmin, async (_req, res, next) => {
    try { res.json(await getAllApplications()); } catch (error) { next(error); }
  });
  app.patch('/api/applications/:id', requireAdmin, async (req, res, next) => {
    try {
      const updates = validate(z.object({ status: z.enum(['new', 'reviewing', 'meeting_scheduled', 'approved', 'rejected']), adminNotes: z.string().max(5000).optional() }), req.body);
      const application = await updateApplication(req.params.id, updates);
      if (!application) return res.status(404).json({ error: 'Application not found' });
      res.json(application);
    } catch (error) { next(error); }
  });
  app.delete('/api/applications/:id', requireAdmin, async (req, res, next) => {
    try { res.json({ success: await deleteApplication(req.params.id) }); } catch (error) { next(error); }
  });

  app.get('/api/articles', async (_req, res, next) => {
    try { res.json(await getAllArticles()); } catch (error) { next(error); }
  });
  app.post('/api/articles', requireAdmin, async (req, res, next) => {
    try { res.status(201).json(await createArticle(validate(objectSchema, req.body) as never)); } catch (error) { next(error); }
  });
  app.put('/api/articles/:id', requireAdmin, async (req, res, next) => {
    try {
      const article = await updateArticle(req.params.id, validate(objectSchema, req.body) as never);
      if (!article) return res.status(404).json({ error: 'Article not found' });
      res.json(article);
    } catch (error) { next(error); }
  });  app.delete('/api/articles/:id', requireAdmin, async (req, res, next) => {
    try { res.json({ success: await deleteArticle(req.params.id) }); } catch (error) { next(error); }
  });
  app.post('/api/articles/:id/like', async (req, res, next) => {
    try { res.json({ likesCount: await toggleArticleLike(req.params.id) }); } catch (error) { next(error); }
  });

  app.get('/api/site-stats', async (_req, res, next) => {
    try { res.json(await getShelterStats()); } catch (error) { next(error); }
  });
  app.put('/api/site-stats', requireAdmin, async (req, res, next) => {
    try { res.json(await setShelterStats(validate(shelterStatsSchema, req.body))); } catch (error) { next(error); }
  });

  app.get('/api/site-contacts', async (_req, res, next) => {
    try { res.json(await getSiteContacts()); } catch (error) { next(error); }
  });
  app.put('/api/site-contacts', requireAdmin, async (req, res, next) => {
    try { res.json(await setSiteContacts(validate(siteContactsSchema, req.body))); } catch (error) { next(error); }
  });

  app.get('/api/donation-settings', async (_req, res, next) => {
    try { res.json(await getDonationSettings()); } catch (error) { next(error); }
  });
  app.put('/api/donation-settings', requireAdmin, async (req, res, next) => {
    try { res.json(await setDonationSettings(validate(donationSettingsSchema, req.body))); } catch (error) { next(error); }
  });

  app.get('/api/preferences', async (req: ShelterRequest, res, next) => {
    try { res.json(await getPreferences(req.visitorId as string)); } catch (error) { next(error); }
  });
  app.post('/api/preferences', async (req: ShelterRequest, res, next) => {
    try {
      const body = validate(z.object({ key: z.string(), value: z.unknown() }), req.body);
      if (!preferenceKeys.has(body.key)) return res.status(400).json({ error: 'Unsupported preference' });
      await setPreference(req.visitorId as string, body.key, body.value);
      res.json({ success: true });
    } catch (error) { next(error); }
  });

  app.get('/api/admin/session', requireAdmin, (_req, res) => res.json({ authenticated: true }));
  app.get('/api/admin/cat-ratings', requireAdmin, async (_req, res, next) => {
    try { res.json(await getCatRatings()); } catch (error) { next(error); }
  });
  app.get('/api/admin/visit-analytics', requireAdmin, async (req, res, next) => {
    try {
      const days = validate(z.coerce.number().int().min(7).max(90).default(30), req.query.days);
      res.json(await getVisitAnalytics(days));
    } catch (error) { next(error); }
  });
  app.post('/api/admin/auth', async (req, res, next) => {
    try {
      const ip = req.ip || 'unknown';
      const now = Date.now();
      const state = loginAttempts.get(ip);
      if (state && state.resetAt > now && state.count >= 5) return res.status(429).json({ error: 'Too many login attempts' });
      const password = validate(z.string().min(1).max(200), req.body?.password);
      if (!(await verifyAdminPassword(password))) {
        const current = state && state.resetAt > now ? state : { count: 0, resetAt: now + 15 * 60 * 1000 };
        current.count += 1;
        loginAttempts.set(ip, current);
        return res.status(401).json({ authenticated: false });
      }
      loginAttempts.delete(ip);
      const token = crypto.randomBytes(32).toString('hex');
      await createAdminSession(tokenHash(token), new Date(now + SESSION_MS));
      setCookie(res, ADMIN_COOKIE, token, SESSION_MS);
      res.json({ authenticated: true });
    } catch (error) { next(error); }
  });
  app.post('/api/admin/logout', async (req: ShelterRequest, res, next) => {
    try {
      const token = parseCookies(req)[ADMIN_COOKIE];
      if (token) await deleteAdminSession(tokenHash(token));
      clearCookie(res, ADMIN_COOKIE);
      res.json({ success: true });
    } catch (error) { next(error); }
  });
  app.post('/api/admin/password', requireAdmin, async (req, res, next) => {
    try {
      const oldPassword = validate(z.string().min(1).max(200), req.body?.oldPassword);
      const newPassword = validate(passwordSchema, req.body?.newPassword);
      const result = await changeAdminPassword(oldPassword, newPassword);
      if (!result.success) return res.status(400).json(result);
      clearCookie(res, ADMIN_COOKIE);
      res.json(result);
    } catch (error) { next(error); }
  });

  app.get('/api/database/stats', requireAdmin, async (_req, res, next) => {
    try { res.json(await getDatabaseStats()); } catch (error) { next(error); }
  });
  app.get('/api/database/backup-schedule', requireAdmin, async (_req, res, next) => {
    try { res.json(await getAutomaticBackupStatus()); } catch (error) { next(error); }
  });
  app.get('/api/database/backup-directories', requireAdmin, async (req, res, next) => {
    try {
      const requestedPath = typeof req.query.path === 'string' ? req.query.path : undefined;
      res.json(await browseServerDirectories(requestedPath));
    } catch (error) { next(error); }
  });
  app.post('/api/database/backup-directories', requireAdmin, async (req, res, next) => {
    try {
      const input = validate(createBackupDirectorySchema, req.body);
      res.status(201).json(await createServerDirectory(input.parentPath, input.name));
    } catch (error) { next(error); }
  });
  app.put('/api/database/backup-schedule', requireAdmin, async (req, res, next) => {
    try {
      const settings = validate(databaseBackupSettingsSchema, req.body);
      const directory = await assertBackupDirectoryWritable(settings.directory);
      await setDatabaseBackupSettings({ ...settings, directory });
      res.json(await reloadAutomaticBackupScheduler());
    } catch (error) { next(error); }
  });
  app.get('/api/database/export', requireAdmin, async (_req, res, next) => {
    try {
      const backupPath = await createPostgresBackup();
      const date = new Date().toISOString().slice(0, 10);
      res.setHeader('Content-Type', 'application/octet-stream');
      res.download(backupPath, `cat_shelter_postgres_${date}.backup`, async (error) => {
        await removeTemporaryBackup(backupPath);
        if (error && !res.headersSent) next(error);
      });
    } catch (error) { next(error); }
  });
  app.post('/api/database/import', requireAdmin, express.raw({ type: 'application/octet-stream', limit: '250mb' }), async (req: ShelterRequest, res, next) => {
    try {
      if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
        res.status(400).json({ success: false, error: 'Файл резервной копии пуст или не передан' });
        return;
      }
      await restorePostgresBackup(req.body);
      await initDatabase();
      await reloadAutomaticBackupScheduler();
      if (req.adminTokenHash) {
        await deleteAdminSession(req.adminTokenHash);
        await createAdminSession(req.adminTokenHash, new Date(Date.now() + SESSION_MS));
      }
      res.json({ success: true, stats: await getDatabaseStats() });
    } catch (error) { next(error); }
  });
  app.use('/api', (error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    console.error('[API]', message);
    res.status(message.includes('required') || message.includes('Expected') ? 400 : 500).json({ error: message });
  });

  if (!isProduction) {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    const indexTemplate = fs.readFileSync(path.join(distPath, 'index.html'), 'utf8');
    app.get('/news/tag/:tag', async (req, res, next) => {
      try {
        const articles = await getAllArticles();
        const tag = findArticleTagBySlug(req.params.tag, articles);
        if (!tag) {
          res.status(404).type('text/plain').send('Тема не найдена');
          return;
        }
        res
          .set('Cache-Control', 'public, max-age=300')
          .type('text/html')
          .send(renderSeoDocument(indexTemplate, articleTagSeoPage(tag, articles)));
      } catch (error) {
        next(error);
      }
    });
    app.get(['/cats/:slug', '/news/:slug'], async (req, res, next) => {
      try {
        const [cats, articles] = await Promise.all([getAllCats(), getAllArticles()]);
        let page: SeoPage | null = null;
        if (req.path.startsWith('/cats/')) {
          const cat = findBySeoSlug(req.params.slug, cats, (candidate) => candidate.name, 'kotik');
          if (cat) page = catSeoPage(cat, cats);
        } else {
          const article = findBySeoSlug(req.params.slug, articles, (candidate) => candidate.title, 'novost');
          if (article) page = articleSeoPage(article, articles);
        }
        if (!page) {
          res.status(404).type('text/plain').send('Материал не найден');
          return;
        }
        res
          .set('Cache-Control', 'public, max-age=300')
          .type('text/html')
          .send(renderSeoDocument(indexTemplate, page));
      } catch (error) {
        next(error);
      }
    });
    app.use('/assets', express.static(path.join(distPath, 'assets'), {
      immutable: true,
      maxAge: '1y',
    }));
    app.use(express.static(distPath, {
      maxAge: '1h',
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('index.html')) res.setHeader('Cache-Control', 'no-cache');
      },
    }));
    app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  if (httpsEnabled) {
    const keyPath = path.resolve(process.cwd(), process.env.TLS_KEY_PATH || 'certs/server.key');
    const certPath = path.resolve(process.cwd(), process.env.TLS_CERT_PATH || 'certs/server.crt');
    const server = https.createServer({
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(certPath),
      minVersion: 'TLSv1.2',
    }, app);
    server.listen(port, listenHost, () => console.log('[Server] https://' + listenHost + ':' + port));
  } else {
    app.listen(port, listenHost, () => console.log('[Server] http://' + listenHost + ':' + port));
  }
}

startServer().catch((error) => {
  console.error('[Server Error]', error instanceof Error ? error.message : error);
  process.exit(1);
});














