# myre

myre is a for-fun operating-system project by groceryboix. We're learning how computers work by building small things together and taking the time to understand them.

The long-term idea is an Arch-based Linux system with strong gaming support. We'd love myre to stand alongside, or maybe even improve on, projects like Bazzite. That's a big someday goal. For now, we're here to learn and enjoy making things work.

![myre banner](site/banner.png)

## Site files

- `site/index.html` is the project vision board. Card 6 links to its own page instead of opening inside the grid.
- `site/learning.html` is the studies page for videos, notes, checklists, and the team board.
- `site/app.js` runs the studies page. `site/api/studies.js` checks the three names and passwords on the server, then reads and writes Supabase. No database key or password goes in browser code.
- `site/learning/` contains the starter Markdown lessons, grouped by what we're learning, testing, and making.
- `supabase/schema.sql` creates the studies tables and access rules in a new Supabase project.
- `supabase/lock_direct_access.sql` closes the old browser-to-Supabase access path.
- `supabase/heartbeat.sql` starts a daily database-side write, including before Vercel deployment.
- `site/api/heartbeat.js` and `site/vercel.json` schedule a private daily database write after deployment.
- `site/banner.html` and `site/banner.css` make the screenshot-ready banner.
- `site/banner.png` is the screenshot of the HTML banner.
- `site/favicon.svg` is the four-square icon used by the site pages.
- `site/styles.css` styles the vision board and the responsive learning page.

As new cards get their own material, keep the board quick to scan and link each card to a page for the full details.

## Studies setup

The tables in `supabase/schema.sql` are in the free `myre` project, with row-level security on every table. `supabase/lock_direct_access.sql` disables direct browser access. The old editor-email table remains unused. The studies page now has three fixed names, each with its own password. The server checks the password and keeps the session in a signed, HTTP-only cookie. There is no Google sign-in or email flow.

For Vercel, choose `site` as the Root Directory and the static/Other framework option. There is no package install or build step. The studies page needs its `/api/studies` Vercel Function, so opening `learning.html` as a `file://` page will not sign you in.

Set these server-side Vercel environment variables before deploying:

- `MYRE_PASSWORD_RAJIN`, `MYRE_PASSWORD_SAMIYEEL`, `MYRE_PASSWORD_SAUMIK`: different, random passwords of at least 16 characters. Share each one privately with its owner. Changing one password signs that person out.
- `MYRE_SESSION_SECRET`: a separate random string of at least 32 characters. Changing it signs everyone out.
- `SUPABASE_SERVICE_ROLE_KEY`: the project's service-role key from Supabase. The studies function and external heartbeat need it. Keep it only in Vercel's encrypted environment settings, never in Git or a public page.
- `CRON_SECRET`: a separate random string of at least 16 characters for Vercel's scheduled heartbeat endpoint.

The site will show a setup message until these variables are present in a production deployment. The server does not include password reset or brute-force protection, so use long random passwords and change one if it is shared accidentally.

The database-side heartbeat in `supabase/heartbeat.sql` runs daily at 08:00 UTC, even before deployment. The separate external heartbeat in `site/vercel.json` also runs at 08:00 UTC, but only from a production Vercel deployment.

After deployment, check Vercel Cron Jobs and logs, then confirm the `last_ping_at` value in the private `myre_heartbeat` row changes. Supabase Cron's history shows whether the internal job ran. The internal write may not count as user activity, and even an external daily request is **not a guarantee** against Supabase inactivity pausing.

The old browser-only `myre-learning-v1` data remains in that browser's local storage; this version does not delete or silently import it.

## The people making it

- [Rajin](https://rajinkhan.com)
- [Samiyeel](https://samiyeelalim.com)
- [Saumik](https://saumik-kabbya.vercel.app/)
