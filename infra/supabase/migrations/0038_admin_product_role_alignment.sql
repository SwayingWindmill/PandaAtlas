-- Align the product-facing Administrator role with the Admin Design requirement
-- that administrators include ordinary content-editor authority. Moderation,
-- privacy, audit export, and senior/sensitive Archive powers remain separate.

begin;

insert into identity.role_capabilities (role_key, capability_key) values
  ('administrator', 'archive.change_set.create'),
  ('administrator', 'archive.accountable.validate'),
  ('administrator', 'archive.accountable.publish'),
  ('administrator', 'archive.accountable.metrics'),
  ('administrator', 'archive.workbench.read')
on conflict do nothing;

commit;
