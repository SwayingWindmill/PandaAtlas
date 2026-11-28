import { type Fixture, fixture } from "./fixture.ts";

const E2E_FIXTURE_HEADER = "x-e2e-fixture-token";

async function postFixture<T>(
  baseUrl: string,
  token: string,
  route: string,
  body?: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(`${baseUrl}/api/_test/e2e/${route}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      [E2E_FIXTURE_HEADER]: token,
    },
    body: JSON.stringify(body ?? {}),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`E2E fixture ${route} failed (${response.status}): ${text.slice(0, 300)}`);
  }
  return JSON.parse(text) as T;
}

/** Publishes this run's pandas, family, zoo, photos and 猜熊猫 question through the dev/test E2E fixture API. */
export function seedFixture(
  apiBaseUrl: string,
  fixtureToken: string,
): Promise<Pick<Fixture, "panda" | "notice" | "zoo">> {
  return postFixture<Pick<Fixture, "panda" | "notice" | "zoo">>(apiBaseUrl, fixtureToken, "seed");
}

/** Expires an account's recent interactive auth watermark on the test API so privacy routes require fresh OTP verification. */
export async function expireRecentAuth(accountId: string, afterEpochSeconds?: number): Promise<void> {
  const { apiBaseUrl, fixtureToken } = fixture();
  await postFixture(apiBaseUrl, fixtureToken, "auth/expire-recent", {
    accountId,
    ...(afterEpochSeconds === undefined ? {} : { afterEpochSeconds }),
  });
}

/** Runs the scheduled async cycle a few times, enough for queued work to settle. */
export async function runScheduledCycles(cycles = 4): Promise<void> {
  const { apiBaseUrl, fixtureToken } = fixture();
  await postFixture(apiBaseUrl, fixtureToken, "scheduled-cycles", { cycles });
}

/** Takes a published panda down for review and restores it, which notifies its followers, then runs the cycle. */
export async function takeDownAndRestore(pandaId: string): Promise<void> {
  const { apiBaseUrl, fixtureToken } = fixture();
  await postFixture(apiBaseUrl, fixtureToken, "takedown-restore", { pandaId });
}
