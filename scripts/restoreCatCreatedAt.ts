import 'dotenv/config';
import fs from 'fs';
import { execFileSync } from 'child_process';
import pg from 'pg';

const archivePath = process.argv[2];
if (!archivePath || !fs.existsSync(archivePath)) {
  throw new Error('Укажите существующий файл резервной копии PostgreSQL.');
}

const dump = execFileSync('pg_restore', ['--data-only', '--table=cats', archivePath], {
  encoding: 'utf8',
  maxBuffer: 20 * 1024 * 1024,
});

const timestamps = new Map<string, string>();
for (const line of dump.split(/\r?\n/)) {
  if (!line.startsWith('cat-')) continue;

  const firstTab = line.indexOf('\t');
  const lastTab = line.lastIndexOf('\t');
  if (firstTab < 0 || lastTab <= firstTab) continue;

  const id = line.slice(0, firstTab);
  const timestamp = line.slice(lastTab + 1);
  if (!Number.isFinite(Date.parse(timestamp))) {
    throw new Error('Некорректная дата в резервной копии для анкеты ' + id);
  }
  timestamps.set(id, timestamp);
}

if (timestamps.size === 0) {
  throw new Error('В резервной копии не найдены анкеты котиков.');
}

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  host: process.env.PGHOST || '127.0.0.1',
  port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE || 'cats',
  user: process.env.PGUSER || 'chat_gpt',
  password: process.env.PGPASSWORD,
  max: 1,
  connectionTimeoutMillis: 5000,
});

const client = await pool.connect();
try {
  await client.query('BEGIN');
  let restored = 0;
  for (const [id, timestamp] of timestamps) {
    const result = await client.query(
      'UPDATE cats SET created_at = $2 WHERE id = $1',
      [id, timestamp],
    );
    restored += result.rowCount || 0;
  }
  await client.query('COMMIT');
  console.log(JSON.stringify({ timestampsInBackup: timestamps.size, restored }, null, 2));
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
  await pool.end();
}
