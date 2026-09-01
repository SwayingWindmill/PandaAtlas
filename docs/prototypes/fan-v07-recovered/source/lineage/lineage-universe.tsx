"use client";

/* eslint-disable @next/next/no-img-element -- lineage portraits use reviewed public panda media. */

import type { Route } from "next";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import * as f3 from "family-chart";
import "family-chart/styles/family-chart.css";
import { ArrowRight, ExternalLink, Minus, Plus, Search, ShieldCheck, X } from "lucide-react";

import type { LineageQueryState } from "@/features/lineage/lineage-query";
import {
  buildStructuredLineageViewModel,
  type StructuredLineageGraph,
  type StructuredLineageGraphEdge,
  type StructuredLineageGraphNode,
  type StructuredRelationStatus,
} from "@/features/lineage/lineage-view-model";
import type { PublicLocale } from "@/foundation/content/locales";
import type { PandaLineageNode, PublicParentageAssertionSummary, PublicSourceSummary } from "@/lib/types";

import styles from "./universe.module.css";

type ViewMode = "tree" | "pedigree" | "fan" | "list";
type FamilyCardStyle = "circle" | "rect";

const PANDA_PLACEHOLDER = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160"><rect width="160" height="160" rx="80" fill="#e8ebe5"/><circle cx="48" cy="43" r="24" fill="#173129"/><circle cx="112" cy="43" r="24" fill="#173129"/><ellipse cx="80" cy="87" rx="55" ry="52" fill="#faf8f0"/><ellipse cx="57" cy="77" rx="17" ry="22" transform="rotate(25 57 77)" fill="#173129"/><ellipse cx="103" cy="77" rx="17" ry="22" transform="rotate(-25 103 77)" fill="#173129"/><circle cx="61" cy="78" r="5" fill="#faf8f0"/><circle cx="99" cy="78" r="5" fill="#faf8f0"/><ellipse cx="80" cy="101" rx="10" ry="7" fill="#173129"/><path d="M68 113 Q80 123 92 113" fill="none" stroke="#173129" stroke-width="5" stroke-linecap="round"/></svg>`)}`;

type LocalPanda = {
  id: string;
  slug: string;
  name: string;
  alternateName: string | null;
  imageUrl: string | null;
  birthYear: string | null;
  profileAvailable: boolean;
};

type FamilyChartModel = {
  data: f3.Data;
  canonicalIdByRawId: Map<string, string>;
  canonicalNodes: PandaLineageNode[];
  nodeById: Map<string, PandaLineageNode>;
  assertions: PublicParentageAssertionSummary[];
};

interface Props {
  locale: PublicLocale;
  initialState: LineageQueryState;
  nodes: PandaLineageNode[];
  assertions: PublicParentageAssertionSummary[];
  sources: PublicSourceSummary[];
}

function roleLabel(locale: PublicLocale, role: "father" | "mother") {
  if (locale === "zh") return role === "father" ? "父亲" : "母亲";
  return role === "father" ? "Father" : "Mother";
}

function statusLabel(locale: PublicLocale, status: StructuredRelationStatus) {
  const zh = { confirmed: "已确认", tentative: "暂定", disputed: "有争议", superseded: "已取代", unknown: "未知" } as const;
  const en = { confirmed: "Confirmed", tentative: "Tentative", disputed: "Disputed", superseded: "Superseded", unknown: "Unknown" } as const;
  return (locale === "zh" ? zh : en)[status];
}

function edgePriority(status: StructuredRelationStatus) {
  if (status === "confirmed") return 0;
  if (status === "tentative") return 1;
  if (status === "disputed") return 2;
  if (status === "superseded") return 3;
  return 4;
}

function localizedNode(node: PandaLineageNode, locale: PublicLocale): LocalPanda {
  return {
    id: node.id,
    slug: node.slug,
    name: locale === "zh" ? node.name_zh : node.name_en ?? node.name_zh,
    alternateName: locale === "zh" ? node.name_en : node.name_zh,
    imageUrl: node.cover_image_url,
    birthYear: node.birth_date?.match(/^\d{4}/)?.[0] ?? null,
    profileAvailable: node.profile_available === true,
  };
}

function nodeScore(node: PandaLineageNode) {
  return Number(Boolean(node.cover_image_url)) * 4
    + Number(node.profile_available === true) * 2
    + Number(node.record_tier === "complete_first_pass");
}

function identityKey(node: PandaLineageNode) {
  const year = node.birth_date?.slice(0, 4) ?? "";
  return `${node.name_zh.trim().toLocaleLowerCase()}|${year}`;
}

function buildFamilyChartModel(nodes: PandaLineageNode[], assertions: PublicParentageAssertionSummary[], locale: PublicLocale): FamilyChartModel {
  const preferredByIdentity = new Map<string, PandaLineageNode>();
  for (const node of nodes) {
    const key = identityKey(node);
    const existing = preferredByIdentity.get(key);
    if (!existing || nodeScore(node) > nodeScore(existing)) preferredByIdentity.set(key, node);
  }

  const canonicalNodes = [...preferredByIdentity.values()];
  const canonicalIdByRawId = new Map<string, string>();
  for (const node of nodes) canonicalIdByRawId.set(node.id, preferredByIdentity.get(identityKey(node))?.id ?? node.id);
  const nodeById = new Map(canonicalNodes.map((node) => [node.id, node]));

  const normalizedByKey = new Map<string, PublicParentageAssertionSummary>();
  for (const assertion of assertions) {
    const parentId = canonicalIdByRawId.get(assertion.parent_id) ?? assertion.parent_id;
    const childId = canonicalIdByRawId.get(assertion.child_id) ?? assertion.child_id;
    if (parentId === childId || !nodeById.has(parentId) || !nodeById.has(childId)) continue;
    const normalized = { ...assertion, parent_id: parentId, child_id: childId };
    const key = `${childId}|${normalized.role}|${parentId}`;
    const existing = normalizedByKey.get(key);
    if (!existing || edgePriority(normalized.status) < edgePriority(existing.status)) normalizedByKey.set(key, normalized);
  }
  const normalizedAssertions = [...normalizedByKey.values()];

  const byChild = new Map<string, PublicParentageAssertionSummary[]>();
  for (const assertion of normalizedAssertions) {
    byChild.set(assertion.child_id, [...(byChild.get(assertion.child_id) ?? []), assertion]);
  }

  const rels = new Map<string, { parents: Set<string>; spouses: Set<string>; children: Set<string> }>();
  canonicalNodes.forEach((node) => rels.set(node.id, { parents: new Set(), spouses: new Set(), children: new Set() }));

  const choose = (pool: PublicParentageAssertionSummary[], role: "father" | "mother") =>
    pool.filter((item) => item.role === role).sort((a, b) => edgePriority(a.status) - edgePriority(b.status))[0] ?? null;

  for (const [childId, pool] of byChild) {
    const father = choose(pool, "father");
    const mother = choose(pool, "mother");
    const parents = [father?.parent_id, mother?.parent_id].filter((id): id is string => Boolean(id));
    const childRels = rels.get(childId);
    parents.forEach((parentId) => {
      childRels?.parents.add(parentId);
      rels.get(parentId)?.children.add(childId);
    });
    if (father && mother && father.parent_id !== mother.parent_id) {
      rels.get(father.parent_id)?.spouses.add(mother.parent_id);
      rels.get(mother.parent_id)?.spouses.add(father.parent_id);
    }
  }

  const data = canonicalNodes.map((node) => {
    const localized = localizedNode(node, locale);
    const nodeRels = rels.get(node.id)!;
    const gender = node.gender === "female" ? "F" : "M";
    return {
      id: node.id,
      data: {
        gender,
        name: localized.name,
        birthday: localized.birthYear ?? "—",
        avatar: localized.imageUrl ?? PANDA_PLACEHOLDER,
        slug: node.slug,
        alternate: localized.alternateName ?? "",
        status: node.status,
        gender_unknown: node.gender === "unknown" ? "1" : "0",
      },
      rels: {
        parents: [...nodeRels.parents],
        spouses: [...nodeRels.spouses],
        children: [...nodeRels.children],
      },
    };
  }) as f3.Data;

  return { data, canonicalIdByRawId, canonicalNodes, nodeById, assertions: normalizedAssertions };
}

function directParentAssertions(model: FamilyChartModel, focusId: string) {
  const canonicalFocus = model.canonicalIdByRawId.get(focusId) ?? focusId;
  const pool = model.assertions.filter((assertion) => assertion.child_id === canonicalFocus);
  const choose = (role: "father" | "mother") => pool
    .filter((assertion) => assertion.role === role)
    .sort((a, b) => edgePriority(a.status) - edgePriority(b.status))[0] ?? null;
  return { father: choose("father"), mother: choose("mother") };
}

function shortRoleLabel(locale: PublicLocale, role: "father" | "mother") {
  if (locale === "zh") return role === "father" ? "父" : "母";
  return role === "father" ? "FATHER" : "MOTHER";
}

function cardPoint(card: HTMLElement) {
  const holder = card.closest<HTMLElement>(".card_cont");
  const transform = holder?.style.transform ?? "";
  const match = transform.match(/translate\((-?\d+(?:\.\d+)?)px,\s*(-?\d+(?:\.\d+)?)px\)/);
  return match ? { x: Number(match[1]), y: Number(match[2]) } : null;
}

function cardOpacity(card: HTMLElement) {
  const holder = card.closest<HTMLElement>(".card_cont");
  const opacity = Number(holder?.style.opacity || "1");
  return Number.isFinite(opacity) ? Math.max(0, Math.min(1, opacity)) : 1;
}

type FamilyPoint = { x: number; y: number };
type FamilyUnit = { key: string; parentIds: string[]; childIds: string[] };

function buildFamilyUnits(familyData: f3.Data) {
  const records = familyData as Array<{ id: string; rels?: { spouses?: string[]; children?: string[] } }>;
  const byId = new Map(records.map((item) => [item.id, item]));
  const pairedParentChild = new Set<string>();
  const seenPairs = new Set<string>();
  const units: FamilyUnit[] = [];

  for (const record of records) {
    for (const spouseId of record.rels?.spouses ?? []) {
      const spouse = byId.get(spouseId);
      if (!spouse) continue;
      const parentIds = [record.id, spouseId].sort();
      const key = `pair:${parentIds.join("|")}`;
      if (seenPairs.has(key)) continue;
      seenPairs.add(key);
      const spouseChildren = new Set(spouse.rels?.children ?? []);
      const childIds = (record.rels?.children ?? []).filter((id) => spouseChildren.has(id));
      childIds.forEach((childId) => {
        pairedParentChild.add(`${record.id}|${childId}`);
        pairedParentChild.add(`${spouseId}|${childId}`);
      });
      units.push({ key, parentIds, childIds });
    }
  }

  for (const record of records) {
    const childIds = (record.rels?.children ?? []).filter((childId) => !pairedParentChild.has(`${record.id}|${childId}`));
    if (childIds.length) units.push({ key: `single:${record.id}`, parentIds: [record.id], childIds });
  }

  return units;
}

function roundedElbowPath(root: FamilyPoint, child: FamilyPoint, radius = 16) {
  const dx = child.x - root.x;
  const dy = child.y - root.y;
  if (Math.abs(dx) < .5) return `M${root.x},${root.y}V${child.y}`;
  const dirX = dx > 0 ? 1 : -1;
  const dirY = dy >= 0 ? 1 : -1;
  const barY = root.y + dy * .5;
  const r = Math.max(4, Math.min(radius, Math.abs(dx) * .28, Math.abs(dy) * .18));
  return [
    `M${root.x},${root.y}`,
    `V${barY - dirY * r}`,
    `Q${root.x},${barY} ${root.x + dirX * r},${barY}`,
    `H${child.x - dirX * r}`,
    `Q${child.x},${barY} ${child.x},${barY + dirY * r}`,
    `V${child.y}`,
  ].join("");
}

function spouseGeometryAlpha(a: FamilyPoint, b: FamilyPoint) {
  const distance = Math.hypot(b.x - a.x, b.y - a.y);
  const verticalDelta = Math.abs(b.y - a.y);
  const distanceAlpha = 1 - Math.max(0, Math.min(1, (distance - 280) / 180));
  const verticalAlpha = 1 - Math.max(0, Math.min(1, (verticalDelta - 20) / 90));
  return Math.min(distanceAlpha, verticalAlpha);
}

function spousePath(a: FamilyPoint, b: FamilyPoint) {
  const midX = (a.x + b.x) / 2;
  return `M${a.x},${a.y}C${midX},${a.y} ${midX},${b.y} ${b.x},${b.y}`;
}

function roundedFamilyPath(root: FamilyPoint, children: FamilyPoint[], radius = 18) {
  if (!children.length) return "";
  const sorted = [...children].sort((a, b) => a.x - b.x);
  if (sorted.length === 1) return roundedElbowPath(root, sorted[0], radius);

  const averageChildY = sorted.reduce((sum, child) => sum + child.y, 0) / sorted.length;
  const dirY = averageChildY >= root.y ? 1 : -1;
  const barY = root.y + (averageChildY - root.y) * .5;
  const left = sorted[0];
  const right = sorted[sorted.length - 1];
  const horizontalSpan = Math.max(1, right.x - left.x);
  const r = Math.max(5, Math.min(radius, Math.abs(averageChildY - root.y) * .18, horizontalSpan * .08));
  const parts = [`M${root.x},${root.y}V${barY}`];

  parts.push(
    `M${left.x},${left.y}`,
    `V${barY + dirY * r}`,
    `Q${left.x},${barY} ${left.x + r},${barY}`,
    `H${right.x - r}`,
    `Q${right.x},${barY} ${right.x},${barY + dirY * r}`,
    `V${right.y}`,
  );

  for (const child of sorted.slice(1, -1)) parts.push(`M${child.x},${barY}V${child.y}`);
  return parts.join("");
}

function decorateFamilyChart(
  host: HTMLDivElement,
  familyUnits: FamilyUnit[],
  parentRoleById: Map<string, { role: "father" | "mother"; status: StructuredRelationStatus }>,
  locale: PublicLocale,
) {
  // Keep Family Chart's native cards, links and relationship transitions intact.
  // The remaining legacy decorator body is intentionally bypassed while the prototype settles on the library's own design.
  void host;
  void familyUnits;
  void parentRoleById;
  void locale;
  return;
  const cards = new Map<string, { card: HTMLElement; point: FamilyPoint; opacity: number }>();
  host.querySelectorAll<HTMLElement>(".card").forEach((card) => {
    const id = card.dataset.id;
    const point = cardPoint(card);
    if (id && point) cards.set(id, { card, point, opacity: cardOpacity(card) });
    const parentRole = id ? parentRoleById.get(id) : null;
    if (parentRole) {
      card.dataset.parentRole = parentRole.role;
      card.dataset.parentLabel = shortRoleLabel(locale, parentRole.role);
      card.dataset.parentStatus = parentRole.status;
    } else {
      delete card.dataset.parentRole;
      delete card.dataset.parentLabel;
      delete card.dataset.parentStatus;
    }
  });

  const linksView = host.querySelector<SVGGElement>("g.links_view");
  if (!linksView) return;
  host.querySelectorAll<SVGPathElement>("path.link").forEach((path) => { path.dataset.linkKind = "native"; });

  let custom = linksView.querySelector<SVGGElement>(".zhipanda-family-links");
  if (!custom) {
    custom = document.createElementNS("http://www.w3.org/2000/svg", "g");
    custom.setAttribute("class", "zhipanda-family-links");
    linksView.appendChild(custom);
  }

  const ensurePath = (key: string, className: string, members: string[]) => {
    let path = custom!.querySelector<SVGPathElement>(`path[data-family-key="${CSS.escape(key)}"]`);
    if (!path) {
      path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.dataset.familyKey = key;
      custom!.appendChild(path);
    }
    if (path.dataset.baseClass !== className) {
      const wasVisible = path.classList.contains("is-visible");
      const wasRelated = path.classList.contains("is-related");
      path.setAttribute("class", className);
      path.dataset.baseClass = className;
      if (wasVisible) path.classList.add("is-visible");
      if (wasRelated) path.classList.add("is-related");
    }
    path.dataset.members = members.join(" ");
    return path;
  };

  const ensureDot = (key: string) => {
    let dot = custom!.querySelector<SVGCircleElement>(`circle[data-family-key="${CSS.escape(key)}"]`);
    if (!dot) {
      dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      dot.dataset.familyKey = key;
      dot.setAttribute("class", "family-union-dot");
      dot.setAttribute("r", "3.2");
      custom!.appendChild(dot);
    }
    return dot;
  };

  const activeKeys = new Set<string>();
  const setAlpha = (element: SVGElement, alpha: number) => {
    const value = Math.max(0, Math.min(1, alpha));
    element.style.setProperty("--family-alpha", value.toFixed(3));
    element.style.setProperty("--family-hover-alpha", (value * .18).toFixed(3));
  };

  for (const unit of familyUnits) {
    const visibleParents = unit.parentIds.map((id) => cards.get(id)).filter((entry): entry is { card: HTMLElement; point: FamilyPoint; opacity: number } => Boolean(entry));
    const visibleChildren = unit.childIds.map((id) => cards.get(id)).filter((entry): entry is { card: HTMLElement; point: FamilyPoint; opacity: number } => Boolean(entry));
    const layoutChildren = visibleChildren.filter((entry) => entry.opacity > .08);
    const members = [...unit.parentIds, ...unit.childIds];

    if (unit.parentIds.length === 2 && visibleParents.length === 2) {
      const [a, b] = visibleParents;
      const union = { x: (a.point.x + b.point.x) / 2, y: (a.point.y + b.point.y) / 2 };
      const parentAlpha = Math.min(a.opacity, b.opacity) * spouseGeometryAlpha(a.point, b.point);
      const spouseKey = `${unit.key}:spouse`;
      const spouseLink = ensurePath(spouseKey, "family-spouse-clean", members);
      spouseLink.setAttribute("d", spousePath(a.point, b.point));
      setAlpha(spouseLink, parentAlpha);
      activeKeys.add(spouseKey);

      const dotKey = `${unit.key}:dot`;
      const dot = ensureDot(dotKey);
      dot.setAttribute("cx", String(union.x));
      dot.setAttribute("cy", String(union.y));
      setAlpha(dot, parentAlpha);
      activeKeys.add(dotKey);

      if (layoutChildren.length) {
        const branchKey = `${unit.key}:branch`;
        const branchPath = ensurePath(branchKey, "family-branch-clean", members);
        branchPath.setAttribute("d", roundedFamilyPath(union, layoutChildren.map((child) => child.point)));
        setAlpha(branchPath, Math.min(parentAlpha, Math.max(...layoutChildren.map((child) => child.opacity))));
        activeKeys.add(branchKey);
      }
      continue;
    }

    if (unit.parentIds.length === 1 && visibleParents.length === 1 && layoutChildren.length) {
      const branchKey = `${unit.key}:branch`;
      const branchPath = ensurePath(branchKey, "family-branch-clean family-branch-single-parent", members);
      branchPath.setAttribute("d", roundedFamilyPath(visibleParents[0].point, layoutChildren.map((child) => child.point)));
      setAlpha(branchPath, Math.min(visibleParents[0].opacity, Math.max(...layoutChildren.map((child) => child.opacity))));
      activeKeys.add(branchKey);
    }
  }

  custom.querySelectorAll<SVGElement>("[data-family-key]").forEach((element) => {
    element.classList.toggle("is-visible", activeKeys.has(element.dataset.familyKey ?? ""));
  });

  cards.forEach(({ card }, id) => {
    card.onpointerenter = () => {
      custom!.querySelectorAll<SVGPathElement>("path.is-visible").forEach((path) => path.classList.toggle("is-related", (path.dataset.members ?? "").split(" ").includes(id)));
      custom!.classList.add("has-hover");
    };
    card.onpointerleave = () => custom!.classList.remove("has-hover");
  });
}

function animateFamilyChartDecoration(
  host: HTMLDivElement,
  familyUnits: FamilyUnit[],
  parentRoleById: Map<string, { role: "father" | "mother"; status: StructuredRelationStatus }>,
  locale: PublicLocale,
  duration = 580,
) {
  void host;
  void familyUnits;
  void parentRoleById;
  void locale;
  void duration;
  return () => {};
  const startedAt = performance.now();
  let frame = 0;
  const tick = (now: number) => {
    decorateFamilyChart(host, familyUnits, parentRoleById, locale);
    if (now - startedAt < duration) frame = window.requestAnimationFrame(tick);
  };
  frame = window.requestAnimationFrame(tick);
  return () => window.cancelAnimationFrame(frame);
}

function FamilyCanvas({ locale, focusId, ancestorDepth, descendantDepth, model, cardStyle, onFocus, onInspect }: {
  locale: PublicLocale;
  focusId: string;
  ancestorDepth: number;
  descendantDepth: number;
  model: FamilyChartModel;
  cardStyle: FamilyCardStyle;
  onFocus: (id: string) => void;
  onInspect: (assertionId: string) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<f3.Chart | null>(null);
  const onFocusRef = useRef(onFocus);
  const lastMainRef = useRef<string | null>(null);
  onFocusRef.current = onFocus;
  const canonicalFocusId = model.canonicalIdByRawId.get(focusId) ?? focusId;
  const parents = useMemo(() => directParentAssertions(model, canonicalFocusId), [canonicalFocusId, model]);
  const familyUnits = useMemo(() => buildFamilyUnits(model.data), [model.data]);
  const parentRoleById = useMemo(() => {
    const result = new Map<string, { role: "father" | "mother"; status: StructuredRelationStatus }>();
    for (const assertion of [...model.assertions].sort((a, b) => edgePriority(a.status) - edgePriority(b.status))) {
      if (!result.has(assertion.parent_id)) result.set(assertion.parent_id, { role: assertion.role, status: assertion.status });
    }
    return result;
  }, [model.assertions]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    host.innerHTML = "";

    const transitionTime = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 480;
    const chart = f3.createChart(host, model.data)
      .setTransitionTime(transitionTime)
      .setOrientationVertical()
      .setCardXSpacing(cardStyle === "circle" ? 190 : 245)
      .setCardYSpacing(cardStyle === "circle" ? 245 : 176)
      .setAncestryDepth(ancestorDepth)
      .setProgenyDepth(descendantDepth)
      .setShowSiblingsOfMain(true)
      .setDuplicateBranchToggle(false)
      .setSingleParentEmptyCard(false);

    chart.updateMainId(canonicalFocusId);
    const card = chart.setCardHtml()
      .setStyle(cardStyle === "circle" ? "imageCircle" : "imageCircleRect")
      .setCardImageField("avatar")
      .setCardDisplay([["name"], ["birthday"]])
      .setOnHoverPathToMain();

    card.setOnCardClick((_event: MouseEvent, datum: any) => {
      const id = datum?.data?.id as string | undefined;
      if (!id) return;
      onFocusRef.current(id);
    });

    chart.updateTree({ initial: true, tree_position: "fit", transition_time: 0 });
    window.requestAnimationFrame(() => decorateFamilyChart(host, familyUnits, parentRoleById, locale));
    lastMainRef.current = canonicalFocusId;
    chartRef.current = chart;

    return () => {
      chartRef.current = null;
      host.innerHTML = "";
    };
  // The family-chart instance owns its D3 lifecycle. Recreate when data or card geometry changes.
  }, [cardStyle, familyUnits, locale, model, parentRoleById]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    chart
      .setAncestryDepth(ancestorDepth)
      .setProgenyDepth(descendantDepth)
      .setShowSiblingsOfMain(true);

    if (lastMainRef.current !== canonicalFocusId) {
      lastMainRef.current = canonicalFocusId;
      chart.updateMainId(canonicalFocusId);
    }
    const transitionTime = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 480;
    chart.updateTree({ tree_position: "main_to_middle", transition_time: transitionTime });
    const host = hostRef.current;
    if (!host) return undefined;
    if (transitionTime === 0) {
      decorateFamilyChart(host, familyUnits, parentRoleById, locale);
      return undefined;
    }
    return animateFamilyChartDecoration(host, familyUnits, parentRoleById, locale, transitionTime + 80);
  }, [ancestorDepth, canonicalFocusId, descendantDepth, familyUnits, locale, parentRoleById]);

  const parentItem = (assertion: PublicParentageAssertionSummary | null, role: "father" | "mother") => {
    const parent = assertion ? model.nodeById.get(assertion.parent_id) ?? null : null;
    return (
      <button
        type="button"
        className={styles.parentFact}
        data-role={role}
        disabled={!assertion}
        onClick={() => assertion && onInspect(assertion.id)}
      >
        <span>{roleLabel(locale, role)}</span>
        <strong>{parent ? localizedNode(parent, locale).name : locale === "zh" ? "暂无公开记录" : "No published record"}</strong>
        <small>{assertion ? statusLabel(locale, assertion.status) : "—"}</small>
      </button>
    );
  };

  return (
    <div className={styles.familyChartWrap}>
      <div ref={hostRef} className={`f3 ${styles.familyChartHost}`} data-card-style={cardStyle} aria-label={locale === "zh" ? "熊猫家族谱系图" : "Panda family chart"} />
      {parents.father || parents.mother ? <div className={styles.parentFacts}>
        <span>{locale === "zh" ? "当前中心的父母证据" : "Focus parent evidence"}</span>
        {parentItem(parents.father, "father")}
        {parentItem(parents.mother, "mother")}
      </div> : null}
      <div className={styles.familyChartHint}>{locale === "zh"
        ? "点击熊猫重新聚焦 · 悬停查看亲缘路径 · 拖动画布 · 滚轮缩放"
        : "Select any panda to re-root · hover to reveal its kinship path · pan and zoom"}</div>
    </div>
  );
}

function ancestorTree(graph: StructuredLineageGraph) {
  const byChild = new Map<string, StructuredLineageGraphEdge[]>();
  graph.edges.forEach((edge) => byChild.set(edge.childId, [...(byChild.get(edge.childId) ?? []), edge]));
  const resultNodes = new Set<string>([graph.focusId]);
  const resultEdges: StructuredLineageGraphEdge[] = [];
  let frontier = [graph.focusId];
  for (let depth = 0; depth < 6 && frontier.length; depth += 1) {
    const next: string[] = [];
    for (const childId of frontier) {
      const edges = byChild.get(childId) ?? [];
      for (const role of ["father", "mother"] as const) {
        const edge = edges.filter((item) => item.role === role).sort((a, b) => edgePriority(a.status) - edgePriority(b.status))[0] ?? null;
        if (!edge) continue;
        resultEdges.push(edge);
        resultNodes.add(edge.parentId);
        next.push(edge.parentId);
      }
    }
    frontier = next;
  }
  return { nodeIds: resultNodes, edges: resultEdges };
}

function ancestorSlots(graph: StructuredLineageGraph) {
  const ancestors = ancestorTree(graph);
  const byChild = new Map<string, StructuredLineageGraphEdge[]>();
  ancestors.edges.forEach((edge) => byChild.set(edge.childId, [...(byChild.get(edge.childId) ?? []), edge]));
  const slots = new Map<string, { depth: number; slot: number; role: "father" | "mother" | null }>();
  slots.set(graph.focusId, { depth: 0, slot: 0, role: null });
  const queue = [graph.focusId];
  while (queue.length) {
    const childId = queue.shift()!;
    const child = slots.get(childId);
    if (!child) continue;
    const edges = byChild.get(childId) ?? [];
    for (const role of ["father", "mother"] as const) {
      const edge = edges.filter((item) => item.role === role).sort((a, b) => edgePriority(a.status) - edgePriority(b.status))[0] ?? null;
      if (!edge || slots.has(edge.parentId)) continue;
      slots.set(edge.parentId, {
        depth: child.depth + 1,
        slot: child.slot * 2 + (role === "mother" ? 1 : 0),
        role,
      });
      queue.push(edge.parentId);
    }
  }
  return { ancestors, slots };
}

function PedigreeView({ locale, graph, onFocus }: { locale: PublicLocale; graph: StructuredLineageGraph; onFocus: (id: string) => void }) {
  const zh = locale === "zh";
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const { ancestors, slots } = ancestorSlots(graph);
  const width = 1240;
  const height = 720;
  const positions = new Map<string, { x: number; y: number }>();
  slots.forEach((slot, id) => {
    const x = 140 + slot.depth * 280;
    const rows = 2 ** slot.depth;
    const y = ((slot.slot + .5) / rows) * height;
    positions.set(id, { x, y });
  });

  return (
    <div className={styles.pedigreeView}>
      <div className={styles.modeExplainer}><strong>{zh ? "谱系" : "Pedigree"}</strong><span>{zh ? "从当前熊猫向上追祖先。父系固定在上，母系固定在下，适合快速读清多代血缘。" : "Trace ancestors from the focus panda. Paternal branches stay above maternal branches for a predictable pedigree."}</span></div>
      <div className={styles.pedigreeCanvas}>
        <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className={styles.pedigreeLines} aria-hidden="true">
          {ancestors.edges.map((edge) => {
            const parent = positions.get(edge.parentId);
            const child = positions.get(edge.childId);
            if (!parent || !child) return null;
            const midX = (parent.x + child.x) / 2;
            return <path key={edge.id} d={`M ${child.x + 58} ${child.y} C ${midX} ${child.y}, ${midX} ${parent.y}, ${parent.x - 58} ${parent.y}`} data-role={edge.role} data-status={edge.status} />;
          })}
        </svg>
        <div className={styles.pedigreeNodes}>
          {[...ancestors.nodeIds].map((id) => {
            const node = nodeById.get(id);
            const point = positions.get(id);
            const slot = slots.get(id);
            if (!node || !point || !slot) return null;
            return (
              <button key={id} type="button" className={styles.pedigreeNode} data-focus={id === graph.focusId ? "true" : undefined} data-role={slot.role ?? undefined} style={{ left: `${point.x / width * 100}%`, top: `${point.y / height * 100}%` }} onClick={() => onFocus(id)}>
                <span><img src={node.coverImageUrl ?? PANDA_PLACEHOLDER} alt="" /></span>
                <strong>{node.name}</strong>
                <small>{slot.role ? roleLabel(locale, slot.role) : zh ? "中心" : "Focus"}{node.birthYear ? ` · ${node.birthYear}` : ""}</small>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function FanView({ locale, graph, onFocus }: { locale: PublicLocale; graph: StructuredLineageGraph; onFocus: (id: string) => void }) {
  const zh = locale === "zh";
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const { ancestors, slots } = ancestorSlots(graph);
  const width = 1100;
  const height = 690;
  const center = { x: width / 2, y: 590 };
  const positions = new Map<string, { x: number; y: number }>();
  slots.forEach((slot, id) => {
    if (slot.depth === 0) {
      positions.set(id, center);
      return;
    }
    const radius = 150 + (slot.depth - 1) * 145;
    const rows = 2 ** slot.depth;
    const ratio = (slot.slot + .5) / rows;
    const angle = (205 + 130 * ratio) * Math.PI / 180;
    positions.set(id, { x: center.x + Math.cos(angle) * radius, y: center.y + Math.sin(angle) * radius });
  });

  return (
    <div className={styles.fanView}>
      <div className={styles.modeExplainer}><strong>{zh ? "扇形" : "Fan"}</strong><span>{zh ? "把祖先按代际围绕当前熊猫展开。越往外代表越高一代，父系与母系保持固定方向。" : "Ancestors radiate outward by generation, keeping paternal and maternal branches spatially consistent."}</span></div>
      <svg viewBox={`0 0 ${width} ${height}`} className={styles.fanLines} aria-hidden="true">
        {ancestors.edges.map((edge) => {
          const parent = positions.get(edge.parentId);
          const child = positions.get(edge.childId);
          if (!parent || !child) return null;
          const midY = (parent.y + child.y) / 2;
          return <path key={edge.id} d={`M ${parent.x} ${parent.y} C ${parent.x} ${midY}, ${child.x} ${midY}, ${child.x} ${child.y}`} data-role={edge.role} data-status={edge.status} />;
        })}
      </svg>
      <div className={styles.fanNodes}>
        {[...ancestors.nodeIds].map((id) => {
          const node = nodeById.get(id);
          const point = positions.get(id);
          if (!node || !point) return null;
          const incoming = ancestors.edges.find((edge) => edge.parentId === id);
          return (
            <button key={id} type="button" className={styles.fanNode} data-focus={id === graph.focusId ? "true" : undefined} style={{ left: `${point.x / width * 100}%`, top: `${point.y / height * 100}%` }} onClick={() => onFocus(id)}>
              <span><img src={node.coverImageUrl ?? PANDA_PLACEHOLDER} alt="" /></span>
              <strong>{node.name}</strong>
              <small>{incoming ? roleLabel(locale, incoming.role) : zh ? "中心" : "Focus"}{node.birthYear ? ` · ${node.birthYear}` : ""}</small>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function relationSummary(locale: PublicLocale, graph: StructuredLineageGraph, node: StructuredLineageGraphNode) {
  const zh = locale === "zh";
  if (node.id === graph.focusId) return zh ? "中心熊猫" : "Focus panda";
  const parentEdge = graph.edges.find((edge) => edge.childId === graph.focusId && edge.parentId === node.id);
  if (parentEdge) return roleLabel(locale, parentEdge.role);
  const childEdge = graph.edges.find((edge) => edge.parentId === graph.focusId && edge.childId === node.id);
  if (childEdge) return zh ? "子女" : "Child";
  if (node.generation < 0) return zh ? `上 ${Math.abs(node.generation)} 代` : `${Math.abs(node.generation)} generations up`;
  if (node.generation > 0) return zh ? `下 ${node.generation} 代` : `${node.generation} generations down`;
  return zh ? "同代亲属" : "Same generation";
}

function ListView({ locale, graph, onFocus }: { locale: PublicLocale; graph: StructuredLineageGraph; onFocus: (id: string) => void }) {
  const zh = locale === "zh";
  const members = [...graph.nodes].sort((a, b) => a.generation - b.generation || Number(a.birthYear ?? 9999) - Number(b.birthYear ?? 9999) || a.name.localeCompare(b.name));
  return (
    <div className={styles.listView}>
      <div className={styles.modeExplainer}><strong>{zh ? "名单" : "List"}</strong><span>{zh ? "不画关系线，快速查看当前范围内的全部成员、代际和档案。" : "A line-free roster for quickly scanning every member in the current lineage scope."}</span></div>
      <div className={styles.lineageList}>
        {members.map((node) => (
          <button key={node.id} type="button" className={styles.lineageListRow} data-focus={node.id === graph.focusId ? "true" : undefined} onClick={() => onFocus(node.id)}>
            <img src={node.coverImageUrl ?? PANDA_PLACEHOLDER} alt="" />
            <span><strong>{node.name}</strong><small>{node.alternateName ?? ""}</small></span>
            <span className={styles.listRelation}>{relationSummary(locale, graph, node)}</span>
            <span className={styles.listYear}>{node.birthYear ?? "—"}</span>
            <ArrowRight aria-hidden="true" />
          </button>
        ))}
      </div>
    </div>
  );
}

function updateUrl(locale: PublicLocale, state: LineageQueryState) {
  const params = new URLSearchParams({ focus: state.focusSlug });
  if (state.ancestorDepth !== 2) params.set("ancestors", String(state.ancestorDepth));
  if (state.descendantDepth !== 2) params.set("descendants", String(state.descendantDepth));
  window.history.replaceState({}, "", `/${locale}/prototype/fan-v07/lineage?${params}`);
}

export function LineageUniverse({ locale, initialState, nodes, assertions, sources }: Props) {
  const zh = locale === "zh";
  const [state, setState] = useState(initialState);
  const [mode, setMode] = useState<ViewMode>("tree");
  const [familyCardStyle, setFamilyCardStyle] = useState<FamilyCardStyle>("circle");
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [selectedAssertionId, setSelectedAssertionId] = useState<string | null>(null);
  const view = useMemo(() => buildStructuredLineageViewModel(nodes, assertions, sources, state, locale), [assertions, locale, nodes, sources, state]);
  const familyModel = useMemo(() => buildFamilyChartModel(nodes, assertions, locale), [assertions, locale, nodes]);
  const localNodeById = useMemo(() => new Map(familyModel.canonicalNodes.map((node) => [node.id, localizedNode(node, locale)])), [familyModel.canonicalNodes, locale]);
  const assertionById = useMemo(() => new Map(familyModel.assertions.map((assertion) => [assertion.id, assertion])), [familyModel.assertions]);
  const sourceById = useMemo(() => new Map(sources.map((source) => [source.id, source])), [sources]);

  const focusNode = (id: string) => {
    const canonicalId = familyModel.canonicalIdByRawId.get(id) ?? id;
    const target = familyModel.nodeById.get(canonicalId) ?? nodes.find((node) => node.id === id);
    if (!target) return;
    setSelectedAssertionId(null);
    setState((current) => ({ ...current, focusId: target.id, focusSlug: target.slug, relation: "" }));
  };

  useEffect(() => updateUrl(locale, state), [locale, state]);

  const suggestions = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    const pool = familyModel.canonicalNodes.map((node) => localizedNode(node, locale));
    const filtered = term
      ? pool.filter((node) => `${node.name} ${node.alternateName ?? ""} ${node.slug}`.toLocaleLowerCase().includes(term))
      : pool;
    return filtered.slice(0, 8);
  }, [familyModel.canonicalNodes, locale, query]);

  const selectedAssertion = selectedAssertionId ? assertionById.get(selectedAssertionId) ?? null : null;
  const selectedParent = selectedAssertion ? localNodeById.get(selectedAssertion.parent_id) ?? null : null;
  const selectedChild = selectedAssertion ? localNodeById.get(selectedAssertion.child_id) ?? null : null;
  const selectedSources = selectedAssertion?.source_ids.map((id) => sourceById.get(id)).filter((source): source is PublicSourceSummary => Boolean(source)) ?? [];

  const changeDepth = (key: "ancestorDepth" | "descendantDepth", delta: number) => {
    setState((current) => ({ ...current, [key]: Math.min(4, Math.max(1, current[key] + delta)), relation: "" }));
  };

  return (
    <main className={styles.page}>
      <section className={styles.stage}>
        <div className={styles.lineageToolbar}>
          <div className={styles.focusIdentity}>
            <div className={styles.focusPhoto}><img src={view.focus.coverImageUrl ?? PANDA_PLACEHOLDER} alt="" /></div>
            <div><small>PANDA LINEAGE</small><h1>{view.focus.name}</h1><p>{view.focus.alternateName ?? ""}{view.focus.birthYear ? ` · ${view.focus.birthYear}` : ""}</p></div>
            {view.focus.profileAvailable ? <Link href={`/${locale}/prototype/fan-v07/panda/${view.focus.slug}` as Route}>{zh ? "档案" : "Profile"}<ArrowRight aria-hidden="true" /></Link> : null}
          </div>

          <div className={styles.toolbarActions}>
            <div className={styles.modeSwitch}>
              <button type="button" aria-pressed={mode === "tree"} onClick={() => setMode("tree")} title="Tree">{zh ? "家族树" : "Tree"}</button>
              <button type="button" aria-pressed={mode === "pedigree"} onClick={() => setMode("pedigree")} title="Pedigree">{zh ? "谱系" : "Pedigree"}</button>
              <button type="button" aria-pressed={mode === "fan"} onClick={() => setMode("fan")} title="Fan">{zh ? "扇形" : "Fan"}</button>
              <button type="button" aria-pressed={mode === "list"} onClick={() => setMode("list")} title="List">{zh ? "名单" : "List"}</button>
            </div>

            {mode === "tree" ? <div className={styles.familyCardStyleSwitch}>
              <button type="button" aria-pressed={familyCardStyle === "circle"} onClick={() => setFamilyCardStyle("circle")}>{zh ? "圆形" : "Circle"}</button>
              <button type="button" aria-pressed={familyCardStyle === "rect"} onClick={() => setFamilyCardStyle("rect")}>{zh ? "矩形" : "Card"}</button>
            </div> : null}

            <div className={styles.depthControl}>
              <div><button type="button" onClick={() => changeDepth("ancestorDepth", -1)} disabled={state.ancestorDepth <= 1}><Minus /></button><span>{zh ? "祖" : "Up"} {state.ancestorDepth}</span><button type="button" onClick={() => changeDepth("ancestorDepth", 1)} disabled={state.ancestorDepth >= 4}><Plus /></button></div>
              <div><button type="button" onClick={() => changeDepth("descendantDepth", -1)} disabled={state.descendantDepth <= 1}><Minus /></button><span>{zh ? "后" : "Down"} {state.descendantDepth}</span><button type="button" onClick={() => changeDepth("descendantDepth", 1)} disabled={state.descendantDepth >= 4}><Plus /></button></div>
            </div>

            <div className={styles.searchBox} data-open={searchOpen ? "true" : undefined}>
              <Search aria-hidden="true" />
              <input value={query} onChange={(event) => { setQuery(event.target.value); setSearchOpen(true); }} onFocus={() => setSearchOpen(true)} placeholder={zh ? "切换中心熊猫" : "Change focus panda"} />
              {query ? <button type="button" onClick={() => setQuery("")}><X aria-hidden="true" /></button> : null}
              {searchOpen ? <div className={styles.searchResults}>{suggestions.map((node) => <button type="button" key={node.id} onClick={() => { focusNode(node.id); setQuery(""); setSearchOpen(false); }}><img src={node.imageUrl ?? PANDA_PLACEHOLDER} alt="" /><strong>{node.name}</strong><small>{node.alternateName ?? node.birthYear ?? ""}</small></button>)}</div> : null}
            </div>
          </div>
        </div>

        <div className={styles.modeBody}>
          {mode === "tree" ? <FamilyCanvas locale={locale} focusId={state.focusId} ancestorDepth={state.ancestorDepth} descendantDepth={state.descendantDepth} model={familyModel} cardStyle={familyCardStyle} onFocus={focusNode} onInspect={setSelectedAssertionId} /> : null}
          {mode === "pedigree" ? <PedigreeView locale={locale} graph={view.graph} onFocus={focusNode} /> : null}
          {mode === "fan" ? <FanView locale={locale} graph={view.graph} onFocus={focusNode} /> : null}
          {mode === "list" ? <ListView locale={locale} graph={view.graph} onFocus={focusNode} /> : null}
        </div>
      </section>

      {selectedAssertion ? (
        <aside className={styles.evidenceDrawer}>
          <div className={styles.drawerHead}><div><small>RELATIONSHIP EVIDENCE</small><h2>{selectedParent?.name ?? "—"}<span>→</span>{selectedChild?.name ?? "—"}</h2></div><button type="button" onClick={() => setSelectedAssertionId(null)}><X /></button></div>
          <div className={styles.drawerBadges}><span data-role={selectedAssertion.role}>{roleLabel(locale, selectedAssertion.role)}</span><span data-status={selectedAssertion.status}>{statusLabel(locale, selectedAssertion.status)}</span></div>
          <p>{zh ? "家族图使用 Family Chart 的亲属语义布局；父亲和母亲的证据仍直接来自公开亲本断言，不根据旧 father_id / mother_id 猜测。" : "The family view uses Family Chart's kinship-aware layout while parent evidence still comes directly from published parentage assertions."}</p>
          <div className={styles.sourceList}><strong><ShieldCheck />{zh ? "公开来源" : "Published sources"}</strong>{selectedSources.length ? selectedSources.map((source) => <article key={source.id}><div><strong>{source.publisher}</strong><span>{source.title}</span><small>{source.last_verified_at ? `${zh ? "最后核实" : "Verified"} ${source.last_verified_at}` : source.access_state}</small></div>{source.url ? <a href={source.url} target="_blank" rel="noreferrer"><ExternalLink /></a> : null}</article>) : <p>{zh ? "暂无可访问来源链接。" : "No accessible public source link."}</p>}</div>
        </aside>
      ) : null}
    </main>
  );
}
