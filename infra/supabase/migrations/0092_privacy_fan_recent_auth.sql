-- Fan data export and account deletion verify identity with a recent email code
-- on a live session rather than requiring TOTP enrollment. Staff capabilities keep AAL2.

begin;

update identity.capabilities
set minimum_aal = 'aal1',
    requires_recent_auth = true,
    requires_live_session = true
where capability_key = 'privacy.request.manage';

commit;
