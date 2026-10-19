const qrScanCache = new Map<string, Promise<string | null>>();

export const normalizeSbpPaymentUrl = (value: string): string | null => {
  try {
    const url = new URL(value.trim());
    const hostname = url.hostname.toLocaleLowerCase('ru');
    const isNspkPaymentHost = hostname === 'qr.nspk.ru' || hostname.endsWith('.nspk.ru');
    if (!['http:', 'https:'].includes(url.protocol) || !isNspkPaymentHost) return null;
    return url.href;
  } catch {
    return null;
  }
};

export const findSbpPaymentUrl = (text: string): string | null => {
  const candidates = text.match(/https?:\/\/[^\s)\]]+/gi) || [];
  for (const candidate of candidates) {
    const paymentUrl = normalizeSbpPaymentUrl(candidate.replace(/[.,!?;:]+$/, ''));
    if (paymentUrl) return paymentUrl;
  }
  return null;
};

type LoadedImage = {
  source: CanvasImageSource;
  width: number;
  height: number;
  close?: () => void;
};

const loadImage = async (source: string): Promise<LoadedImage> => {
  if (typeof createImageBitmap === 'function') {
    const response = await fetch(source, { credentials: 'same-origin' });
    if (!response.ok) throw new Error(`Unable to load QR image: ${response.status}`);
    const bitmap = await createImageBitmap(await response.blob());
    return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
  }

  const image = new Image();
  image.crossOrigin = 'anonymous';
  image.decoding = 'async';
  image.src = source;
  if (typeof image.decode === 'function') {
    await image.decode();
  } else {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('Unable to load QR image'));
    });
  }
  return { source: image, width: image.naturalWidth, height: image.naturalHeight };
};

const scanImageForSbpPaymentUrl = async (source: string): Promise<string | null> => {
  if (!source || typeof window === 'undefined') return null;

  try {
    const image = await loadImage(source);
    const maxScanSide = 1600;
    const scale = Math.min(1, maxScanSide / Math.max(image.width, image.height));
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return null;
    context.drawImage(image.source, 0, 0, width, height);
    image.close?.();

    const imageData = context.getImageData(0, 0, width, height);
    const { default: jsQR } = await import('jsqr');
    const result = jsQR(imageData.data, width, height, { inversionAttempts: 'attemptBoth' });
    return result ? normalizeSbpPaymentUrl(result.data) : null;
  } catch {
    // Remote images without CORS access and invalid image data remain ordinary photos.
    return null;
  }
};

export const detectSbpPaymentUrl = (source: string): Promise<string | null> => {
  const cached = qrScanCache.get(source);
  if (cached) return cached;
  const scan = scanImageForSbpPaymentUrl(source);
  qrScanCache.set(source, scan);
  return scan;
};
