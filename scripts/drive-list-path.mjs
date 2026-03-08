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

async function driveGet(auth, fileId, fields) {
  const url = new URL(`https://www.googleapis.com/drive/v3/files/${fileId}`);
  url.searchParams.set('fields', fields);
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${auth.accessToken}` },
  });
  const json = await response.json();
  if (!response.ok) throw new Error(JSON.stringify(json, null, 2));
  return json;
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

async function resolvePath(auth, segments) {
  const rootMatches = await listByName(auth, segments[0]);
  const normalizedFirst = normalizeName(segments[0]);
  const candidates = rootMatches.filter((item) => normalizeName(item.name) === normalizedFirst);

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

async function listFiles(auth, folderId) {
  const url = new URL('https://www.googleapis.com/drive/v3/files');
  url.searchParams.set('q', `'${folderId}' in parents and trashed=false`);
  url.searchParams.set('pageSize', '200');
  url.searchParams.set('fields', 'files(id,name,mimeType,size,createdTime,modifiedTime,thumbnailLink,webViewLink)');
  url.searchParams.set('orderBy', 'createdTime desc');
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${auth.accessToken}` },
  });
  const json = await response.json();
  if (!response.ok) throw new Error(JSON.stringify(json, null, 2));
  return json.files ?? [];
}

const rawPath = readFlag('path');
if (!rawPath) {
  throw new Error('Provide --path /Work/Media/BreadHub/Raisin Cinnamon');
}

const auth = await ensureDriveAccess();
const segments = rawPath.split('/').map((item) => item.trim()).filter(Boolean);
const chain = await resolvePath(auth, segments);
const leaf = chain.at(-1);
const files = await listFiles(auth, leaf.id);
const leafDetail = await driveGet(auth, leaf.id, 'id,name,parents,webViewLink');

console.log(
  JSON.stringify(
    {
      resolvedPath: `/${chain.map((node) => node.name.trim()).join('/')}`,
      folders: chain,
      leaf: leafDetail,
      files,
    },
    null,
    2
  )
);
