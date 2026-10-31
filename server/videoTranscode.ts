import { execFile } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { promisify } from 'util';
import ffmpegPath from 'ffmpeg-static';

const execFileAsync = promisify(execFile);

export interface BrowserVideo {
  content: Buffer;
  mimeType: string;
  transcoded: boolean;
}

function containsCodecMarker(content: Buffer, marker: string): boolean {
  return content.indexOf(Buffer.from(marker, 'ascii')) >= 0;
}

export function isHevcVideo(content: Buffer): boolean {
  return containsCodecMarker(content, 'hvc1') || containsCodecMarker(content, 'hev1');
}

export async function ensureBrowserCompatibleVideo(content: Buffer, mimeType: string): Promise<BrowserVideo> {
  if (!isHevcVideo(content)) return { content, mimeType, transcoded: false };
  if (!ffmpegPath) throw Object.assign(new Error('Преобразование HEVC-видео недоступно'), { status: 503 });

  const temporaryDirectory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'cat-shelter-video-'));
  const inputExtension = mimeType === 'video/quicktime' ? 'mov' : mimeType === 'video/3gpp' ? '3gp' : 'mp4';
  const inputPath = path.join(temporaryDirectory, `input.${inputExtension}`);
  const outputPath = path.join(temporaryDirectory, 'output.mp4');

  try {
    await fs.promises.writeFile(inputPath, content);
    await execFileAsync(ffmpegPath, [
      '-hide_banner', '-loglevel', 'error', '-y',
      '-i', inputPath,
      '-map_metadata', '-1',
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '24', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '128k',
      '-movflags', '+faststart',
      outputPath,
    ], { maxBuffer: 4 * 1024 * 1024 });
    return { content: await fs.promises.readFile(outputPath), mimeType: 'video/mp4', transcoded: true };
  } catch (error) {
    console.error('[Video] HEVC conversion failed', error);
    throw Object.assign(new Error('Не удалось преобразовать видео с камеры. Попробуйте записать ролик ещё раз.'), { status: 422 });
  } finally {
    await fs.promises.rm(temporaryDirectory, { recursive: true, force: true });
  }
}
