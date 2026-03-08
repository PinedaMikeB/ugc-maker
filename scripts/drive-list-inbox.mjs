import process from 'node:process';
import { ensureDriveAccess } from './lib/google-oauth.mjs';

function readFlag(name) {
  const flag = `--${name}`;
  const index = process.argv.indexOf(flag);
  if (index === -1) return '';
  return process.argv[index + 1] ?? '';
}

const folderId = readFlag('folder') || process.env.DRIVE_INBOX_FOLDER_ID;
if (!folderId) {
  throw new Error('Provide --folder <google-drive-folder-id> or set DRIVE_INBOX_FOLDER_ID.');
}

const auth = await ensureDriveAccess();
const url = new URL('https://www.googleapis.com/drive/v3/files');
url.searchParams.set('q', `'${folderId}' in parents and trashed=false`);
url.searchParams.set('pageSize', '100');
url.searchParams.set('fields', 'files(id,name,mimeType,createdTime,modifiedTime,size)');
url.searchParams.set('orderBy', 'createdTime desc');

const response = await fetch(url, {
  headers: { Authorization: `Bearer ${auth.accessToken}` },
});
const json = await response.json();

if (!response.ok) {
  throw new Error(JSON.stringify(json, null, 2));
}

console.log(JSON.stringify(json.files ?? [], null, 2));
