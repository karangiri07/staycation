# Staycation

Creator-curated property discovery site rebuilt from the supplied `staycation_v3 (1).html`. The source content includes six Maharashtra listings, creator identity `@vlogsbyarunn`, Instagram profile/reel references, original visual direction and direct owner WhatsApp enquiries. Published reels appear in the public gallery; unpublished reels remain in Admin.

## Requirements

- Node.js 20+
- Python 3.11+
- PostgreSQL 14+ (or Docker Compose)
- Cloudinary account for media upload/delete

## Local setup

1. Copy `backend/.env.example` to `backend/.env` and set `JWT_SECRET`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, database URL, CORS origins, and Cloudinary credentials. The default SQLite URL is available for quick API startup; PostgreSQL is recommended and used by the compose setup.
2. Start PostgreSQL with `docker compose up -d db` (or use the full compose stack after creating the backend env file).
3. From `backend`, create a virtual environment, install `requirements.txt`, and run `uvicorn app.main:app --reload --port 8000`.
4. From the project root, copy `.env.example` to `.env` if the API URL differs from `http://localhost:8000`, then run `npm install` and `npm run dev`.
5. Open `/admin`; sign in with the backend environment username and password.

The original six featured listings are shipped as frontend fallback content. Create them in the CMS to store/publish them in PostgreSQL and edit them thereafter. Unconfigured WhatsApp displays the source placeholder `91XXXXXXXXXX`; set the actual international number in Admin → WhatsApp contact.

## Features

- React + JavaScript + Vite and Tailwind CSS; no TypeScript.
- Cinematic scroll-locked hero: progressive image zoom and copy reveal, keyboard/touch/wheel support, lock cleanup at completion and component unmount.
- Responsive property collection with original property names, locations, prices, tags and imagery; search and category filters.
- A horizontally scrollable public reels gallery. Published Cloudinary videos autoplay muted and loop; upload and publish videos from `/admin`. Demo Instagram previews link out and do not autoplay.
- Direct `wa.me` visitor links. No booking, visitor chat or WhatsApp messaging backend.
- Admin JWT login, property create/list/edit/delete and publish/draft state; Cloudinary image uploads and media deletion; reel upload/list/publish/delete; editable WhatsApp contact.
- SQLAlchemy metadata models and PostgreSQL initial migration. `create_all` safely creates missing tables on startup.

## API summary

- `POST /api/auth/login`
- `GET /api/properties`, `GET /api/reels`, `GET /api/public/config`, `GET /api/health`
- Authenticated `/api/admin/properties` GET/POST, `/api/admin/properties/{id}` PUT/DELETE
- Authenticated `/api/admin/config` GET/PUT
- Authenticated `/api/admin/upload/image` and `/api/admin/upload/reel` POST, `/api/admin/upload/{public_id}` DELETE
- Authenticated `/api/admin/reels` GET and `/api/admin/reels/{id}` PATCH/DELETE

## Production deployment

- **Frontend:** build with `npm run build`; deploy `dist/` to Vercel, Netlify or a static host. Configure `VITE_API_URL` to the deployed API origin and set SPA fallback routing to `index.html` so `/admin` resolves.
- **Backend:** deploy `backend/` on Render, Railway or another Python ASGI host using `backend/Dockerfile` or `uvicorn app.main:app --host 0.0.0.0 --port $PORT`. Configure all variables from `backend/.env.example`; use a strong unique JWT secret, non-default admin credentials, the production database URL and the exact frontend origin in `CORS_ORIGINS`.
- **Database:** provision managed PostgreSQL and set `DATABASE_URL` to `postgresql+psycopg://...`. Keep backups enabled. The included migration is idempotent; SQLAlchemy creates tables at startup.
- **Cloudinary:** create a cloud, then set `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` only on the backend. Never expose the API secret to Vite/browser configuration.
- **WhatsApp:** after login, enter the owner's number with country code and digits; the public page opens a prefilled message in the visitor's WhatsApp app.

## Validation and limitations

Request schemas validate text/category/phone values; upload endpoints check MIME type, size, credentials and provider errors; protected routes reject absent/invalid/expired JWTs. Keep the API behind HTTPS and rotate credentials if exposed. Image limit is 10 MB; video limit is 100 MB. Live Cloudinary, PostgreSQL hosting, production CORS and WhatsApp delivery need the owner's service credentials and cannot be verified without them.
