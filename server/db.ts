import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import pg, { type PoolClient } from 'pg';
import bcrypt from 'bcryptjs';
import {
  Cat, AdoptionApplication, ShelterArticle, ShelterStats, SiteContacts, DonationSettings, DatabaseBackupSettings,
  OwnerContent, OwnerContentKind, UserAccount, UserRole,
} from '../src/types';
import { INITIAL_CATS } from '../src/data/cats';
import { INITIAL_ARTICLES } from '../src/data/news';
import realCatPhoto from '../src/assets/defaultCat';
import {
  externalizeApplicationMedia,
  externalizeArticleMedia,
  externalizeCatMedia,
  externalizeDonationMedia,
  decodeMediaDataUrl,
  getMediaMimeType,
  getStoredMediaFileName,
  inlineApplicationMedia,
  inlineArticleMedia,
  inlineCatMedia,
  MEDIA_DIR,
} from './media';
import {
  ensureRelationalSchema,
  readApplications,
  readArticles,
  readCats,
  writeApplicationRecord,
  writeArticleRecord,
  writeCatRecord,
} from './relationalStore';

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  host: process.env.PGHOST || '127.0.0.1',
  port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE || 'cats',
  user: process.env.PGUSER || 'chat_gpt',
  password: process.env.PGPASSWORD,
  max: 10,
  connectionTimeoutMillis: 5000,
});

export interface CatRating {
  catId: string;
  likesCount: number;
  rank: number;
}

export interface VisitAnalytics {
  days: number;
  daily: Array<{ date: string; visitors: number; visits: number }>;
  summary: {
    visitorsToday: number;
    visitsToday: number;
    uniqueVisitors7Days: number;
    visits7Days: number;
    uniqueVisitors30Days: number;
    visits30Days: number;
  };
}

export interface ShelterDbSchema {
  version: number;
  lastUpdated: string;
  cats: Cat[];
  applications: AdoptionApplication[];
  articles: ShelterArticle[];
}

export interface ServerDbStats {
  isSupported: boolean;
  database: string;
  catsCount: number;
  appsCount: number;
  articlesCount: number;
  preferencesCount: number;
  lastUpdated: string;
  isServerStorage: boolean;
}

export interface BootstrapData {
  cats: Cat[];
  applications: AdoptionApplication[];
  articles: ShelterArticle[];
  preferences: Record<string, unknown>;
  shelterStats: ShelterStats;
  siteContacts: SiteContacts;
  donationSettings: DonationSettings;
}

const LEGACY_DB_FILE = path.resolve(process.cwd(), 'data', 'shelter_db.json');
const DEFAULT_DATABASE_BACKUP_SETTINGS: DatabaseBackupSettings = {
  time: '03:00',
  retentionCount: 7,
  directory: path.resolve(process.cwd(), process.env.AUTO_BACKUP_DIR || path.join('data', 'backups')),
};

export interface StoredMediaAsset {
  fileName: string;
  mimeType: string;
  content: Buffer;
  sizeBytes: number;
}

function normalizeSiteContacts(data?: Partial<SiteContacts> | null): SiteContacts {
  return {
    address: typeof data?.address === 'string' ? data.address : 'Санкт-Петербург, м. Площадь Мужества',
    visitingHours: typeof data?.visitingHours === 'string' ? data.visitingHours : 'Любой день по предварительной договорённости.',
    phone: typeof data?.phone === 'string' ? data.phone : '',
    email: typeof data?.email === 'string' ? data.email : 'kindforcat@gmail.com',
    telegram: typeof data?.telegram === 'string' ? data.telegram : 't.me/maythecatbewithyou',
    telegramUrl: typeof data?.telegramUrl === 'string' ? data.telegramUrl : 'https://t.me/maythecatbewithyou',
    maxUrl: typeof data?.maxUrl === 'string' && data.maxUrl.trim() ? data.maxUrl : 'https://max.ru/channel_dobrotadylakota',
    vkUrl: typeof data?.vkUrl === 'string' && data.vkUrl.trim() ? data.vkUrl : 'https://vk.ru/dobrota_dlya_kota',
    youtubeUrl: typeof data?.youtubeUrl === 'string' && data.youtubeUrl.trim() ? data.youtubeUrl : 'https://www.youtube.com/@dobrota_d_kota',
    rutubeUrl: typeof data?.rutubeUrl === 'string' && data.rutubeUrl.trim() ? data.rutubeUrl : 'https://rutube.ru/channel/82015606',
  };
}

function collectMediaFileNames(value: unknown, result = new Set<string>()): Set<string> {
  if (typeof value === 'string') {
    const fileName = getStoredMediaFileName(value);
    if (fileName) result.add(fileName);
  } else if (Array.isArray(value)) {
    value.forEach((item) => collectMediaFileNames(item, result));
  } else if (value && typeof value === 'object') {
    Object.values(value).forEach((item) => collectMediaFileNames(item, result));
  }
  return result;
}

async function persistMediaFileNames(fileNames: Iterable<string>): Promise<void> {
  const uniqueNames = [...new Set(fileNames)].filter((fileName) => getMediaMimeType(fileName));
  if (!uniqueNames.length) return;

  const existing = await pool.query<{ file_name: string }>(
    'SELECT file_name FROM media_assets WHERE file_name = ANY($1::text[])',
    [uniqueNames],
  );
  const existingNames = new Set(existing.rows.map((row) => row.file_name));

  for (const fileName of uniqueNames) {
    if (existingNames.has(fileName)) continue;
    const mimeType = getMediaMimeType(fileName);
    if (!mimeType) continue;
    const filePath = path.join(MEDIA_DIR, fileName);
    let content: Buffer;
    try {
      content = await fs.promises.readFile(filePath);
    } catch {
      continue;
    }
    await pool.query(
      'INSERT INTO media_assets (file_name, mime_type, content, size_bytes) VALUES ($1, $2, $3, $4) ON CONFLICT (file_name) DO NOTHING',
      [fileName, mimeType, content, content.length],
    );
  }
}

async function persistMediaReferences(value: unknown): Promise<void> {
  await persistMediaFileNames(collectMediaFileNames(value));
}

function collectInlineMedia(value: unknown, result = new Map<string, { mimeType: string; content: Buffer }>()): Map<string, { mimeType: string; content: Buffer }> {
  if (typeof value === 'string') {
    const media = decodeMediaDataUrl(value);
    if (media) result.set(media.fileName, { mimeType: media.mimeType, content: media.content });
  } else if (Array.isArray(value)) {
    value.forEach((item) => collectInlineMedia(item, result));
  } else if (value && typeof value === 'object') {
    Object.values(value).forEach((item) => collectInlineMedia(item, result));
  }
  return result;
}

async function persistInlineMedia(value: unknown): Promise<void> {
  for (const [fileName, media] of collectInlineMedia(value)) {
    await pool.query(
      'INSERT INTO media_assets (file_name, mime_type, content, size_bytes) VALUES ($1, $2, $3, $4) ON CONFLICT (file_name) DO NOTHING',
      [fileName, media.mimeType, media.content, media.content.length],
    );
  }
}

async function storeCatMedia(cat: Cat): Promise<Cat> {
  await persistInlineMedia(cat);
  const stored = externalizeCatMedia(cat);
  await persistMediaReferences(stored);
  return stored;
}

async function storeApplicationMedia(application: AdoptionApplication): Promise<AdoptionApplication> {
  await persistInlineMedia(application);
  const stored = externalizeApplicationMedia(application);
  await persistMediaReferences(stored);
  return stored;
}

async function storeArticleMedia(article: ShelterArticle): Promise<ShelterArticle> {
  await persistInlineMedia(article);
  const stored = externalizeArticleMedia(article);
  await persistMediaReferences(stored);
  return stored;
}

async function storeDonationMedia(settings: DonationSettings): Promise<DonationSettings> {
  await persistInlineMedia(settings);
  const stored = externalizeDonationMedia(settings);
  await persistMediaReferences(stored);
  return stored;
}

async function migrateMediaDirectory(): Promise<void> {
  let fileNames: string[] = [];
  try {
    fileNames = (await fs.promises.readdir(MEDIA_DIR, { withFileTypes: true }))
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name);
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
    if (code !== 'ENOENT') throw error;
  }
  await persistMediaFileNames(fileNames);
}

function sanitizeCat(cat: Cat): Cat {
  const rawHealth = (cat.health || {}) as Cat['health'] & { microchipped?: boolean };
  const { microchipped: _legacy, ...health } = rawHealth;
  let photos = Array.isArray(cat.photos) ? cat.photos : [];
  photos = photos.map((photo) => {
    if (typeof photo !== 'string' || !photo.trim()) return realCatPhoto;
    if (photo.includes('regenerated_image_') || photo.startsWith('./') || photo.startsWith('/src/') || photo.startsWith('src/')) return realCatPhoto;
    return photo;
  });
  return { ...cat, photos: photos.length ? photos : [realCatPhoto], health };
}

function readLegacyDatabase(): Partial<ShelterDbSchema> & { settings?: Record<string, unknown> } {
  try { return JSON.parse(fs.readFileSync(LEGACY_DB_FILE, 'utf8')); } catch { return {}; }
}

async function externalizeDatabaseMedia(): Promise<void> {
  const dataColumns = await pool.query<{ table_name: string }>(`
    SELECT table_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_name = 'data'
      AND table_name IN ('cats', 'articles', 'applications')
  `);
  const legacyTables = new Set(dataColumns.rows.map((row) => row.table_name));

  if (legacyTables.has('cats')) {
    const cats = await pool.query<{ id: string; data: Cat }>('SELECT id, data FROM cats');
    for (const row of cats.rows) {
      const updated = await storeCatMedia(sanitizeCat(row.data));
      if (JSON.stringify(updated) !== JSON.stringify(row.data)) {
        await pool.query('UPDATE cats SET data = $2 WHERE id = $1', [row.id, updated]);
      }
    }
  }

  if (legacyTables.has('applications')) {
    const applications = await pool.query<{ id: string; data: AdoptionApplication }>('SELECT id, data FROM applications');
    for (const row of applications.rows) {
      const updated = await storeApplicationMedia(row.data);
      if (JSON.stringify(updated) !== JSON.stringify(row.data)) {
        await pool.query('UPDATE applications SET data = $2 WHERE id = $1', [row.id, updated]);
      }
    }
  }

  if (legacyTables.has('articles')) {
    const articles = await pool.query<{ id: string; data: ShelterArticle }>('SELECT id, data FROM articles');
    for (const row of articles.rows) {
      const updated = await storeArticleMedia(row.data);
      if (JSON.stringify(updated) !== JSON.stringify(row.data)) {
        await pool.query('UPDATE articles SET data = $2 WHERE id = $1', [row.id, updated]);
      }
    }
  }

  const donation = await pool.query<{ data: DonationSettings }>(
    'SELECT data FROM site_settings WHERE key = $1',
    ['donation_settings'],
  );
  if (donation.rowCount) {
    const updated = await storeDonationMedia(donation.rows[0].data);
    if (JSON.stringify(updated) !== JSON.stringify(donation.rows[0].data)) {
      await pool.query('UPDATE site_settings SET data = $2 WHERE key = $1', ['donation_settings', updated]);
    }
  }
}

export async function initDatabase(): Promise<ServerDbStats> {
  await pool.query([
    'CREATE TABLE IF NOT EXISTS cats (id text PRIMARY KEY, updated_at timestamptz NOT NULL DEFAULT now())',
    'CREATE TABLE IF NOT EXISTS applications (id text PRIMARY KEY, owner_id text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now())',
    'CREATE INDEX IF NOT EXISTS applications_owner_id_idx ON applications(owner_id)',
    'CREATE TABLE IF NOT EXISTS articles (id text PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now())',
    'DO $migration$ BEGIN ALTER TABLE articles ADD COLUMN created_at timestamptz; EXCEPTION WHEN duplicate_column THEN NULL; END $migration$',
    'UPDATE articles SET created_at = updated_at WHERE created_at IS NULL',
    'ALTER TABLE articles ALTER COLUMN created_at SET DEFAULT now()',
    'ALTER TABLE articles ALTER COLUMN created_at SET NOT NULL',
    "CREATE TABLE IF NOT EXISTS user_preferences (owner_id text PRIMARY KEY, data jsonb NOT NULL DEFAULT '{}'::jsonb, updated_at timestamptz NOT NULL DEFAULT now())",
    'CREATE TABLE IF NOT EXISTS site_visit_days (visit_date date NOT NULL DEFAULT current_date, owner_id text NOT NULL, visits integer NOT NULL DEFAULT 1, first_seen timestamptz NOT NULL DEFAULT now(), last_seen timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (visit_date, owner_id))',
    'CREATE INDEX IF NOT EXISTS site_visit_days_date_idx ON site_visit_days(visit_date)',
    "CREATE TABLE IF NOT EXISTS site_settings (key text PRIMARY KEY, data jsonb NOT NULL DEFAULT '{}'::jsonb, updated_at timestamptz NOT NULL DEFAULT now())",
    'CREATE TABLE IF NOT EXISTS admin_users (username text PRIMARY KEY, password_hash text NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())',
    'CREATE TABLE IF NOT EXISTS admin_sessions (token_hash text PRIMARY KEY, username text NOT NULL REFERENCES admin_users(username) ON DELETE CASCADE, expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now())',
    'CREATE TABLE IF NOT EXISTS media_assets (file_name text PRIMARY KEY, mime_type text NOT NULL, content bytea NOT NULL, size_bytes integer NOT NULL, created_at timestamptz NOT NULL DEFAULT now())',
    "CREATE TABLE IF NOT EXISTS shelter_users (email text PRIMARY KEY, display_name text NOT NULL, password_hash text NOT NULL, role text NOT NULL CHECK (role IN ('administrator','curator','owner')), verified_at timestamptz, verification_token_hash text, verification_expires_at timestamptz, reset_token_hash text, reset_expires_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now())",
    "DO $migration$ BEGIN ALTER TABLE shelter_users ADD COLUMN pending_cat_id text REFERENCES cats(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_column THEN NULL; END $migration$",
    "DO $migration$ BEGIN ALTER TABLE shelter_users ADD COLUMN verification_attempts integer NOT NULL DEFAULT 0; EXCEPTION WHEN duplicate_column THEN NULL; END $migration$",
    'CREATE TABLE IF NOT EXISTS shelter_sessions (token_hash text PRIMARY KEY, email text NOT NULL REFERENCES shelter_users(email) ON DELETE CASCADE, expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now())',
    'CREATE INDEX IF NOT EXISTS shelter_sessions_email_idx ON shelter_sessions(email)',
    'CREATE TABLE IF NOT EXISTS cat_owners (cat_id text NOT NULL REFERENCES cats(id) ON DELETE CASCADE, owner_email text NOT NULL REFERENCES shelter_users(email) ON DELETE CASCADE, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (cat_id, owner_email))',
    'CREATE INDEX IF NOT EXISTS cat_owners_owner_idx ON cat_owners(owner_email)',
    "CREATE TABLE IF NOT EXISTS owner_content (id text PRIMARY KEY, cat_id text NOT NULL REFERENCES cats(id) ON DELETE CASCADE, author_email text NOT NULL REFERENCES shelter_users(email) ON DELETE CASCADE, kind text NOT NULL CHECK (kind IN ('photo','video','comment','question')), body text NOT NULL DEFAULT '', media_url text, is_confidential boolean NOT NULL DEFAULT false, answer text, answered_by text REFERENCES shelter_users(email) ON DELETE SET NULL, moderation_status text NOT NULL DEFAULT 'pending' CHECK (moderation_status IN ('pending','approved','rejected')), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now())",
    'CREATE INDEX IF NOT EXISTS owner_content_cat_idx ON owner_content(cat_id, created_at)',
    'CREATE INDEX IF NOT EXISTS owner_content_moderation_idx ON owner_content(moderation_status, created_at)'
  ].join(';'));

  const legacy = readLegacyDatabase();
  const adminCount = await pool.query<{ count: string }>('SELECT count(*)::text AS count FROM admin_users');
  if (Number(adminCount.rows[0].count) === 0) {
    const legacyPassword = typeof legacy.settings?.adminPassword === 'string' ? legacy.settings.adminPassword : undefined;
    const initialPassword = process.env.ADMIN_INITIAL_PASSWORD || legacyPassword;
    if (!initialPassword || initialPassword.length < 4) throw new Error('ADMIN_INITIAL_PASSWORD must contain at least 4 characters');
    await pool.query('INSERT INTO admin_users (username, password_hash) VALUES ($1, $2)', ['admin', await bcrypt.hash(initialPassword, 12)]);
  }
  await pool.query(`
    INSERT INTO shelter_users (email, display_name, password_hash, role, verified_at)
    SELECT 'vyanovska@gmail.com', 'Администратор', password_hash, 'administrator', now()
    FROM admin_users
    WHERE username = 'admin'
      AND NOT EXISTS (SELECT 1 FROM shelter_users WHERE role = 'administrator')
    LIMIT 1
  `);
  await pool.query(
    'INSERT INTO site_settings (key, data) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING',
    ['shelter_stats', { adoptedCount: 384, currentCount: 51 }]
  );
  await pool.query(
    'INSERT INTO site_settings (key, data) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING',
    ['site_contacts', {
      address: 'Санкт-Петербург, м. Площадь Мужества',
      visitingHours: 'Любой день по предварительной договорённости.',
      phone: '',
      email: 'kindforcat@gmail.com',
      telegram: 't.me/maythecatbewithyou',
      telegramUrl: 'https://t.me/maythecatbewithyou',
      maxUrl: 'https://max.ru/channel_dobrotadylakota',
      vkUrl: 'https://vk.ru/dobrota_dlya_kota',
      youtubeUrl: 'https://www.youtube.com/@dobrota_d_kota',
      rutubeUrl: 'https://rutube.ru/channel/82015606',
    }]
  );
  await pool.query(
    'INSERT INTO site_settings (key, data) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING',
    ['donation_settings', {
      title: 'Помочь переводом',
      description: 'Отсканируйте QR-код в мобильном приложении банка.',
      image: '/images/donation-qr.jpg',
    }]
  );
  await pool.query(
    'INSERT INTO site_settings (key, data) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING',
    ['database_backup_schedule', DEFAULT_DATABASE_BACKUP_SETTINGS]
  );
  await pool.query("DELETE FROM site_settings WHERE key = 'agreement_template'");
  await externalizeDatabaseMedia();
  await migrateMediaDirectory();
  await ensureRelationalSchema(pool);

  const counts = await pool.query<{ cats: string; articles: string; applications: string }>(
    'SELECT (SELECT count(*) FROM cats)::text AS cats, (SELECT count(*) FROM articles)::text AS articles, (SELECT count(*) FROM applications)::text AS applications'
  );
  const row = counts.rows[0];
  const catsToSeed = Number(row.cats) === 0
    ? (Array.isArray(legacy.cats) && legacy.cats.length ? legacy.cats : INITIAL_CATS)
    : [];
  const articlesToSeed = Number(row.articles) === 0
    ? (Array.isArray(legacy.articles) && legacy.articles.length ? legacy.articles : INITIAL_ARTICLES)
    : [];
  const applicationsToSeed = Number(row.applications) === 0 && Array.isArray(legacy.applications)
    ? legacy.applications
    : [];
  if (catsToSeed.length || articlesToSeed.length || applicationsToSeed.length) {
    const storedCats: Cat[] = [];
    for (const cat of catsToSeed) storedCats.push(await storeCatMedia(sanitizeCat(cat)));
    const storedArticles: ShelterArticle[] = [];
    for (const article of articlesToSeed) storedArticles.push(await storeArticleMedia(article));
    const storedApplications: AdoptionApplication[] = [];
    for (const application of applicationsToSeed) storedApplications.push(await storeApplicationMedia(application));

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const cat of storedCats) await writeCatRecord(client, cat, true);
      for (const article of storedArticles) await writeArticleRecord(client, article, true);
      for (const application of storedApplications) await writeApplicationRecord(client, 'legacy-import', application, true);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  await pool.query('DELETE FROM admin_sessions WHERE expires_at <= now()');
  await pool.query('DELETE FROM shelter_sessions WHERE expires_at <= now()');
  return getDatabaseStats();
}

export async function getAllCats(): Promise<Cat[]> {
  return (await readCats(pool)).map(sanitizeCat);
}

export async function getBootstrapData(ownerId: string): Promise<BootstrapData> {
  const [cats, applications, articles, result] = await Promise.all([
    readCats(pool),
    readApplications(pool, ownerId),
    readArticles(pool),
    pool.query<Pick<BootstrapData, 'preferences' | 'shelterStats' | 'siteContacts' | 'donationSettings'>>(`
      SELECT
        COALESCE((SELECT data FROM user_preferences WHERE owner_id = $1), '{}'::jsonb) AS preferences,
        (SELECT data FROM site_settings WHERE key = 'shelter_stats') AS "shelterStats",
        (SELECT data FROM site_settings WHERE key = 'site_contacts') AS "siteContacts",
        (SELECT data FROM site_settings WHERE key = 'donation_settings') AS "donationSettings"
    `, [ownerId]),
  ]);
  return {
    ...result.rows[0],
    cats: cats.map(sanitizeCat),
    applications,
    articles,
    siteContacts: normalizeSiteContacts(result.rows[0].siteContacts),
  };
}

export async function saveCat(data: Partial<Cat> & { id?: string }): Promise<Cat> {
  if (data.id) {
    const current = (await readCats(pool)).find((cat) => cat.id === data.id);
    if (current) {
      const cat = await storeCatMedia(sanitizeCat({ ...current, ...data } as Cat));
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await writeCatRecord(client, cat, false);
        await client.query('COMMIT');
        return cat;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally { client.release(); }
    }
  }
  const cat = await storeCatMedia(sanitizeCat({
    id: data.id || 'cat-' + crypto.randomUUID(),
    name: data.name || 'Подопечный передержки',
    age: data.age || 'Возраст уточняется',
    ageCategory: data.ageCategory || 'adult',
    gender: data.gender || 'male',
    size: data.size || 'medium',
    weightKg: data.weightKg || 4,
    temperament: data.temperament || 'calm',
    breed: data.breed || 'Метис',
    color: data.color || '',
    photos: data.photos?.length ? data.photos : [realCatPhoto],
    primaryPhotoPosition: data.primaryPhotoPosition || { x: 50, y: 30 },
    videos: data.videos || [],
    character: data.character || [],
    story: data.story || '',
    habits: data.habits || { litterBox: 'Приучен к лотку', scratchingPost: 'Приучен к когтеточке', foodPreference: 'Сбалансированный корм' },
    health: data.health || { vaccinated: true, sterilized: true, parasiteTreated: true, fivFelvNegative: true },
    goodWith: data.goodWith || { children: true, otherCats: true, dogs: true },
    arrivalDate: data.arrivalDate || String(new Date().getFullYear()),
    status: data.status || 'available',
    featured: data.featured || false,
  }));
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await writeCatRecord(client, cat, true);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
  return (await readCats(pool)).find((saved) => saved.id === cat.id) || cat;
}

export async function deleteCat(id: string): Promise<boolean> {
  return Boolean((await pool.query('DELETE FROM cats WHERE id = $1', [id])).rowCount);
}

export async function getAllApplications(): Promise<AdoptionApplication[]> {
  return readApplications(pool);
}

export async function getApplicationsForOwner(ownerId: string): Promise<AdoptionApplication[]> {
  return readApplications(pool, ownerId);
}

export async function createApplication(ownerId: string, data: Omit<AdoptionApplication, 'id' | 'createdAt' | 'status'>): Promise<AdoptionApplication> {
  const application = await storeApplicationMedia({ ...data, id: 'MUR-' + crypto.randomBytes(5).toString('hex').toUpperCase(), status: 'new', createdAt: new Date().toLocaleDateString('ru-RU'), adminNotes: '' });
  await writeApplicationRecord(pool, ownerId, application, true);
  return application;
}

export async function updateApplication(id: string, updates: Partial<AdoptionApplication>): Promise<AdoptionApplication | null> {
  const owner = await pool.query<{ owner_id: string }>('SELECT owner_id FROM applications WHERE id = $1', [id]);
  if (!owner.rowCount) return null;
  const current = (await readApplications(pool)).find((application) => application.id === id);
  if (!current) return null;
  const application = { ...current, ...updates, id };
  await writeApplicationRecord(pool, owner.rows[0].owner_id, application, false);
  return application;
}

export async function markApplicationReviewing(id: string): Promise<AdoptionApplication | null> {
  await pool.query(
    "UPDATE applications SET status = 'reviewing', updated_at = now() WHERE id = $1 AND status = 'new'",
    [id],
  );
  return (await readApplications(pool)).find((application) => application.id === id) || null;
}

export async function deleteApplication(id: string): Promise<boolean> {
  return Boolean((await pool.query('DELETE FROM applications WHERE id = $1', [id])).rowCount);
}

export async function getAllArticles(): Promise<ShelterArticle[]> {
  return readArticles(pool);
}

export async function createArticle(data: Omit<ShelterArticle, 'id' | 'publishedAt' | 'likesCount'>): Promise<ShelterArticle> {
  const article = await storeArticleMedia({ ...data, id: 'art-' + crypto.randomUUID(), publishedAt: new Date().toLocaleDateString('ru-RU'), likesCount: 0 });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await writeArticleRecord(client, article, true);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
  return (await readArticles(pool)).find((saved) => saved.id === article.id) || article;
}

export async function updateArticle(id: string, data: Partial<ShelterArticle>): Promise<ShelterArticle | null> {
  const current = (await readArticles(pool)).find((article) => article.id === id);
  if (!current) return null;
  const article = await storeArticleMedia({
    ...current,
    ...data,
    id: current.id,
    publishedAt: current.publishedAt,
    likesCount: current.likesCount || 0,
  });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await writeArticleRecord(client, article, false);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
  return article;
}
export async function deleteArticle(id: string): Promise<boolean> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const deleted = Boolean((await client.query('DELETE FROM articles WHERE id = $1', [id])).rowCount);
    await client.query('DELETE FROM tags WHERE NOT EXISTS (SELECT 1 FROM article_tag_links links WHERE links.tag_id=tags.id)');
    await client.query('COMMIT');
    return deleted;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}

export async function toggleArticleLike(id: string): Promise<number> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const lock = await client.query('SELECT id FROM articles WHERE id = $1 FOR UPDATE', [id]);
    if (!lock.rowCount) throw new Error('Article not found');
    const article = (await readArticles(client)).find((candidate) => candidate.id === id);
    if (!article) throw new Error('Article not found');
    article.likesCount = (article.likesCount || 0) + 1;
    await writeArticleRecord(client, article, false);
    await client.query('COMMIT');
    return article.likesCount;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}

export async function getShelterStats(): Promise<ShelterStats> {
  const result = await pool.query<{ data: ShelterStats }>(
    'SELECT data FROM site_settings WHERE key = $1',
    ['shelter_stats']
  );
  const data = result.rows[0]?.data;
  return {
    adoptedCount: Number.isInteger(data?.adoptedCount) && data.adoptedCount >= 0 ? data.adoptedCount : 384,
    currentCount: Number.isInteger(data?.currentCount) && data.currentCount >= 0 ? data.currentCount : 51,
  };
}

export async function setShelterStats(stats: ShelterStats): Promise<ShelterStats> {
  await pool.query(
    'INSERT INTO site_settings (key, data) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data, updated_at = now()',
    ['shelter_stats', stats]
  );
  return stats;
}

export async function getSiteContacts(): Promise<SiteContacts> {
  const result = await pool.query<{ data: SiteContacts }>(
    'SELECT data FROM site_settings WHERE key = $1',
    ['site_contacts']
  );
  return normalizeSiteContacts(result.rows[0]?.data);
}

export async function setSiteContacts(contacts: SiteContacts): Promise<SiteContacts> {
  await pool.query(
    'INSERT INTO site_settings (key, data) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data, updated_at = now()',
    ['site_contacts', contacts]
  );
  return contacts;
}

export async function getDonationSettings(): Promise<DonationSettings> {
  const result = await pool.query<{ data: DonationSettings }>(
    'SELECT data FROM site_settings WHERE key = $1',
    ['donation_settings']
  );
  const data = result.rows[0]?.data;
  return {
    title: typeof data?.title === 'string' ? data.title : 'Помочь переводом',
    description: typeof data?.description === 'string'
      ? data.description
      : 'Отсканируйте QR-код в мобильном приложении банка.',
    image: typeof data?.image === 'string' && data.image ? data.image : '/images/donation-qr.jpg',
  };
}

export async function setDonationSettings(settings: DonationSettings): Promise<DonationSettings> {
  const storedSettings = await storeDonationMedia(settings);
  await pool.query(
    'INSERT INTO site_settings (key, data) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data, updated_at = now()',
    ['donation_settings', storedSettings]
  );
  return storedSettings;
}

export async function getDatabaseBackupSettings(): Promise<DatabaseBackupSettings> {
  const result = await pool.query<{ data: DatabaseBackupSettings }>(
    'SELECT data FROM site_settings WHERE key = $1',
    ['database_backup_schedule']
  );
  const data = result.rows[0]?.data;
  return {
    time: typeof data?.time === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(data.time)
      ? data.time
      : DEFAULT_DATABASE_BACKUP_SETTINGS.time,
    retentionCount: Number.isInteger(data?.retentionCount) && data.retentionCount >= 1 && data.retentionCount <= 90
      ? data.retentionCount
      : DEFAULT_DATABASE_BACKUP_SETTINGS.retentionCount,
    directory: typeof data?.directory === 'string' && path.isAbsolute(data.directory)
      ? path.normalize(data.directory)
      : DEFAULT_DATABASE_BACKUP_SETTINGS.directory,
  };
}

export async function setDatabaseBackupSettings(settings: DatabaseBackupSettings): Promise<DatabaseBackupSettings> {
  await pool.query(
    'INSERT INTO site_settings (key, data) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data, updated_at = now()',
    ['database_backup_schedule', settings]
  );
  return settings;
}

export async function getMediaAsset(fileName: string): Promise<StoredMediaAsset | null> {
  if (!getMediaMimeType(fileName)) return null;
  const result = await pool.query<{ file_name: string; mime_type: string; content: Buffer; size_bytes: number }>(
    'SELECT file_name, mime_type, content, size_bytes FROM media_assets WHERE file_name = $1',
    [fileName],
  );
  if (!result.rowCount) return null;
  const row = result.rows[0];
  return { fileName: row.file_name, mimeType: row.mime_type, content: row.content, sizeBytes: row.size_bytes };
}

export async function getPreferences(ownerId: string): Promise<Record<string, unknown>> {
  const result = await pool.query<{ data: Record<string, unknown> }>('SELECT data FROM user_preferences WHERE owner_id = $1', [ownerId]);
  return result.rows[0]?.data || {};
}

export async function setPreference(ownerId: string, key: string, value: unknown): Promise<void> {
  const data = { ...(await getPreferences(ownerId)), [key]: value };
  await pool.query('INSERT INTO user_preferences (owner_id, data) VALUES ($1, $2) ON CONFLICT (owner_id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()', [ownerId, data]);
}

export async function getCatRatings(): Promise<CatRating[]> {
  const result = await pool.query<{ cat_id: string; likes_count: number }>(`
    SELECT cats.id AS cat_id, COALESCE(ratings.likes_count, 0)::int AS likes_count
    FROM cats
    LEFT JOIN (
      SELECT favorite.value AS cat_id, count(DISTINCT preferences.owner_id)::int AS likes_count
      FROM user_preferences AS preferences
      CROSS JOIN LATERAL jsonb_array_elements_text(
        CASE WHEN jsonb_typeof(preferences.data->'favorites') = 'array'
          THEN preferences.data->'favorites'
          ELSE '[]'::jsonb
        END
      ) AS favorite(value)
      GROUP BY favorite.value
    ) AS ratings ON ratings.cat_id = cats.id
    ORDER BY likes_count DESC, cats.id
  `);
  let previousLikes: number | null = null;
  let currentRank = 0;
  return result.rows.map((row, index) => {
    if (row.likes_count !== previousLikes) currentRank = index + 1;
    previousLikes = row.likes_count;
    return { catId: row.cat_id, likesCount: row.likes_count, rank: currentRank };
  });
}

export async function recordSiteVisit(ownerId: string): Promise<void> {
  await pool.query(`
    INSERT INTO site_visit_days (visit_date, owner_id, visits)
    VALUES (current_date, $1, 1)
    ON CONFLICT (visit_date, owner_id)
    DO UPDATE SET visits = site_visit_days.visits + 1, last_seen = now()
  `, [ownerId]);
}

export async function getVisitAnalytics(days: number): Promise<VisitAnalytics> {
  const [dailyResult, summaryResult] = await Promise.all([
    pool.query<{ date: string; visitors: number; visits: number }>(`
      WITH dates AS (
        SELECT generate_series(current_date - ($1::int - 1), current_date, interval '1 day')::date AS day
      )
      SELECT to_char(dates.day, 'YYYY-MM-DD') AS date,
        count(visits.owner_id)::int AS visitors,
        COALESCE(sum(visits.visits), 0)::int AS visits
      FROM dates
      LEFT JOIN site_visit_days AS visits ON visits.visit_date = dates.day
      GROUP BY dates.day
      ORDER BY dates.day
    `, [days]),
    pool.query<{
      visitors_today: number; visits_today: number;
      unique_7: number; visits_7: number;
      unique_30: number; visits_30: number;
    }>(`
      SELECT
        count(DISTINCT owner_id) FILTER (WHERE visit_date = current_date)::int AS visitors_today,
        COALESCE(sum(visits) FILTER (WHERE visit_date = current_date), 0)::int AS visits_today,
        count(DISTINCT owner_id) FILTER (WHERE visit_date >= current_date - 6)::int AS unique_7,
        COALESCE(sum(visits) FILTER (WHERE visit_date >= current_date - 6), 0)::int AS visits_7,
        count(DISTINCT owner_id) FILTER (WHERE visit_date >= current_date - 29)::int AS unique_30,
        COALESCE(sum(visits) FILTER (WHERE visit_date >= current_date - 29), 0)::int AS visits_30
      FROM site_visit_days
    `),
  ]);
  const summary = summaryResult.rows[0];
  return {
    days,
    daily: dailyResult.rows,
    summary: {
      visitorsToday: summary.visitors_today,
      visitsToday: summary.visits_today,
      uniqueVisitors7Days: summary.unique_7,
      visits7Days: summary.visits_7,
      uniqueVisitors30Days: summary.unique_30,
      visits30Days: summary.visits_30,
    },
  };
}

type UserRow = {
  email: string;
  display_name: string;
  password_hash: string;
  role: UserRole;
  verified_at: Date | null;
  created_at: Date;
  pending_cat_id?: string | null;
};

function normalizeEmail(email: string): string {
  return email.trim().toLocaleLowerCase('en-US');
}

async function deleteUnreferencedMediaAssets(client: PoolClient, mediaUrls: Array<string | null>): Promise<string[]> {
  const fileNames = [...new Set(mediaUrls
    .map((url) => url ? getStoredMediaFileName(url) : null)
    .filter((fileName): fileName is string => Boolean(fileName)))];
  if (!fileNames.length) return [];

  const deleted = await client.query<{ file_name: string }>(`
    DELETE FROM media_assets AS asset
    WHERE asset.file_name = ANY($1::text[])
      AND NOT EXISTS (SELECT 1 FROM owner_content WHERE media_url = '/media/' || asset.file_name)
      AND NOT EXISTS (SELECT 1 FROM cat_photos WHERE asset_file_name = asset.file_name)
      AND NOT EXISTS (SELECT 1 FROM cat_videos WHERE asset_file_name = asset.file_name OR thumbnail_asset_file_name = asset.file_name)
      AND NOT EXISTS (SELECT 1 FROM article_images WHERE asset_file_name = asset.file_name)
      AND NOT EXISTS (SELECT 1 FROM article_videos WHERE asset_file_name = asset.file_name OR thumbnail_asset_file_name = asset.file_name)
      AND NOT EXISTS (SELECT 1 FROM applications WHERE cat_photo_url = '/media/' || asset.file_name)
      AND NOT EXISTS (SELECT 1 FROM site_settings WHERE position('/media/' || asset.file_name IN data::text) > 0)
    RETURNING asset.file_name
  `, [fileNames]);
  return deleted.rows.map((row) => row.file_name);
}

async function deleteOwnerContentRows(client: PoolClient, email: string, catIds?: string[]): Promise<string[]> {
  const values: unknown[] = [normalizeEmail(email)];
  const catFilter = catIds ? ' AND cat_id = ANY($2::text[])' : '';
  if (catIds) values.push(catIds);
  const media = await client.query<{ media_url: string | null }>(
    `DELETE FROM owner_content WHERE author_email = $1${catFilter} RETURNING media_url`,
    values,
  );
  return deleteUnreferencedMediaAssets(client, media.rows.map((row) => row.media_url));
}

async function removeLegacyMediaFiles(fileNames: string[]): Promise<void> {
  await Promise.all(fileNames.map(async (fileName) => {
    try {
      await fs.promises.unlink(path.join(MEDIA_DIR, fileName));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.warn(`Не удалось удалить неиспользуемый медиафайл ${fileName}:`, error);
      }
    }
  }));
}

function secureTokenHash(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function accountFromRow(row: UserRow): Promise<UserAccount> {
  const cats = await pool.query<{ cat_id: string }>('SELECT cat_id FROM cat_owners WHERE owner_email = $1 ORDER BY created_at, cat_id', [row.email]);
  return {
    email: row.email,
    displayName: row.display_name,
    role: row.role,
    isVerified: Boolean(row.verified_at),
    createdAt: row.created_at.toISOString(),
    catIds: cats.rows.map((cat) => cat.cat_id),
  };
}

export async function getUserBySession(hash: string): Promise<UserAccount | null> {
  const result = await pool.query<UserRow>(`
    SELECT u.email, u.display_name, u.password_hash, u.role, u.verified_at, u.created_at
    FROM shelter_sessions s
    JOIN shelter_users u ON u.email = s.email
    WHERE s.token_hash = $1 AND s.expires_at > now()
  `, [hash]);
  return result.rowCount ? accountFromRow(result.rows[0]) : null;
}

export async function authenticateUser(email: string, password: string): Promise<{ user: UserAccount | null; needsVerification: boolean }> {
  const result = await pool.query<UserRow>(`
    SELECT email, display_name, password_hash, role, verified_at, created_at
    FROM shelter_users WHERE email = $1
  `, [normalizeEmail(email)]);
  if (!result.rowCount || !(await bcrypt.compare(password, result.rows[0].password_hash))) {
    return { user: null, needsVerification: false };
  }
  if (!result.rows[0].verified_at) return { user: null, needsVerification: true };
  return { user: await accountFromRow(result.rows[0]), needsVerification: false };
}

export async function createUserSession(hash: string, email: string, expiresAt: Date): Promise<void> {
  await pool.query(
    'INSERT INTO shelter_sessions (token_hash, email, expires_at) VALUES ($1, $2, $3) ON CONFLICT (token_hash) DO UPDATE SET email = EXCLUDED.email, expires_at = EXCLUDED.expires_at',
    [hash, normalizeEmail(email), expiresAt],
  );
}

export async function deleteUserSession(hash: string): Promise<void> {
  await pool.query('DELETE FROM shelter_sessions WHERE token_hash = $1', [hash]);
}

function createVerificationCode(): string {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
}

export async function registerOwner(email: string, password: string, displayName?: string, pendingCatId?: string): Promise<{ user: UserAccount; code: string }> {
  const normalized = normalizeEmail(email);
  const code = createVerificationCode();
  const existing = await pool.query<{ verified_at: Date | null }>('SELECT verified_at FROM shelter_users WHERE email = $1', [normalized]);
  if (existing.rowCount) {
    if (existing.rows[0].verified_at) throw Object.assign(new Error('Пользователь с таким e-mail уже зарегистрирован'), { status: 409 });
    throw Object.assign(new Error('Регистрация уже ожидает подтверждения. Запросите повторное письмо.'), { status: 409 });
  }
  const result = await pool.query<UserRow>(`
    INSERT INTO shelter_users (
      email, display_name, password_hash, role, verification_token_hash, verification_expires_at, pending_cat_id
    ) VALUES ($1, $2, $3, 'owner', $4, now() + interval '30 minutes', $5)
    RETURNING email, display_name, password_hash, role, verified_at, created_at, pending_cat_id
  `, [normalized, displayName?.trim() || normalized, await bcrypt.hash(password, 12), secureTokenHash(code), pendingCatId || null]);
  return { user: await accountFromRow(result.rows[0]), code };
}

export async function resendVerification(email: string): Promise<string | null> {
  const normalized = normalizeEmail(email);
  const code = createVerificationCode();
  const result = await pool.query(`
    UPDATE shelter_users
    SET verification_token_hash = $2, verification_expires_at = now() + interval '30 minutes',
        verification_attempts = 0, updated_at = now()
    WHERE email = $1 AND role = 'owner' AND verified_at IS NULL
  `, [normalized, secureTokenHash(code)]);
  return result.rowCount ? code : null;
}

export async function verifyRegistration(email: string, code: string): Promise<UserAccount | null> {
  const normalized = normalizeEmail(email);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query<UserRow>(`
      UPDATE shelter_users
      SET verified_at = now(), verification_token_hash = NULL, verification_expires_at = NULL,
          verification_attempts = 0, updated_at = now()
      WHERE email = $1 AND verification_token_hash = $2 AND verification_expires_at > now()
        AND verification_attempts < 5
      RETURNING email, display_name, password_hash, role, verified_at, created_at, pending_cat_id
    `, [normalized, secureTokenHash(code)]);
    if (!result.rowCount) {
      await client.query(`
        UPDATE shelter_users
        SET verification_attempts = LEAST(verification_attempts + 1, 5), updated_at = now()
        WHERE email = $1 AND role = 'owner' AND verified_at IS NULL
          AND verification_expires_at > now() AND verification_attempts < 5
      `, [normalized]);
      await client.query('COMMIT');
      return null;
    }
    const user = result.rows[0];
    if (user.pending_cat_id) {
      await client.query(
        'INSERT INTO cat_owners (cat_id, owner_email) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [user.pending_cat_id, user.email],
      );
      await client.query('UPDATE shelter_users SET pending_cat_id = NULL WHERE email = $1', [user.email]);
    }
    await client.query('COMMIT');
    return accountFromRow(user);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function setPendingUserCat(email: string, catId: string): Promise<void> {
  await pool.query(
    "UPDATE shelter_users SET pending_cat_id = $2, updated_at = now() WHERE email = $1 AND role = 'owner' AND verified_at IS NULL",
    [normalizeEmail(email), catId],
  );
}

export async function attachUserCat(email: string, catId: string): Promise<UserAccount> {
  const normalized = normalizeEmail(email);
  const result = await pool.query<UserRow>(`
    SELECT email, display_name, password_hash, role, verified_at, created_at
    FROM shelter_users WHERE email = $1 AND role = 'owner' AND verified_at IS NOT NULL
  `, [normalized]);
  if (!result.rowCount) throw Object.assign(new Error('Аккаунт владельца не найден или не подтверждён'), { status: 400 });
  await pool.query(
    'INSERT INTO cat_owners (cat_id, owner_email) VALUES ($1, $2) ON CONFLICT DO NOTHING',
    [catId, normalized],
  );
  return accountFromRow(result.rows[0]);
}

export async function createPasswordReset(email: string): Promise<string | null> {
  const token = crypto.randomBytes(32).toString('hex');
  const result = await pool.query(`
    UPDATE shelter_users
    SET reset_token_hash = $2, reset_expires_at = now() + interval '1 hour', updated_at = now()
    WHERE email = $1 AND verified_at IS NOT NULL
  `, [normalizeEmail(email), secureTokenHash(token)]);
  return result.rowCount ? token : null;
}

export async function resetPassword(token: string, newPassword: string): Promise<boolean> {
  const result = await pool.query<{ email: string }>(`
    UPDATE shelter_users
    SET password_hash = $2, reset_token_hash = NULL, reset_expires_at = NULL, updated_at = now()
    WHERE reset_token_hash = $1 AND reset_expires_at > now()
    RETURNING email
  `, [secureTokenHash(token), await bcrypt.hash(newPassword, 12)]);
  if (result.rowCount) await pool.query('DELETE FROM shelter_sessions WHERE email = $1', [result.rows[0].email]);
  return Boolean(result.rowCount);
}

export async function changeUserPassword(email: string, oldPassword: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
  const normalized = normalizeEmail(email);
  const result = await pool.query<{ password_hash: string }>('SELECT password_hash FROM shelter_users WHERE email = $1', [normalized]);
  if (!result.rowCount || !(await bcrypt.compare(oldPassword, result.rows[0].password_hash))) {
    return { success: false, error: 'Текущий пароль указан неверно' };
  }
  await pool.query('UPDATE shelter_users SET password_hash = $2, updated_at = now() WHERE email = $1', [normalized, await bcrypt.hash(newPassword, 12)]);
  await pool.query('DELETE FROM shelter_sessions WHERE email = $1', [normalized]);
  return { success: true };
}

export async function updateUserProfile(email: string, displayName: string): Promise<UserAccount | null> {
  const result = await pool.query<UserRow>(`
    UPDATE shelter_users SET display_name = $2, updated_at = now() WHERE email = $1
    RETURNING email, display_name, password_hash, role, verified_at, created_at
  `, [normalizeEmail(email), displayName.trim() || normalizeEmail(email)]);
  return result.rowCount ? accountFromRow(result.rows[0]) : null;
}

export async function listUsers(role: UserRole): Promise<UserAccount[]> {
  const result = await pool.query<UserRow>(`
    SELECT email, display_name, password_hash, role, verified_at, created_at
    FROM shelter_users
    ${role === 'curator' ? "WHERE role IN ('owner', 'curator')" : ''}
    ORDER BY role, created_at, email
  `);
  return Promise.all(result.rows.map(accountFromRow));
}

export async function createStaffUser(email: string, password: string, displayName: string, role: Extract<UserRole, 'administrator' | 'curator'>): Promise<UserAccount> {
  const normalized = normalizeEmail(email);
  const result = await pool.query<UserRow>(`
    INSERT INTO shelter_users (email, display_name, password_hash, role, verified_at)
    VALUES ($1, $2, $3, $4, now())
    RETURNING email, display_name, password_hash, role, verified_at, created_at
  `, [normalized, displayName.trim() || normalized, await bcrypt.hash(password, 12), role]);
  return accountFromRow(result.rows[0]);
}

export async function updateManagedUser(email: string, displayName: string, role: UserRole): Promise<UserAccount | null> {
  const normalized = normalizeEmail(email);
  const client = await pool.connect();
  let updated: UserRow | null = null;
  let deletedFiles: string[] = [];
  try {
    await client.query('BEGIN');
    const current = await client.query<{ role: UserRole }>('SELECT role FROM shelter_users WHERE email = $1 FOR UPDATE', [normalized]);
    if (!current.rowCount) {
      await client.query('ROLLBACK');
      return null;
    }
    if (current.rows[0].role === 'administrator' && role !== 'administrator') {
      const administrators = await client.query<{ count: string }>("SELECT count(*)::text AS count FROM shelter_users WHERE role = 'administrator'");
      if (Number(administrators.rows[0].count) <= 1) {
        throw Object.assign(new Error('Нельзя изменить роль единственного администратора'), { status: 400 });
      }
    }
    const result = await client.query<UserRow>(`
      UPDATE shelter_users
      SET display_name = $2, role = $3, updated_at = now()
      WHERE email = $1
      RETURNING email, display_name, password_hash, role, verified_at, created_at
    `, [normalized, displayName.trim() || normalized, role]);
    updated = result.rows[0];
    if (role !== 'owner') {
      deletedFiles = await deleteOwnerContentRows(client, normalized);
      await client.query('DELETE FROM cat_owners WHERE owner_email = $1', [normalized]);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  await removeLegacyMediaFiles(deletedFiles);
  return updated ? accountFromRow(updated) : null;
}

export async function assignUserCats(email: string, catIds: string[]): Promise<UserAccount | null> {
  const normalized = normalizeEmail(email);
  const user = await pool.query<UserRow>('SELECT email, display_name, password_hash, role, verified_at, created_at FROM shelter_users WHERE email = $1 AND role = $2', [normalized, 'owner']);
  if (!user.rowCount) return null;
  const uniqueCatIds = [...new Set(catIds)];
  const client = await pool.connect();
  let deletedFiles: string[] = [];
  try {
    await client.query('BEGIN');
    for (const catId of [...uniqueCatIds].sort()) {
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1)::bigint)', [catId]);
    }
    const allCats = new Map((await getAllCats()).map((cat) => [cat.id, cat]));
    const invalidCatId = uniqueCatIds.find((catId) => {
      const cat = allCats.get(catId);
      return !cat || (cat.status !== 'adopted' && cat.status !== 'trial');
    });
    if (invalidCatId) {
      throw Object.assign(new Error('Можно привязать только котиков со статусом «Нашёл дом» или «На испытательном сроке»'), { status: 400 });
    }
    if (uniqueCatIds.length > 0) {
      const occupied = await client.query<{ cat_id: string; owner_email: string }>(`
        SELECT cat_id, owner_email
        FROM cat_owners
        WHERE cat_id = ANY($1::text[]) AND owner_email <> $2
        LIMIT 1
      `, [uniqueCatIds, normalized]);
      if (occupied.rowCount) {
        const catName = allCats.get(occupied.rows[0].cat_id)?.name || occupied.rows[0].cat_id;
        throw Object.assign(new Error(`Котик «${catName}» уже привязан к другому владельцу`), { status: 409 });
      }
    }
    const existingAssignments = await client.query<{ cat_id: string }>('SELECT cat_id FROM cat_owners WHERE owner_email = $1', [normalized]);
    const retainedCatIds = new Set(uniqueCatIds);
    const detachedCatIds = existingAssignments.rows
      .map((row) => row.cat_id)
      .filter((catId) => !retainedCatIds.has(catId));
    if (detachedCatIds.length) deletedFiles = await deleteOwnerContentRows(client, normalized, detachedCatIds);
    await client.query('DELETE FROM cat_owners WHERE owner_email = $1', [normalized]);
    for (const catId of uniqueCatIds) {
      await client.query('INSERT INTO cat_owners (cat_id, owner_email) VALUES ($1, $2)', [catId, normalized]);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  await removeLegacyMediaFiles(deletedFiles);
  return accountFromRow(user.rows[0]);
}

export async function deleteManagedUser(email: string, actorRole: UserRole): Promise<boolean> {
  const normalized = normalizeEmail(email);
  const client = await pool.connect();
  let deletedFiles: string[] = [];
  let success = false;
  try {
    await client.query('BEGIN');
    const result = await client.query<{ role: UserRole; verified_at: Date | null }>('SELECT role, verified_at FROM shelter_users WHERE email = $1 FOR UPDATE', [normalized]);
    if (!result.rowCount) {
      await client.query('ROLLBACK');
      return false;
    }
    const target = result.rows[0];
    if (actorRole === 'curator' && (target.role !== 'owner' || target.verified_at)) {
      await client.query('ROLLBACK');
      return false;
    }
    if (actorRole !== 'administrator' && target.role !== 'owner') {
      await client.query('ROLLBACK');
      return false;
    }
    if (target.role === 'administrator') {
      await client.query('ROLLBACK');
      return false;
    }
    deletedFiles = await deleteOwnerContentRows(client, normalized);
    success = Boolean((await client.query('DELETE FROM shelter_users WHERE email = $1', [normalized])).rowCount);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  await removeLegacyMediaFiles(deletedFiles);
  return success;
}

export async function getCatsForOwner(email: string): Promise<Cat[]> {
  const catIds = await pool.query<{ cat_id: string }>('SELECT cat_id FROM cat_owners WHERE owner_email = $1', [normalizeEmail(email)]);
  const allowed = new Set(catIds.rows.map((row) => row.cat_id));
  return (await getAllCats()).filter((cat) => allowed.has(cat.id));
}

function ownerContentFromRow(row: Record<string, unknown>, includeEmail: boolean): OwnerContent {
  return {
    id: String(row.id),
    catId: String(row.cat_id),
    ...(includeEmail ? { authorEmail: String(row.author_email) } : {}),
    authorDisplayName: String(row.display_name),
    kind: row.kind as OwnerContentKind,
    text: String(row.body || ''),
    ...(row.media_url ? { mediaUrl: String(row.media_url) } : {}),
    isConfidential: Boolean(row.is_confidential),
    ...(row.answer ? { answer: String(row.answer) } : {}),
    ...(row.answered_by ? { answeredBy: String(row.answered_by) } : {}),
    moderationStatus: row.moderation_status as OwnerContent['moderationStatus'],
    createdAt: (row.created_at as Date).toISOString(),
    updatedAt: (row.updated_at as Date).toISOString(),
  };
}

const ownerContentSelect = `
  SELECT c.*, u.display_name
  FROM owner_content c JOIN shelter_users u ON u.email = c.author_email
`;

export async function getOwnerContentForCat(catId: string, viewerEmail?: string, staff = false): Promise<OwnerContent[]> {
  const values: unknown[] = [catId];
  let visibility = "c.moderation_status = 'approved' AND c.is_confidential = false";
  if (staff) visibility = 'true';
  else if (viewerEmail) {
    values.push(normalizeEmail(viewerEmail));
    visibility = "(c.moderation_status = 'approved' AND c.is_confidential = false) OR c.author_email = $2";
  }
  const result = await pool.query<Record<string, unknown>>(`${ownerContentSelect} WHERE c.cat_id = $1 AND (${visibility}) ORDER BY c.created_at`, values);
  return result.rows.map((row) => ownerContentFromRow(row, staff || Boolean(viewerEmail)));
}

export async function getPendingOwnerContent(): Promise<OwnerContent[]> {
  const result = await pool.query<Record<string, unknown>>(`${ownerContentSelect} WHERE c.moderation_status = 'pending' OR (c.kind = 'question' AND c.answer IS NULL) ORDER BY c.created_at`);
  return result.rows.map((row) => ownerContentFromRow(row, true));
}

export async function createOwnerContent(email: string, data: { catId: string; kind: OwnerContentKind; text?: string; mediaUrl?: string; isConfidential?: boolean }): Promise<OwnerContent> {
  const normalized = normalizeEmail(email);
  const ownership = await pool.query('SELECT 1 FROM cat_owners WHERE cat_id = $1 AND owner_email = $2', [data.catId, normalized]);
  if (!ownership.rowCount) throw Object.assign(new Error('Котик не привязан к вашему аккаунту'), { status: 403 });
  const cat = (await getAllCats()).find((candidate) => candidate.id === data.catId);
  if (!cat) throw Object.assign(new Error('Котик не найден'), { status: 404 });
  if (data.kind !== 'question' && cat.status !== 'adopted') {
    const message = cat.status === 'trial'
      ? 'Во время испытательного срока можно только задавать вопросы'
      : 'Фото, видео и комментарии доступны после завершения испытательного срока';
    throw Object.assign(new Error(message), { status: 400 });
  }
  let mediaUrl = data.mediaUrl?.trim() || null;
  if (mediaUrl?.startsWith('data:')) {
    const media = decodeMediaDataUrl(mediaUrl);
    if (!media) throw Object.assign(new Error('Формат медиафайла не поддерживается'), { status: 400 });
    await pool.query(
      'INSERT INTO media_assets (file_name, mime_type, content, size_bytes) VALUES ($1, $2, $3, $4) ON CONFLICT (file_name) DO NOTHING',
      [media.fileName, media.mimeType, media.content, media.content.length],
    );
    mediaUrl = '/media/' + media.fileName;
  }
  const id = 'owner-' + crypto.randomUUID();
  await pool.query(`
    INSERT INTO owner_content (id, cat_id, author_email, kind, body, media_url, is_confidential)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
  `, [id, data.catId, normalized, data.kind, data.text?.trim() || '', mediaUrl, data.kind === 'question' && Boolean(data.isConfidential)]);
  return (await getOwnerContentForCat(data.catId, normalized)).find((item) => item.id === id) as OwnerContent;
}

export async function updateOwnerContent(email: string, id: string, text: string): Promise<OwnerContent | null> {
  const result = await pool.query<{ cat_id: string }>(`
    UPDATE owner_content SET body = $3, moderation_status = 'pending', updated_at = now()
    WHERE id = $1 AND author_email = $2 AND kind = 'comment'
    RETURNING cat_id
  `, [id, normalizeEmail(email), text.trim()]);
  if (!result.rowCount) return null;
  return (await getOwnerContentForCat(result.rows[0].cat_id, email)).find((item) => item.id === id) || null;
}

export async function deleteOwnerContent(email: string, id: string): Promise<boolean> {
  const client = await pool.connect();
  let deletedFiles: string[] = [];
  let success = false;
  try {
    await client.query('BEGIN');
    const removed = await client.query<{ media_url: string | null }>(`
      DELETE FROM owner_content
      WHERE id = $1 AND author_email = $2 AND kind IN ('photo','video','comment')
      RETURNING media_url
    `, [id, normalizeEmail(email)]);
    success = Boolean(removed.rowCount);
    deletedFiles = await deleteUnreferencedMediaAssets(client, removed.rows.map((row) => row.media_url));
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  await removeLegacyMediaFiles(deletedFiles);
  return success;
}

export async function moderateOwnerContent(id: string, status: OwnerContent['moderationStatus'], answer: string | undefined, staffEmail: string): Promise<OwnerContent | null> {
  const result = await pool.query<{ cat_id: string }>(`
    UPDATE owner_content
    SET moderation_status = $2,
        answer = CASE WHEN kind = 'question' AND $3::text IS NOT NULL THEN $3 ELSE answer END,
        answered_by = CASE WHEN kind = 'question' AND $3::text IS NOT NULL THEN $4 ELSE answered_by END,
        updated_at = now()
    WHERE id = $1 RETURNING cat_id
  `, [id, status, answer?.trim() || null, normalizeEmail(staffEmail)]);
  if (!result.rowCount) return null;
  return (await getOwnerContentForCat(result.rows[0].cat_id, undefined, true)).find((item) => item.id === id) || null;
}

// Compatibility helpers for older imports. Authentication now uses named accounts.
export async function verifyAdminPassword(password: string): Promise<boolean> {
  return Boolean((await authenticateUser('vyanovska@gmail.com', password)).user);
}

export async function changeAdminPassword(oldPassword: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
  return changeUserPassword('vyanovska@gmail.com', oldPassword, newPassword);
}

export async function createAdminSession(hash: string, expiresAt: Date): Promise<void> {
  await createUserSession(hash, 'vyanovska@gmail.com', expiresAt);
}

export async function hasAdminSession(hash: string): Promise<boolean> {
  const user = await getUserBySession(hash);
  return Boolean(user && ['administrator', 'curator'].includes(user.role));
}

export async function deleteAdminSession(hash: string): Promise<void> {
  await deleteUserSession(hash);
}

export async function getDatabaseStats(): Promise<ServerDbStats> {
  const result = await pool.query<{ cats: string; apps: string; articles: string; preferences: string; updated: Date }>('SELECT (SELECT count(*) FROM cats)::text AS cats, (SELECT count(*) FROM applications)::text AS apps, (SELECT count(*) FROM articles)::text AS articles, (SELECT count(*) FROM user_preferences)::text AS preferences, now() AS updated');
  const row = result.rows[0];
  return { isSupported: true, database: process.env.PGDATABASE || 'cats', catsCount: Number(row.cats), appsCount: Number(row.apps), articlesCount: Number(row.articles), preferencesCount: Number(row.preferences), lastUpdated: row.updated.toISOString(), isServerStorage: true };
}

export async function exportFullDatabase(): Promise<ShelterDbSchema> {
  const [cats, applications, articles] = await Promise.all([
    getAllCats(),
    getAllApplications(),
    getAllArticles(),
  ]);
  return {
    version: 4,
    lastUpdated: new Date().toISOString(),
    cats: cats.map(inlineCatMedia),
    applications: applications.map(inlineApplicationMedia),
    articles: articles.map(inlineArticleMedia),
  };
}

export async function importFullDatabase(bundle: unknown): Promise<{ success: boolean; stats?: ServerDbStats; error?: string }> {
  if (!bundle || typeof bundle !== 'object') return { success: false, error: 'Некорректный файл импорта' };
  const raw = bundle as Record<string, unknown>;
  const payload = raw.data && typeof raw.data === 'object' ? raw.data as Record<string, unknown> : raw;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (Array.isArray(payload.applications)) await client.query('DELETE FROM applications');
    if (Array.isArray(payload.articles)) await client.query('DELETE FROM articles');
    if (Array.isArray(payload.cats)) {
      await client.query('DELETE FROM cats');
      for (const item of payload.cats as Cat[]) {
        const cat = await storeCatMedia(sanitizeCat(item));
        await writeCatRecord(client, cat, true);
      }
    }
    if (Array.isArray(payload.applications)) {
      for (const item of payload.applications as AdoptionApplication[]) {
        const application = await storeApplicationMedia(item);
        await writeApplicationRecord(client, 'legacy-import', application, true);
      }
    }
    if (Array.isArray(payload.articles)) {
      for (const item of payload.articles as ShelterArticle[]) {
        const article = await storeArticleMedia(item);
        await writeArticleRecord(client, article, true);
      }
    }
    await client.query('COMMIT');
    return { success: true, stats: await getDatabaseStats() };
  } catch (error) {
    await client.query('ROLLBACK');
    return { success: false, error: error instanceof Error ? error.message : 'Ошибка импорта' };
  } finally { client.release(); }
}














