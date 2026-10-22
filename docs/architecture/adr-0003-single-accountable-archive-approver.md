# ADR 0003: One accountable approver

- Status: accepted (2026-07-30); the V1 compatibility migration in the original record was retired with V1 storage

One accountable approver decides each publication, with no four-eyes step. Validation, by a machine or a person, can make a change ready, but ready is never an approval: publishing stays an explicit command that carries the approver's capability, recent authentication, reason and audit trail. #611 applies this to V2 contribution approval.

A reader might expect a second reviewer for an archive. The earlier workflow stored a reviewer's `approved` as if it were the publication decision, so a validation result read as an approval and blurred who was accountable; the owner chose one named, accountable decision per publication instead.
