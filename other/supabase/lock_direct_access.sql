-- Run after schema.sql when using the name-and-password server function.
-- Browser clients no longer have direct table access, even with Supabase Auth.
revoke all on table public.myre_videos, public.myre_notes,
  public.myre_tasks, public.myre_checks from anon, authenticated;
revoke execute on function public.myre_can_edit() from authenticated;
