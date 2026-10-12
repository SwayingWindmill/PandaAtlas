-- Admin staff should be able to work throughout an authenticated session.
-- A 15-minute recent-auth window is appropriate for high-impact commands,
-- not for routine evidence inspection, review, and candidate preparation.
-- Role grants, account state, and ordinary JWT validation remain mandatory.
begin;

update identity.capabilities
set requires_recent_auth = false
where capability_key in (
  'review.case.intake',
  'review.case.read',
  'review.case.claim',
  'review.case.verify_source',
  'review.case.decide',
  'review.case.recommend',
  'review.case.triage',
  'review.case.reopen',
  'review.case.request_information',
  'review.case.metrics',
  'moderation.appeal.read',
  'moderation.sanction.read',
  'moderation.metrics',
  'curation.change.read',
  'curation.change.manage',
  'publication.release.manage',
  'audit.read'
);

-- Still require live AAL2 plus recent interactive authentication for actual
-- publication/rollback, sanctions, independent approvals and staff IAM changes.
commit;
