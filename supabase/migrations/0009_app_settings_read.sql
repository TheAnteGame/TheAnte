-- 0009 — League configuration (ticker toggles, cadences) is public to the league
-- (§11); writes remain admin-only (no policy — service role via commissioner actions).
create policy app_settings_read on app_settings for select to authenticated
  using (ante.is_approved());
