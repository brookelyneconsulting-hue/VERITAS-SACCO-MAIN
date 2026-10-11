# Veritas SACCO — independent Supabase version

## 1. Install

```bash
npm install
```

This project no longer uses `@base44/sdk` or `@base44/vite-plugin`.

## 2. Configure Supabase

Create `.env.local` from `.env.example`:

```env
VITE_SUPABASE_URL=https://znwkhhznjdzgbdudmkvf.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_OR_PUBLISHABLE_KEY
```

Do **not** put the PostgreSQL password/connection string in the browser.

## 3. Create the database

Open Supabase SQL Editor and run:

1. `supabase/schema.sql`
2. Create your first account through `/register`.
3. Use `supabase/bootstrap.sql` to make that first account the platform owner.

## 4. Edge Functions

Deploy:

- `send-email`
- `invite-user`
- `invoke-llm`
- `extract-uploaded-file`

Required server-side secrets:

- `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY`
- `MAIL_FROM`
- `OPENAI_API_KEY`
- optional `OPENAI_MODEL`

Never expose service-role, Resend, or OpenAI keys as `VITE_*` browser variables.

## 5. Run locally

```bash
npm run dev
```

## 6. Production

Deploy the Vite frontend to Vercel. Set the same `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Vercel environment variables, then connect the `.co.ke` domain.

### Member portal authentication

The old member-number/ID check was client-side. The independent version adds a `member-login` Edge Function. It verifies the member number + ID server-side, provisions a synthetic Supabase Auth identity, and then signs the member into a normal Supabase session. PostgreSQL RLS can therefore restrict member records to that member.

Deploy `member-login` and set `MEMBER_AUTH_SECRET` as a Supabase secret.

The member enrollment flow is also server-side: `enroll-member` creates the member record and links the authenticated Supabase user to that member. The public institution picker uses `public-institutions`, and guarantor lookup uses `member-lookup` so the browser does not need unrestricted member-directory access.
