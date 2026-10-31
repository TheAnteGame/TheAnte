-- 0036 — A player with phone notifications on can turn email off (D-122).
--
-- Only meaningful while the player has at least one device in push_subscriptions:
-- the senders check both, so a player whose last device is gone gets email again
-- whatever this says — and the app sets it back to true when that happens, so the
-- profile shows the truth. If a push to every device fails, the email goes anyway.
alter table players add column email_notifications boolean not null default true;

comment on column players.email_notifications is 'False = phone only (D-122). Ignored unless the player has a push device; reset to true when the last one goes.';
