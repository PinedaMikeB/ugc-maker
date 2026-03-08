import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const root = process.cwd();
const downloadsDir = path.join(root, 'runtime', 'downloads', 'raisin-cinnamon');
const outputDir = path.join(root, 'runtime', 'output');
const slidesDir = path.join(outputDir, 'slides');
const publicDir = path.join(root, 'preview-assets');
const pythonBin = path.join(root, '.venv', 'bin', 'python');
const voiceAiff = path.join(outputDir, 'cinnamon-voice.aiff');
const voiceWav = path.join(outputDir, 'cinnamon-voice.wav');
const finalVideo = path.join(publicDir, 'breadhub-raisin-cinnamon-preview.mp4');
const manifestPath = path.join(outputDir, 'cinnamon-preview.json');
const scenesConfigPath = path.join(outputDir, 'cinnamon-scenes.json');

const scriptBeats = [
  {
    image: '647056595_1494946395523656_7710617307308884484_n.jpg',
    duration: 4,
    headline: 'BreadHub Cinnamon Drop',
    subline: 'Fresh trays, soft crumb, instant craving.',
  },
  {
    image: 'Biscoff Cinnamon.png',
    duration: 5,
    headline: 'Biscoff Cinnamon',
    subline: 'Loaded topping and bakery-style indulgence.',
  },
  {
    image: 'Blueberry cinnamon.png',
    duration: 5,
    headline: 'Blueberry Cinnamon',
    subline: 'Sweet fruit layer with a soft cinnamon base.',
  },
  {
    image: 'Cinnamon Drizzle.png',
    duration: 6,
    headline: 'Cinnamon Drizzle',
    subline: 'Sticky finish, cozy flavor, easy repeat order.',
  },
];

const voiceover = [
  'BreadHub just dropped a cinnamon lineup that looks premium but still feels like merienda.',
  'From the Biscoff cinnamon to the blueberry cinnamon and that cinnamon drizzle finish, every piece looks made for a quick crave post.',
  'If you want soft, sweet, and easy to recommend, this is the kind of BreadHub drop worth trying while it is fresh.',
].join(' ');

async function ensureSourceFiles() {
  const missing = [];
  for (const beat of scriptBeats) {
    const filePath = path.join(downloadsDir, beat.image);
    try {
      await fs.access(filePath);
    } catch {
      missing.push(beat.image);
    }
  }
  if (missing.length) {
    throw new Error(`Missing source files in ${downloadsDir}: ${missing.join(', ')}`);
  }
}

async function renderSlides() {
  await fs.mkdir(slidesDir, { recursive: true });
  await fs.writeFile(
    scenesConfigPath,
    `${JSON.stringify(
      {
        outputDir: slidesDir,
        scenes: scriptBeats.map((beat) => ({
          ...beat,
          source: path.join(downloadsDir, beat.image),
        })),
      },
      null,
      2
    )}\n`,
    'utf8'
  );
  await execFileAsync(pythonBin, [path.join(root, 'scripts', 'render_cinnamon_slides.py'), scenesConfigPath], {
    maxBuffer: 1024 * 1024 * 10,
  });
}

async function generateVoice() {
  await fs.mkdir(outputDir, { recursive: true });
  await execFileAsync('say', ['-v', 'Samantha', '-r', '175', '-o', voiceAiff, voiceover]);
  await execFileAsync('ffmpeg', ['-y', '-i', voiceAiff, voiceWav]);
}

async function renderVideo() {
  await fs.mkdir(publicDir, { recursive: true });
  const ffmpegArgs = [];

  for (let index = 0; index < scriptBeats.length; index += 1) {
    ffmpegArgs.push(
      '-loop',
      '1',
      '-t',
      String(scriptBeats[index].duration),
      '-i',
      path.join(slidesDir, `slide-${String(index + 1).padStart(2, '0')}.jpg`)
    );
  }

  ffmpegArgs.push(
    '-i',
    voiceWav,
    '-filter_complex',
    `${scriptBeats.map((_, index) => `[${index}:v]`).join('')}concat=n=${scriptBeats.length}:v=1:a=0[video]`,
    '-map',
    '[video]',
    '-map',
    `${scriptBeats.length}:a`,
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-r',
    '30',
    '-c:a',
    'aac',
    '-b:a',
    '192k',
    '-shortest',
    finalVideo
  );

  await execFileAsync('ffmpeg', ['-y', ...ffmpegArgs], { maxBuffer: 1024 * 1024 * 20 });
}

async function writeManifest() {
  const totalDuration = scriptBeats.reduce((sum, beat) => sum + beat.duration, 0);
  await fs.writeFile(
    manifestPath,
    `${JSON.stringify(
      {
        title: 'BreadHub Cinnamon UGC Preview',
        output: finalVideo,
        durationSeconds: totalDuration,
        sourceDir: downloadsDir,
        voiceover,
        scenes: scriptBeats,
      },
      null,
      2
    )}\n`,
    'utf8'
  );
}

await ensureSourceFiles();
await renderSlides();
await generateVoice();
await renderVideo();
await writeManifest();

console.log(
  JSON.stringify(
    {
      ok: true,
      output: finalVideo,
      manifest: manifestPath,
    },
    null,
    2
  )
);
