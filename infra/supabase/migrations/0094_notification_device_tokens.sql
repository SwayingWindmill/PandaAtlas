-- Expand-first notification schema update for Expo Push device tokens and push provider jobs.
begin;

alter table notification.channel_preferences
  drop constraint channel_preferences_channel_check,
  add constraint channel_preferences_channel_check
    check (channel in ('station', 'email', 'push'));

alter table notification.message_channels
  drop constraint message_channels_channel_check,
  add constraint message_channels_channel_check
    check (channel in ('station', 'email', 'push'));

alter table notification.provider_jobs
  drop constraint provider_jobs_channel_check,
  add constraint provider_jobs_channel_check
    check (channel in ('email', 'push'));

alter table notification.provider_jobs
  drop constraint provider_jobs_message_id_key,
  add constraint provider_jobs_message_id_channel_key
    unique (message_id, channel);

create table if not exists notification.device_tokens (
  device_token_id uuid default gen_random_uuid() not null,
  account_id uuid not null,
  expo_push_token text not null,
  platform text not null,
  active boolean default true not null,
  disabled_reason text,
  last_active_at timestamp with time zone default now() not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  constraint device_tokens_pkey primary key (device_token_id),
  constraint device_tokens_account_id_fkey foreign key (account_id)
    references identity.accounts(account_id) on delete cascade,
  constraint device_tokens_expo_push_token_key unique (expo_push_token),
  constraint device_tokens_platform_check check (platform in ('ios', 'android')),
  constraint device_tokens_active_reason_check check (
    (active and disabled_reason is null)
    or ((not active) and disabled_reason is not null)
  )
);

create index if not exists idx_notification_device_tokens_account_active
  on notification.device_tokens(account_id, updated_at desc)
  where active;

revoke all on table notification.device_tokens from public, anon, authenticated;
grant select, insert, update, delete on table notification.device_tokens to zhipanda_app;

commit;
