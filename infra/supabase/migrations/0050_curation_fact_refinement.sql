-- A reconciled acquisition candidate can refine an existing compatible fact
-- (for example year -> exact day) without being either corroboration or dispute.
-- 0049 used an unnamed operation CHECK, so locate that exact semantic constraint
-- once and replace it with the explicit V2 operation contract.

begin;

do $migration$
declare
  operation_constraint text;
begin
  select conname
  into operation_constraint
  from pg_constraint
  where conrelid = 'curation.owner_changes'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%fact.propose%'
    and pg_get_constraintdef(oid) like '%parentage.create%'
    and pg_get_constraintdef(oid) like '%residency.create%';

  if operation_constraint is null then
    raise exception 'curation.owner_changes operation constraint was not found';
  end if;

  execute format(
    'alter table curation.owner_changes drop constraint %I',
    operation_constraint
  );
end
$migration$;

alter table curation.owner_changes
  add constraint curation_owner_changes_operation_check
  check (
    (owner_module = 'panda' and operation in (
      'fact.propose',
      'fact.corroborate',
      'fact.refine',
      'fact.dispute',
      'name.add',
      'name.corroborate',
      'external_identifier.add',
      'external_identifier.corroborate'
    ))
    or (owner_module = 'lineage' and operation = 'parentage.create')
    or (owner_module = 'life_history' and operation in ('residency.create', 'event.create'))
  );

commit;
