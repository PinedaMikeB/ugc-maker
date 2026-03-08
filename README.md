# UGC Maker

Frontend-first MVP for a BreadHub-style UGC video automation workflow.

## What this build includes

- A polished static dashboard for the `1 folder = 1 product = 1 render job` workflow
- Mock Google Drive inbox cards
- Product analysis pipeline stages
- Script beat preview and shot mapping
- Render queue panel
- Backend contract section for the Java + Firebase implementation
- CLI scripts that can read the existing Google Drive OAuth token and list folders

## Why the app starts frontend-first

The target folder was empty, and the workflow still needed to be shaped before hardening backend code. This MVP locks down the user-facing flow first:

1. Detect a product folder from Google Drive
2. Register a new job
3. Analyze clips
4. Draft the influencer-style script
5. Queue the final render

## Suggested backend split

- `HTML/CSS/JS`: admin UI
- `Java`: API, Drive polling, Firestore job state, auth
- `Python + FFmpeg`: media analysis, transcription, edit assembly, rendering
- `Firebase`: Hosting, Firestore, Storage

## Recommended API surface

- `POST /api/jobs/sync-drive`
- `POST /api/jobs/:jobId/analyze`
- `POST /api/jobs/:jobId/script`
- `POST /api/jobs/:jobId/render`
- `GET /api/jobs`
- `GET /api/jobs/:jobId`

## Google Drive CLI

The project now includes simple CLI helpers for Drive access:

```bash
npm install
npm run drive:auth-status
npm run drive:list-folders
npm run drive:list-inbox -- --folder YOUR_DRIVE_FOLDER_ID
```

Credential resolution order:

1. `GOOGLE_OAUTH_CLIENT_PATH` / `GOOGLE_OAUTH_TOKEN_PATH`
2. local `./.secrets/`
3. sibling workspace `../eko-arms/.secrets/`

Set `DRIVE_INBOX_FOLDER_ID` if you want a default inbox folder for folder-per-product polling.

## Firestore draft schema

```json
{
  "jobs": {
    "job_ube_cheese_2026_03_08": {
      "productName": "Ube Cheese Pandesal",
      "driveFolderId": "drive-folder-id",
      "status": "SCRIPT_DRAFTED",
      "tone": "Playful, comforting",
      "clipCount": 14,
      "analysis": {
        "transcriptReady": true,
        "keyframesReady": true,
        "tags": ["Storefront", "Order moment", "Cheese pull", "Reaction"]
      },
      "script": {
        "hook": "Guys, I just found the softest ube cheese pandesal...",
        "cta": "If you pass by BreadHub, get this while it is fresh..."
      },
      "output": {
        "storagePath": "renders/ube-cheese/final.mp4",
        "cdnUrl": "https://cdn.example.com/renders/ube-cheese/final.mp4"
      },
      "createdAt": "2026-03-08T13:00:00Z"
    }
  }
}
```

## Local preview

Open `index.html` directly in a browser, or serve the folder with a static file server.
