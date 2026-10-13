-- Grant gaps found by the app-role grants test (#571), which derives the privileges the API needs from
-- its source. Integration tests connect as postgres, so each of these passed CI and would fail only in
-- production.

-- 0045 granted the review_moderation tables but not the queue views the review and moderation
-- repositories read.
grant select on review_moderation.review_case_queue, review_moderation.appeal_queue to zhipanda_app;

-- 0047 granted select/insert/update only, but privacy erasure deletes an account's channel preferences.
grant delete on notification.channel_preferences to zhipanda_app;

-- Staff invitation acceptance and role grants check an account's email and whether it is verified. The
-- application role has no access to auth.users, so read only those facts through a definer function,
-- like identity.is_live_auth_session (0042).
create function identity.auth_email_status(requested_account_id uuid)
returns table (email text, email_confirmed boolean)
language sql
security definer
set search_path = ''
stable
as $function$
  select auth_user.email::text, auth_user.email_confirmed_at is not null
  from auth.users auth_user
  where auth_user.id = requested_account_id
$function$;

revoke all on function identity.auth_email_status(uuid) from public;
grant execute on function identity.auth_email_status(uuid) to zhipanda_app;
