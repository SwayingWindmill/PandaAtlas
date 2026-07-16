-- Sub-migration of schema version 0007. Cloudflare's remote D1 parser
-- receives one complete trigger statement per migration.

create trigger if not exists public_releases_immutable_delete
before delete on public_releases begin
  select raise(abort, 'public releases are immutable');
end;
