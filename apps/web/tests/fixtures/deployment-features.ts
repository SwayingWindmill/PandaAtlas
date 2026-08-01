export type DeploymentFeature = "engagement" | "notification";

export function isDeployedFeatureEnabled(feature: DeploymentFeature): boolean {
  const key = `PLAYWRIGHT_DEPLOYED_${feature.toUpperCase()}_ENABLED`;
  const value = process.env[key]?.trim().toLowerCase();

  if (value === undefined) return true;
  return value === "1" || value === "true";
}
