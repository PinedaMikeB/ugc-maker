import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { ensureDriveAccess } from './lib/google-oauth.mjs';

function readFlag(name) {
  const flag = `--${name}`;
  const index = process.argv.indexOf(flag);
  if (index === -1) return '';
  return process.argv[index + 1] ?? '';
}

function normalizeName(value) {
  return String(value || '').trim().toLowerCase();
}

async function listByName(auth, folderName) {
  const url = new URL('https://www.googleapis.com/drive/v3/files');
  url.searchParams.set(
    'q',
    `mimeType='application/vnd.google-apps.folder' and name='${folderName.replace(/'/g, "\\'")}' and trashed=false`
  );
  url.searchParams.set('pageSize', '200');
  url.searchParams.set('fields', 'files(id,name,parents,createdTime)');
  url.searchParams.set('orderBy', 'createdTime desc');
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${auth.accessToken}` },
  });
  const json = await response.json();
  if (!response.ok) throw new Error(JSON.stringify(json, null, 2));
  return json.files ?? [];
}

async function listChildFolders(auth, parentId) {
  const url = new URL('https://www.googleapis.com/drive/v3/files');
  url.searchParams.set(
    'q',
    `'${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`
  );
  url.searchParams.set('pageSize', '200');
  url.searchParams.set('fields', 'files(id,name,parents,createdTime)');
  url.searchParams.set('orderBy', 'createdTime desc');
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${auth.accessToken}` },
  });
  const json = await response.json();
  if (!response.ok) throw new Error(JSON.stringify(json, null, 2));
  return json.files ?? [];
}

async function listFiles(auth, folderId) {
  const url = new URL('https://www.googleapis.com/drive/v3/files');
  url.searchParams.set('q', `'${folderId}' in parents and trashed=false`);
  url.searchParams.set('pageSize', '200');
  url.searchParams.set(
    'fields',
    'files(id,name,mimeType,size,createdTime,modifiedTime,webViewLink)'
  );
  url.searchParams.set('orderBy', 'createdTime desc');
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${auth.accessToken}` },
  });
  const json = await response.json();
  if (!response.ok) throw new Error(JSON.stringify(json, null, 2));
  return json.files ?? [];
}

async function resolvePath(auth, segments) {
  const rootMatches = await listByName(auth, segments[0]);
  const candidates = rootMatches.filter((item) => normalizeName(item.name) === normalizeName(segments[0]));

  for (const candidate of candidates) {
    const chain = [candidate];
    let current = candidate;
    let failed = false;

    for (const segment of segments.slice(1)) {
      const children = await listChildFolders(auth, current.id);
      const next = children.find((child) => normalizeName(child.name) === normalizeName(segment));
      if (!next) {
        failed = true;
        break;
      }
      chain.push(next);
      current = next;
    }

    if (!failed) return chain;
  }

  throw new Error(`Could not resolve Drive path: /${segments.join('/')}`);
}

async function downloadFile(auth, file, outputDir) {
  const url = new URL(`https://www.googleapis.com/drive/v3/files/${file.id}`);
  url.searchParams.set('alt', 'media');
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${auth.accessToken}` },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to download ${file.name}: ${text}`);
  }
  const targetPath = path.join(outputDir, file.name.trim());
  const buffer = Buffer.from(await response.arrayBuffer());
  await fs.writeFile(targetPath, buffer);
  return targetPath;
}

const rawPath = readFlag('path');
const outDir = readFlag('out') || path.resolve(process.cwd(), 'runtime', 'downloads');
if (!rawPath) {
  throw new Error('Provide --path /Work/Media/BreadHub/Raisin Cinnamon');
}

const auth = await ensureDriveAccess();
const segments = rawPath.split('/').map((item) => item.trim()).filter(Boolean);
const chain = await resolvePath(auth, segments);
const leaf = chain.at(-1);
const files = await listFiles(auth, leaf.id);
const media = files.filter((file) => /^image\/|^video\//.test(file.mimeType || ''));

await fs.mkdir(outDir, { recursive: true });

const downloaded = [];
for (const file of media) {
  const savedPath = await downloadFile(auth, file, outDir);
  downloaded.push({
    id: file.id,
    name: file.name,
    mimeType: file.mimeType,
    savedPath,
  });
}

console.log(
  JSON.stringify(
    {
      resolvedPath: `/${chain.map((node) => node.name.trim()).join('/')}`,
      downloadDir: outDir,
      downloaded,
    },
    null,
    2
  )
);
