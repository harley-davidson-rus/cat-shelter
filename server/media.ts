import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type { AdoptionApplication, Cat, CatVideo, DonationSettings, ShelterArticle } from '../src/types';

export const MEDIA_DIR = path.resolve(process.cwd(), 'data', 'media');

export interface DecodedMediaDataUrl {
  fileName: string;
  mimeType: string;
  content: Buffer;
}

const MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
};

const EXTENSION_MIMES: Record<string, string> = Object.fromEntries(
  Object.entries(MIME_EXTENSIONS).map(([mime, extension]) => [extension, mime]),
);

export function getStoredMediaFileName(value: string): string | null {
  const match = /^\/media\/([a-f0-9]{64}\.[a-z0-9]+)$/.exec(value);
  return match?.[1] || null;
}

export function getMediaMimeType(fileName: string): string | null {
  const match = /^[a-f0-9]{64}\.([a-z0-9]+)$/.exec(fileName);
  return match ? EXTENSION_MIMES[match[1]] || null : null;
}

export function decodeMediaDataUrl(value: string): DecodedMediaDataUrl | null {
  if (!value.startsWith('data:')) return null;
  const match = /^data:([^;,]+);base64,([\s\S]+)$/.exec(value);
  if (!match) return null;

  const mime = match[1].toLowerCase();
  const extension = MIME_EXTENSIONS[mime];
  if (!extension) return null;

  const bytes = Buffer.from(match[2], 'base64');
  if (bytes.length === 0) return null;

  const fileName = crypto.createHash('sha256').update(bytes).digest('hex') + '.' + extension;
  return { fileName, mimeType: mime, content: bytes };
}

function storeDataUrl(value: string): string {
  const media = decodeMediaDataUrl(value);
  return media ? '/media/' + media.fileName : value;
}

function restoreMediaUrl(value: string): string {
  const match = /^\/media\/([a-f0-9]{64})\.([a-z0-9]+)$/.exec(value);
  if (!match) return value;
  const filePath = path.join(MEDIA_DIR, match[1] + '.' + match[2]);
  if (!fs.existsSync(filePath)) return value;
  const mime = EXTENSION_MIMES[match[2]];
  if (!mime) return value;
  return 'data:' + mime + ';base64,' + fs.readFileSync(filePath).toString('base64');
}

function externalizeVideo(video: CatVideo): CatVideo {
  return {
    ...video,
    url: storeDataUrl(video.url),
    thumbnail: video.thumbnail ? storeDataUrl(video.thumbnail) : video.thumbnail,
  };
}

function inlineVideo(video: CatVideo): CatVideo {
  return {
    ...video,
    url: restoreMediaUrl(video.url),
    thumbnail: video.thumbnail ? restoreMediaUrl(video.thumbnail) : video.thumbnail,
  };
}

export function externalizeCatMedia(cat: Cat): Cat {
  return {
    ...cat,
    photos: cat.photos.map(storeDataUrl),
    videos: (cat.videos || []).map(externalizeVideo),
  };
}

export function inlineCatMedia(cat: Cat): Cat {
  return {
    ...cat,
    photos: cat.photos.map(restoreMediaUrl),
    videos: (cat.videos || []).map(inlineVideo),
  };
}

export function externalizeArticleMedia(article: ShelterArticle): ShelterArticle {
  return {
    ...article,
    coverImage: storeDataUrl(article.coverImage),
    galleryImages: article.galleryImages?.map(storeDataUrl),
    videos: article.videos?.map(externalizeVideo),
  };
}

export function inlineArticleMedia(article: ShelterArticle): ShelterArticle {
  return {
    ...article,
    coverImage: restoreMediaUrl(article.coverImage),
    galleryImages: article.galleryImages?.map(restoreMediaUrl),
    videos: article.videos?.map(inlineVideo),
  };
}

export function externalizeDonationMedia(settings: DonationSettings): DonationSettings {
  return { ...settings, image: storeDataUrl(settings.image) };
}

export function inlineDonationMedia(settings: DonationSettings): DonationSettings {
  return { ...settings, image: restoreMediaUrl(settings.image) };
}

export function externalizeApplicationMedia(application: AdoptionApplication): AdoptionApplication {
  return {
    ...application,
    catPhoto: application.catPhoto ? storeDataUrl(application.catPhoto) : application.catPhoto,
  };
}

export function inlineApplicationMedia(application: AdoptionApplication): AdoptionApplication {
  return {
    ...application,
    catPhoto: application.catPhoto ? restoreMediaUrl(application.catPhoto) : application.catPhoto,
  };
}
