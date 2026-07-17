import type { PublicLocale } from "@/foundation/content/locales";
import type {
  PandaLineageNode,
  PublicParentageAssertionSummary,
  PublicParentageStatus,
  PublicSourceSummary,
} from "@/lib/types";
import type { LineageQueryState } from "./lineage-query";

export type StructuredRelationKind =
  | "parent"
  | "ancestor"
  | "sibling"
  | "child"
  | "descendant";

export type StructuredRelationStatus = PublicParentageStatus | "unknown";

export interface StructuredLineageNode {
  id: string;
  slug: string;
  name: string;
  nameLanguage: "zh-CN" | "en";
  alternateName: string | null;
  profileAvailable: boolean;
  recordTier: string | null;
}

export interface StructuredLineageSource {
  id: string;
  publisher: string;
  title: string;
  url: string | null;
  accessState: string;
  lastVerifiedAt: string | null;
}

export interface StructuredLineageRelation {
  id: string;
  kind: StructuredRelationKind;
  generation: number;
  direction: "up" | "down" | "lateral";
  role: "father" | "mother" | null;
  status: StructuredRelationStatus;
  related: StructuredLineageNode;
  path: StructuredLineageNode[];
  assertionIds: string[];
  sources: StructuredLineageSource[];
  selected: boolean;
}

export interface StructuredLineageSection {
  key: "parents" | "ancestors" | "siblings" | "children" | "descendants";
  relations: StructuredLineageRelation[];
}

export interface StructuredLineageViewModel {
  focus: StructuredLineageNode;
  focusOptions: StructuredLineageNode[];
  sections: StructuredLineageSection[];
  selectedRelation: StructuredLineageRelation | null;
  validRelationIds: Set<string>;
  totalRelations: number;
  scopedNodeCount: number;
  hasPartialRecords: boolean;
}

interface TraversalState {
  nodeId: string;
  nodePath: string[];
  assertions: PublicParentageAssertionSummary[];
}

const statusPriority: Record<StructuredRelationStatus, number> = {
  unknown: 0,
  confirmed: 1,
  superseded: 2,
  tentative: 3,
  disputed: 4,
};

function combineStatus(assertions: PublicParentageAssertionSummary[]): StructuredRelationStatus {
  if (!assertions.length) return "unknown";
  return assertions.reduce<StructuredRelationStatus>((current, assertion) =>
    statusPriority[assertion.status] > statusPriority[current] ? assertion.status : current,
  "unknown");
}

function localizedNode(node: PandaLineageNode, locale: PublicLocale): StructuredLineageNode {
  const missingEnglish = locale === "en" && !node.name_en;
  return {
    id: node.id,
    slug: node.slug,
    name: locale === "zh" ? node.name_zh : node.name_en ?? node.name_zh,
    nameLanguage: missingEnglish ? "zh-CN" : locale === "zh" ? "zh-CN" : "en",
    alternateName: locale === "zh" ? node.name_en : node.name_zh,
    profileAvailable: node.profile_available === true,
    recordTier: node.record_tier ?? null,
  };
}

function relationSources(
  assertions: PublicParentageAssertionSummary[],
  sourcesById: Map<string, PublicSourceSummary>,
): StructuredLineageSource[] {
  const sourceIds = [...new Set(assertions.flatMap((assertion) => assertion.source_ids))];
  return sourceIds.map((sourceId) => {
    const source = sourcesById.get(sourceId);
    return source
      ? {
          id: source.id,
          publisher: source.publisher,
          title: source.title,
          url: source.url,
          accessState: source.access_state,
          lastVerifiedAt: source.last_verified_at,
        }
      : {
          id: sourceId,
          publisher: "Unresolved source",
          title: sourceId,
          url: null,
          accessState: "unavailable",
          lastVerifiedAt: null,
        };
  });
}

function buildRelation(
  id: string,
  kind: StructuredRelationKind,
  generation: number,
  role: StructuredLineageRelation["role"],
  relatedId: string,
  nodePath: string[],
  assertions: PublicParentageAssertionSummary[],
  nodesById: Map<string, PandaLineageNode>,
  sourcesById: Map<string, PublicSourceSummary>,
  locale: PublicLocale,
  selectedId: string,
): StructuredLineageRelation | null {
  const relatedNode = nodesById.get(relatedId);
  if (!relatedNode) return null;
  const path = nodePath.flatMap((nodeId) => {
    const node = nodesById.get(nodeId);
    return node ? [localizedNode(node, locale)] : [];
  });
  return {
    id,
    kind,
    generation,
    direction: generation < 0 ? "up" : generation > 0 ? "down" : "lateral",
    role,
    status: combineStatus(assertions),
    related: localizedNode(relatedNode, locale),
    path,
    assertionIds: assertions.map((assertion) => assertion.id),
    sources: relationSources(assertions, sourcesById),
    selected: id === selectedId,
  };
}

export function buildStructuredLineageViewModel(
  nodes: PandaLineageNode[],
  assertions: PublicParentageAssertionSummary[],
  sources: PublicSourceSummary[],
  state: LineageQueryState,
  locale: PublicLocale,
): StructuredLineageViewModel {
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const sourcesById = new Map(sources.map((source) => [source.id, source]));
  const assertionsByChild = new Map<string, PublicParentageAssertionSummary[]>();
  const assertionsByParent = new Map<string, PublicParentageAssertionSummary[]>();

  for (const assertion of assertions) {
    assertionsByChild.set(assertion.child_id, [
      ...(assertionsByChild.get(assertion.child_id) ?? []),
      assertion,
    ]);
    assertionsByParent.set(assertion.parent_id, [
      ...(assertionsByParent.get(assertion.parent_id) ?? []),
      assertion,
    ]);
  }

  const focusNode = nodesById.get(state.focusId) ?? nodes.find((node) => node.profile_available) ?? nodes[0];
  if (!focusNode) throw new Error("The trusted lineage release contains no nodes.");

  const relations = new Map<string, StructuredLineageRelation>();
  const addRelation = (relation: StructuredLineageRelation | null) => {
    if (relation && !relations.has(relation.id)) relations.set(relation.id, relation);
  };

  let ancestorFrontier: TraversalState[] = [{
    nodeId: focusNode.id,
    nodePath: [focusNode.id],
    assertions: [],
  }];
  for (let generation = 1; generation <= state.ancestorDepth; generation += 1) {
    const nextFrontier: TraversalState[] = [];
    for (const current of ancestorFrontier) {
      for (const assertion of assertionsByChild.get(current.nodeId) ?? []) {
        const pathAssertions = [...current.assertions, assertion];
        const nodePath = [...current.nodePath, assertion.parent_id];
        const kind: StructuredRelationKind = generation === 1 ? "parent" : "ancestor";
        const id = generation === 1
          ? assertion.id
          : `ancestor:${assertion.parent_id}:${pathAssertions.map((item) => item.id).join("~")}`;
        addRelation(buildRelation(
          id,
          kind,
          -generation,
          generation === 1 ? assertion.role : null,
          assertion.parent_id,
          nodePath,
          pathAssertions,
          nodesById,
          sourcesById,
          locale,
          state.relation,
        ));
        nextFrontier.push({ nodeId: assertion.parent_id, nodePath, assertions: pathAssertions });
      }
    }
    ancestorFrontier = nextFrontier;
  }

  let descendantFrontier: TraversalState[] = [{
    nodeId: focusNode.id,
    nodePath: [focusNode.id],
    assertions: [],
  }];
  for (let generation = 1; generation <= state.descendantDepth; generation += 1) {
    const nextFrontier: TraversalState[] = [];
    for (const current of descendantFrontier) {
      for (const assertion of assertionsByParent.get(current.nodeId) ?? []) {
        const pathAssertions = [...current.assertions, assertion];
        const nodePath = [...current.nodePath, assertion.child_id];
        const kind: StructuredRelationKind = generation === 1 ? "child" : "descendant";
        const id = generation === 1
          ? assertion.id
          : `descendant:${assertion.child_id}:${pathAssertions.map((item) => item.id).join("~")}`;
        addRelation(buildRelation(
          id,
          kind,
          generation,
          generation === 1 ? assertion.role : null,
          assertion.child_id,
          nodePath,
          pathAssertions,
          nodesById,
          sourcesById,
          locale,
          state.relation,
        ));
        nextFrontier.push({ nodeId: assertion.child_id, nodePath, assertions: pathAssertions });
      }
    }
    descendantFrontier = nextFrontier;
  }

  const siblings = new Map<string, { parents: string[]; assertions: PublicParentageAssertionSummary[] }>();
  for (const focusParentAssertion of assertionsByChild.get(focusNode.id) ?? []) {
    for (const siblingAssertion of assertionsByParent.get(focusParentAssertion.parent_id) ?? []) {
      if (siblingAssertion.child_id === focusNode.id) continue;
      const existing = siblings.get(siblingAssertion.child_id) ?? { parents: [], assertions: [] };
      existing.parents.push(focusParentAssertion.parent_id);
      existing.assertions.push(focusParentAssertion, siblingAssertion);
      siblings.set(siblingAssertion.child_id, existing);
    }
  }
  for (const [siblingId, evidence] of siblings) {
    const uniqueAssertions = [...new Map(evidence.assertions.map((assertion) => [assertion.id, assertion])).values()];
    const parentIds = [...new Set(evidence.parents)];
    addRelation(buildRelation(
      `sibling:${siblingId}`,
      "sibling",
      0,
      null,
      siblingId,
      [focusNode.id, ...parentIds, siblingId],
      uniqueAssertions,
      nodesById,
      sourcesById,
      locale,
      state.relation,
    ));
  }

  const collator = new Intl.Collator(locale === "zh" ? "zh-CN" : "en", { sensitivity: "base" });
  const allRelations = [...relations.values()].sort((left, right) =>
    left.generation - right.generation || collator.compare(left.related.name, right.related.name),
  );
  const sections: StructuredLineageSection[] = [
    { key: "parents", relations: allRelations.filter((relation) => relation.kind === "parent") },
    { key: "ancestors", relations: allRelations.filter((relation) => relation.kind === "ancestor") },
    { key: "siblings", relations: allRelations.filter((relation) => relation.kind === "sibling") },
    { key: "children", relations: allRelations.filter((relation) => relation.kind === "child") },
    { key: "descendants", relations: allRelations.filter((relation) => relation.kind === "descendant") },
  ];
  const scopedNodeIds = new Set([focusNode.id, ...allRelations.flatMap((relation) => relation.path.map((node) => node.id))]);
  const hasPartialRecords = [...scopedNodeIds].some((nodeId) =>
    nodesById.get(nodeId)?.record_tier !== "complete_first_pass",
  ) || allRelations.some((relation) =>
    relation.status !== "confirmed" || relation.sources.some((source) => source.accessState !== "accessible"),
  );

  return {
    focus: localizedNode(focusNode, locale),
    focusOptions: nodes
      .filter((node) => node.profile_available)
      .map((node) => localizedNode(node, locale))
      .sort((left, right) => collator.compare(left.name, right.name)),
    sections,
    selectedRelation: allRelations.find((relation) => relation.selected) ?? null,
    validRelationIds: new Set(allRelations.map((relation) => relation.id)),
    totalRelations: allRelations.length,
    scopedNodeCount: scopedNodeIds.size,
    hasPartialRecords,
  };
}
