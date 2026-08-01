begin;

create or replace function review_moderation.mark_account_state_command_ownership()
returns trigger
language plpgsql
as $$
begin
  if new.kind in ('account_suspended', 'account_closed_for_abuse') then
    perform set_config('panda.moderation_suspension_claim', '1', true);
  elsif new.kind = 'restoration' then
    perform set_config('panda.moderation_restoration_claim', '1', true);
  end if;
  return new;
end;
$$;

create or replace function review_moderation.guard_account_state_ownership()
returns trigger
language plpgsql
as $$
declare
  suspension_claim boolean := coalesce(
    nullif(current_setting('panda.moderation_suspension_claim', true), ''),
    '0'
  ) = '1';
  restoration_claim boolean := coalesce(
    nullif(current_setting('panda.moderation_restoration_claim', true), ''),
    '0'
  ) = '1';
begin
  if old.state <> 'suspended'
    and new.state = 'suspended'
    and suspension_claim then
    new.state_reason := 'moderation';
  end if;

  if old.state = 'suspended' and new.state = 'active' then
    if old.state_reason = 'moderation' and not restoration_claim then
      raise exception 'moderation-owned suspension requires an append-only restoration action'
        using errcode = '40001';
    end if;
    if old.state_reason is distinct from 'moderation' and restoration_claim then
      raise exception 'moderation cannot restore an account suspended by another process'
        using errcode = '40001';
    end if;
  end if;

  return new;
end;
$$;

create trigger trg_moderation_action_state_claim
before insert on review_moderation.moderation_actions
for each row execute function review_moderation.mark_account_state_command_ownership();

create trigger trg_identity_account_moderation_ownership
before update of state, state_reason on identity.accounts
for each row execute function review_moderation.guard_account_state_ownership();

revoke all on function review_moderation.mark_account_state_command_ownership() from public;
revoke all on function review_moderation.guard_account_state_ownership() from public;

commit;
