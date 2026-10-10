import { Cat, AdoptionApplication, ShelterArticle } from '../types';
import realCatPhoto from '../assets/defaultCat';
import { INITIAL_CATS } from '../data/cats';
import { INITIAL_ARTICLES } from '../data/news';

export const DB_NAME = 'murlyka_shelter_db';
export const DB_VERSION = 2;

export const STORES = {
  CATS: 'cats',
  APPLICATIONS: 'applications',
  ARTICLES: 'articles',
  SETTINGS: 'settings',
} as const;

/**
 * Sanitize cat object so invalid relative paths or missing photos fall back to default photo
 */
export function sanitizeCat(cat: Cat): Cat {
  const { microchipped, ...restHealth } = (cat as any).health || {};
  let photos = Array.isArray(cat.photos) ? cat.photos : [];
  photos = photos.map((p) => {
    if (typeof p !== 'string' || !p.trim()) return realCatPhoto;
    if (
      p.includes('regenerated_image_') ||
      p.startsWith('./') ||
      p.startsWith('/src/') ||
      p.startsWith('src/')
    ) {
      return realCatPhoto;
    }
    return p;
  });
  if (photos.length === 0) {
    photos = [realCatPhoto];
  }
  return {
    ...cat,
    photos,
    health: restHealth,
  };
}

let dbInstance: IDBDatabase | null = null;
let dbOpenPromise: Promise<IDBDatabase> | null = null;

/**
 * Open or retrieve the existing IndexedDB connection
 */
export function getLocalDB(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance);
  if (dbOpenPromise) return dbOpenPromise;

  dbOpenPromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is not supported in this browser environment'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains(STORES.CATS)) {
        db.createObjectStore(STORES.CATS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.APPLICATIONS)) {
        db.createObjectStore(STORES.APPLICATIONS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.ARTICLES)) {
        db.createObjectStore(STORES.ARTICLES, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
        db.createObjectStore(STORES.SETTINGS, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      dbInstance.onversionchange = () => {
        dbInstance?.close();
        dbInstance = null;
      };
      resolve(dbInstance);
    };

    request.onerror = () => {
      dbOpenPromise = null;
      reject(request.error);
    };
  });

  return dbOpenPromise;
}

// -----------------------------------------------------------------------------
// CATS CRUD IN LOCAL DB
// -----------------------------------------------------------------------------

export async function dbGetCats(): Promise<Cat[] | null> {
  try {
    const db = await getLocalDB();
    const tx = db.transaction(STORES.CATS, 'readonly');
    const store = tx.objectStore(STORES.CATS);
    const request = store.getAll();

    return await new Promise<Cat[] | null>((resolve) => {
      request.onsuccess = () => {
        const result = request.result;
        if (Array.isArray(result) && result.length > 0) {
          resolve((result as Cat[]).map(sanitizeCat));
        } else {
          resolve(null);
        }
      };
      request.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function dbSaveAllCats(cats: Cat[]): Promise<void> {
  try {
    const db = await getLocalDB();
    const tx = db.transaction(STORES.CATS, 'readwrite');
    const store = tx.objectStore(STORES.CATS);
    store.clear();
    for (const cat of cats) {
      store.put(sanitizeCat(cat));
    }
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Graceful fallback
  }
}

export async function dbPutCat(cat: Cat): Promise<void> {
  try {
    const db = await getLocalDB();
    const tx = db.transaction(STORES.CATS, 'readwrite');
    const store = tx.objectStore(STORES.CATS);
    store.put(sanitizeCat(cat));
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Graceful fallback
  }
}

export async function dbDeleteCat(catId: string): Promise<void> {
  try {
    const db = await getLocalDB();
    const tx = db.transaction(STORES.CATS, 'readwrite');
    const store = tx.objectStore(STORES.CATS);
    store.delete(catId);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Graceful fallback
  }
}

// -----------------------------------------------------------------------------
// APPLICATIONS CRUD IN LOCAL DB
// -----------------------------------------------------------------------------

export async function dbGetApplications(): Promise<AdoptionApplication[] | null> {
  try {
    const db = await getLocalDB();
    const tx = db.transaction(STORES.APPLICATIONS, 'readonly');
    const store = tx.objectStore(STORES.APPLICATIONS);
    const request = store.getAll();

    return await new Promise<AdoptionApplication[] | null>((resolve) => {
      request.onsuccess = () => {
        const result = request.result;
        if (Array.isArray(result) && result.length > 0) {
          resolve(result as AdoptionApplication[]);
        } else {
          resolve(null);
        }
      };
      request.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function dbSaveAllApplications(apps: AdoptionApplication[]): Promise<void> {
  try {
    const db = await getLocalDB();
    const tx = db.transaction(STORES.APPLICATIONS, 'readwrite');
    const store = tx.objectStore(STORES.APPLICATIONS);
    store.clear();
    for (const app of apps) {
      store.put(app);
    }
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Graceful fallback
  }
}

export async function dbPutApplication(app: AdoptionApplication): Promise<void> {
  try {
    const db = await getLocalDB();
    const tx = db.transaction(STORES.APPLICATIONS, 'readwrite');
    const store = tx.objectStore(STORES.APPLICATIONS);
    store.put(app);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Graceful fallback
  }
}

export async function dbDeleteApplication(appId: string): Promise<void> {
  try {
    const db = await getLocalDB();
    const tx = db.transaction(STORES.APPLICATIONS, 'readwrite');
    const store = tx.objectStore(STORES.APPLICATIONS);
    store.delete(appId);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Graceful fallback
  }
}

// -----------------------------------------------------------------------------
// ARTICLES / NEWS CRUD IN LOCAL DB
// -----------------------------------------------------------------------------

export async function dbGetArticles(): Promise<ShelterArticle[] | null> {
  try {
    const db = await getLocalDB();
    const tx = db.transaction(STORES.ARTICLES, 'readonly');
    const store = tx.objectStore(STORES.ARTICLES);
    const request = store.getAll();

    return await new Promise<ShelterArticle[] | null>((resolve) => {
      request.onsuccess = () => {
        const result = request.result;
        if (Array.isArray(result) && result.length > 0) {
          resolve(result as ShelterArticle[]);
        } else {
          resolve(null);
        }
      };
      request.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function dbSaveAllArticles(articles: ShelterArticle[]): Promise<void> {
  try {
    const db = await getLocalDB();
    const tx = db.transaction(STORES.ARTICLES, 'readwrite');
    const store = tx.objectStore(STORES.ARTICLES);
    store.clear();
    for (const article of articles) {
      store.put(article);
    }
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Graceful fallback
  }
}

export async function dbPutArticle(article: ShelterArticle): Promise<void> {
  try {
    const db = await getLocalDB();
    const tx = db.transaction(STORES.ARTICLES, 'readwrite');
    const store = tx.objectStore(STORES.ARTICLES);
    store.put(article);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Graceful fallback
  }
}

export async function dbDeleteArticle(articleId: string): Promise<void> {
  try {
    const db = await getLocalDB();
    const tx = db.transaction(STORES.ARTICLES, 'readwrite');
    const store = tx.objectStore(STORES.ARTICLES);
    store.delete(articleId);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Graceful fallback
  }
}

// -----------------------------------------------------------------------------
// SETTINGS / PREFERENCES IN LOCAL DB
// -----------------------------------------------------------------------------

export async function dbGetSetting<T>(key: string, defaultValue: T): Promise<T> {
  try {
    const db = await getLocalDB();
    const tx = db.transaction(STORES.SETTINGS, 'readonly');
    const store = tx.objectStore(STORES.SETTINGS);
    const request = store.get(key);

    return await new Promise<T>((resolve) => {
      request.onsuccess = () => {
        const item = request.result;
        if (item && item.value !== undefined) {
          resolve(item.value as T);
        } else {
          resolve(defaultValue);
        }
      };
      request.onerror = () => resolve(defaultValue);
    });
  } catch {
    return defaultValue;
  }
}

export async function dbSaveSetting<T>(key: string, value: T): Promise<void> {
  try {
    const db = await getLocalDB();
    const tx = db.transaction(STORES.SETTINGS, 'readwrite');
    const store = tx.objectStore(STORES.SETTINGS);
    store.put({ key, value, updatedAt: new Date().toISOString() });
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Graceful fallback
  }
}

// -----------------------------------------------------------------------------
// DATABASE STATS & BACKUP EXPORT / IMPORT
// -----------------------------------------------------------------------------

export interface DatabaseStats {
  isSupported: boolean;
  catsCount: number;
  appsCount: number;
  articlesCount: number;
  settingsCount: number;
  lastUpdated?: string;
}

export async function dbGetDatabaseStats(): Promise<DatabaseStats> {
  try {
    const db = await getLocalDB();
    const getCount = (storeName: string): Promise<number> => {
      return new Promise((resolve) => {
        try {
          const tx = db.transaction(storeName, 'readonly');
          const store = tx.objectStore(storeName);
          const req = store.count();
          req.onsuccess = () => resolve(req.result || 0);
          req.onerror = () => resolve(0);
        } catch {
          resolve(0);
        }
      });
    };

    const [catsCount, appsCount, articlesCount, settingsCount] = await Promise.all([
      getCount(STORES.CATS),
      getCount(STORES.APPLICATIONS),
      getCount(STORES.ARTICLES),
      getCount(STORES.SETTINGS),
    ]);

    return {
      isSupported: true,
      catsCount,
      appsCount,
      articlesCount,
      settingsCount,
      lastUpdated: new Date().toLocaleTimeString('ru-RU'),
    };
  } catch {
    return {
      isSupported: false,
      catsCount: 0,
      appsCount: 0,
      articlesCount: 0,
      settingsCount: 0,
    };
  }
}

export interface DatabaseExportBundle {
  version: number;
  timestamp: string;
  source: string;
  data: {
    cats: Cat[];
    applications: AdoptionApplication[];
    articles: ShelterArticle[];
    settings: Record<string, any>;
  };
}

export async function dbExportAllData(): Promise<string> {
  const db = await getLocalDB();

  const getAllFromStore = <T>(storeName: string): Promise<T[]> => {
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const req = store.getAll();
        req.onsuccess = () => resolve((req.result as T[]) || []);
        req.onerror = () => resolve([]);
      } catch {
        resolve([]);
      }
    });
  };

  const [cats, applications, articles, settingsArr] = await Promise.all([
    getAllFromStore<Cat>(STORES.CATS),
    getAllFromStore<AdoptionApplication>(STORES.APPLICATIONS),
    getAllFromStore<ShelterArticle>(STORES.ARTICLES),
    getAllFromStore<{ key: string; value: any }>(STORES.SETTINGS),
  ]);

  const settingsMap: Record<string, any> = {};
  for (const s of settingsArr) {
    if (s && s.key) {
      settingsMap[s.key] = s.value;
    }
  }

  const bundle: DatabaseExportBundle = {
    version: DB_VERSION,
    timestamp: new Date().toISOString(),
    source: 'Фонд помощи животным «Доброта для кота»',
    data: {
      cats,
      applications,
      articles,
      settings: settingsMap,
    },
  };

  return JSON.stringify(bundle, null, 2);
}

export async function dbImportAllData(jsonStr: string): Promise<{
  success: boolean;
  catsCount: number;
  appsCount: number;
  articlesCount: number;
  error?: string;
}> {
  try {
    const parsed: DatabaseExportBundle = JSON.parse(jsonStr);
    if (!parsed || !parsed.data) {
      return { success: false, catsCount: 0, appsCount: 0, articlesCount: 0, error: 'Неверный формат резервной копии' };
    }

    const { cats, applications, articles, settings } = parsed.data;

    if (Array.isArray(cats) && cats.length > 0) {
      await dbSaveAllCats(cats);
    }
    if (Array.isArray(applications)) {
      await dbSaveAllApplications(applications);
    }
    if (Array.isArray(articles)) {
      await dbSaveAllArticles(articles);
    }
    if (settings && typeof settings === 'object') {
      for (const [key, value] of Object.entries(settings)) {
        await dbSaveSetting(key, value);
      }
    }

    return {
      success: true,
      catsCount: Array.isArray(cats) ? cats.length : 0,
      appsCount: Array.isArray(applications) ? applications.length : 0,
      articlesCount: Array.isArray(articles) ? articles.length : 0,
    };
  } catch (err: any) {
    return {
      success: false,
      catsCount: 0,
      appsCount: 0,
      articlesCount: 0,
      error: err?.message || 'Ошибка парсинга файла резервной копии',
    };
  }
}
