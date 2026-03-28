# Supabase Migration (MongoDB → Supabase)

## 1) Create schema in Supabase

Run [server/supabase/schema.sql](server/supabase/schema.sql) in Supabase SQL Editor.

Optional demo data:

Run [server/supabase/seed.sql](server/supabase/seed.sql) for doctors across all specialties, patients, appointments, reports, notifications, and notes.

## 2) Set server environment variables

In server `.env` (and Vercel env vars), set:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (recommended for backend)
- `JWT_SECRET`

Optional fallback key:

- `SUPABASE_ANON_KEY`

## 3) Remove old MongoDB env vars from deployment

- `MONGODB_URI`
- `MONGO_URI`

## 4) Install dependencies

`@supabase/supabase-js` is now required by the backend.

## 5) Data migration (optional)

If you need old MongoDB data, export collections (`users`, `appointments`, `reports`, `notifications`, `patientnotes`) and import into Supabase tables with matching columns.
