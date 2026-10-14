# GitHub automation

`.github/` contains repository automation and contribution templates. Each workflow file declares when it runs.

| Workflow | Does |
|---|---|
| [`development-verification.yml`](workflows/development-verification.yml) | Changed-scope verification on pull requests; every scope on `main` |
| [`cloudflare-deployability.yml`](workflows/cloudflare-deployability.yml) | Builds both Workers, boots the API Worker and runs the Web browser suites |
| [`pr-stack-depth.yml`](workflows/pr-stack-depth.yml) | Allows at most one level of pull-request stacking |
| [`production-deploy.yml`](workflows/production-deploy.yml) | Builds, waits for approval on the `production` environment, migrates, deploys the API then the Web, and probes |
| [`production-probe.yml`](workflows/production-probe.yml) | Fails when the API, its database, the async downstream or the home page is down |
| [`batch-operations.yml`](workflows/batch-operations.yml) | Plans or runs a bounded batch operation from the batch catalog |
| [`crawler-poc.yml`](workflows/crawler-poc.yml) | Runs the controlled crawler comparison |

[`dependabot.yml`](dependabot.yml) opens grouped weekly version updates. [`PULL_REQUEST_TEMPLATE.md`](PULL_REQUEST_TEMPLATE.md) and [`ISSUE_TEMPLATE/delivery.md`](ISSUE_TEMPLATE/delivery.md) shape pull requests and issues.

Only `production-deploy.yml` holds production secrets, and only after approval.
