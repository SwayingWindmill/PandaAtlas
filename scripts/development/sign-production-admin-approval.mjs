// Run on the deployment owner's machine, not in Cloudflare or a database shell.
// The signing key never becomes a PandaAtlas app/runtime secret.
import { sign } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function main(argv) {
  if (argv.length === 1 && argv[0] === "--help") {
    console.log("Owner-only offline signature: --operation bootstrap|recover --account-id <UUID> --approval-id <ticket> --approved-by <owner> --private-key <pem-path> --output <json-path>");
    return;
  }
  const flags = new Map();
  const required = ["--operation", "--account-id", "--approval-id", "--approved-by", "--private-key", "--output"];
  for (let i = 0; i < argv.length; i += 2) {
    if (!required.includes(argv[i]) || flags.has(argv[i])) throw new Error("Unknown or duplicate signing argument");
    flags.set(argv[i], argv[i + 1]);
  }
  if (required.some((flag) => !flags.get(flag)) ||
      !["bootstrap", "recover"].includes(flags.get("--operation")) ||
      !UUID.test(flags.get("--account-id")) ||
      !/^[A-Za-z0-9-]{8,80}$/.test(flags.get("--approval-id"))) {
    throw new Error("Explicit approved operation, immutable subject, approval ID and owner key are required");
  }
  const request = {
    version: 1,
    operation: flags.get("--operation"),
    accountId: flags.get("--account-id"),
    approvalId: flags.get("--approval-id"),
    approvedBy: flags.get("--approved-by"),
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  };
  const privateKey = await readFile(flags.get("--private-key"), "utf8");
  const signature = sign(null, Buffer.from(JSON.stringify(request)), privateKey).toString("base64");
  await writeFile(flags.get("--output"), JSON.stringify({ request, signature }, null, 2) + "\n", { encoding: "utf8", flag: "wx", mode: 0o600 });
  console.log("Signed approval written (expires in one hour). Share only this approval JSON with the trusted operator, never the private key.");
}

main(process.argv.slice(2)).catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
