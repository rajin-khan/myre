# myre

myre is a for-fun operating-system project by groceryboix. We're learning how computers work by building small things together and taking the time to understand them.

The long-term idea is an Arch-based Linux system with strong gaming support. We'd love myre to stand alongside, or maybe even improve on, projects like Bazzite. That's a big someday goal. For now, we're here to learn and enjoy making things work.

![myre banner](site/banner.png)

## Site files

- `site/index.html` is the project vision board. Card 6 links to its own page instead of opening inside the grid.
- `site/learning.html` is the studies page for videos, notes, checklists, and the team board.
- `site/app.js` saves those shared items in Supabase. `site/config.js` holds the public project URL and publishable key. Never put a secret or service-role key in browser code.
- `site/learning/` contains the starter Markdown lessons, grouped by what we're learning, testing, and making.
- `supabase/schema.sql` creates the studies tables and access rules in a new Supabase project.
- `site/api/heartbeat.js` and `site/vercel.json` schedule a private daily database write after deployment.
- `site/banner.html` and `site/banner.css` make the screenshot-ready banner.
- `site/banner.png` is the screenshot of the HTML banner.
- `site/favicon.svg` is the four-square icon used by the site pages.
- `site/styles.css` styles the vision board and the responsive learning page.

As new cards get their own material, keep the board quick to scan and link each card to a page for the full details.

## Studies setup

The tables and access rules in `supabase/schema.sql` have been applied to the free `myre` project. Row-level security is on for every table. Studies are private: only signed-in email addresses listed in `myre_editors` can read or change videos, notes, tasks, and checklists. The crew emails still need to be added. To do that in the Supabase SQL editor, use `insert into public.myre_editors (email) values ('person@example.com');` for each crew member. The email must be lowercase.

Sign-in uses Supabase's default magic-link email. Its built-in email sender only delivers to members of the Supabase organization and is heavily rate-limited. For the three friends to sign in without granting them dashboard access, configure a custom SMTP sender in Supabase Authentication → Emails → SMTP Settings. The site does not require a package install or build step.

For Vercel, choose `site` as the Root Directory and the static/Other framework option. Once it is deployed, set Supabase Authentication → URL Configuration to the production site URL and allow the exact `https://your-site.example/learning.html` redirect. Test the email link on that deployed site. A local `file://` copy cannot complete the email redirect.

The daily heartbeat is configured for 08:00 UTC in `site/vercel.json`. It only runs from a production Vercel deployment. Set these *server-side* Vercel environment variables before deploying:

- `CRON_SECRET`: a random secret of at least 16 characters. Vercel sends it to the scheduled endpoint as a bearer token.
- `SUPABASE_SERVICE_ROLE_KEY`: the project's service-role key from Supabase. Keep it only in Vercel's encrypted environment settings; never add it to `site/config.js`, Git, or a public page.

After deployment, check Vercel Cron Jobs and logs, then confirm the `last_ping_at` value in the private `myre_heartbeat` row changes. A daily write is an attempt to keep the free project active, **not a guarantee** against Supabase inactivity pausing.

The old browser-only `myre-learning-v1` data remains in that browser's local storage; this version does not delete or silently import it.

## The people making it

- [Rajin](https://rajinkhan.com)
- [Samiyeel](https://samiyeelalim.com)
- [Saumik](https://saumik-kabbya.vercel.app/)
