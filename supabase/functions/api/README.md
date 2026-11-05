# Maya API

This Edge Function is the application backend. Web and Android clients send
authenticated requests here; only this function uses the Supabase service key.

Base URL:

`https://<project-ref>.supabase.co/functions/v1/api/v1`

Endpoints:

- `GET /health`
- `GET /bootstrap`
- `GET|POST|PATCH|DELETE /tasks`
- The same resource shape is available for habits, habit-logs, books,
  reading-sessions, subjects, focus-sessions, nutrition-logs, meals, activities,
  events, ai-messages, and settings.

Every request requires a Supabase user access token. The API overwrites
`user_id` with the authenticated user and never accepts it from clients.
Deletes are soft deletes. The API converts the existing camelCase app model to
the snake_case database model and returns the app's camelCase model.

The service-role key belongs only in the Edge Function's server environment. It
must never be shipped to the web bundle or Android app.
