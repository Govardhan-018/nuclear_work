# Web cloud client

The browser client talks directly to Supabase with the publishable key and the
signed-in user's access token. No service or secret key belongs in this app.

Set the values from `.env.local` (never commit that file):

```text
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

The web client is intentionally cloud-only. If Supabase is unavailable, it
must show an error/loading state rather than silently writing to IndexedDB.
