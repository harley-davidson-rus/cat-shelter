import 'dotenv/config';
import { getAllApplications, getAllArticles, getAllCats, initDatabase } from '../server/db';

async function main() {
  const before = await initDatabase();
  const [cats, articles, applications] = await Promise.all([
    getAllCats(),
    getAllArticles(),
    getAllApplications(),
  ]);
  console.log(JSON.stringify({
    database: before.database,
    cats: cats.length,
    articles: articles.length,
    applications: applications.length,
    migration: 'relational-core-v1',
  }, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
