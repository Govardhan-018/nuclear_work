# Maya API on Render

This is the standalone backend service used by both the web client and Android
app. It authenticates users through Supabase Auth and accesses Postgres from the
server. Clients must never receive the service role key.

## Render setup

Create a Web Service from this repository with:

- Root Directory: `backend`
- Runtime: Node
- Build Command: `npm install`
- Start Command: `npm start`

Add these environment variables in Render:

- `SUPABASE_URL`: project base URL, without `/rest/v1`
- `SUPABASE_PUBLISHABLE_KEY`: the project's publishable key
- `SUPABASE_SERVICE_ROLE_KEY`: server-only secret key; never put this in a client or commit it
- `CORS_ORIGINS`: comma-separated exact deployed web origins

The API base path is `/api/v1`; health check is `/api/v1/health`.

## API routes

- `POST /api/v1/auth/signup`
- `POST /api/v1/auth/token?grant_type=password`
- `POST /api/v1/auth/token?grant_type=refresh_token`
- `POST /api/v1/auth/logout`
- `GET /api/v1/bootstrap`
- `GET|POST|PATCH|DELETE /api/v1/{resource}`
- `POST /api/v1/sync`

Resource names: tasks, habits, habit-logs, books, reading-sessions, subjects,
focus-sessions, nutrition-logs, meals, activities, events, ai-messages, settings.

## Database

Apply the SQL migration in `../supabase/migrations` once before deploying the
service. Configure the service key only as a Render secret environment variable.
