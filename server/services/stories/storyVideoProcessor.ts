import { execFile } from 'child_process';
import { promisify } from 'util';
import { mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import ffmpegPath from 'ffmpeg-static';
import axios from 'axios';

const execFileAsync = promisify(execFile);

export const STORY_VIDEO_MAX_DURATION_SEC = 60;
const STORY_W = 1080;
const STORY_H = 1920;

export type StoryAudioMode = 'original' | 'muted' | 'music';

export interface StoryVideoProcessOptions {
  audioMode: StoryAudioMode;
  musicUrl?: string | null;
}

function getFfmpegPath(): string {
  if (!ffmpegPath) {
    throw new Error(
      'FFmpeg no está disponible en este servidor. Instala ffmpeg-static o FFmpeg en el sistema.',
    );
  }
  return ffmpegPath;
}

async function downloadFile(url: string, maxBytes: number): Promise<Buffer> {
  const { data } = await axios.get(url.split('?')[0], {
    responseType: 'arraybuffer',
    timeout: 120000,
    maxContentLength: maxBytes,
  });
  return Buffer.from(data);
}

async function runFfmpeg(args: string[]): Promise<void> {
  const bin = getFfmpegPath();
  try {
    await execFileAsync(bin, args, { maxBuffer: 20 * 1024 * 1024 });
  } catch (err: unknown) {
    const stderr = err && typeof err === 'object' && 'stderr' in err
      ? String((err as { stderr?: string }).stderr || '')
      : '';
    throw new Error(`Error procesando video: ${stderr.slice(-500) || (err instanceof Error ? err.message : 'FFmpeg falló')}`);
  }
}

const VIDEO_FILTER = [
  `scale=${STORY_W}:${STORY_H}:force_original_aspect_ratio=increase`,
  `crop=${STORY_W}:${STORY_H}`,
].join(',');

/** Adapta video a 9:16 (1080×1920), máx. 60 s, con audio según modo. */
export async function processStoryVideo(
  sourceBuffer: Buffer,
  options: StoryVideoProcessOptions,
): Promise<Buffer> {
  const workDir = await mkdtemp(join(tmpdir(), 'pollon-story-video-'));
  const inputPath = join(workDir, 'input');
  const outputPath = join(workDir, 'output.mp4');
  const musicPath = join(workDir, 'music.mp3');

  try {
    await writeFile(inputPath, sourceBuffer);

    const baseArgs = [
      '-y',
      '-i', inputPath,
      '-t', String(STORY_VIDEO_MAX_DURATION_SEC),
      '-vf', VIDEO_FILTER,
      '-c:v', 'libx264',
      '-preset', 'fast',
      '-crf', '23',
      '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart',
    ];

    if (options.audioMode === 'muted') {
      await runFfmpeg([...baseArgs, '-an', outputPath]);
    } else if (options.audioMode === 'music' && options.musicUrl) {
      const musicBuffer = await downloadFile(options.musicUrl, 25 * 1024 * 1024);
      await writeFile(musicPath, musicBuffer);
      await runFfmpeg([
        '-y',
        '-i', inputPath,
        '-i', musicPath,
        '-t', String(STORY_VIDEO_MAX_DURATION_SEC),
        '-filter_complex',
        `[0:v]${VIDEO_FILTER}[v];[1:a]aloop=loop=-1:size=2e+09,atrim=0:${STORY_VIDEO_MAX_DURATION_SEC},volume=0.85[a]`,
        '-map', '[v]',
        '-map', '[a]',
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-crf', '23',
        '-pix_fmt', 'yuv420p',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-shortest',
        '-movflags', '+faststart',
        outputPath,
      ]);
    } else {
      await runFfmpeg([
        ...baseArgs,
        '-c:a', 'aac',
        '-b:a', '128k',
        outputPath,
      ]);
    }

    return await readFile(outputPath);
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

/** Extrae un frame JPEG como miniatura para listados. */
export async function extractVideoThumbnail(sourceBuffer: Buffer): Promise<Buffer> {
  const workDir = await mkdtemp(join(tmpdir(), 'pollon-story-thumb-'));
  const inputPath = join(workDir, 'input');
  const outputPath = join(workDir, 'thumb.jpg');

  try {
    await writeFile(inputPath, sourceBuffer);
    await runFfmpeg([
      '-y',
      '-i', inputPath,
      '-ss', '00:00:00.5',
      '-vframes', '1',
      '-vf', `scale=${STORY_W}:${STORY_H}:force_original_aspect_ratio=increase,crop=${STORY_W}:${STORY_H}`,
      '-q:v', '3',
      outputPath,
    ]);
    return await readFile(outputPath);
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}
