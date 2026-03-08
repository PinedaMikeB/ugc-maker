import fs from 'node:fs/promises';
import path from 'node:path';
import { google } from 'googleapis';

export const GOOGLE_SCOPES = {
  drive: 'https://www.googleapis.com/auth/drive',
};

function fallbackSecretPath(fileName) {
  return [
    process.env[`GOOGLE_OAUTH_${fileName === 'google-oauth-client.json' ? 'CLIENT' : 'TOKEN'}_PATH`],
    path.resolve(process.cwd(), '.secrets', fileName),
    path.resolve(process.cwd(), '..', 'eko-arms', '.secrets', fileName),
  ].filter(Boolean);
}

async function firstExistingPath(candidates) {
  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      continue;
    }
  }
  throw new Error(`No usable file found. Checked:\n- ${candidates.join('\n- ')}`);
}

export async function resolveCredentialsPath() {
  return firstExistingPath(fallbackSecretPath('google-oauth-client.json'));
}

export async function resolveTokenPath() {
  return firstExistingPath(fallbackSecretPath('google-oauth-token.json'));
}

function normalizeScopes(raw) {
  return [...new Set(String(raw || '').split(/\s+/).map((item) => item.trim()).filter(Boolean))];
}

function oauthConfig(credentialsJson) {
  const root = credentialsJson.installed ?? credentialsJson.web;
  if (!root) {
    throw new Error('Credentials JSON must contain either "installed" or "web".');
  }
  const redirectUri = root.redirect_uris?.[0];
  if (!root.client_id || !root.client_secret || !redirectUri) {
    throw new Error('Credentials JSON missing client_id, client_secret, or redirect_uris.');
  }
  return {
    clientId: root.client_id,
    clientSecret: root.client_secret,
    redirectUri,
  };
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

async function getTokenInfoScopes(accessToken) {
  if (!accessToken) return [];
  const response = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(accessToken)}`
  );
  if (!response.ok) return [];
  const json = await response.json();
  return normalizeScopes(json.scope);
}

export async function ensureDriveAccess() {
  const credentialsPath = await resolveCredentialsPath();
  const tokenPath = await resolveTokenPath();

  const credentials = await readJson(credentialsPath);
  const storedToken = await readJson(tokenPath);
  const { clientId, clientSecret, redirectUri } = oauthConfig(credentials);
  const oauthClient = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  oauthClient.setCredentials(storedToken);

  const access = await oauthClient.getAccessToken();
  const accessToken = typeof access === 'string' ? access : (access?.token || '');
  const scopes = (await getTokenInfoScopes(accessToken)).length
    ? await getTokenInfoScopes(accessToken)
    : normalizeScopes(storedToken.scope);

  if (!scopes.includes(GOOGLE_SCOPES.drive)) {
    throw new Error('Stored OAuth token does not include Google Drive scope.');
  }

  return {
    oauthClient,
    accessToken,
    scopes,
    credentialsPath,
    tokenPath,
  };
}
