-- Indexes for foreign keys and lookups that are actually used, or that will be scanned as
-- fan and intake tables grow. CREATE INDEX takes a share lock that blocks writes for the build.
-- These tables are empty or a few thousand rows, so the lock is brief. CONCURRENTLY cannot run
-- inside the transaction supabase db push uses, and it is not worth a separate session here.
--
-- Left alone on purpose: staff and audit actor keys, publication actor keys, and
-- community_intake.submissions.current_status_event_id. Nothing reads them, and the referenced
-- rows are not deleted. Cover reads of public_read.media already use
-- idx_public_read_media_panda (release_id, panda_id, display_order, asset_id).

begin;

-- Guess questions join media on release and asset. The panda-leading index cannot serve that,
-- so the planner was reading every media row in the projection (about 46 ms).
create index idx_public_read_media_release_asset
  on public_read.media (release_id, asset_id);

-- Attempts, encounters and daily results grow with each fan. The account-leading keys already
-- exist; these are the other side of the foreign key, used when a question, panda or asset changes.
create index idx_game_attempts_question
  on game.attempts (question_id);

create index idx_game_attempts_selected_panda
  on game.attempts (selected_panda_id);

create index idx_game_encounters_panda
  on game.encounters (panda_id);

create index idx_game_daily_panda_results_panda
  on game.daily_panda_results (panda_id);

create index idx_game_questions_media_asset
  on game.questions (media_asset_id);

-- Staff account detail lists state history for one account, newest first.
create index idx_identity_account_state_events_account
  on identity.account_state_events (account_id, occurred_at desc);

-- A contribution loads the attachments of one revision. idx_community_attachments_submission
-- leads with submission_id only, so it does not cover this foreign key.
create index idx_community_attachments_revision
  on community_intake.attachments (submission_id, bound_revision_number, created_at);

-- Deleting an account is restricted by the uploads that account made.
create index idx_admin_media_uploads_uploaded_by
  on admin_media.uploads (uploaded_by);

commit;
