# Working in myre

myre is a small, for-fun project: learn first, try things on our machines, then build an Arch-based distro together.

- `learning/` holds public Markdown notes, grouped by person (`rajin/`, `samiyeel/`, `saumik/`). A push to any branch syncs its notes to the studies page through the GitHub workflow.
- `site/` is the website and its API. Keep it in place; Vercel deploys this directory.
- `experiments/` is for things we build and run while learning. See its README.
- `legit/` is for the distro work we intend to keep. See its README.
- `other/` holds support scripts, Supabase SQL, and tests. Run tests from the root with `node --test other/test/*.test.js`.

Keep the public root `README.md` about the project, not setup instructions. Root `.github/`, `.gitignore`, and `.env.example` serve Git or deployment; `.env` contains local secrets and must never be committed. Never use npm. Do not run destructive Supabase commands against live data without warning and explicit approval.
