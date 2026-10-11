import type {
  PublicationAction,
  PublicationReleaseInspection,
  PublicationReleaseSummary,
} from "./api/queries";

// A release detail can load even when the collection holding the current
// public release failed. Never infer eligibility from that partial view.
export function availablePublicationActions({
  selected,
  current,
  releasesReady,
  canManage,
  canActivate,
  canEmergency,
}: {
  selected: PublicationReleaseInspection["release"] | undefined;
  current: PublicationReleaseSummary | undefined;
  releasesReady: boolean;
  canManage: boolean;
  canActivate: boolean;
  canEmergency: boolean;
}): PublicationAction[] {
  if (!selected || !releasesReady) return [];
  if (selected.lifecycleState === "building") return canManage ? ["seal"] : [];
  if (selected.lifecycleState !== "sealed") return [];
  if (selected.suspended) return canEmergency ? ["restore"] : [];

  const actions: PublicationAction[] = [];
  if (!selected.isCurrent && canActivate) {
    if (!current || new Date(selected.builtAt) > new Date(current.builtAt)) {
      actions.push("activate");
    } else if (selected.projectionSchemaVersion === current.projectionSchemaVersion) {
      actions.push("rollback");
    }
  }
  if (canEmergency) actions.push("suspend");
  return actions;
}
