export interface ParentageEdge {
  parentId: string;
  childId: string;
}

// The pandas a public profile shows around its focus: parents, children, siblings (sharing a
// parent) and grandparents. Returned sorted, without the focus panda.
export function familyCircleIds(focusId: string, edges: readonly ParentageEdge[]): string[] {
  const parentsOf = new Map<string, string[]>();
  const childrenOf = new Map<string, string[]>();
  for (const { parentId, childId } of edges) {
    parentsOf.set(childId, [...(parentsOf.get(childId) ?? []), parentId]);
    childrenOf.set(parentId, [...(childrenOf.get(parentId) ?? []), childId]);
  }

  const ids = new Set<string>();
  for (const parentId of parentsOf.get(focusId) ?? []) {
    ids.add(parentId);
    for (const siblingId of childrenOf.get(parentId) ?? []) ids.add(siblingId);
    for (const grandparentId of parentsOf.get(parentId) ?? []) ids.add(grandparentId);
  }
  for (const childId of childrenOf.get(focusId) ?? []) ids.add(childId);
  ids.delete(focusId);
  return [...ids].sort();
}
