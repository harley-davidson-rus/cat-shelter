import 'dotenv/config';
import crypto from 'crypto';
import pg from 'pg';
import { ensureBrowserCompatibleVideo, isHevcVideo } from '../server/videoTranscode';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  host: process.env.PGHOST || '127.0.0.1',
  port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE || 'cats',
  user: process.env.PGUSER || 'chat_gpt',
  password: process.env.PGPASSWORD,
  max: 2,
});

type VideoRow = {
  id: string;
  mime_type: string;
  content: Buffer;
};

try {
  const result = await pool.query<VideoRow>(`
    SELECT oc.id, ma.mime_type, ma.content
    FROM owner_content oc
    JOIN media_assets ma ON ma.file_name = substring(oc.media_url from '/media/(.*)$')
    WHERE oc.kind = 'video'
  `);
  let converted = 0;
  for (const row of result.rows) {
    if (!isHevcVideo(row.content)) continue;
    const video = await ensureBrowserCompatibleVideo(row.content, row.mime_type);
    const fileName = crypto.createHash('sha256').update(video.content).digest('hex') + '.mp4';
    await pool.query('BEGIN');
    try {
      await pool.query(
        'INSERT INTO media_assets (file_name, mime_type, content, size_bytes) VALUES ($1, $2, $3, $4) ON CONFLICT (file_name) DO NOTHING',
        [fileName, video.mimeType, video.content, video.content.length],
      );
      await pool.query('UPDATE owner_content SET media_url = $2, updated_at = now() WHERE id = $1', [row.id, '/media/' + fileName]);
      await pool.query('COMMIT');
      converted += 1;
    } catch (error) {
      await pool.query('ROLLBACK');
      throw error;
    }
  }
  console.log(`Converted HEVC owner videos: ${converted}`);
} finally {
  await pool.end();
}
