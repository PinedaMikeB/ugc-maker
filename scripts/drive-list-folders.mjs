import { ensureDriveAccess } from './lib/google-oauth.mjs';

const auth = await ensureDriveAccess();

const url = new URL('https://www.googleapis.com/drive/v3/files');
url.searchParams.set('q', "mimeType='application/vnd.google-apps.folder' and trashed=false");
url.searchParams.set('pageSize', '20');
url.searchParams.set('fields', 'files(id,name,createdTime),nextPageToken');
url.searchParams.set('orderBy', 'createdTime desc');

const response = await fetch(url, {
  headers: { Authorization: `Bearer ${auth.accessToken}` },
});

const json = await response.json();
if (!response.ok) {
  throw new Error(JSON.stringify(json, null, 2));
}

console.log(JSON.stringify(json.files ?? [], null, 2));
