import type { Pool, PoolClient, QueryResultRow } from 'pg';
import type { AdoptionApplication, Cat, CatVideo, ShelterArticle } from '../src/types';
import { articleTagSlug, normalizeArticleTag } from '../src/utils/seo';
import { getStoredMediaFileName } from './media';

type DatabaseClient = Pool | PoolClient;

type CatRow = QueryResultRow & {
  id: string; name: string; age: string; age_category: Cat['ageCategory']; gender: Cat['gender'];
  size: Cat['size']; weight_kg: number | null; temperament: Cat['temperament']; color: string; breed: string;
  primary_photo_x: number | null; primary_photo_y: number | null; story: string;
  habit_litter_box: string; habit_scratching_post: string; habit_food_preference: string;
  health_vaccinated: boolean; health_sterilized: boolean; health_parasite_treated: boolean;
  health_fiv_felv_negative: boolean; health_special_needs: string | null;
  good_with_children: boolean; good_with_cats: boolean; good_with_dogs: boolean;
  arrival_date: string; status: Cat['status']; featured: boolean;
};

type ArticleRow = QueryResultRow & {
  id: string; title: string; category: ShelterArticle['category']; summary: string; content: string;
  cover_position_x: number | null; cover_position_y: number | null; published_at: string;
  read_time_minutes: number; author: string; author_role: string | null; event_date: string | null;
  event_location: string | null; related_cat_id: string | null; likes_count: number;
};

type ApplicationRow = QueryResultRow & {
  id: string; owner_id: string; cat_id: string | null; cat_name: string; cat_photo_url: string | null;
  applicant_name: string; phone: string; email: string; city: string;
  housing_type: AdoptionApplication['housingType']; has_window_screens: boolean; has_other_pets: boolean;
  other_pets_description: string | null; has_experience: boolean; experience_description: string | null;
  family_agreement: boolean; comment: string | null; status: AdoptionApplication['status'];
  submitted_at_text: string; admin_notes: string | null;
};

const SCHEMA_VERSION = 1;

async function addColumn(pool: Pool, table: string, definition: string): Promise<void> {
  try {
    await pool.query('ALTER TABLE ' + table + ' ADD COLUMN ' + definition);
  } catch (error) {
    if ((error as { code?: string }).code !== '42701') throw error;
  }
}

export async function ensureRelationalSchema(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version integer PRIMARY KEY,
      name text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  const columns: Record<'cats' | 'articles' | 'applications', string[]> = {
    cats: [
      "name text NOT NULL DEFAULT ''", "age text NOT NULL DEFAULT ''", "age_category text NOT NULL DEFAULT 'adult'",
      "gender text NOT NULL DEFAULT 'male'", "size text NOT NULL DEFAULT 'medium'", 'weight_kg real',
      "temperament text NOT NULL DEFAULT 'calm'", "color text NOT NULL DEFAULT ''", "breed text NOT NULL DEFAULT ''",
      'primary_photo_x real', 'primary_photo_y real', "story text NOT NULL DEFAULT ''",
      "habit_litter_box text NOT NULL DEFAULT ''", "habit_scratching_post text NOT NULL DEFAULT ''",
      "habit_food_preference text NOT NULL DEFAULT ''", 'health_vaccinated boolean NOT NULL DEFAULT false',
      'health_sterilized boolean NOT NULL DEFAULT false', 'health_parasite_treated boolean NOT NULL DEFAULT false',
      'health_fiv_felv_negative boolean NOT NULL DEFAULT false', 'health_special_needs text',
      'good_with_children boolean NOT NULL DEFAULT false', 'good_with_cats boolean NOT NULL DEFAULT false',
      'good_with_dogs boolean NOT NULL DEFAULT false', "arrival_date text NOT NULL DEFAULT ''",
      "status text NOT NULL DEFAULT 'available'", 'featured boolean NOT NULL DEFAULT false',
      'created_at timestamptz NOT NULL DEFAULT now()',
    ],
    articles: [
      "title text NOT NULL DEFAULT ''", "category text NOT NULL DEFAULT 'rescue_story'", "summary text NOT NULL DEFAULT ''",
      "content text NOT NULL DEFAULT ''", 'cover_position_x real', 'cover_position_y real',
      "published_at text NOT NULL DEFAULT ''", 'read_time_minutes integer NOT NULL DEFAULT 3',
      "author text NOT NULL DEFAULT ''", 'author_role text', 'event_date text', 'event_location text',
      'related_cat_id text', 'likes_count integer NOT NULL DEFAULT 0',
    ],
    applications: [
      'cat_id text', "cat_name text NOT NULL DEFAULT ''", 'cat_photo_url text',
      "applicant_name text NOT NULL DEFAULT ''", "phone text NOT NULL DEFAULT ''", "email text NOT NULL DEFAULT ''",
      "city text NOT NULL DEFAULT ''", "housing_type text NOT NULL DEFAULT 'own_apartment'",
      'has_window_screens boolean NOT NULL DEFAULT false', 'has_other_pets boolean NOT NULL DEFAULT false',
      'other_pets_description text', 'has_experience boolean NOT NULL DEFAULT false', 'experience_description text',
      'family_agreement boolean NOT NULL DEFAULT false', 'comment text', "status text NOT NULL DEFAULT 'new'",
      "submitted_at_text text NOT NULL DEFAULT ''", 'admin_notes text',
    ],
  };
  for (const [table, definitions] of Object.entries(columns)) {
    for (const definition of definitions) await addColumn(pool, table, definition);
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS cat_character_traits (
      cat_id text NOT NULL REFERENCES cats(id) ON DELETE CASCADE,
      position integer NOT NULL CHECK (position >= 0),
      trait text NOT NULL,
      PRIMARY KEY (cat_id, position)
    );
    CREATE TABLE IF NOT EXISTS cat_photos (
      cat_id text NOT NULL REFERENCES cats(id) ON DELETE CASCADE,
      position integer NOT NULL CHECK (position >= 0),
      url text NOT NULL,
      asset_file_name text REFERENCES media_assets(file_name) ON DELETE RESTRICT,
      PRIMARY KEY (cat_id, position)
    );
    CREATE INDEX IF NOT EXISTS cat_photos_asset_idx ON cat_photos(asset_file_name);
    CREATE TABLE IF NOT EXISTS cat_videos (
      cat_id text NOT NULL REFERENCES cats(id) ON DELETE CASCADE,
      video_id text NOT NULL,
      position integer NOT NULL CHECK (position >= 0),
      url text NOT NULL,
      asset_file_name text REFERENCES media_assets(file_name) ON DELETE RESTRICT,
      title text NOT NULL,
      duration text,
      thumbnail_url text,
      thumbnail_asset_file_name text REFERENCES media_assets(file_name) ON DELETE RESTRICT,
      is_short boolean NOT NULL DEFAULT false,
      PRIMARY KEY (cat_id, video_id),
      UNIQUE (cat_id, position)
    );

    CREATE TABLE IF NOT EXISTS article_images (
      article_id text NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
      role text NOT NULL CHECK (role IN ('cover', 'gallery')),
      position integer NOT NULL CHECK (position >= 0),
      url text NOT NULL,
      asset_file_name text REFERENCES media_assets(file_name) ON DELETE RESTRICT,
      PRIMARY KEY (article_id, role, position)
    );
    CREATE INDEX IF NOT EXISTS article_images_asset_idx ON article_images(asset_file_name);
    CREATE TABLE IF NOT EXISTS article_videos (
      article_id text NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
      video_id text NOT NULL,
      position integer NOT NULL CHECK (position >= 0),
      url text NOT NULL,
      asset_file_name text REFERENCES media_assets(file_name) ON DELETE RESTRICT,
      title text NOT NULL,
      duration text,
      thumbnail_url text,
      thumbnail_asset_file_name text REFERENCES media_assets(file_name) ON DELETE RESTRICT,
      is_short boolean NOT NULL DEFAULT false,
      PRIMARY KEY (article_id, video_id),
      UNIQUE (article_id, position)
    );
    CREATE TABLE IF NOT EXISTS tags (
      id bigserial PRIMARY KEY,
      name text NOT NULL,
      slug text NOT NULL UNIQUE
    );
    CREATE TABLE IF NOT EXISTS article_tag_links (
      article_id text NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
      tag_id bigint NOT NULL REFERENCES tags(id) ON DELETE RESTRICT,
      position integer NOT NULL CHECK (position >= 0),
      PRIMARY KEY (article_id, tag_id),
      UNIQUE (article_id, position)
    );

    CREATE INDEX IF NOT EXISTS cats_status_idx ON cats(status);
    CREATE INDEX IF NOT EXISTS cats_featured_idx ON cats(featured) WHERE featured = true;
    CREATE INDEX IF NOT EXISTS cats_updated_at_idx ON cats(updated_at DESC);
    CREATE INDEX IF NOT EXISTS cats_created_at_idx ON cats(created_at DESC);
    CREATE INDEX IF NOT EXISTS articles_published_idx ON articles(created_at DESC);
    CREATE INDEX IF NOT EXISTS articles_category_idx ON articles(category);
    CREATE INDEX IF NOT EXISTS applications_status_idx ON applications(status);
    CREATE INDEX IF NOT EXISTS applications_cat_id_idx ON applications(cat_id);
  `);

  const migrated = await pool.query('SELECT 1 FROM schema_migrations WHERE version = $1', [SCHEMA_VERSION]);
  if (migrated.rowCount) {
    await addRelationalConstraints(pool);
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const cats = await client.query<{ data: Cat }>('SELECT data FROM cats');
    const articles = await client.query<{ data: ShelterArticle }>('SELECT data FROM articles');
    const applications = await client.query<{ owner_id: string; data: AdoptionApplication }>('SELECT owner_id, data FROM applications');
    for (const row of cats.rows) await writeCatRecord(client, row.data, false);
    for (const row of articles.rows) await writeArticleRecord(client, row.data, false);
    for (const row of applications.rows) await writeApplicationRecord(client, row.owner_id, row.data, false);
    await client.query('INSERT INTO schema_migrations (version, name) VALUES ($1, $2)', [SCHEMA_VERSION, 'normalize_core_entities']);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  await addRelationalConstraints(pool);
}

async function addRelationalConstraints(pool: Pool): Promise<void> {
  await pool.query(`
    DO $constraints$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'articles_related_cat_fkey') THEN
        ALTER TABLE articles ADD CONSTRAINT articles_related_cat_fkey FOREIGN KEY (related_cat_id) REFERENCES cats(id) ON DELETE SET NULL;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'applications_cat_fkey') THEN
        ALTER TABLE applications ADD CONSTRAINT applications_cat_fkey FOREIGN KEY (cat_id) REFERENCES cats(id) ON DELETE SET NULL;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cats_age_category_check') THEN
        ALTER TABLE cats ADD CONSTRAINT cats_age_category_check CHECK (age_category IN ('kitten','young','adult','senior'));
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cats_gender_check') THEN
        ALTER TABLE cats ADD CONSTRAINT cats_gender_check CHECK (gender IN ('male','female'));
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cats_status_check') THEN
        ALTER TABLE cats ADD CONSTRAINT cats_status_check CHECK (status IN ('available','reserved','adopted'));
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'articles_category_check') THEN
        ALTER TABLE articles ADD CONSTRAINT articles_category_check CHECK (category IN ('rescue_story','shelter_success','event'));
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'applications_status_check') THEN
        ALTER TABLE applications ADD CONSTRAINT applications_status_check CHECK (status IN ('new','reviewing','meeting_scheduled','approved','rejected'));
      END IF;
    END $constraints$;
  `);
}

function mediaAsset(url?: string): string | null {
  return url ? getStoredMediaFileName(url) : null;
}

async function replaceCatChildren(db: DatabaseClient, cat: Cat): Promise<void> {
  await db.query('DELETE FROM cat_character_traits WHERE cat_id = $1', [cat.id]);
  for (const [position, trait] of (cat.character || []).entries()) {
    await db.query('INSERT INTO cat_character_traits (cat_id, position, trait) VALUES ($1, $2, $3)', [cat.id, position, trait]);
  }
  await db.query('DELETE FROM cat_photos WHERE cat_id = $1', [cat.id]);
  for (const [position, url] of (cat.photos || []).entries()) {
    await db.query('INSERT INTO cat_photos (cat_id, position, url, asset_file_name) VALUES ($1, $2, $3, $4)', [cat.id, position, url, mediaAsset(url)]);
  }
  await db.query('DELETE FROM cat_videos WHERE cat_id = $1', [cat.id]);
  for (const [position, video] of (cat.videos || []).entries()) {
    await insertVideo(db, 'cat_videos', 'cat_id', cat.id, video, position);
  }
}

async function insertVideo(db: DatabaseClient, table: 'cat_videos' | 'article_videos', ownerColumn: 'cat_id' | 'article_id', ownerId: string, video: CatVideo, position: number): Promise<void> {
  await db.query(
    `INSERT INTO ${table} (${ownerColumn}, video_id, position, url, asset_file_name, title, duration, thumbnail_url, thumbnail_asset_file_name, is_short)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [ownerId, video.id, position, video.url, mediaAsset(video.url), video.title, video.duration || null, video.thumbnail || null, mediaAsset(video.thumbnail), Boolean(video.isShort)],
  );
}

export async function writeCatRecord(db: DatabaseClient, cat: Cat, insert: boolean): Promise<void> {
  const values = [
    cat.id, cat.name, cat.age, cat.ageCategory, cat.gender, cat.size, cat.weightKg ?? null, cat.temperament,
    cat.color, cat.breed, cat.primaryPhotoPosition?.x ?? null, cat.primaryPhotoPosition?.y ?? null, cat.story,
    cat.habits.litterBox, cat.habits.scratchingPost, cat.habits.foodPreference,
    cat.health.vaccinated, cat.health.sterilized, cat.health.parasiteTreated, cat.health.fivFelvNegative,
    cat.health.specialNeeds || null, cat.goodWith.children, cat.goodWith.otherCats, cat.goodWith.dogs,
    cat.arrivalDate, cat.status, Boolean(cat.featured), cat,
  ];
  if (insert) {
    await db.query(`INSERT INTO cats (
      id,name,age,age_category,gender,size,weight_kg,temperament,color,breed,primary_photo_x,primary_photo_y,story,
      habit_litter_box,habit_scratching_post,habit_food_preference,health_vaccinated,health_sterilized,
      health_parasite_treated,health_fiv_felv_negative,health_special_needs,good_with_children,good_with_cats,
      good_with_dogs,arrival_date,status,featured,data
    ) VALUES (${values.map((_, index) => '$' + (index + 1)).join(',')})`, values);
  } else {
    await db.query(`UPDATE cats SET
      name=$2,age=$3,age_category=$4,gender=$5,size=$6,weight_kg=$7,temperament=$8,color=$9,breed=$10,
      primary_photo_x=$11,primary_photo_y=$12,story=$13,habit_litter_box=$14,habit_scratching_post=$15,
      habit_food_preference=$16,health_vaccinated=$17,health_sterilized=$18,health_parasite_treated=$19,
      health_fiv_felv_negative=$20,health_special_needs=$21,good_with_children=$22,good_with_cats=$23,
      good_with_dogs=$24,arrival_date=$25,status=$26,featured=$27,data=$28,updated_at=now() WHERE id=$1`, values);
  }
  await replaceCatChildren(db, cat);
}

export async function readCats(db: DatabaseClient): Promise<Cat[]> {
  const result = await db.query<CatRow>('SELECT * FROM cats ORDER BY created_at DESC, id DESC');
  const traits = await db.query('SELECT cat_id, position, trait FROM cat_character_traits ORDER BY cat_id, position');
  const photos = await db.query('SELECT cat_id, position, url FROM cat_photos ORDER BY cat_id, position');
  const videos = await db.query('SELECT cat_id, video_id, position, url, title, duration, thumbnail_url, is_short FROM cat_videos ORDER BY cat_id, position');
  return result.rows.map((row) => ({
    id: row.id, name: row.name, age: row.age, ageCategory: row.age_category, gender: row.gender, size: row.size,
    weightKg: row.weight_kg ?? undefined, temperament: row.temperament, color: row.color, breed: row.breed,
    photos: photos.rows.filter((item) => item.cat_id === row.id).map((item) => item.url),
    primaryPhotoPosition: row.primary_photo_x === null || row.primary_photo_y === null ? undefined : { x: row.primary_photo_x, y: row.primary_photo_y },
    videos: videos.rows.filter((item) => item.cat_id === row.id).map((item) => ({
      id: item.video_id, url: item.url, title: item.title, duration: item.duration || undefined,
      thumbnail: item.thumbnail_url || undefined, isShort: item.is_short,
    })),
    character: traits.rows.filter((item) => item.cat_id === row.id).map((item) => item.trait),
    story: row.story,
    habits: { litterBox: row.habit_litter_box, scratchingPost: row.habit_scratching_post, foodPreference: row.habit_food_preference },
    health: { vaccinated: row.health_vaccinated, sterilized: row.health_sterilized, parasiteTreated: row.health_parasite_treated, fivFelvNegative: row.health_fiv_felv_negative, ...(row.health_special_needs ? { specialNeeds: row.health_special_needs } : {}) },
    goodWith: { children: row.good_with_children, otherCats: row.good_with_cats, dogs: row.good_with_dogs },
    arrivalDate: row.arrival_date, status: row.status, featured: row.featured,
  }));
}

async function replaceArticleChildren(db: DatabaseClient, article: ShelterArticle): Promise<void> {
  await db.query('DELETE FROM article_images WHERE article_id = $1', [article.id]);
  await db.query('INSERT INTO article_images (article_id, role, position, url, asset_file_name) VALUES ($1,$2,$3,$4,$5)', [article.id, 'cover', 0, article.coverImage, mediaAsset(article.coverImage)]);
  for (const [position, url] of (article.galleryImages || []).entries()) {
    await db.query('INSERT INTO article_images (article_id, role, position, url, asset_file_name) VALUES ($1,$2,$3,$4,$5)', [article.id, 'gallery', position, url, mediaAsset(url)]);
  }
  await db.query('DELETE FROM article_videos WHERE article_id = $1', [article.id]);
  for (const [position, video] of (article.videos || []).entries()) {
    await insertVideo(db, 'article_videos', 'article_id', article.id, video, position);
  }
  await db.query('DELETE FROM article_tag_links WHERE article_id = $1', [article.id]);
  const uniqueTags = new Set<string>();
  for (const rawTag of article.tags || []) {
    const name = normalizeArticleTag(rawTag);
    const slug = articleTagSlug(name);
    if (!name || uniqueTags.has(slug)) continue;
    uniqueTags.add(slug);
    const tag = await db.query<{ id: string }>(
      'INSERT INTO tags (name, slug) VALUES ($1,$2) ON CONFLICT (slug) DO UPDATE SET name=EXCLUDED.name RETURNING id',
      [name, slug],
    );
    await db.query('INSERT INTO article_tag_links (article_id, tag_id, position) VALUES ($1,$2,$3)', [article.id, tag.rows[0].id, uniqueTags.size - 1]);
  }
  await db.query('DELETE FROM tags WHERE NOT EXISTS (SELECT 1 FROM article_tag_links links WHERE links.tag_id=tags.id)');
}

export async function writeArticleRecord(db: DatabaseClient, article: ShelterArticle, insert: boolean): Promise<void> {
  const values = [article.id, article.title, article.category, article.summary, article.content,
    article.coverPosition?.x ?? null, article.coverPosition?.y ?? null, article.publishedAt, article.readTimeMinutes,
    article.author, article.authorRole || null, article.eventDate || null, article.eventLocation || null,
    article.relatedCatId || null, article.likesCount || 0, article];
  if (insert) {
    await db.query(`INSERT INTO articles (id,title,category,summary,content,cover_position_x,cover_position_y,published_at,
      read_time_minutes,author,author_role,event_date,event_location,related_cat_id,likes_count,data)
      VALUES (${values.map((_, index) => '$' + (index + 1)).join(',')})`, values);
  } else {
    await db.query(`UPDATE articles SET title=$2,category=$3,summary=$4,content=$5,cover_position_x=$6,
      cover_position_y=$7,published_at=$8,read_time_minutes=$9,author=$10,author_role=$11,event_date=$12,
      event_location=$13,related_cat_id=$14,likes_count=$15,data=$16,updated_at=now() WHERE id=$1`, values);
  }
  await replaceArticleChildren(db, article);
}

export async function readArticles(db: DatabaseClient): Promise<ShelterArticle[]> {
  const result = await db.query<ArticleRow>('SELECT * FROM articles ORDER BY created_at DESC, id DESC');
  const images = await db.query('SELECT article_id, role, position, url FROM article_images ORDER BY article_id, role, position');
  const videos = await db.query('SELECT article_id, video_id, position, url, title, duration, thumbnail_url, is_short FROM article_videos ORDER BY article_id, position');
  const tags = await db.query('SELECT links.article_id, links.position, tags.name FROM article_tag_links links JOIN tags ON tags.id=links.tag_id ORDER BY links.article_id, links.position');
  return result.rows.map((row) => {
    const articleImages = images.rows.filter((item) => item.article_id === row.id);
    return {
      id: row.id, title: row.title, category: row.category, summary: row.summary, content: row.content,
      coverImage: articleImages.find((item) => item.role === 'cover')?.url || '',
      coverPosition: row.cover_position_x === null || row.cover_position_y === null ? undefined : { x: row.cover_position_x, y: row.cover_position_y },
      galleryImages: articleImages.filter((item) => item.role === 'gallery').map((item) => item.url),
      videos: videos.rows.filter((item) => item.article_id === row.id).map((item) => ({ id: item.video_id, url: item.url, title: item.title, duration: item.duration || undefined, thumbnail: item.thumbnail_url || undefined, isShort: item.is_short })),
      publishedAt: row.published_at, readTimeMinutes: row.read_time_minutes, author: row.author,
      authorRole: row.author_role || undefined, eventDate: row.event_date || undefined, eventLocation: row.event_location || undefined,
      relatedCatId: row.related_cat_id || undefined,
      tags: tags.rows.filter((item) => item.article_id === row.id).map((item) => item.name), likesCount: row.likes_count,
    };
  });
}

export async function writeApplicationRecord(db: DatabaseClient, ownerId: string, application: AdoptionApplication, insert: boolean): Promise<void> {
  const values = [application.id, ownerId, application.catId || null, application.catName, application.catPhoto || null,
    application.applicantName, application.phone, application.email, application.city, application.housingType,
    application.hasWindowScreens, application.hasOtherPets, application.otherPetsDescription || null,
    application.hasExperience, application.experienceDescription || null, application.familyAgreement,
    application.comment || null, application.status, application.createdAt, application.adminNotes || null, application];
  if (insert) {
    await db.query(`INSERT INTO applications (id,owner_id,cat_id,cat_name,cat_photo_url,applicant_name,phone,email,city,
      housing_type,has_window_screens,has_other_pets,other_pets_description,has_experience,experience_description,
      family_agreement,comment,status,submitted_at_text,admin_notes,data)
      VALUES (${values.map((_, index) => '$' + (index + 1)).join(',')})`, values);
  } else {
    await db.query(`UPDATE applications SET owner_id=$2,cat_id=$3,cat_name=$4,cat_photo_url=$5,applicant_name=$6,
      phone=$7,email=$8,city=$9,housing_type=$10,has_window_screens=$11,has_other_pets=$12,
      other_pets_description=$13,has_experience=$14,experience_description=$15,family_agreement=$16,
      comment=$17,status=$18,submitted_at_text=$19,admin_notes=$20,data=$21,updated_at=now() WHERE id=$1`, values);
  }
}

export async function readApplications(db: DatabaseClient, ownerId?: string): Promise<AdoptionApplication[]> {
  const result = await db.query<ApplicationRow>(
    `SELECT * FROM applications ${ownerId ? 'WHERE owner_id=$1' : ''} ORDER BY created_at DESC`,
    ownerId ? [ownerId] : [],
  );
  return result.rows.map((row) => ({
    id: row.id, catId: row.cat_id || '', catName: row.cat_name, catPhoto: row.cat_photo_url || undefined,
    applicantName: row.applicant_name, phone: row.phone, email: row.email, city: row.city,
    housingType: row.housing_type, hasWindowScreens: row.has_window_screens, hasOtherPets: row.has_other_pets,
    otherPetsDescription: row.other_pets_description || undefined, hasExperience: row.has_experience,
    experienceDescription: row.experience_description || undefined, familyAgreement: row.family_agreement,
    comment: row.comment || undefined, status: row.status, createdAt: row.submitted_at_text,
    adminNotes: row.admin_notes || undefined,
  }));
}
