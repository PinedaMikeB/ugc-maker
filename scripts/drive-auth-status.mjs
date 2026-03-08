import { ensureDriveAccess } from './lib/google-oauth.mjs';

const auth = await ensureDriveAccess();

console.log(
  JSON.stringify(
    {
      authorized: true,
      credentialsPath: auth.credentialsPath,
      tokenPath: auth.tokenPath,
      scopes: auth.scopes,
    },
    null,
    2
  )
);
