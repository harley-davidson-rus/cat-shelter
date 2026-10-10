import type { DatabaseBackupSettings } from '../src/types';
import { getDatabaseBackupSettings } from './db';
import {
  createScheduledPostgresBackup,
  listScheduledPostgresBackups,
  pruneScheduledPostgresBackups,
} from './postgresBackup';

export interface DatabaseBackupScheduleStatus extends DatabaseBackupSettings {
  timeZone: string;
  isRunning: boolean;
  nextRunAt: string | null;
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  lastFileName: string | null;
  lastError: string | null;
  storedBackupsCount: number;
}

let currentSettings: DatabaseBackupSettings = {
  time: '03:00',
  retentionCount: 7,
  directory: process.env.AUTO_BACKUP_DIR || 'data/backups',
};
let timer: NodeJS.Timeout | null = null;
let isRunning = false;
let nextRunAt: string | null = null;
let lastRunAt: string | null = null;
let lastSuccessAt: string | null = null;
let lastFileName: string | null = null;
let lastError: string | null = null;

function nextOccurrence(time: string): Date {
  const [hours, minutes] = time.split(':').map(Number);
  const next = new Date();
  next.setHours(hours, minutes, 0, 0);
  if (next.getTime() <= Date.now()) next.setDate(next.getDate() + 1);
  return next;
}

function scheduleNextRun(): void {
  if (timer) clearTimeout(timer);
  const next = nextOccurrence(currentSettings.time);
  nextRunAt = next.toISOString();
  timer = setTimeout(() => {
    void runScheduledDatabaseBackup().finally(scheduleNextRun);
  }, Math.max(1000, next.getTime() - Date.now()));
  timer.unref();
}

export async function runScheduledDatabaseBackup(): Promise<void> {
  if (isRunning) return;
  isRunning = true;
  nextRunAt = null;
  lastRunAt = new Date().toISOString();
  lastError = null;
  try {
    const file = await createScheduledPostgresBackup(currentSettings.retentionCount, currentSettings.directory);
    lastSuccessAt = file.createdAt;
    lastFileName = file.fileName;
    console.log(`[Backup] Automatic PostgreSQL backup created: ${file.fileName}`);
  } catch (error) {
    lastError = error instanceof Error ? error.message : String(error);
    console.error(`[Backup] Automatic PostgreSQL backup failed: ${lastError}`);
  } finally {
    isRunning = false;
  }
}

export async function reloadAutomaticBackupScheduler(): Promise<DatabaseBackupScheduleStatus> {
  currentSettings = await getDatabaseBackupSettings();
  await pruneScheduledPostgresBackups(currentSettings.retentionCount, currentSettings.directory);
  scheduleNextRun();
  return getAutomaticBackupStatus();
}

export async function getAutomaticBackupStatus(): Promise<DatabaseBackupScheduleStatus> {
  const files = await listScheduledPostgresBackups(currentSettings.directory);
  const latest = files[0];
  return {
    ...currentSettings,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'local',
    isRunning,
    nextRunAt,
    lastRunAt,
    lastSuccessAt: lastSuccessAt || latest?.createdAt || null,
    lastFileName: lastFileName || latest?.fileName || null,
    lastError,
    storedBackupsCount: files.length,
  };
}

export async function startAutomaticBackupScheduler(): Promise<void> {
  const status = await reloadAutomaticBackupScheduler();
  console.log(`[Backup] Daily PostgreSQL backup scheduled for ${status.time} (${status.timeZone}), keeping ${status.retentionCount} archives`);
}
