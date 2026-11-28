-- Encrypted Sign in with Apple refresh tokens for App Store 5.1.1(v) revocation on account deletion.
begin;

create table if not exists identity.apple_revocation_tokens (
  account_id uuid not null,
  refresh_token_ciphertext text not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  constraint apple_revocation_tokens_pkey primary key (account_id),
  constraint apple_revocation_tokens_account_id_fkey foreign key (account_id)
    references identity.accounts(account_id) on delete cascade
);

revoke all on table identity.apple_revocation_tokens from public, anon, authenticated;
grant select, insert, update, delete on table identity.apple_revocation_tokens to zhipanda_app;

commit;
