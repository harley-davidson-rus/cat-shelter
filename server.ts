import 'dotenv/config';
import express, { NextFunction, Request, Response } from 'express';
import fs from 'fs';
import https from 'https';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import crypto from 'crypto';
import { z } from 'zod';
import QRCode from 'qrcode';
import nodemailer from 'nodemailer';
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
  authenticateUser, createUserSession, deleteUserSession, getUserBySession, attachUserCat, setPendingUserCat,
  registerOwner, resendVerification, verifyRegistration, createPasswordReset, resetPassword,
  changeUserPassword, updateUserProfile, listUsers, createStaffUser, updateManagedUser, assignUserCats, deleteManagedUser,
  getCatsForOwner, getOwnerContentForCat, getPendingOwnerContent, createOwnerContent, updateOwnerContent,
  deleteOwnerContent, moderateOwnerContent,
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
import { ensureBrowserCompatibleVideo } from './server/videoTranscode';
import type { Cat, OwnerContent, ShelterArticle, UserAccount, UserRole } from './src/types';
import {
  articleSeoPath,
  articleTagPath,
  articleTagSlug,
  catSeoPath,
  findArticleTagBySlug,
  findBySeoSlug,
  normalizeArticleTag,
} from './src/utils/seo';
import { PASSWORD_REQUIREMENTS } from './src/utils/password';

const ADMIN_COOKIE = process.env.SESSION_COOKIE_NAME || 'shelter_admin_session';
const VISITOR_COOKIE = process.env.VISITOR_COOKIE_NAME || 'shelter_visitor';
const SESSION_MS = 12 * 60 * 60 * 1000;
const COOKIE_SECRET = process.env.COOKIE_SECRET;
const isProduction = process.env.NODE_ENV === 'production' || process.argv.includes('--production');
const httpsEnabled = process.env.HTTPS_ENABLED === 'true';
const listenHost = process.env.HOST || '127.0.0.1';
if (!COOKIE_SECRET || COOKIE_SECRET.length < 32) throw new Error('COOKIE_SECRET must contain at least 32 characters');

type ShelterRequest = Request & { visitorId?: string; adminTokenHash?: string; user?: UserAccount };

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
const passwordSchema = z.string()
  .min(8, 'Пароль должен содержать минимум 8 символов')
  .max(200, 'Пароль не должен быть длиннее 200 символов')
  .regex(/[a-z]/, 'Пароль должен содержать строчную латинскую букву')
  .regex(/[A-Z]/, 'Пароль должен содержать заглавную латинскую букву')
  .regex(/[0-9]/, 'Пароль должен содержать цифру');
const emailSchema = z.string().trim().email().max(320);
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

function catInviteSignature(catId: string): string {
  return sign(`cat-invite:${catId}`);
}

function catRegistrationUrl(catId: string): string {
  return `${PUBLIC_ORIGIN}/?register=1&catId=${encodeURIComponent(catId)}&invite=${catInviteSignature(catId)}`;
}

function isValidCatInvite(catId: string, signature: string): boolean {
  const expected = catInviteSignature(catId);
  return signature.length === expected.length
    && crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

async function resolveInvitedCat(catId?: string, invite?: string): Promise<Cat | undefined> {
  if (!catId && !invite) return undefined;
  if (!catId || !invite || !isValidCatInvite(catId, invite)) {
    throw Object.assign(new Error('Ссылка привязки котика недействительна'), { status: 400 });
  }
  const cat = (await getAllCats()).find((candidate) => candidate.id === catId);
  if (!cat) throw Object.assign(new Error('Котик из ссылки не найден'), { status: 404 });
  return cat;
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
    const user = await getUserBySession(hash);
    if (!user || !['administrator', 'curator'].includes(user.role)) {
      clearCookie(res, ADMIN_COOKIE);
      res.status(401).json({ error: 'Session expired' });
      return;
    }
    req.adminTokenHash = hash;
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

async function optionalUser(req: ShelterRequest, _res: Response, next: NextFunction): Promise<void> {
  try {
    const token = parseCookies(req)[ADMIN_COOKIE];
    if (token) {
      const hash = tokenHash(token);
      const user = await getUserBySession(hash);
      if (user) {
        req.adminTokenHash = hash;
        req.user = user;
      }
    }
    next();
  } catch (error) { next(error); }
}

async function requireUser(req: ShelterRequest, res: Response, next: NextFunction): Promise<void> {
  await optionalUser(req, res, () => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    next();
  });
}

function requireRole(...roles: UserRole[]) {
  return (req: ShelterRequest, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Недостаточно прав для выполнения действия' });
      return;
    }
    next();
  };
}

function validate<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    const error = new Error(result.error.issues.map((issue) => issue.message).join(', ')) as Error & { status: number };
    error.status = 400;
    throw error;
  }
  return result.data;
}

const CANONICAL_PUBLIC_ORIGIN = 'https://kind4cat.ru';

function resolvePublicOrigin(): string {
  const configuredOrigin = (process.env.PUBLIC_ORIGIN || CANONICAL_PUBLIC_ORIGIN).replace(/\/$/, '');
  let parsedOrigin: URL;
  try {
    parsedOrigin = new URL(configuredOrigin);
  } catch {
    throw new Error('PUBLIC_ORIGIN must be a valid absolute URL');
  }
  if (!['http:', 'https:'].includes(parsedOrigin.protocol) || parsedOrigin.origin !== configuredOrigin) {
    throw new Error('PUBLIC_ORIGIN must contain only the http(s) origin without a path, query, or hash');
  }
  if (isProduction && parsedOrigin.origin !== CANONICAL_PUBLIC_ORIGIN) {
    throw new Error(`Production PUBLIC_ORIGIN must be ${CANONICAL_PUBLIC_ORIGIN}`);
  }
  return parsedOrigin.origin;
}

const PUBLIC_ORIGIN = resolvePublicOrigin();

async function sendTransactionalEmail(to: string, subject: string, text: string): Promise<void> {
  const webhook = process.env.EMAIL_DELIVERY_WEBHOOK;
  if (webhook) {
    const response = await fetch(webhook, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.EMAIL_DELIVERY_TOKEN ? { Authorization: `Bearer ${process.env.EMAIL_DELIVERY_TOKEN}` } : {}),
      },
      body: JSON.stringify({ to, subject, text }),
    });
    if (!response.ok) throw Object.assign(new Error('Сервис отправки писем временно недоступен'), { status: 503 });
    return;
  }

  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const password = process.env.SMTP_PASSWORD;
  const from = process.env.EMAIL_FROM || user;
  if (!host || !user || !password || !from) {
    throw Object.assign(new Error('Отправка писем не настроена. Укажите SMTP_HOST, SMTP_USER, SMTP_PASSWORD и EMAIL_FROM.'), { status: 503 });
  }
  const port = Number(process.env.SMTP_PORT || 587);
  const transport = nodemailer.createTransport({
    host,
    port,
    secure: process.env.SMTP_SECURE === 'true' || port === 465,
    auth: { user, pass: password },
  });
  await transport.sendMail({ from, to, subject, text });
}

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

function renderHomeSeoDocument(template: string, cats: Cat[], articles: ShelterArticle[]): string {
  const catLinks = cats.map((cat) =>
    '<li><a href="' + escapeHtml(catSeoPath(cat, cats)) + '">' + escapeHtml(cat.name) + '</a></li>'
  ).join('');
  const articleLinks = articles.map((article) =>
    '<li><a href="' + escapeHtml(articleSeoPath(article, articles)) + '">' + escapeHtml(article.title) + '</a></li>'
  ).join('');
  const prerender = [
    '<main id="seo-prerender" style="max-width:72rem;margin:0 auto;padding:2rem 1rem;font-family:Arial,sans-serif;color:#292524">',
    '<h1>Фонд помощи животным «Доброта для кота»</h1>',
    '<p>Анкеты котиков, которые ищут ответственный и любящий дом, и новости фонда.</p>',
    '<section><h2>Анкеты котиков</h2><ul>', catLinks, '</ul></section>',
    '<section><h2>Новости и истории</h2><ul>', articleLinks, '</ul></section>',
    '</main>',
  ].join('');
  return template.replace('<div id="root"></div>', prerender + '<div id="root"></div>');
}

function renderCatGameDemoDocument(template: string): string {
  const title = 'Поиграть с Мраморкой — Доброта для кота';
  const description = 'Экспериментальная игровая комната ласковой кошечки Мраморки.';
  return template
    .replace(/<title>[\s\S]*?<\/title>/i, '<title>' + title + '</title>')
    .replace(/<meta name="description"[^>]*>/i, '<meta name="description" content="' + description + '" />')
    .replace(/<meta name="robots"[^>]*>/i, '<meta name="robots" content="noindex, nofollow" />')
    .replace(/<meta name="googlebot"[^>]*>/i, '<meta name="googlebot" content="noindex, nofollow" />')
    .replace(/<meta name="yandex"[^>]*>/i, '<meta name="yandex" content="noindex, nofollow" />')
    .replace(/<link rel="canonical"[^>]*>/i, '<link rel="canonical" href="' + PUBLIC_ORIGIN + '/cat-game-demo" />')
    .replace(/<meta property="og:title"[^>]*>/i, '<meta property="og:title" content="' + title + '" />')
    .replace(/<meta property="og:description"[^>]*>/i, '<meta property="og:description" content="' + description + '" />')
    .replace(/<meta property="og:url"[^>]*>/i, '<meta property="og:url" content="' + PUBLIC_ORIGIN + '/cat-game-demo" />');
}

function sitemapDate(...values: Array<string | undefined>): string {
  const timestamps = values
    .map((value) => value ? Date.parse(value) : Number.NaN)
    .filter((value) => Number.isFinite(value));
  return new Date(timestamps.length ? Math.max(...timestamps) : Date.now()).toISOString().slice(0, 10);
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
      const tags = collectArticleTags(articles).filter((tag) => tag.count >= 2);
      const entries = [
        {
          url: PUBLIC_ORIGIN + '/',
          lastModified: sitemapDate(
            ...cats.flatMap((cat) => [cat.updatedAt, cat.createdAt]),
            ...articles.flatMap((article) => [article.updatedAt, article.createdAt]),
          ),
          changeFrequency: 'daily',
          priority: '1.0',
        },
        ...cats.map((cat) => ({
          url: PUBLIC_ORIGIN + catSeoPath(cat, cats),
          lastModified: sitemapDate(cat.updatedAt, cat.createdAt),
          changeFrequency: 'weekly',
          priority: '0.8',
        })),
        ...articles.map((article) => ({
          url: PUBLIC_ORIGIN + articleSeoPath(article, articles),
          lastModified: sitemapDate(article.updatedAt, article.createdAt),
          changeFrequency: 'weekly',
          priority: '0.8',
        })),
        ...tags.map((tag) => {
          const matchingArticles = articles.filter((article) =>
            (article.tags || []).some((candidate) => articleTagSlug(candidate) === tag.slug)
          );
          return {
            url: PUBLIC_ORIGIN + articleTagPath(tag.label),
            lastModified: sitemapDate(
              ...matchingArticles.flatMap((article) => [article.updatedAt, article.createdAt]),
            ),
            changeFrequency: 'weekly',
            priority: '0.8',
          };
        }),
      ];
      const xml = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        ...entries.map((entry) => [
          '  <url>',
          '    <loc>' + escapeHtml(entry.url) + '</loc>',
          '    <lastmod>' + entry.lastModified + '</lastmod>',
          '    <changefreq>' + entry.changeFrequency + '</changefreq>',
          '    <priority>' + entry.priority + '</priority>',
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
  app.put('/api/site-stats', requireAdmin, requireRole('administrator'), async (req, res, next) => {
    try { res.json(await setShelterStats(validate(shelterStatsSchema, req.body))); } catch (error) { next(error); }
  });

  app.get('/api/site-contacts', async (_req, res, next) => {
    try { res.json(await getSiteContacts()); } catch (error) { next(error); }
  });
  app.put('/api/site-contacts', requireAdmin, requireRole('administrator'), async (req, res, next) => {
    try { res.json(await setSiteContacts(validate(siteContactsSchema, req.body))); } catch (error) { next(error); }
  });

  app.get('/api/donation-settings', async (_req, res, next) => {
    try { res.json(await getDonationSettings()); } catch (error) { next(error); }
  });
  app.put('/api/donation-settings', requireAdmin, requireRole('administrator'), async (req, res, next) => {
    try { res.json(await setDonationSettings(validate(donationSettingsSchema, req.body))); } catch (error) { next(error); }
  });

  app.get('/api/cats/:id/memo-print', requireAdmin, async (req, res, next) => {
    try {
      const cat = (await getAllCats()).find((candidate) => candidate.id === req.params.id);
      if (!cat) return res.status(404).type('text/plain').send('Котик не найден');
      const registrationUrl = catRegistrationUrl(cat.id);
      const qrCode = await QRCode.toDataURL(registrationUrl, { width: 220, margin: 1, errorCorrectionLevel: 'M' });
      res.type('html').send(`<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>Памятка — ${escapeHtml(cat.name)}</title><style>
        body{font-family:Arial,sans-serif;color:#1c1917;margin:0}.memo{box-sizing:border-box;min-height:100vh;padding:24mm 20mm;display:grid;grid-template-columns:1fr 48mm;gap:12mm;align-items:start}.memo h1{font-size:22pt;margin:0 0 8mm}.memo h2{font-size:15pt;margin:0 0 4mm}.memo p,.memo li{font-size:11pt;line-height:1.45}.qr{text-align:center}.qr img{width:48mm;height:48mm}.qr a{font-size:8pt;word-break:break-all}.actions{position:fixed;right:16px;top:16px;display:flex;align-items:flex-start;gap:8px;z-index:2}.email-form{display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end;max-width:560px}.email-form input{box-sizing:border-box;width:260px;padding:10px 12px;border:1px solid #d6d3d1;border-radius:10px;font:14px Arial;background:white}.actions button{font:600 14px Arial;padding:10px 14px;border-radius:10px;border:0;background:#f59e0b;color:white;cursor:pointer;white-space:nowrap}.actions button.secondary{background:#1c1917}.actions button:disabled{opacity:.6;cursor:wait}.email-status{flex-basis:100%;text-align:right;font-size:12px;color:#166534;min-height:15px}.email-status.error{color:#be123c}@media(max-width:850px){.actions{position:static;padding:12px;justify-content:flex-end;flex-wrap:wrap}.memo{padding-top:12mm}.email-form input{width:220px}}@media print{.actions{display:none}}
      </style></head><body><div class="actions"><form id="email-form" class="email-form"><input id="recipient-email" type="email" required autocomplete="email" placeholder="E-mail получателя" aria-label="E-mail получателя"><button id="email-submit" class="secondary" type="submit">Отправить на e-mail</button><span id="email-status" class="email-status" role="status"></span></form><button type="button" onclick="window.print()">Печать памятки</button></div><section class="memo"><div><h1>Памятка нового хозяина</h1><h2>Котик: ${escapeHtml(cat.name)}</h2><p>Отсканируйте QR-код. Ссылка уже содержит защищённую привязку к этому котику.</p><ul><li>Если у вас уже есть аккаунт владельца, выберите вход — котик сразу появится в личном кабинете.</li><li>Если аккаунта ещё нет, зарегистрируйтесь и подтвердите e-mail; после подтверждения котик будет привязан автоматически.</li><li>${PASSWORD_REQUIREMENTS}</li><li>Если письма нет, проверьте папку «Спам».</li><li>В личном кабинете можно задавать вопросы и публиковать фото, короткие видео и свои заметки о котике.</li></ul></div><div class="qr"><img src="${qrCode}" alt="QR-код привязки котика"><p><a href="${registrationUrl}">${registrationUrl}</a></p></div></section><script>
        document.getElementById('email-form').addEventListener('submit',async function(event){event.preventDefault();var input=document.getElementById('recipient-email');var button=document.getElementById('email-submit');var status=document.getElementById('email-status');button.disabled=true;status.className='email-status';status.textContent='Отправляем…';try{var response=await fetch('/api/cats/${encodeURIComponent(cat.id)}/memo-email',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:input.value})});var result=await response.json();if(!response.ok)throw new Error(result.error||'Не удалось отправить письмо');status.textContent=result.message||'Письмо отправлено.';}catch(error){status.className='email-status error';status.textContent=error instanceof Error?error.message:'Не удалось отправить письмо';}finally{button.disabled=false;}});
      </script></body></html>`);
    } catch (error) { next(error); }
  });

  app.post('/api/cats/:id/memo-email', requireAdmin, async (req, res, next) => {
    try {
      const email = validate(emailSchema, req.body?.email);
      const cat = (await getAllCats()).find((candidate) => candidate.id === req.params.id);
      if (!cat) return res.status(404).json({ error: 'Котик не найден' });
      const registrationUrl = catRegistrationUrl(cat.id);
      await sendTransactionalEmail(
        email,
        `Памятка нового хозяина — ${cat.name}`,
        `Памятка нового хозяина\n\nКотик: ${cat.name}\n\nПерейдите по защищённой ссылке, чтобы войти или зарегистрироваться и привязать котика к личному кабинету:\n${registrationUrl}\n\nЕсли у вас уже есть аккаунт владельца, выберите вход. Если аккаунта ещё нет, зарегистрируйтесь и подтвердите e-mail.\n\n${PASSWORD_REQUIREMENTS} Если письма подтверждения нет, проверьте папку «Спам».`,
      );
      res.json({ success: true, message: `Памятка отправлена на ${email}` });
    } catch (error) { next(error); }
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

  app.post('/api/auth/register', async (req, res, next) => {
    try {
      const input = validate(z.object({
        email: emailSchema,
        password: passwordSchema,
        passwordConfirm: z.string(),
        displayName: z.string().trim().max(120).optional(),
        catId: z.string().trim().min(1).max(200).optional(),
        invite: z.string().trim().min(1).max(200).optional(),
      }), req.body);
      if (input.password !== input.passwordConfirm) return res.status(400).json({ error: 'Пароли не совпадают' });
      const invitedCat = await resolveInvitedCat(input.catId, input.invite);
      const registration = await registerOwner(input.email, input.password, input.displayName, invitedCat?.id);
      const verifyUrl = `${PUBLIC_ORIGIN}/?verify=${encodeURIComponent(registration.token)}`;
      await sendTransactionalEmail(
        registration.user.email,
        'Подтвердите регистрацию в «Доброта для кота»',
        `Для подтверждения регистрации перейдите по ссылке: ${verifyUrl}\n\nЕсли вы не создавали аккаунт, проигнорируйте письмо.`,
      );
      res.status(201).json({ message: 'Письмо отправлено. Подтвердите регистрацию по ссылке из письма. Если письма нет, проверьте папку «Спам».' });
    } catch (error) { next(error); }
  });
  app.post('/api/auth/resend-verification', async (req, res, next) => {
    try {
      const email = validate(emailSchema, req.body?.email);
      const token = await resendVerification(email);
      if (token) {
        const verifyUrl = `${PUBLIC_ORIGIN}/?verify=${encodeURIComponent(token)}`;
        await sendTransactionalEmail(email, 'Новая ссылка подтверждения регистрации', `Подтвердите регистрацию: ${verifyUrl}`);
      }
      res.json({ message: 'Если регистрация ожидает подтверждения, новое письмо отправлено. Проверьте также папку «Спам».' });
    } catch (error) { next(error); }
  });
  app.post('/api/auth/verify', async (req, res, next) => {
    try {
      const token = validate(z.string().min(32).max(200), req.body?.token);
      const user = await verifyRegistration(token);
      if (!user) return res.status(400).json({ error: 'Ссылка недействительна или срок её действия истёк' });
      res.json({ message: 'Регистрация подтверждена. Теперь вы можете войти.', user });
    } catch (error) { next(error); }
  });
  app.post('/api/auth/request-password-reset', async (req, res, next) => {
    try {
      const email = validate(emailSchema, req.body?.email);
      const token = await createPasswordReset(email);
      if (token) {
        const resetUrl = `${PUBLIC_ORIGIN}/?reset=${encodeURIComponent(token)}`;
        await sendTransactionalEmail(email, 'Восстановление пароля', `Задайте новый пароль по ссылке: ${resetUrl}`);
      }
      res.json({ message: 'Если аккаунт существует, письмо для восстановления пароля отправлено.' });
    } catch (error) { next(error); }
  });
  app.post('/api/auth/reset-password', async (req, res, next) => {
    try {
      const input = validate(z.object({ token: z.string().min(32).max(200), password: passwordSchema, passwordConfirm: z.string() }), req.body);
      if (input.password !== input.passwordConfirm) return res.status(400).json({ error: 'Пароли не совпадают' });
      if (!(await resetPassword(input.token, input.password))) return res.status(400).json({ error: 'Ссылка недействительна или срок её действия истёк' });
      res.json({ message: 'Пароль изменён. Войдите с новым паролем.' });
    } catch (error) { next(error); }
  });

  app.get('/api/admin/session', optionalUser, (req: ShelterRequest, res) => res.json({ authenticated: Boolean(req.user), user: req.user }));
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
      const input = validate(z.object({
        email: emailSchema,
        password: z.string().min(1).max(200),
        catId: z.string().trim().min(1).max(200).optional(),
        invite: z.string().trim().min(1).max(200).optional(),
      }), req.body);
      const { email, password } = input;
      const invitedCat = await resolveInvitedCat(input.catId, input.invite);
      const attemptKey = `${ip}:${email.toLocaleLowerCase('en-US')}`;
      const state = loginAttempts.get(attemptKey);
      if (state && state.resetAt > now && state.count >= 5) return res.status(429).json({ error: 'Too many login attempts' });
      const auth = await authenticateUser(email, password);
      if (auth.needsVerification) {
        if (invitedCat) await setPendingUserCat(email, invitedCat.id);
        return res.status(403).json({ authenticated: false, needsVerification: true, error: 'Подтвердите регистрацию по ссылке из письма.' });
      }
      if (!auth.user) {
        const current = state && state.resetAt > now ? state : { count: 0, resetAt: now + 15 * 60 * 1000 };
        current.count += 1;
        loginAttempts.set(attemptKey, current);
        return res.status(401).json({ authenticated: false, error: 'Неверное имя пользователя или пароль' });
      }
      loginAttempts.delete(attemptKey);
      let user = auth.user;
      if (invitedCat) {
        if (user.role !== 'owner') return res.status(400).json({ authenticated: false, error: 'Котика можно привязать только к аккаунту владельца' });
        user = await attachUserCat(user.email, invitedCat.id);
      }
      const token = crypto.randomBytes(32).toString('hex');
      await createUserSession(tokenHash(token), user.email, new Date(now + SESSION_MS));
      setCookie(res, ADMIN_COOKIE, token, SESSION_MS);
      res.json({ authenticated: true, user });
    } catch (error) { next(error); }
  });
  app.post('/api/admin/logout', async (req: ShelterRequest, res, next) => {
    try {
      const token = parseCookies(req)[ADMIN_COOKIE];
      if (token) await deleteUserSession(tokenHash(token));
      clearCookie(res, ADMIN_COOKIE);
      res.json({ success: true });
    } catch (error) { next(error); }
  });
  app.post('/api/admin/password', requireUser, async (req: ShelterRequest, res, next) => {
    try {
      const oldPassword = validate(z.string().min(1).max(200), req.body?.oldPassword);
      const newPassword = validate(passwordSchema, req.body?.newPassword);
      const result = await changeUserPassword(req.user!.email, oldPassword, newPassword);
      if (!result.success) return res.status(400).json(result);
      clearCookie(res, ADMIN_COOKIE);
      res.json(result);
    } catch (error) { next(error); }
  });
  app.patch('/api/account', requireUser, async (req: ShelterRequest, res, next) => {
    try {
      const displayName = validate(z.string().trim().max(120), req.body?.displayName);
      res.json(await updateUserProfile(req.user!.email, displayName));
    } catch (error) { next(error); }
  });
  app.post('/api/account/accept-cat-invite', requireUser, requireRole('owner'), async (req: ShelterRequest, res, next) => {
    try {
      const input = validate(z.object({ catId: z.string().trim().min(1).max(200), invite: z.string().trim().min(1).max(200) }), req.body);
      const cat = await resolveInvitedCat(input.catId, input.invite);
      res.json(await attachUserCat(req.user!.email, cat!.id));
    } catch (error) { next(error); }
  });

  app.get('/api/users', requireAdmin, async (req: ShelterRequest, res, next) => {
    try { res.json(await listUsers(req.user!.role, req.user!.email)); } catch (error) { next(error); }
  });
  app.post('/api/users/staff', requireAdmin, requireRole('administrator'), async (req, res, next) => {
    try {
      const input = validate(z.object({
        email: emailSchema,
        password: passwordSchema,
        displayName: z.string().trim().max(120),
        role: z.enum(['administrator', 'curator']),
      }), req.body);
      res.status(201).json(await createStaffUser(input.email, input.password, input.displayName, input.role));
    } catch (error) { next(error); }
  });
  app.patch('/api/users/:email', requireAdmin, requireRole('administrator'), async (req: ShelterRequest, res, next) => {
    try {
      const input = validate(z.object({
        displayName: z.string().trim().max(120),
        role: z.enum(['administrator', 'curator', 'owner']),
      }), req.body);
      const isCurrentUser = req.params.email.trim().toLocaleLowerCase('en-US') === req.user!.email.toLocaleLowerCase('en-US');
      if (isCurrentUser && input.role !== req.user!.role) {
        return res.status(400).json({ error: 'Свою роль изменить нельзя' });
      }
      const user = await updateManagedUser(req.params.email, input.displayName, input.role);
      if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
      res.json(user);
    } catch (error) { next(error); }
  });
  app.put('/api/users/:email/cats', requireAdmin, async (req, res, next) => {
    try {
      const catIds = validate(z.array(z.string().min(1).max(200)).max(100), req.body?.catIds);
      const user = await assignUserCats(req.params.email, catIds);
      if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
      res.json(user);
    } catch (error) { next(error); }
  });
  app.delete('/api/users/:email', requireAdmin, async (req: ShelterRequest, res, next) => {
    try {
      const success = await deleteManagedUser(req.params.email, req.user!.role);
      if (!success) return res.status(400).json({ error: 'Этого пользователя нельзя удалить' });
      res.json({ success });
    } catch (error) { next(error); }
  });

  app.get('/api/account/cats', requireUser, requireRole('owner'), async (req: ShelterRequest, res, next) => {
    try { res.json(await getCatsForOwner(req.user!.email)); } catch (error) { next(error); }
  });
  app.get('/owner-video-capture', (req, res) => {
    const catId = typeof req.query.catId === 'string' ? req.query.catId : '';
    res.redirect(302, `/owner-media-capture?catId=${encodeURIComponent(catId)}&kind=video`);
  });
  app.get('/owner-media-capture', requireUser, requireRole('owner'), async (req: ShelterRequest, res, next) => {
    try {
      const catId = validate(z.string().min(1).max(200), req.query.catId);
      const kind = validate(z.enum(['photo', 'video']), req.query.kind);
      const cat = (await getCatsForOwner(req.user!.email)).find((candidate) => candidate.id === catId);
      if (!cat) return res.status(404).type('text/plain').send('Котик не найден или не привязан к вашему аккаунту');
      if (cat.status !== 'adopted') return res.status(400).type('text/plain').send('Фото и видео можно добавлять после завершения испытательного срока');
      const isPhoto = kind === 'photo';
      const mediaLabel = isPhoto ? 'Фото' : 'Видео';
      const actionLabel = isPhoto ? 'Сделать фото' : 'Записать видео';
      const returnUrl = `/?cabinet=1&ownerCat=${encodeURIComponent(cat.id)}&ownerMedia=${kind}`;
      res
        .set('Cache-Control', 'no-store')
        .type('html')
        .send(`<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>${mediaLabel} для ${escapeHtml(cat.name)}</title>
<style>*{box-sizing:border-box}body{margin:0;background:#fafaf9;color:#1c1917;font:16px system-ui,-apple-system,sans-serif}.page{min-height:100dvh;display:flex;flex-direction:column}.head{padding:18px 20px;background:#1c1917;color:#fff;font-weight:800;font-size:18px}.main{width:min(100%,520px);margin:auto;padding:28px 20px;text-align:center}.icon{width:72px;height:72px;margin:0 auto 18px;border-radius:24px;background:#f59e0b;color:#fff;display:grid;place-items:center;font-size:32px}h1{font-size:25px;margin:0 0 10px}p{color:#78716c;line-height:1.5;margin:0 0 24px}.button,.back{width:100%;min-height:56px;border:0;border-radius:16px;font:800 16px system-ui;display:flex;align-items:center;justify-content:center;text-decoration:none}.button{background:#f59e0b;color:#fff}.button.secondary{background:#292524}.button:disabled{opacity:.55}.back{margin-top:12px;background:#fff;color:#44403c;border:1px solid #d6d3d1}.preview{display:none;margin:20px 0;padding:10px;border:1px solid #e7e5e4;border-radius:20px;background:#fff}.preview img,.preview video{display:none;width:100%;max-height:52dvh;object-fit:contain;border-radius:14px;background:#1c1917}.confirm{display:none;gap:10px}.confirm .button{flex:1}.status{min-height:48px;margin-top:18px;padding:12px;border-radius:14px;font-size:14px;line-height:1.45}.status:empty{padding:0}.status.error{background:#fff1f2;color:#be123c}.status.ok{background:#ecfdf5;color:#047857}.note{font-size:12px;margin-top:18px}</style></head>
<body><div class="page"><header class="head">Панель управления</header><main class="main"><div class="icon">${isPhoto ? '📷' : '●'}</div><h1>${mediaLabel} для ${escapeHtml(cat.name)}</h1><p>После системной кнопки OK проверьте результат. Материал попадёт на модерацию только после нажатия «Отправить».</p><input id="capture" type="file" accept="${isPhoto ? 'image/*' : 'video/*'}" capture="environment" hidden><button id="start" class="button" type="button">${actionLabel}</button><div id="preview" class="preview"><img id="photo-preview" alt="Предварительный просмотр"><video id="video-preview" controls playsinline></video></div><div id="confirm" class="confirm"><button id="retake" class="button secondary" type="button">Переснять</button><button id="send" class="button" type="button">Отправить</button></div><a id="back" class="back" href="${returnUrl}">Вернуться без отправки</a><div id="status" class="status" role="status"></div><p class="note">${isPhoto ? 'Фото — до 25 МБ.' : 'Видео — до 25 МБ и до 60 секунд.'} Не закрывайте этот экран во время отправки.</p></main></div>
<script>
const kind='${kind}',input=document.getElementById('capture'),button=document.getElementById('start'),status=document.getElementById('status'),preview=document.getElementById('preview'),photoPreview=document.getElementById('photo-preview'),videoPreview=document.getElementById('video-preview'),confirmBox=document.getElementById('confirm'),send=document.getElementById('send'),retake=document.getElementById('retake'),back=document.getElementById('back');let selectedFile=null,objectUrl='';
const show=(text,type='')=>{status.textContent=text;status.className='status '+type};
const duration=file=>new Promise((resolve,reject)=>{const url=URL.createObjectURL(file),video=document.createElement('video');video.preload='metadata';video.onloadedmetadata=()=>{URL.revokeObjectURL(url);resolve(video.duration)};video.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('Не удалось прочитать видео'))};video.src=url});
button.addEventListener('click',()=>input.click());
const clearPreview=()=>{if(objectUrl)URL.revokeObjectURL(objectUrl);objectUrl='';selectedFile=null;photoPreview.removeAttribute('src');videoPreview.removeAttribute('src');videoPreview.load();preview.style.display='none';photoPreview.style.display='none';videoPreview.style.display='none';confirmBox.style.display='none';button.style.display='flex';back.style.display='flex';input.value='';show('')};
input.addEventListener('change',async()=>{const file=input.files&&input.files[0];if(!file)return;const expected=kind==='photo'?'image/':'video/';if(!file.type.startsWith(expected)){show(kind==='photo'?'Выбранный файл не является фотографией.':'Выбранный файл не является видео.','error');input.value='';return}if(file.size>25*1024*1024){show((kind==='photo'?'Фото':'Видео')+' больше 25 МБ.','error');input.value='';return}try{if(kind==='video'){const seconds=await duration(file);if(!Number.isFinite(seconds)||seconds>60)throw new Error('Длительность видео не должна превышать 60 секунд.')}selectedFile=file;if(objectUrl)URL.revokeObjectURL(objectUrl);objectUrl=URL.createObjectURL(file);if(kind==='photo'){photoPreview.src=objectUrl;photoPreview.style.display='block'}else{videoPreview.src=objectUrl;videoPreview.style.display='block'}preview.style.display='block';confirmBox.style.display='flex';button.style.display='none';back.style.display='none';show('Проверьте результат и подтвердите отправку.','ok')}catch(error){show(error instanceof Error?error.message:'Не удалось прочитать файл','error');input.value=''}});
retake.addEventListener('click',()=>{clearPreview();input.click()});
send.addEventListener('click',async()=>{if(!selectedFile)return;send.disabled=true;retake.disabled=true;show('Отправляем материал…','ok');try{const response=await fetch('/api/owner-content/media-capture?catId=${encodeURIComponent(cat.id)}&kind='+kind,{method:'POST',headers:{'Content-Type':selectedFile.type||(kind==='photo'?'image/jpeg':'video/mp4')},body:selectedFile});const result=await response.json().catch(()=>({}));if(!response.ok)throw new Error(result.error||'Не удалось отправить материал');show('Материал отправлен. Возвращаемся в панель…','ok');window.location.replace('${returnUrl}&ownerCapture=success&ownerContent='+encodeURIComponent(result.id))}catch(error){show(error instanceof Error?error.message:'Не удалось отправить материал','error');send.disabled=false;retake.disabled=false}});
</script></body></html>`);
    } catch (error) { next(error); }
  });
  app.post('/api/owner-content/media-capture', requireUser, requireRole('owner'), express.raw({ type: ['image/*', 'video/*'], limit: '25mb' }), async (req: ShelterRequest, res, next) => {
    try {
      const catId = validate(z.string().min(1).max(200), req.query.catId);
      const kind = validate(z.enum(['photo', 'video']), req.query.kind);
      const mimeType = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
      const supportedTypes = kind === 'photo'
        ? new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
        : new Set(['video/mp4', 'video/webm', 'video/quicktime', 'video/3gpp']);
      if (!supportedTypes.has(mimeType)) return res.status(400).json({ error: `Формат ${kind === 'photo' ? 'фотографии' : 'видео'} не поддерживается` });
      if (!Buffer.isBuffer(req.body) || req.body.length === 0) return res.status(400).json({ error: 'Медиафайл не получен' });
      const normalizedMedia = kind === 'video'
        ? await ensureBrowserCompatibleVideo(req.body, mimeType)
        : { content: req.body, mimeType };
      const mediaUrl = `data:${normalizedMedia.mimeType};base64,${normalizedMedia.content.toString('base64')}`;
      const content = await createOwnerContent(req.user!.email, { catId, kind, mediaUrl });
      const staff = (await listUsers('administrator')).filter((user) => user.role !== 'owner');
      await Promise.allSettled(staff.map((user) => sendTransactionalEmail(
        user.email,
        `Новое ${kind === 'photo' ? 'фото' : 'видео'} владельца котика`,
        `${req.user!.displayName} добавил(а) материал, требующий проверки: ${PUBLIC_ORIGIN}/?cabinet=1&content=${encodeURIComponent(content.id)}`,
      )));
      res.status(201).json(content);
    } catch (error) { next(error); }
  });
  app.get('/api/cats/:id/owner-content', optionalUser, async (req: ShelterRequest, res, next) => {
    try {
      const staff = Boolean(req.user && ['administrator', 'curator'].includes(req.user.role));
      res.json(await getOwnerContentForCat(req.params.id, req.user?.email, staff));
    } catch (error) { next(error); }
  });
  app.get('/api/owner-content/pending', requireAdmin, async (_req, res, next) => {
    try { res.json(await getPendingOwnerContent()); } catch (error) { next(error); }
  });
  app.post('/api/owner-content', requireUser, requireRole('owner'), async (req: ShelterRequest, res, next) => {
    try {
      const input = validate(z.object({
        catId: z.string().min(1).max(200),
        kind: z.enum(['photo', 'video', 'comment', 'question']),
        text: z.string().max(5000).optional(),
        mediaUrl: z.string().max(14000000).optional(),
        isConfidential: z.boolean().optional(),
      }), req.body);
      if (['photo', 'video'].includes(input.kind) && !input.mediaUrl) return res.status(400).json({ error: 'Добавьте файл' });
      if (['comment', 'question'].includes(input.kind) && !input.text?.trim()) return res.status(400).json({ error: 'Введите текст' });
      const content = await createOwnerContent(req.user!.email, input);
      const staff = (await listUsers('administrator')).filter((user) => user.role !== 'owner');
      await Promise.allSettled(staff.map((user) => sendTransactionalEmail(
        user.email,
        'Новое действие владельца котика',
        `${req.user!.displayName} добавил(а) материал, требующий реакции: ${PUBLIC_ORIGIN}/?cabinet=1&content=${encodeURIComponent(content.id)}`,
      )));
      res.status(201).json(content);
    } catch (error) { next(error); }
  });
  app.post('/api/owner-content/media-batch', requireUser, requireRole('owner'), async (req: ShelterRequest, res, next) => {
    try {
      const input = validate(z.object({
        catId: z.string().min(1).max(200),
        kind: z.enum(['photo', 'video']),
        mediaUrls: z.array(z.string().min(1).max(14000000)).min(1).max(5),
      }), req.body);
      const contents: OwnerContent[] = [];
      for (const mediaUrl of input.mediaUrls) {
        contents.push(await createOwnerContent(req.user!.email, { catId: input.catId, kind: input.kind, mediaUrl }));
      }
      const staff = (await listUsers('administrator')).filter((user) => user.role !== 'owner');
      await Promise.allSettled(staff.map((user) => sendTransactionalEmail(
        user.email,
        'Новые материалы владельца котика',
        `${req.user!.displayName} добавил(а) ${contents.length} файл(а), требующих проверки: ${PUBLIC_ORIGIN}/?cabinet=1&content=${encodeURIComponent(contents[0].id)}`,
      )));
      res.status(201).json(contents);
    } catch (error) { next(error); }
  });
  app.patch('/api/owner-content/:id', requireUser, requireRole('owner'), async (req: ShelterRequest, res, next) => {
    try {
      const text = validate(z.string().trim().min(1).max(5000), req.body?.text);
      const content = await updateOwnerContent(req.user!.email, req.params.id, text);
      if (!content) return res.status(404).json({ error: 'Материал не найден или недоступен для редактирования' });
      res.json(content);
    } catch (error) { next(error); }
  });
  app.delete('/api/owner-content/:id', requireUser, requireRole('owner'), async (req: ShelterRequest, res, next) => {
    try { res.json({ success: await deleteOwnerContent(req.user!.email, req.params.id) }); } catch (error) { next(error); }
  });
  app.patch('/api/owner-content/:id/moderate', requireAdmin, async (req: ShelterRequest, res, next) => {
    try {
      const input = validate(z.object({ status: z.enum(['pending', 'approved', 'rejected']), answer: z.string().max(5000).optional() }), req.body);
      const content = await moderateOwnerContent(req.params.id, input.status, input.answer, req.user!.email);
      if (!content) return res.status(404).json({ error: 'Материал не найден' });
      if (content.authorEmail) {
        await sendTransactionalEmail(
          content.authorEmail,
          content.kind === 'question' && input.answer ? 'На ваш вопрос ответили' : 'Материал прошёл модерацию',
          `Откройте панель управления: ${PUBLIC_ORIGIN}/?cabinet=1&content=${encodeURIComponent(content.id)}`,
        );
      }
      res.json(content);
    } catch (error) { next(error); }
  });

  app.get('/api/database/stats', requireAdmin, requireRole('administrator'), async (_req, res, next) => {
    try { res.json(await getDatabaseStats()); } catch (error) { next(error); }
  });
  app.get('/api/database/backup-schedule', requireAdmin, requireRole('administrator'), async (_req, res, next) => {
    try { res.json(await getAutomaticBackupStatus()); } catch (error) { next(error); }
  });
  app.get('/api/database/backup-directories', requireAdmin, requireRole('administrator'), async (req, res, next) => {
    try {
      const requestedPath = typeof req.query.path === 'string' ? req.query.path : undefined;
      res.json(await browseServerDirectories(requestedPath));
    } catch (error) { next(error); }
  });
  app.post('/api/database/backup-directories', requireAdmin, requireRole('administrator'), async (req, res, next) => {
    try {
      const input = validate(createBackupDirectorySchema, req.body);
      res.status(201).json(await createServerDirectory(input.parentPath, input.name));
    } catch (error) { next(error); }
  });
  app.put('/api/database/backup-schedule', requireAdmin, requireRole('administrator'), async (req, res, next) => {
    try {
      const settings = validate(databaseBackupSettingsSchema, req.body);
      const directory = await assertBackupDirectoryWritable(settings.directory);
      await setDatabaseBackupSettings({ ...settings, directory });
      res.json(await reloadAutomaticBackupScheduler());
    } catch (error) { next(error); }
  });
  app.get('/api/database/export', requireAdmin, requireRole('administrator'), async (_req, res, next) => {
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
  app.post('/api/database/import', requireAdmin, requireRole('administrator'), express.raw({ type: 'application/octet-stream', limit: '250mb' }), async (req: ShelterRequest, res, next) => {
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
    const explicitStatus = error && typeof error === 'object' && 'status' in error ? Number(error.status) : 0;
    const databaseCode = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
    const status = explicitStatus >= 400 && explicitStatus < 600
      ? explicitStatus
      : databaseCode === '23505'
        ? 409
        : databaseCode === '23503' || databaseCode === '23514'
          ? 400
          : message.includes('required') || message.includes('Expected')
            ? 400
            : 500;
    console.error('[API]', message);
    res.status(status).json({ error: message });
  });

  if (!isProduction) {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    const indexTemplate = fs.readFileSync(path.join(distPath, 'index.html'), 'utf8');
    app.get('/', async (_req, res, next) => {
      try {
        const [cats, articles] = await Promise.all([getAllCats(), getAllArticles()]);
        res
          .set('Cache-Control', 'public, max-age=300')
          .type('text/html')
          .send(renderHomeSeoDocument(indexTemplate, cats, articles));
      } catch (error) {
        next(error);
      }
    });
    app.get('/cat-game-demo', (_req, res) => {
      res
        .set('Cache-Control', 'no-cache')
        .type('text/html')
        .send(renderCatGameDemoDocument(indexTemplate));
    });
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














