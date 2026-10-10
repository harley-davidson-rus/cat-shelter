import { spawn } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';

const POSTGRES_ARCHIVE_SIGNATURE = Buffer.from('PGDMP');
const MAX_ERROR_LENGTH = 12000;

interface PostgresCliConnection {
  args: string[];
  env: NodeJS.ProcessEnv;
}

function postgresTool(name: 'pg_dump' | 'pg_restore'): string {
  const explicitPath = name === 'pg_dump' ? process.env.PG_DUMP_PATH : process.env.PG_RESTORE_PATH;
  if (explicitPath) return explicitPath;
  if (process.env.PG_BIN_DIR) {
    return path.join(process.env.PG_BIN_DIR, process.platform === 'win32' ? `${name}.exe` : name);
  }
  return name;
}

function postgresConnection(): PostgresCliConnection {
  let host = process.env.PGHOST || '127.0.0.1';
  let port = process.env.PGPORT || '5432';
  let database = process.env.PGDATABASE || 'cats';
  let user = process.env.PGUSER || 'chat_gpt';
  let password = process.env.PGPASSWORD;
  let sslMode = process.env.PGSSLMODE;

  if (process.env.DATABASE_URL) {
    const url = new URL(process.env.DATABASE_URL);
    host = url.hostname || host;
    port = url.port || port;
    database = decodeURIComponent(url.pathname.replace(/^\//, '')) || database;
    user = decodeURIComponent(url.username) || user;
    password = decodeURIComponent(url.password) || password;
    sslMode = url.searchParams.get('sslmode') || sslMode;
  }

  return {
    args: ['--host', host, '--port', port, '--username', user, '--dbname', database],
    env: {
      ...process.env,
      ...(password ? { PGPASSWORD: password } : {}),
      ...(sslMode ? { PGSSLMODE: sslMode } : {}),
    },
  };
}

function runPostgresTool(tool: 'pg_dump' | 'pg_restore', args: string[], env: NodeJS.ProcessEnv): Promise<void> {
  return new Promise((resolve, reject) => {
    const executable = postgresTool(tool);
    const child = spawn(executable, args, {
      env,
      windowsHide: true,
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    let stderr = '';

    child.stderr.on('data', (chunk: Buffer | string) => {
      if (stderr.length < MAX_ERROR_LENGTH) stderr += chunk.toString();
    });
    child.on('error', (error) => {
      reject(new Error(`Не удалось запустить ${tool}. Проверьте установку клиентских утилит PostgreSQL и переменную PG_BIN_DIR. ${error.message}`));
    });
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${tool} завершился с кодом ${code}: ${stderr.trim() || 'неизвестная ошибка'}`));
    });
  });
}

function temporaryBackupPath(): string {
  return path.join(os.tmpdir(), `cat-shelter-${crypto.randomUUID()}.backup`);
}

async function createPostgresBackupAt(outputPath: string): Promise<void> {
  const connection = postgresConnection();
  await runPostgresTool('pg_dump', [
    ...connection.args,
    '--format=custom',
    '--compress=6',
    '--no-owner',
    '--no-privileges',
    '--file', outputPath,
  ], connection.env);
}

export function isPostgresCustomBackup(data: Buffer): boolean {
  return data.length >= POSTGRES_ARCHIVE_SIGNATURE.length
    && data.subarray(0, POSTGRES_ARCHIVE_SIGNATURE.length).equals(POSTGRES_ARCHIVE_SIGNATURE);
}

export async function createPostgresBackup(): Promise<string> {
  const outputPath = temporaryBackupPath();
  try {
    await createPostgresBackupAt(outputPath);
    return outputPath;
  } catch (error) {
    await removeTemporaryBackup(outputPath);
    throw error;
  }
}

export interface ScheduledBackupFile {
  fileName: string;
  createdAt: string;
  sizeBytes: number;
}

export interface ServerDirectoryListing {
  currentPath: string | null;
  parentPath: string | null;
  directories: Array<{ name: string; path: string }>;
}

async function availableFileSystemRoots(): Promise<string[]> {
  if (process.platform !== 'win32') return ['/'];
  const candidates = Array.from({ length: 26 }, (_, index) => `${String.fromCharCode(65 + index)}:\\`);
  const checks = await Promise.all(candidates.map(async (candidate) => {
    try {
      const stats = await fs.promises.stat(candidate);
      return stats.isDirectory() ? candidate : null;
    } catch {
      return null;
    }
  }));
  return checks.filter((candidate): candidate is string => candidate !== null);
}

export async function browseServerDirectories(requestedPath?: string): Promise<ServerDirectoryListing> {
  if (!requestedPath) {
    const roots = await availableFileSystemRoots();
    return {
      currentPath: null,
      parentPath: null,
      directories: roots.map((root) => ({ name: root, path: root })),
    };
  }

  if (!path.isAbsolute(requestedPath)) throw new Error('Путь к папке должен быть абсолютным');
  const currentPath = path.normalize(requestedPath);
  const stats = await fs.promises.stat(currentPath);
  if (!stats.isDirectory()) throw new Error('Выбранный путь не является папкой');
  const entries = await fs.promises.readdir(currentPath, { withFileTypes: true });
  const directories = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({ name: entry.name, path: path.join(currentPath, entry.name) }))
    .sort((left, right) => left.name.localeCompare(right.name, 'ru'));
  const parent = path.dirname(currentPath);
  return {
    currentPath,
    parentPath: parent === currentPath ? null : parent,
    directories,
  };
}

export async function createServerDirectory(parentPath: string, directoryName: string): Promise<ServerDirectoryListing> {
  if (!path.isAbsolute(parentPath)) throw new Error('Родительский путь должен быть абсолютным');
  const normalizedParent = path.normalize(parentPath);
  const parentStats = await fs.promises.stat(normalizedParent);
  if (!parentStats.isDirectory()) throw new Error('Родительский путь не является папкой');

  const name = directoryName.trim();
  if (!name || name === '.' || name === '..') throw new Error('Укажите корректное имя новой папки');
  if (/[\\/\0]/.test(name)) throw new Error('Имя папки не должно содержать разделители пути');
  if (process.platform === 'win32') {
    if (/[<>:"|?*\x00-\x1F]/.test(name) || /[. ]$/.test(name)) {
      throw new Error('Имя папки содержит недопустимые для Windows символы');
    }
    if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i.test(name)) {
      throw new Error('Это имя зарезервировано Windows');
    }
  }

  const targetPath = path.join(normalizedParent, name);
  try {
    await fs.promises.mkdir(targetPath, { recursive: false });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
      throw new Error('Папка с таким именем уже существует');
    }
    throw error;
  }
  return browseServerDirectories(targetPath);
}

export async function assertBackupDirectoryWritable(directory: string): Promise<string> {
  if (!path.isAbsolute(directory)) throw new Error('Путь к папке backup должен быть абсолютным');
  const normalized = path.normalize(directory);
  const stats = await fs.promises.stat(normalized);
  if (!stats.isDirectory()) throw new Error('Выбранный путь не является папкой');
  const probePath = path.join(normalized, `.cat-shelter-write-test-${crypto.randomUUID()}.tmp`);
  try {
    await fs.promises.writeFile(probePath, 'backup write test', { flag: 'wx' });
  } finally {
    await fs.promises.unlink(probePath).catch(() => {});
  }
  return normalized;
}

export async function listScheduledPostgresBackups(directory: string): Promise<ScheduledBackupFile[]> {
  let entries: fs.Dirent[];
  try {
    entries = await fs.promises.readdir(directory, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }

  const files = await Promise.all(entries
    .filter((entry) => entry.isFile() && /^cat_shelter_auto_.+\.backup$/.test(entry.name))
    .map(async (entry) => {
      const stats = await fs.promises.stat(path.join(directory, entry.name));
      return { fileName: entry.name, createdAt: stats.mtime.toISOString(), sizeBytes: stats.size };
    }));
  return files.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export async function pruneScheduledPostgresBackups(retentionCount: number, directory: string): Promise<void> {
  const files = await listScheduledPostgresBackups(directory);
  await Promise.all(files.slice(retentionCount).map((file) =>
    fs.promises.unlink(path.join(directory, file.fileName))
  ));
}

function localBackupTimestamp(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return [
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    `${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`,
  ].join('_');
}

export async function createScheduledPostgresBackup(retentionCount: number, directory: string): Promise<ScheduledBackupFile> {
  await fs.promises.mkdir(directory, { recursive: true });
  const timestamp = localBackupTimestamp(new Date());
  const fileName = `cat_shelter_auto_${timestamp}.backup`;
  const outputPath = path.join(directory, fileName);
  const partialPath = `${outputPath}.partial`;
  try {
    await createPostgresBackupAt(partialPath);
    await fs.promises.rename(partialPath, outputPath);
    await pruneScheduledPostgresBackups(retentionCount, directory);
    const stats = await fs.promises.stat(outputPath);
    return { fileName, createdAt: stats.mtime.toISOString(), sizeBytes: stats.size };
  } catch (error) {
    await fs.promises.unlink(partialPath).catch(() => {});
    throw error;
  }
}

export async function restorePostgresBackup(archive: Buffer): Promise<void> {
  if (!isPostgresCustomBackup(archive)) {
    throw new Error('Выбранный файл не является резервной копией PostgreSQL в custom-формате');
  }

  const inputPath = temporaryBackupPath();
  const connection = postgresConnection();
  await fs.promises.writeFile(inputPath, archive, { flag: 'wx' });
  try {
    await runPostgresTool('pg_restore', [
      ...connection.args,
      '--clean',
      '--if-exists',
      '--no-owner',
      '--no-privileges',
      '--single-transaction',
      '--exit-on-error',
      inputPath,
    ], connection.env);
  } finally {
    await removeTemporaryBackup(inputPath);
  }
}

export async function removeTemporaryBackup(filePath: string): Promise<void> {
  await fs.promises.unlink(filePath).catch(() => {});
}
