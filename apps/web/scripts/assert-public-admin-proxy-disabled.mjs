function isEnabled(value) {
  const normalized = value?.trim().toLowerCase();
  return normalized === "true" || normalized === "1";
}

const unsafeSettings = [];

if (isEnabled(process.env.ENABLE_LOCAL_ADMIN_PROXY)) {
  unsafeSettings.push("ENABLE_LOCAL_ADMIN_PROXY");
}
if (process.env.LOCAL_ADMIN_PROXY_BIND_HOST?.trim()) {
  unsafeSettings.push("LOCAL_ADMIN_PROXY_BIND_HOST");
}

if (unsafeSettings.length > 0) {
  console.error(
    `Refusing a public web build with local admin proxy configuration: ${unsafeSettings.join(", ")}.`,
  );
  process.exit(1);
}
