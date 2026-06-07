# 🍲 Uppskriftir

A fast, minimal recipe collection app built with vanilla JS, Supabase, and Netlify. No frameworks, no build step — just HTML, CSS, and JavaScript.

**Live site:** [uppskriftir.franklin.is](https://uppskriftir.franklin.is)

---

## Features

- Browse, search, and filter recipes by category and tags
- Multi-part recipe support — separate sections for e.g. cake base and frosting
- Cover images and step-by-step photos
- Admin portal for creating and editing recipes
- Role-based access — super admin manages who can edit
- Email confirmation via Resend
- Images stored in Supabase Storage, auto-resized in the browser before upload
- Fully static — blazing fast, no server required

---

## Tech stack

| Layer | Technology |
|---|---|
| Hosting | Netlify (static) |
| Database | Supabase (Postgres + RLS) |
| Auth | Supabase Auth |
| Storage | Supabase Storage |
| Email | Resend |
| Frontend | Vanilla HTML / CSS / JS |

---

## Project structure

```
uppskriftir/
├── index.html              # Main recipe site
├── admin.html              # Admin portal shell
├── admin.css               # Admin portal styles
├── styles.css              # Main site styles
├── netlify.toml            # Security headers, cache rules, redirects
├── favicon.svg
├── supabase-setup.sql      # Full database schema — run this to set up a new project
├── supabase/               # Local Supabase CLI config
│   └── config.toml
├── scripts/
│   ├── app.js              # Main site logic (fetch, render, route)
│   ├── env.js              # Environment detection (local / test / production)
│   ├── supabase-config.js  # Supabase credentials per environment
│   ├── admin-utils.js      # Shared helpers (Supabase client, flash, slugify)
│   ├── admin-auth.js       # Login, signup, logout, super admin check
│   ├── admin-recipes.js    # Recipe list, editor, parts builder, save/delete
│   ├── admin-storage.js    # Image upload, resize, preview, delete
│   ├── admin-users.js      # User management (super admin only)
│   └── admin-migrate.js    # Bulk import from JSON
└── img/                    # Static images (logo etc.)
```

---

## Environments

| Environment | URL | Supabase |
|---|---|---|
| Local dev | `http://localhost:8888` | Local Supabase CLI |
| Test | `https://test--unrivaled-custard-b4af1f.netlify.app` | Hosted test project |
| Production | `https://uppskriftir.franklin.is` | Hosted prod project |

Environment is detected automatically in `scripts/env.js` based on `window.location.hostname`.

---

## Local development

### Prerequisites

- [Node.js](https://nodejs.org)
- [Docker Desktop](https://www.docker.com/products/docker-desktop) (running)
- [Netlify CLI](https://docs.netlify.com/cli/get-started/)

### Setup

```bash
# Install Netlify CLI globally
npm install -g netlify-cli

# Start local Supabase (Docker must be running, run as admin on Windows)
npx supabase start

# Note the API URL and anon key from the output, add them to scripts/supabase-config.js

# Run the database setup in Supabase Studio (http://localhost:54323)
# Open SQL Editor and paste the contents of supabase-setup.sql
# Then go to Table Editor → admin_users → Insert row
# Add your email with is_super: true

# Start the local dev server
netlify dev
```

Open [http://localhost:8888](http://localhost:8888) for the main site and [http://localhost:8888/admin](http://localhost:8888/admin) for the admin portal.

### Stopping local Supabase

```bash
npx supabase stop        # stops but preserves data
npx supabase stop --no-backup  # stops and wipes data
```

---

## Supabase setup (hosted)

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor → New query**, paste and run `supabase-setup.sql`
3. Go to **Table Editor → admin_users → Insert row**, add your email with `is_super: true`
4. Go to **Project Settings → Authentication → SMTP**, connect Resend for email
5. Go to **Project Settings → Authentication → URL Configuration**, set your site URL and redirect URLs
6. Copy your project URL and anon key into `scripts/supabase-config.js`

---

## Admin portal

Access the admin portal at `/admin`. First-time setup:

1. A super admin adds your email via **Notendur** tab (or directly in Supabase Table Editor)
2. You sign up at `/admin` — email confirmation required
3. Once confirmed, log in and start adding recipes

**Super admin** can add/remove other users. Regular admins can create and edit their own recipes.

---

## Recipe data format

Recipes are stored as JSONB in Supabase. The format supports both simple and multi-part recipes:

```json
{
  "id": "bananabraud",
  "title": "Bananabrauð",
  "category": "Kaffitími",
  "tags": ["kaffitími", "brauð"],
  "time_minutes": 60,
  "servings": 4,
  "description": "...",
  "cover_image": "https://...",
  "cover_image_path": "bananabraud/cover-123.jpg",
  "parts": [
    {
      "title": "Brauðið",
      "ingredients": ["3 stk. bananar", "2 stk. egg"],
      "steps": [
        "Mauka banana í skál",
        { "text": "Baka við 175°C", "images": ["https://..."] }
      ]
    }
  ],
  "notes": "Gott með smjöri og ost."
}
```

---

## Security

- Row-level security on all tables — public read, authenticated write, owner-only edit/delete
- Admin allowlist — only pre-approved emails can sign up
- Signup trigger blocks non-allowlisted emails at the database level
- Input sanitisation on all form fields
- Security headers via `netlify.toml` — CSP, HSTS, X-Frame-Options, Permissions-Policy
- Images validated and resized client-side before upload (max 1200px, JPEG 72%)

---

## Deploying

Push to the `test` branch to deploy to the test environment. Push to `main` (via pull request from `test`) to deploy to production. Netlify handles both automatically.

---

## License

Private project — © Magnus Franklin