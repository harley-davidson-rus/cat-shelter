import 'dotenv/config';
import pg from 'pg';
import {
  readApplications,
  readArticles,
  readCats,
  writeApplicationRecord,
  writeArticleRecord,
  writeCatRecord,
} from '../server/relationalStore';
import { normalizeArticleTag } from '../src/utils/seo';

const config = {
  connectionString: process.env.DATABASE_URL,
  host: process.env.PGHOST || '127.0.0.1',
  port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE || 'cats',
  user: process.env.PGUSER || 'chat_gpt',
  password: process.env.PGPASSWORD,
};

async function main() {
  const pool = new pg.Pool({ ...config, max: 1 });
  const test = await pool.connect();
  await test.query('BEGIN');
  try {
    const cats = await readCats(test);
    const articles = await readArticles(test);
    const applications = await readApplications(test);
    const sourceCats = await test.query<{ data: Record<string, any> }>('SELECT data FROM public.cats ORDER BY id');
    const sourceArticles = await test.query<{ data: Record<string, any> }>('SELECT data FROM public.articles ORDER BY id');
    const catById = new Map(cats.map((cat) => [cat.id, cat]));
    const articleById = new Map(articles.map((article) => [article.id, article]));
    const catMismatches = sourceCats.rows.filter(({ data: source }) => {
      const migrated = catById.get(source.id);
      return !migrated
        || migrated.name !== source.name
        || migrated.status !== source.status
        || migrated.photos.length !== source.photos.length
        || migrated.photos.some((url, index) => url !== source.photos[index])
        || migrated.character.length !== source.character.length;
    }).map(({ data }) => data.id);
    const articleMismatches = sourceArticles.rows.filter(({ data: source }) => {
      const migrated = articleById.get(source.id);
      return !migrated
        || migrated.title !== source.title
        || migrated.coverImage !== source.coverImage
        || JSON.stringify(migrated.tags) !== JSON.stringify(source.tags.map(normalizeArticleTag))
        || migrated.likesCount !== (source.likesCount || 0);
    }).map(({ data }) => data.id);
    const counts = (await test.query(`
      SELECT
        (SELECT count(*) FROM cats)::int AS cats,
        (SELECT count(*) FROM cat_photos)::int AS cat_photos,
        (SELECT count(*) FROM cat_character_traits)::int AS traits,
        (SELECT count(*) FROM articles)::int AS articles,
        (SELECT count(*) FROM tags)::int AS tags,
        (SELECT count(*) FROM article_tag_links)::int AS article_tag_links,
        (SELECT count(*) FROM article_images)::int AS article_images,
        (SELECT count(*) FROM schema_migrations)::int AS migrations
    `)).rows[0];
    const foreignKeys = (await test.query<{ count: number }>(`
      SELECT count(*)::int AS count
      FROM information_schema.table_constraints
      WHERE table_schema = 'public' AND constraint_type='FOREIGN KEY'
    `)).rows[0].count;
    const sampleCat = { ...cats[0], id: 'verification-cat', name: 'Проверка миграции', photos: [...cats[0].photos] };
    await writeCatRecord(test, sampleCat, true);
    sampleCat.status = 'reserved';
    await writeCatRecord(test, sampleCat, false);
    const sampleArticle = {
      ...articles[0],
      id: 'verification-article',
      title: 'Проверка связей',
      relatedCatId: sampleCat.id,
      tags: ['Проверка', 'База данных'],
    };
    await writeArticleRecord(test, sampleArticle, true);
    const articleCreatedAtBeforeUpdate = (await test.query<{ created_at: Date }>(
      'SELECT created_at FROM articles WHERE id=$1',
      [sampleArticle.id],
    )).rows[0].created_at;
    sampleArticle.title = 'Проверка связей после редактирования';
    await writeArticleRecord(test, sampleArticle, false);
    const articleCreatedAtAfterUpdate = (await test.query<{ created_at: Date }>(
      'SELECT created_at FROM articles WHERE id=$1',
      [sampleArticle.id],
    )).rows[0].created_at;
    const sampleApplication = {
      id: 'verification-application', catId: sampleCat.id, catName: sampleCat.name,
      applicantName: 'Тест', phone: '+70000000000', email: 'test@example.com', city: 'Санкт-Петербург',
      housingType: 'own_apartment' as const, hasWindowScreens: true, hasOtherPets: false,
      hasExperience: true, familyAgreement: true, status: 'new' as const, createdAt: '12.10.2026',
    };
    await writeApplicationRecord(test, 'verification-owner', sampleApplication, true);
    await test.query('DELETE FROM cats WHERE id=$1', [sampleCat.id]);
    const relationResult = (await test.query(`
      SELECT
        (SELECT related_cat_id IS NULL FROM articles WHERE id='verification-article') AS article_detached,
        (SELECT cat_id IS NULL FROM applications WHERE id='verification-application') AS application_detached
    `)).rows[0];
    const writeReadResult = {
      catStatusBeforeDelete: 'reserved',
      articleCreatedAtPreservedOnUpdate:
        articleCreatedAtBeforeUpdate.getTime() === articleCreatedAtAfterUpdate.getTime(),
      articleDetachedAfterCatDelete: relationResult.article_detached,
      applicationDetachedAfterCatDelete: relationResult.application_detached,
    };
    const result = { counts, applications: applications.length, foreignKeys, catMismatches, articleMismatches, writeReadResult };
    console.log(JSON.stringify(result, null, 2));
    if (
      catMismatches.length
      || articleMismatches.length
      || !writeReadResult.articleCreatedAtPreservedOnUpdate
      || !writeReadResult.articleDetachedAfterCatDelete
      || !writeReadResult.applicationDetachedAfterCatDelete
    ) process.exitCode = 1;
  } finally {
    await test.query('ROLLBACK');
    test.release();
    await pool.end();
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
