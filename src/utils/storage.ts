import { Cat } from '../types';
import realCatPhoto from '../assets/defaultCat';
import {
  dbGetCats,
  dbSaveAllCats,
  sanitizeCat,
  dbGetApplications,
  dbSaveAllApplications,
  dbGetArticles,
  dbSaveAllArticles,
  dbGetSetting,
  dbSaveSetting,
} from './localDatabase';

export {
  sanitizeCat,
  dbGetCats,
  dbSaveAllCats,
  dbGetApplications,
  dbSaveAllApplications,
  dbGetArticles,
  dbSaveAllArticles,
  dbGetSetting,
  dbSaveSetting,
};

/**
 * Cleanup legacy and obsolete localStorage keys to free up quota
 */
export function cleanupOldStorageKeys(): void {
  try {
    const obsoleteKeys = [
      'murlyka_shelter_real_cats_v9',
      'murlyka_shelter_real_cats_v8',
      'murlyka_shelter_real_cats_v6',
      'murlyka_shelter_real_cats_v5',
      'murlyka_shelter_real_cats_v4',
      'murlyka_shelter_real_cats_v3',
      'murlyka_shelter_real_cats_v2',
      'murlyka_shelter_real_cats_v1',
      'murlyka_shelter_real_cats',
      'murlyka_shelter_articles_v2',
      'murlyka_shelter_articles_v1',
    ];
    for (const key of obsoleteKeys) {
      localStorage.removeItem(key);
    }
    // Check custom hero image key for obsolete paths
    const customHero = localStorage.getItem('ogonyok_custom_hero_image');
    if (customHero) {
      if (
        customHero.includes('regenerated_image_') ||
        customHero.startsWith('./') ||
        customHero.startsWith('/src/') ||
        customHero.startsWith('src/')
      ) {
        localStorage.removeItem('ogonyok_custom_hero_image');
      }
    }
  } catch {
    // Ignore environments where localStorage access is restricted
  }
}

/**
 * Compress an Image File using Canvas to avoid filling up browser storage quotas.
 * Downscales to maxDimension (default 800px) and compresses to JPEG at target quality.
 */
export function compressImageFile(
  file: File,
  maxDimension = 800,
  quality = 0.75
): Promise<string> {
  return new Promise((resolve) => {
    if (!file || !file.type.startsWith('image/')) {
      resolve('');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      if (!result) {
        resolve('');
        return;
      }
      compressDataUrl(result, maxDimension, quality)
        .then(resolve)
        .catch(() => resolve(result));
    };
    reader.onerror = () => resolve('');
    reader.readAsDataURL(file);
  });
}

/**
 * Compresses an existing data URL / base64 image
 */
export function compressDataUrl(
  dataUrl: string,
  maxDimension = 800,
  quality = 0.75
): Promise<string> {
  return new Promise((resolve) => {
    if (!dataUrl || !dataUrl.startsWith('data:image/')) {
      resolve(dataUrl);
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;
        if (width <= 0 || height <= 0) {
          resolve(dataUrl);
          return;
        }
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const compressed = canvas.toDataURL('image/jpeg', quality);
        resolve(compressed);
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

/**
 * Load cats from IndexedDB
 */
export async function loadCatsFromIndexedDB(): Promise<Cat[] | null> {
  return dbGetCats();
}

/**
 * Save cats to IndexedDB (asynchronous, high capacity)
 */
export async function saveCatsToIndexedDB(cats: Cat[]): Promise<void> {
  return dbSaveAllCats(cats);
}

/**
 * Safe persistence handler for cats:
 * 1. Always persists to IndexedDB local database (primary storage).
 * 2. Cleans up old localStorage keys.
 * 3. Safely mirrors to localStorage with automatic degradation if quota is tight.
 */
export function saveCatsSafely(catsToSave: Cat[], storageKey: string): void {
  const sanitized = catsToSave.map(sanitizeCat);
  // Always trigger IndexedDB persistence immediately
  dbSaveAllCats(sanitized).catch(() => {});
  try {
    // Attempt mirror save to localStorage
    localStorage.setItem(storageKey, JSON.stringify(sanitized));
  } catch {
    cleanupOldStorageKeys();
    try {
      localStorage.setItem(storageKey, JSON.stringify(sanitized));
    } catch {
      try {
        const compactCats = sanitized.map((cat) => ({
          ...cat,
          photos: cat.photos ? cat.photos.slice(0, 2) : [],
        }));
        localStorage.setItem(storageKey, JSON.stringify(compactCats));
      } catch {
        // IndexedDB already has the full copy
      }
    }
  }
}
