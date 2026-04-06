# Deployment and Merge Operations

## Frontend production API configuration (Vercel)

If your frontend is deployed separately from the Node/Express API, set:

- `VITE_API_BASE_URL=https://<your-api-domain>`

This makes frontend requests use that backend instead of same-origin `/api/*`.

## Conflict resolution helper

If your branch reports merge conflicts, run:

`npm run check:conflicts`

This scans for unresolved merge markers (`<<<<<<<`, `=======`, `>>>>>>>`) across the repository.

## Current conflict choice (for GitHub web resolver)

If GitHub shows conflict markers in:

- `README.md` around the operations link, keep:
  - `For deployment and merge workflow notes, see [OPERATIONS.md](./OPERATIONS.md).`
- `src/App.tsx` around API constants, keep:
  - `const TELEGRAM_CHANNEL_URL = 'https://t.me/degenpapertrading';`
