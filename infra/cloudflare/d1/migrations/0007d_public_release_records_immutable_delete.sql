-- Sub-migration of schema version 0007. Cloudflare's remote D1 parser
-- receives one complete trigger statement per migration.

create trigger if not exists public_release_records_immutable_delete
before delete on public_release_records begin
  select raise(abort, 'public release records are immutable');
end;
