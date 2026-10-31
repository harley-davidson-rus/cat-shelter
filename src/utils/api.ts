import {
  Cat, AdoptionApplication, ShelterArticle, ApplicationStatus, ShelterStats, SiteContacts, DonationSettings,
  AuthSession, OwnerContent, OwnerContentKind, UserAccount, UserRole,
} from '../types';
import realCatPhoto from '../assets/defaultCat';

export interface ServerDatabaseStats {
  isSupported: boolean;
  database: string;
  catsCount: number;
  appsCount: number;
  articlesCount: number;
  preferencesCount: number;
  lastUpdated: string;
  isServerStorage: boolean;
}

export interface DatabaseBackupScheduleStatus {
  time: string;
  retentionCount: number;
  directory: string;
  timeZone: string;
  isRunning: boolean;
  nextRunAt: string | null;
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  lastFileName: string | null;
  lastError: string | null;
  storedBackupsCount: number;
}

export interface ServerDirectoryListing {
  currentPath: string | null;
  parentPath: string | null;
  directories: Array<{ name: string; path: string }>;
}

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

export interface BootstrapData {
  cats: Cat[];
  applications: AdoptionApplication[];
  articles: ShelterArticle[];
  preferences: Record<string, unknown>;
  shelterStats: ShelterStats;
  siteContacts: SiteContacts;
  donationSettings: DonationSettings;
}

export const ADMIN_SESSION_EXPIRED_EVENT = 'shelter:admin-session-expired';
export const ADMIN_SESSION_AUTHENTICATED_EVENT = 'shelter:admin-session-authenticated';

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export function isAdminAuthenticationError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    let message = response.statusText;
    try { message = (await response.json()).error || message; } catch {}
    if (response.status === 401 && url !== '/api/admin/auth' && typeof window !== 'undefined') {
      window.dispatchEvent(new Event(ADMIN_SESSION_EXPIRED_EVENT));
    }
    throw new ApiError(message, response.status);
  }
  return response.json() as Promise<T>;
}

export function sanitizeCat(cat: Cat): Cat {
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

export async function apiGetCats(): Promise<Cat[]> {
  return (await request<Cat[]>('/api/cats')).map(sanitizeCat);
}

export async function apiGetBootstrap(): Promise<BootstrapData> {
  const data = await request<BootstrapData>('/api/bootstrap');
  return { ...data, cats: data.cats.map(sanitizeCat) };
}

export async function apiSaveCat(cat: Partial<Cat> & { id?: string }): Promise<Cat> {
  const result = await request<Cat>(cat.id ? '/api/cats/' + cat.id : '/api/cats', {
    method: cat.id ? 'PUT' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cat),
  });
  return sanitizeCat(result);
}

export async function apiDeleteCat(id: string): Promise<boolean> {
  return (await request<{ success: boolean }>('/api/cats/' + id, { method: 'DELETE' })).success;
}

export function apiGetApplications(): Promise<AdoptionApplication[]> {
  return request('/api/my/applications');
}

export function apiGetAdminApplications(): Promise<AdoptionApplication[]> {
  return request('/api/applications');
}

export function apiCreateApplication(data: Omit<AdoptionApplication, 'id' | 'createdAt' | 'status'>): Promise<AdoptionApplication> {
  return request('/api/applications', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export function apiUpdateApplication(id: string, status: ApplicationStatus, adminNotes?: string): Promise<AdoptionApplication> {
  return request('/api/applications/' + id, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, ...(adminNotes !== undefined ? { adminNotes } : {}) }),
  });
}

export async function apiDeleteApplication(id: string): Promise<boolean> {
  return (await request<{ success: boolean }>('/api/applications/' + id, { method: 'DELETE' })).success;
}

export function apiGetArticles(): Promise<ShelterArticle[]> {
  return request('/api/articles');
}

export function apiPublishArticle(data: Omit<ShelterArticle, 'id' | 'publishedAt' | 'likesCount'>): Promise<ShelterArticle> {
  return request('/api/articles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export function apiUpdateArticle(id: string, data: Omit<ShelterArticle, 'id' | 'publishedAt' | 'likesCount'>): Promise<ShelterArticle> {
  return request('/api/articles/' + id, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}
export async function apiDeleteArticle(id: string): Promise<boolean> {
  return (await request<{ success: boolean }>('/api/articles/' + id, { method: 'DELETE' })).success;
}

export async function apiLikeArticle(id: string): Promise<number> {
  return (await request<{ likesCount: number }>('/api/articles/' + id + '/like', { method: 'POST' })).likesCount;
}

export function apiGetShelterStats(): Promise<ShelterStats> {
  return request('/api/site-stats');
}

export function apiUpdateShelterStats(stats: ShelterStats): Promise<ShelterStats> {
  return request('/api/site-stats', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(stats),
  });
}

export function apiGetSiteContacts(): Promise<SiteContacts> {
  return request('/api/site-contacts');
}

export function apiUpdateSiteContacts(contacts: SiteContacts): Promise<SiteContacts> {
  return request('/api/site-contacts', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(contacts),
  });
}

export function apiGetDonationSettings(): Promise<DonationSettings> {
  return request('/api/donation-settings');
}

export function apiUpdateDonationSettings(settings: DonationSettings): Promise<DonationSettings> {
  return request('/api/donation-settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });
}

export function apiOpenMemoPrint(catId: string): void {
  window.open('/api/cats/' + encodeURIComponent(catId) + '/memo-print', '_blank', 'noopener,noreferrer');
}

export function apiGetSettings(): Promise<Record<string, unknown>> {
  return request('/api/preferences');
}

export async function apiSaveSetting(key: string, value: unknown): Promise<void> {
  await request('/api/preferences', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, value }),
  });
}

export async function apiLogin(email: string, password: string, catId?: string, invite?: string): Promise<AuthSession> {
  const session = await request<AuthSession>('/api/admin/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, catId, invite }),
  });
  if (session.authenticated && typeof window !== 'undefined') {
    if (session.user?.email) window.localStorage.setItem('shelter:last-login-email', session.user.email);
    window.dispatchEvent(new Event(ADMIN_SESSION_AUTHENTICATED_EVENT));
  }
  return session;
}

export async function apiVerifyAdminPassword(password: string): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  const email = window.localStorage.getItem('shelter:last-login-email') || 'vyanovska@gmail.com';
  try { return (await apiLogin(email, password)).authenticated; } catch { return false; }
}

export async function apiGetAdminSession(): Promise<AuthSession> {
  try {
    return await request<AuthSession>('/api/admin/session');
  } catch { return { authenticated: false }; }
}

export function apiRegisterOwner(email: string, password: string, passwordConfirm: string, displayName?: string, catId?: string, invite?: string): Promise<{ message: string }> {
  return request('/api/auth/register', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, passwordConfirm, displayName, catId, invite }),
  });
}

export function apiAcceptCatInvite(catId: string, invite: string): Promise<UserAccount> {
  return request('/api/account/accept-cat-invite', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ catId, invite }),
  });
}

export function apiResendVerification(email: string): Promise<{ message: string }> {
  return request('/api/auth/resend-verification', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }),
  });
}

const registrationVerificationRequests = new Map<string, Promise<{ message: string; user: UserAccount }>>();

export function apiVerifyRegistration(token: string): Promise<{ message: string; user: UserAccount }> {
  const pendingRequest = registrationVerificationRequests.get(token);
  if (pendingRequest) return pendingRequest;

  // Verification consumes a one-time token. Reuse the same request when React
  // StrictMode runs the link-processing effect twice during development.
  const verificationRequest = request<{ message: string; user: UserAccount }>('/api/auth/verify', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }),
  });
  registrationVerificationRequests.set(token, verificationRequest);
  void verificationRequest.catch(() => {
    if (registrationVerificationRequests.get(token) === verificationRequest) {
      registrationVerificationRequests.delete(token);
    }
  });
  return verificationRequest;
}

export function apiRequestPasswordReset(email: string): Promise<{ message: string }> {
  return request('/api/auth/request-password-reset', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }),
  });
}

export function apiResetPassword(token: string, password: string, passwordConfirm: string): Promise<{ message: string }> {
  return request('/api/auth/reset-password', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, password, passwordConfirm }),
  });
}

export function apiUpdateAccount(displayName: string): Promise<UserAccount> {
  return request('/api/account', {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ displayName }),
  });
}

export function apiGetUsers(): Promise<UserAccount[]> { return request('/api/users'); }

export function apiCreateStaffUser(data: { email: string; password: string; displayName: string; role: Extract<UserRole, 'administrator' | 'curator'> }): Promise<UserAccount> {
  return request('/api/users/staff', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
  });
}

export function apiUpdateUser(email: string, data: { displayName: string; role: UserRole }): Promise<UserAccount> {
  return request('/api/users/' + encodeURIComponent(email), {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
  });
}

export function apiAssignUserCats(email: string, catIds: string[]): Promise<UserAccount> {
  return request('/api/users/' + encodeURIComponent(email) + '/cats', {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ catIds }),
  });
}

export async function apiDeleteUser(email: string): Promise<boolean> {
  return (await request<{ success: boolean }>('/api/users/' + encodeURIComponent(email), { method: 'DELETE' })).success;
}

export function apiGetAccountCats(): Promise<Cat[]> { return request('/api/account/cats'); }
export function apiGetOwnerContent(catId: string): Promise<OwnerContent[]> { return request('/api/cats/' + encodeURIComponent(catId) + '/owner-content'); }
export function apiGetPendingOwnerContent(): Promise<OwnerContent[]> { return request('/api/owner-content/pending'); }

export function apiCreateOwnerContent(data: { catId: string; kind: OwnerContentKind; text?: string; mediaUrl?: string; isConfidential?: boolean }): Promise<OwnerContent> {
  return request('/api/owner-content', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
  });
}

export function apiCreateOwnerMediaBatch(data: { catId: string; kind: 'photo' | 'video'; mediaUrls: string[] }): Promise<OwnerContent[]> {
  return request('/api/owner-content/media-batch', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
  });
}

export function apiUpdateOwnerContent(id: string, text: string): Promise<OwnerContent> {
  return request('/api/owner-content/' + encodeURIComponent(id), {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }),
  });
}

export async function apiDeleteOwnerContent(id: string): Promise<boolean> {
  return (await request<{ success: boolean }>('/api/owner-content/' + encodeURIComponent(id), { method: 'DELETE' })).success;
}

export function apiModerateOwnerContent(id: string, status: OwnerContent['moderationStatus'], answer?: string): Promise<OwnerContent> {
  return request('/api/owner-content/' + encodeURIComponent(id) + '/moderate', {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status, answer }),
  });
}

export function apiRecordVisit(): Promise<{ success: boolean }> {
  return request('/api/analytics/visit', { method: 'POST' });
}

export function apiGetCatRatings(): Promise<CatRating[]> {
  return request('/api/admin/cat-ratings');
}

export function apiGetVisitAnalytics(days = 30): Promise<VisitAnalytics> {
  return request('/api/admin/visit-analytics?days=' + days);
}

export async function apiLogoutAdmin(): Promise<void> {
  await request('/api/admin/logout', { method: 'POST' });
}

export async function apiChangeAdminPassword(oldPassword: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
  try {
    return await request('/api/admin/password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ oldPassword, newPassword }),
    });
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Ошибка смены пароля' };
  }
}

export function apiGetDatabaseStats(): Promise<ServerDatabaseStats> {
  return request('/api/database/stats');
}

export function apiGetDatabaseBackupSchedule(): Promise<DatabaseBackupScheduleStatus> {
  return request('/api/database/backup-schedule');
}

export function apiUpdateDatabaseBackupSchedule(time: string, retentionCount: number, directory: string): Promise<DatabaseBackupScheduleStatus> {
  return request('/api/database/backup-schedule', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ time, retentionCount, directory }),
  });
}

export function apiBrowseServerBackupDirectories(path?: string): Promise<ServerDirectoryListing> {
  const query = path ? `?path=${encodeURIComponent(path)}` : '';
  return request(`/api/database/backup-directories${query}`);
}

export function apiCreateServerBackupDirectory(parentPath: string, name: string): Promise<ServerDirectoryListing> {
  return request('/api/database/backup-directories', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ parentPath, name }),
  });
}

export async function apiDownloadDatabaseBackup(): Promise<void> {
  const response = await fetch('/api/database/export');
  if (!response.ok) throw new Error('Не удалось выгрузить резервную копию');
  const url = URL.createObjectURL(await response.blob());
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'cat_shelter_postgres_' + new Date().toISOString().slice(0, 10) + '.backup';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export async function apiImportDatabaseBackup(file: File): Promise<{ success: boolean; error?: string; stats?: ServerDatabaseStats }> {
  try {
    return await request('/api/database/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: file,
    });
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Ошибка импорта' };
  }
}

