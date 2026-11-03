-- The project is run by one administrator, so the administrator holds every
-- capability a staff role grants. The other role definitions stay; no new
-- staff role is assigned once the invitation and role-management commands go.

begin;

insert into identity.role_capabilities (role_key, capability_key)
select distinct 'administrator', grants.capability_key
from identity.role_capabilities grants
join identity.roles roles on roles.role_key = grants.role_key
where roles.is_staff
on conflict (role_key, capability_key) do nothing;

commit;
