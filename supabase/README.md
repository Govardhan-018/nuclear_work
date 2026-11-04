# Supabase backend foundation

This directory contains the backend schema for Maya. It is intentionally
separate from the client implementation: the web and Android apps can keep
working against their local IndexedDB cache while the sync layer is introduced
incrementally.

## Apply locally

Install the Supabase CLI, link a project, then run:

```bash
supabase db push
```

The first migration creates the application tables, owner-only Row Level
Security policies, server-managed timestamps, and the ordered `sync_events`
ledger.

## Design decisions

- All entity IDs remain text so existing local IDs can be synchronized without
  rewriting records.
- Every application row is owned by `auth.users.id`.
- Client deletes remain tombstones until synchronization confirms them.
- `sync_events.seq` is the server cursor. Device clocks are not used as the
  authoritative ordering mechanism.
- Sessions, logs, meals, and imported activities can be merged as append-like
  records; mutable records will use revision-aware conflict handling.
- Secrets and provider tokens are not stored in the client database schema.
  Strava and Groq server work belongs in protected Edge Functions.

## Next backend step

Add authentication and a small authenticated sync function that:

1. accepts a bounded batch of local changes,
2. validates the authenticated owner,
3. applies idempotent upserts/tombstones,
4. returns changes after a supplied `seq` cursor,
5. reports conflicts without losing either snapshot.
