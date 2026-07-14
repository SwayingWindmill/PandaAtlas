-- Add reviewed public-profile presentation fields to the D1 read projection.

alter table pandas add column record_tier text
  check (record_tier in ('complete_first_pass', 'identity_first_pass', 'dependency_stub'));
alter table pandas add column localized_content_json text not null default '[]';
alter table pandas add column media_release_json text;
alter table pandas add column public_revision_json text;
