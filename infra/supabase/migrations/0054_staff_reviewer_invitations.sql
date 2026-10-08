-- Staff invitation is an explicit, owner-authorized intention.
-- A Supabase Auth identity alone does not grant staff capabilities.
create table identity.staff_invitations (
  invitation_id uuid primary key default gen_random_uuid(),
  account_id uuid not null unique references auth.users(id) on delete restrict,
  email text not null,
  invited_by_account_id uuid not null references identity.accounts(account_id) on delete restrict,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  correlation_id uuid not null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);

create unique index staff_invitations_email_unique
  on identity.staff_invitations (lower(email));

revoke all on identity.staff_invitations from anon, authenticated;
