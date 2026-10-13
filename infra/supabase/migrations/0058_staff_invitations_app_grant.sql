-- 0054 created identity.staff_invitations without granting it to the application role, so the API's
-- staff invitation, role and account-lifecycle services were denied in production. Identity tables
-- are granted explicitly (there is no default ACL on the identity schema).
grant select, insert, update on identity.staff_invitations to zhipanda_app;
