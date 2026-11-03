-- The public panda list filtered every row's facts with jsonb_path_query_array. On the active
-- release that is about 925 rows and 1.8 MB of facts, and EXPLAIN ANALYZE spent 36 ms detoasting
-- them. The same four keys are what the list and profile relatives return. A stored generated
-- column computes them when a release is written, so a list read does not touch facts.
--
-- Adding a stored generated column rewrites public_read.pandas (about 2 MB). The rewrite takes
-- ACCESS EXCLUSIVE until this transaction commits and does not fire the seal trigger, so sealed
-- rows are filled in place. The previous API still selects facts and ignores this column.
--
-- The expression must stay the same as LISTING_FACT_KEYS in public-read.application.ts.
-- jsonb_path_query_array is immutable in this Postgres, which a generated column requires.
-- The column is NOT NULL: Postgres otherwise records a generated column as nullable, and
-- kysely-codegen types it as Json | null.

begin;

alter table public_read.pandas
  add column listing_facts jsonb
  generated always as (
    jsonb_path_query_array(
      facts,
      '$[*] ? (@.fieldKey == "sex" || @.fieldKey == "life_status" || @.fieldKey == "birth_date" || @.fieldKey == "death_date")'::jsonpath
    )
  ) stored not null;

commit;
