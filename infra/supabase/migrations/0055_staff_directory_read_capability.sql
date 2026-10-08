-- Separate authorized staff directory inspection from sensitive IAM mutations.
-- Reading staff identity and audit history needs a live login session, not a
-- recent AAL2 step-up. Grant/revoke/invite/suspend/reinstate keep their existing
-- AAL2, 15-minute recent-authentication and live-session policies.
begin;

insert into identity.capabilities (
  capability_key, description, sensitive,
  requires_recent_auth, minimum_aal, requires_live_session
) values (
  'identity.staff.read',
  'Read restricted staff directory, role history and invitation status.',
  false, false, 'aal1', true
);

insert into identity.role_capabilities (role_key, capability_key)
select distinct role_key, 'identity.staff.read'
from identity.role_capabilities
where capability_key in ('identity.account.manage', 'identity.role.manage')
on conflict (role_key, capability_key) do nothing;

commit;
