-- Supabase security advisor 0011 (function_search_path_mutable): pin an empty search_path on the trigger and
-- helper functions that still resolve names through the caller's. Every body already names its tables with their
-- schema and calls only built-in functions, so behaviour is unchanged; a caller can no longer shadow them.
-- Supabase performance advisor 0001: the notification audience looks up followers by panda for every release
-- (engagement.favorites is keyed by account first), so give that lookup its own index.

begin;

alter function public.set_updated_at() set search_path = '';
alter function identity.set_updated_at() set search_path = '';
alter function identity.reject_append_only_mutation() set search_path = '';
alter function community_intake.reject_append_only_mutation() set search_path = '';
alter function community_intake.enforce_attachment_limits() set search_path = '';
alter function community_intake.enforce_attachment_transition() set search_path = '';
alter function community_intake.enforce_submission_transition() set search_path = '';
alter function review_moderation.add_business_days(timestamptz, integer) set search_path = '';
alter function review_moderation.reject_append_only_mutation() set search_path = '';
alter function review_moderation.enforce_review_case_transition() set search_path = '';
alter function review_moderation.enforce_decision_conflict() set search_path = '';

create index if not exists idx_engagement_favorites_panda on engagement.favorites (panda_id, account_id);

commit;
