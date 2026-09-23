-- Run once after schema.sql. This starts a daily write without a Vercel deployment.
-- Internal database activity alone may not prevent a free project from pausing.
create extension if not exists pg_cron;

select cron.schedule(
  'myre-internal-heartbeat',
  '0 8 * * *',
  $$update public.myre_heartbeat set last_ping_at = now() where id = 1$$
);
