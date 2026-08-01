# GitHub delivery boundary

`.github/` contains repository automation and contribution metadata. Pull-request delivery is governed by [`contracts/delivery-workflow.v1.json`](../contracts/delivery-workflow.v1.json).

- [`PULL_REQUEST_TEMPLATE.md`](PULL_REQUEST_TEMPLATE.md) records the required Issue, Summary, Verification, and Safety sections.
- [`ISSUE_TEMPLATE/delivery.md`](ISSUE_TEMPLATE/delivery.md) defines one bounded implementation outcome.
- [`workflows/delivery-contract.yml`](workflows/delivery-contract.yml) validates pull-request metadata with read-only permissions.

The delivery workflow must not push branches, edit issues or pull requests, access deployment secrets, or perform production actions. Runtime and release workflows remain separately governed.
