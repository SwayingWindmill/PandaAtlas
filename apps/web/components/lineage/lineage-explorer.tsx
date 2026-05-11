"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  Crosshair,
  GitCompareArrows,
  Minus,
  Plus,
  Radar,
  TreePine,
  X
} from "lucide-react";
import { LINEAGE_COPY } from "@/components/lineage/lineage-copy";
import { cn } from "@/lib/utils";
import { DEFAULT_LINEAGE_FOCUS_ID, LINEAGE_PANDAS, type LineagePanda } from "@/lib/lineage-data";
import type { PandaLineageResponse } from "@/lib/types";

type ViewMode = "tree" | "radial";
type NodeType = "panda" | "bubble";

interface PandaGraph {
  byId: Map<string, LineagePanda>;
  parentsByChild: Map<string, string[]>;
  childrenByParent: Map<string, string[]>;
}

interface PositionedNode {
  key: string;
  type: NodeType;
  pandaId: string | null;
  level: number;
  x: number;
  y: number;
  parentId?: string;
  hiddenIds?: string[];
}

interface PositionedEdge {
  key: string;
  fromKey: string;
  toKey: string;
  fromPandaId: string | null;
  toPandaId: string | null;
  kind: "lineage" | "cluster";
}

interface TreeLayoutResult {
  nodes: PositionedNode[];
  edges: PositionedEdge[];
  relativeLevelById: Map<string, number>;
  maxAncestorDepth: number;
  maxDescendantDepth: number;
}

const WORLD_WIDTH = 5600;
const WORLD_HEIGHT = 4200;
const WORLD_ORIGIN_X = WORLD_WIDTH / 2;
const WORLD_ORIGIN_Y = WORLD_HEIGHT / 2;

const H_SPACING = 230;
const V_SPACING = 250;
const FAN_RADIUS = 220;
const AGGREGATION_LIMIT = 5;

const DEFAULT_ANCESTOR_DEPTH = 2;
const DEFAULT_DESCENDANT_DEPTH = 2;

const MIN_SCALE = 0.45;
const MAX_SCALE = 2.4;

interface LineageExplorerProps {
  initialLineage?: PandaLineageResponse | null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function toPairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function sortPandas(a: LineagePanda, b: LineagePanda): number {
  const dateA = a.birth_date ?? "";
  const dateB = b.birth_date ?? "";
  const dateCompare = dateA.localeCompare(dateB);
  if (dateCompare !== 0) {
    return dateCompare;
  }
  return a.name_zh.localeCompare(b.name_zh);
}

function formatDate(value: string | null): string {
  if (!value) {
    return LINEAGE_COPY.fallback.unknown;
  }
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function formatGender(value: LineagePanda["gender"]): string {
  if (value === "male") {
    return "雄性";
  }
  if (value === "female") {
    return "雌性";
  }
  return LINEAGE_COPY.fallback.unknown;
}

function formatText(value: string | null): string {
  const normalized = value?.trim();
  return normalized || LINEAGE_COPY.fallback.unknown;
}

function formatChildrenCount(count: number): string {
  return count > 0 ? `${count} 只` : LINEAGE_COPY.fallback.noPublicRecord;
}

function formatCompareHint(count: number): string {
  if (count === 0) {
    return LINEAGE_COPY.compareHints[0];
  }
  if (count === 1) {
    return LINEAGE_COPY.compareHints[1];
  }
  return LINEAGE_COPY.compareHints[2];
}

function getBubbleNames(hiddenIds: string[], graph: PandaGraph): string[] {
  return hiddenIds.map((id) => graph.byId.get(id)?.name_zh ?? id);
}

function buildBubbleAriaLabel(hiddenIds: string[], graph: PandaGraph, expanded: boolean): string {
  const names = getBubbleNames(hiddenIds, graph);
  const action = expanded ? "收起隐藏个体" : "展开隐藏个体";

  if (names.length === 0) {
    return `${action}，共 ${hiddenIds.length} 只`;
  }

  return `${action}，共 ${names.length} 只：${names.join("、")}`;
}

function buildGraph(items: LineagePanda[]): PandaGraph {
  const byId = new Map<string, LineagePanda>();
  const parentsByChild = new Map<string, string[]>();
  const childrenByParent = new Map<string, string[]>();

  for (const item of items) {
    byId.set(item.id, item);
  }

  for (const item of items) {
    const parents = [item.father_id, item.mother_id].filter((value): value is string => Boolean(value));
    parentsByChild.set(item.id, parents);
    for (const parentId of parents) {
      const bucket = childrenByParent.get(parentId) ?? [];
      bucket.push(item.id);
      childrenByParent.set(parentId, bucket);
    }
  }

  for (const [parentId, childIds] of childrenByParent.entries()) {
    const sorted = childIds
      .map((childId) => byId.get(childId))
      .filter((value): value is LineagePanda => Boolean(value))
      .sort(sortPandas)
      .map((item) => item.id);
    childrenByParent.set(parentId, sorted);
  }

  return { byId, parentsByChild, childrenByParent };
}

function getAncestorDistanceMap(rootId: string, graph: PandaGraph): Map<string, number> {
  const distance = new Map<string, number>([[rootId, 0]]);
  const queue: string[] = [rootId];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      continue;
    }
    const currentDistance = distance.get(current) ?? 0;
    const parents = graph.parentsByChild.get(current) ?? [];
    for (const parentId of parents) {
      if (!distance.has(parentId)) {
        distance.set(parentId, currentDistance + 1);
        queue.push(parentId);
      }
    }
  }

  return distance;
}

function getDescendantDistanceMap(rootId: string, graph: PandaGraph): Map<string, number> {
  const distance = new Map<string, number>([[rootId, 0]]);
  const queue: string[] = [rootId];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      continue;
    }
    const currentDistance = distance.get(current) ?? 0;
    const children = graph.childrenByParent.get(current) ?? [];
    for (const childId of children) {
      if (!distance.has(childId)) {
        distance.set(childId, currentDistance + 1);
        queue.push(childId);
      }
    }
  }

  return distance;
}

function getAncestorMap(nodeId: string, graph: PandaGraph): Map<string, number> {
  const distance = new Map<string, number>();
  const queue: Array<{ id: string; depth: number }> = [{ id: nodeId, depth: 0 }];
  const visited = new Set<string>([nodeId]);

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      continue;
    }
    const parents = graph.parentsByChild.get(current.id) ?? [];
    for (const parentId of parents) {
      if (visited.has(parentId)) {
        continue;
      }
      const depth = current.depth + 1;
      visited.add(parentId);
      distance.set(parentId, depth);
      queue.push({ id: parentId, depth });
    }
  }

  return distance;
}

function getUndirectedNeighbors(nodeId: string, graph: PandaGraph): string[] {
  const parents = graph.parentsByChild.get(nodeId) ?? [];
  const children = graph.childrenByParent.get(nodeId) ?? [];
  return [...parents, ...children];
}

function getShortestPath(fromId: string, toId: string, graph: PandaGraph): string[] {
  if (fromId === toId) {
    return [fromId];
  }

  const queue: string[] = [fromId];
  const previous = new Map<string, string | null>([[fromId, null]]);

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      continue;
    }
    const neighbors = getUndirectedNeighbors(current, graph);
    for (const neighbor of neighbors) {
      if (previous.has(neighbor)) {
        continue;
      }
      previous.set(neighbor, current);
      if (neighbor === toId) {
        const path: string[] = [];
        let cursor: string | null = toId;
        while (cursor) {
          path.unshift(cursor);
          cursor = previous.get(cursor) ?? null;
        }
        return path;
      }
      queue.push(neighbor);
    }
  }

  return [];
}

function getNearestCommonAncestors(aId: string, bId: string, graph: PandaGraph): string[] {
  const aMap = getAncestorMap(aId, graph);
  const bMap = getAncestorMap(bId, graph);
  const candidates: Array<{ id: string; score: number }> = [];

  for (const [ancestorId, aDepth] of aMap.entries()) {
    const bDepth = bMap.get(ancestorId);
    if (typeof bDepth === "number") {
      candidates.push({ id: ancestorId, score: aDepth + bDepth });
    }
  }

  if (candidates.length === 0) {
    return [];
  }

  const minScore = Math.min(...candidates.map((item) => item.score));
  return candidates
    .filter((item) => item.score === minScore)
    .map((item) => item.id)
    .sort((left, right) => left.localeCompare(right));
}

function getComponentIds(seedId: string, graph: PandaGraph): string[] {
  const queue = [seedId];
  const visited = new Set<string>([seedId]);

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      continue;
    }
    for (const neighbor of getUndirectedNeighbors(current, graph)) {
      if (visited.has(neighbor)) {
        continue;
      }
      visited.add(neighbor);
      queue.push(neighbor);
    }
  }

  return [...visited];
}

function getFounderId(seedId: string, graph: PandaGraph): string {
  const componentIds = getComponentIds(seedId, graph);
  const founders = componentIds
    .map((id) => graph.byId.get(id))
    .filter((value): value is LineagePanda => Boolean(value))
    .filter((item) => {
      const parents = graph.parentsByChild.get(item.id) ?? [];
      return parents.length === 0;
    })
    .sort(sortPandas);

  return founders[0]?.id ?? seedId;
}

function buildTreeLayout(
  graph: PandaGraph,
  focusId: string,
  ancestorDepth: number,
  descendantDepth: number,
  expandedClusters: Set<string>
): TreeLayoutResult {
  const ancestorDistance = getAncestorDistanceMap(focusId, graph);
  const descendantDistance = getDescendantDistanceMap(focusId, graph);

  const maxAncestorDepth = Math.max(...ancestorDistance.values());
  const maxDescendantDepth = Math.max(...descendantDistance.values());
  const relativeLevelById = new Map<string, number>();

  for (const [id, depth] of ancestorDistance.entries()) {
    if (id === focusId) {
      relativeLevelById.set(id, 0);
      continue;
    }
    relativeLevelById.set(id, -depth);
  }

  for (const [id, depth] of descendantDistance.entries()) {
    if (id === focusId) {
      relativeLevelById.set(id, 0);
      continue;
    }
    if (!relativeLevelById.has(id)) {
      relativeLevelById.set(id, depth);
    }
  }

  const visibleIds = new Set<string>();
  for (const id of relativeLevelById.keys()) {
    const ancestor = ancestorDistance.get(id);
    const descendant = descendantDistance.get(id);
    if (id === focusId) {
      visibleIds.add(id);
      continue;
    }
    if (typeof ancestor === "number" && ancestor <= ancestorDepth) {
      visibleIds.add(id);
      continue;
    }
    if (typeof descendant === "number" && descendant <= descendantDepth) {
      visibleIds.add(id);
      continue;
    }
  }

  const levelIds = new Map<number, string[]>();
  for (const id of visibleIds) {
    const level = relativeLevelById.get(id) ?? 0;
    const bucket = levelIds.get(level) ?? [];
    bucket.push(id);
    levelIds.set(level, bucket);
  }

  for (const [level, ids] of levelIds.entries()) {
    const sorted = ids
      .map((id) => graph.byId.get(id))
      .filter((value): value is LineagePanda => Boolean(value))
      .sort(sortPandas)
      .map((item) => item.id);
    levelIds.set(level, sorted);
  }

  const assignedParentByChild = new Map<string, string>();
  for (const id of visibleIds) {
    const level = relativeLevelById.get(id) ?? 0;
    if (level <= 0) {
      continue;
    }
    const possibleParents = (graph.parentsByChild.get(id) ?? [])
      .filter((parentId) => visibleIds.has(parentId))
      .filter((parentId) => (relativeLevelById.get(parentId) ?? 0) === level - 1)
      .sort((left, right) => {
        const leftItem = graph.byId.get(left);
        const rightItem = graph.byId.get(right);
        if (!leftItem || !rightItem) {
          return left.localeCompare(right);
        }
        return sortPandas(leftItem, rightItem);
      });

    const chosenParent = possibleParents[0];
    if (chosenParent) {
      assignedParentByChild.set(id, chosenParent);
    }
  }

  const positionedNodes: PositionedNode[] = [];
  const levels = [...levelIds.keys()].sort((a, b) => a - b);

  for (const level of levels) {
    const ids = levelIds.get(level) ?? [];
    const rowNodes: PositionedNode[] = [];

    if (level <= 0) {
      for (const id of ids) {
        rowNodes.push({
          key: `p:${id}`,
          type: "panda",
          pandaId: id,
          level,
          x: 0,
          y: 0
        });
      }
    } else {
      const parentIds = (levelIds.get(level - 1) ?? []).filter((parentId) => visibleIds.has(parentId));
      const added = new Set<string>();

      for (const parentId of parentIds) {
        const parentChildren = ids.filter((childId) => assignedParentByChild.get(childId) === parentId);
        if (parentChildren.length === 0) {
          continue;
        }

        if (parentChildren.length > AGGREGATION_LIMIT) {
          const visibleChildren = parentChildren.slice(0, AGGREGATION_LIMIT - 1);
          const hiddenChildren = parentChildren.slice(AGGREGATION_LIMIT - 1);
          for (const childId of visibleChildren) {
            rowNodes.push({
              key: `p:${childId}`,
              type: "panda",
              pandaId: childId,
              level,
              x: 0,
              y: 0,
              parentId
            });
            added.add(childId);
          }

          const clusterKey = `cluster:${parentId}:${level}`;
          rowNodes.push({
            key: clusterKey,
            type: "bubble",
            pandaId: null,
            level,
            x: 0,
            y: 0,
            parentId,
            hiddenIds: hiddenChildren
          });

          if (expandedClusters.has(clusterKey)) {
            const spread = hiddenChildren.length > 1 ? 110 / (hiddenChildren.length - 1) : 0;
            for (let index = 0; index < hiddenChildren.length; index += 1) {
              const childId = hiddenChildren[index];
              const angle = 35 + spread * index;
              const radians = (angle / 180) * Math.PI;
              rowNodes.push({
                key: `fan:${clusterKey}:${childId}`,
                type: "panda",
                pandaId: childId,
                level: level + 0.35,
                x: Math.cos(radians) * FAN_RADIUS,
                y: Math.sin(radians) * FAN_RADIUS,
                parentId
              });
              added.add(childId);
            }
          }
          continue;
        }

        for (const childId of parentChildren) {
          rowNodes.push({
            key: `p:${childId}`,
            type: "panda",
            pandaId: childId,
            level,
            x: 0,
            y: 0,
            parentId
          });
          added.add(childId);
        }
      }

      const unassigned = ids.filter((id) => !added.has(id));
      for (const id of unassigned) {
        rowNodes.push({
          key: `p:${id}`,
          type: "panda",
          pandaId: id,
          level,
          x: 0,
          y: 0
        });
      }
    }

    const baseNodes = rowNodes.filter((node) => Number.isInteger(node.level));
    for (let index = 0; index < baseNodes.length; index += 1) {
      const node = baseNodes[index];
      const x = (index - (baseNodes.length - 1) / 2) * H_SPACING;
      const y = level * V_SPACING;
      node.x = x;
      node.y = y;
    }

    const bubbleByParent = new Map<string, PositionedNode>();
    for (const node of rowNodes) {
      if (node.type === "bubble" && node.parentId) {
        bubbleByParent.set(node.parentId, node);
      }
    }

    for (const node of rowNodes) {
      if (Number.isInteger(node.level)) {
        continue;
      }
      if (!node.parentId) {
        continue;
      }
      const bubbleNode = bubbleByParent.get(node.parentId);
      if (!bubbleNode) {
        continue;
      }
      node.x += bubbleNode.x;
      node.y += bubbleNode.y;
    }

    positionedNodes.push(...rowNodes);
  }

  const keyByPandaId = new Map<string, string>();
  for (const node of positionedNodes) {
    if (node.type !== "panda" || !node.pandaId) {
      continue;
    }
    keyByPandaId.set(node.pandaId, node.key);
  }

  const edges: PositionedEdge[] = [];
  const edgeKeys = new Set<string>();

  for (const node of positionedNodes) {
    if (node.type === "bubble" && node.parentId) {
      const fromKey = keyByPandaId.get(node.parentId);
      if (fromKey) {
        const edgeKey = `cluster:${fromKey}->${node.key}`;
        if (!edgeKeys.has(edgeKey)) {
          edgeKeys.add(edgeKey);
          edges.push({
            key: edgeKey,
            fromKey,
            toKey: node.key,
            fromPandaId: node.parentId,
            toPandaId: null,
            kind: "cluster"
          });
        }
      }
      continue;
    }

    if (!node.pandaId) {
      continue;
    }

    const level = relativeLevelById.get(node.pandaId) ?? 0;
    const parents = graph.parentsByChild.get(node.pandaId) ?? [];

    if (level > 0) {
      const assignedParent = assignedParentByChild.get(node.pandaId);
      if (!assignedParent) {
        continue;
      }
      const fromKey = keyByPandaId.get(assignedParent);
      if (!fromKey) {
        continue;
      }
      const edgeKey = `lineage:${assignedParent}->${node.pandaId}`;
      if (edgeKeys.has(edgeKey)) {
        continue;
      }
      edgeKeys.add(edgeKey);
      edges.push({
        key: edgeKey,
        fromKey,
        toKey: node.key,
        fromPandaId: assignedParent,
        toPandaId: node.pandaId,
        kind: "lineage"
      });
      continue;
    }

    for (const parentId of parents) {
      if (!keyByPandaId.has(parentId)) {
        continue;
      }
      const fromKey = keyByPandaId.get(parentId);
      if (!fromKey) {
        continue;
      }
      const edgeKey = `lineage:${parentId}->${node.pandaId}`;
      if (edgeKeys.has(edgeKey)) {
        continue;
      }
      edgeKeys.add(edgeKey);
      edges.push({
        key: edgeKey,
        fromKey,
        toKey: node.key,
        fromPandaId: parentId,
        toPandaId: node.pandaId,
        kind: "lineage"
      });
    }
  }

  return {
    nodes: positionedNodes,
    edges,
    relativeLevelById,
    maxAncestorDepth,
    maxDescendantDepth
  };
}

function buildRadialLayout(graph: PandaGraph, focusId: string): TreeLayoutResult {
  const founderId = getFounderId(focusId, graph);
  const depthById = new Map<string, number>([[founderId, 0]]);
  const queue = [founderId];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      continue;
    }
    const currentDepth = depthById.get(current) ?? 0;
    const children = graph.childrenByParent.get(current) ?? [];
    for (const childId of children) {
      if (!depthById.has(childId)) {
        depthById.set(childId, currentDepth + 1);
        queue.push(childId);
      }
    }
  }

  const componentIds = getComponentIds(focusId, graph);
  for (const id of componentIds) {
    if (!depthById.has(id)) {
      depthById.set(id, 0);
    }
  }

  const layerIds = new Map<number, string[]>();
  for (const [id, depth] of depthById.entries()) {
    const bucket = layerIds.get(depth) ?? [];
    bucket.push(id);
    layerIds.set(depth, bucket);
  }

  for (const [depth, ids] of layerIds.entries()) {
    const sorted = ids
      .map((id) => graph.byId.get(id))
      .filter((value): value is LineagePanda => Boolean(value))
      .sort(sortPandas)
      .map((item) => item.id);
    layerIds.set(depth, sorted);
  }

  const nodes: PositionedNode[] = [];
  for (const [depth, ids] of [...layerIds.entries()].sort((a, b) => a[0] - b[0])) {
    if (depth === 0) {
      for (const id of ids) {
        nodes.push({
          key: `p:${id}`,
          type: "panda",
          pandaId: id,
          level: 0,
          x: 0,
          y: 0
        });
      }
      continue;
    }

    const radius = 210 + depth * 210;
    for (let index = 0; index < ids.length; index += 1) {
      const angle = -Math.PI / 2 + (index / Math.max(ids.length, 1)) * Math.PI * 2;
      nodes.push({
        key: `p:${ids[index]}`,
        type: "panda",
        pandaId: ids[index],
        level: depth,
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius
      });
    }
  }

  const keyById = new Map<string, string>();
  for (const node of nodes) {
    if (node.pandaId) {
      keyById.set(node.pandaId, node.key);
    }
  }

  const edges: PositionedEdge[] = [];
  const seen = new Set<string>();
  for (const node of nodes) {
    if (!node.pandaId) {
      continue;
    }
    const parents = graph.parentsByChild.get(node.pandaId) ?? [];
    for (const parentId of parents) {
      const fromKey = keyById.get(parentId);
      if (!fromKey) {
        continue;
      }
      const edgeKey = `lineage:${parentId}->${node.pandaId}`;
      if (seen.has(edgeKey)) {
        continue;
      }
      seen.add(edgeKey);
      edges.push({
        key: edgeKey,
        fromKey,
        toKey: node.key,
        fromPandaId: parentId,
        toPandaId: node.pandaId,
        kind: "lineage"
      });
    }
  }

  const maxDepth = Math.max(...depthById.values());

  return {
    nodes,
    edges,
    relativeLevelById: depthById,
    maxAncestorDepth: 0,
    maxDescendantDepth: maxDepth
  };
}

function buildEdgePath(from: PositionedNode, to: PositionedNode, viewMode: ViewMode): string {
  const x1 = WORLD_ORIGIN_X + from.x;
  const y1 = WORLD_ORIGIN_Y + from.y;
  const x2 = WORLD_ORIGIN_X + to.x;
  const y2 = WORLD_ORIGIN_Y + to.y;

  if (viewMode === "tree") {
    const centerY = (y1 + y2) / 2;
    return `M ${x1} ${y1} C ${x1} ${centerY}, ${x2} ${centerY}, ${x2} ${y2}`;
  }

  const dx = x2 - x1;
  const dy = y2 - y1;
  const perpendicularX = -dy;
  const perpendicularY = dx;
  const length = Math.hypot(perpendicularX, perpendicularY) || 1;
  const bend = 35;
  const c1x = x1 + dx * 0.35 + (perpendicularX / length) * bend;
  const c1y = y1 + dy * 0.35 + (perpendicularY / length) * bend;
  const c2x = x1 + dx * 0.65 + (perpendicularX / length) * bend;
  const c2y = y1 + dy * 0.65 + (perpendicularY / length) * bend;
  return `M ${x1} ${y1} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${x2} ${y2}`;
}

function toExplorerPandas(lineage: PandaLineageResponse | null | undefined): LineagePanda[] {
  if (!lineage || lineage.nodes.length === 0) {
    return LINEAGE_PANDAS;
  }
  return lineage.nodes.map((node) => ({
    id: node.id,
    slug: node.slug,
    name_zh: node.name_zh,
    name_en: node.name_en ?? node.name_zh,
    gender: node.gender,
    birth_date: node.birth_date,
    current_location: node.current_location,
    avatar_url: node.cover_image_url,
    intro: node.intro ?? "No biography yet.",
    highlights: node.tags,
    father_id: node.father_id,
    mother_id: node.mother_id
  }));
}

export function LineageExplorer({ initialLineage = null }: LineageExplorerProps) {
  const sourcePandas = useMemo(() => toExplorerPandas(initialLineage), [initialLineage]);
  const graph = useMemo(() => buildGraph(sourcePandas), [sourcePandas]);
  const focusId = graph.byId.has(initialLineage?.focus_id ?? "")
    ? (initialLineage?.focus_id ?? "")
    : graph.byId.has(DEFAULT_LINEAGE_FOCUS_ID)
      ? DEFAULT_LINEAGE_FOCUS_ID
      : sourcePandas[0]?.id ?? "";

  const [viewMode, setViewMode] = useState<ViewMode>("tree");
  const [ancestorDepth, setAncestorDepth] = useState(DEFAULT_ANCESTOR_DEPTH);
  const [descendantDepth, setDescendantDepth] = useState(DEFAULT_DESCENDANT_DEPTH);
  const [expandedClusters, setExpandedClusters] = useState<Set<string>>(new Set());
  const [selectedPandaId, setSelectedPandaId] = useState<string | null>(focusId || null);
  const [compareMode, setCompareMode] = useState(false);
  const [compareSelection, setCompareSelection] = useState<string[]>([]);
  const [viewport, setViewport] = useState({ x: 0, y: 0, scale: 1 });

  const stageRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);
  const hasDraggedRef = useRef(false);
  const hasCenteredRef = useRef(false);

  const founderId = useMemo(() => getFounderId(focusId, graph), [focusId, graph]);

  const layout = useMemo(() => {
    if (!focusId) {
      return {
        nodes: [] as PositionedNode[],
        edges: [] as PositionedEdge[],
        relativeLevelById: new Map<string, number>(),
        maxAncestorDepth: 0,
        maxDescendantDepth: 0
      };
    }
    if (viewMode === "radial") {
      return buildRadialLayout(graph, focusId);
    }
    return buildTreeLayout(graph, focusId, ancestorDepth, descendantDepth, expandedClusters);
  }, [ancestorDepth, descendantDepth, expandedClusters, focusId, graph, viewMode]);

  const nodesByKey = useMemo(() => {
    const map = new Map<string, PositionedNode>();
    for (const node of layout.nodes) {
      map.set(node.key, node);
    }
    return map;
  }, [layout.nodes]);

  const pandaByRenderKey = useMemo(() => {
    const map = new Map<string, LineagePanda>();
    for (const node of layout.nodes) {
      if (!node.pandaId) {
        continue;
      }
      const panda = graph.byId.get(node.pandaId);
      if (panda) {
        map.set(node.key, panda);
      }
    }
    return map;
  }, [graph.byId, layout.nodes]);

  const highlighted = useMemo(() => {
    if (!compareMode || compareSelection.length !== 2) {
      return {
        nodeIds: new Set<string>(),
        edgePairs: new Set<string>(),
        commonAncestorIds: new Set<string>()
      };
    }

    const [firstId, secondId] = compareSelection;
    const path = getShortestPath(firstId, secondId, graph);
    const nodeIds = new Set(path);
    const edgePairs = new Set<string>();
    for (let index = 0; index < path.length - 1; index += 1) {
      edgePairs.add(toPairKey(path[index], path[index + 1]));
    }
    const commonAncestors = getNearestCommonAncestors(firstId, secondId, graph);
    for (const id of commonAncestors) {
      nodeIds.add(id);
    }
    return {
      nodeIds,
      edgePairs,
      commonAncestorIds: new Set(commonAncestors)
    };
  }, [compareMode, compareSelection, graph]);

  const compareOrderById = useMemo(() => {
    const map = new Map<string, number>();
    for (let index = 0; index < compareSelection.length; index += 1) {
      map.set(compareSelection[index], index + 1);
    }
    return map;
  }, [compareSelection]);

  const selectedPanda = selectedPandaId ? graph.byId.get(selectedPandaId) ?? null : null;

  const selectedParents = useMemo(() => {
    if (!selectedPandaId) {
      return [];
    }
    const parentIds = graph.parentsByChild.get(selectedPandaId) ?? [];
    return parentIds
      .map((id) => graph.byId.get(id))
      .filter((value): value is LineagePanda => Boolean(value));
  }, [graph, selectedPandaId]);

  const selectedChildren = useMemo(() => {
    if (!selectedPandaId) {
      return [];
    }
    const childIds = graph.childrenByParent.get(selectedPandaId) ?? [];
    return childIds
      .map((id) => graph.byId.get(id))
      .filter((value): value is LineagePanda => Boolean(value))
      .sort(sortPandas);
  }, [graph, selectedPandaId]);

  const centerOnWorldPoint = useCallback(
    (worldX: number, worldY: number, nextScale?: number) => {
      const stage = stageRef.current;
      if (!stage) {
        return;
      }
      const rect = stage.getBoundingClientRect();
      const scale = clamp(nextScale ?? viewport.scale, MIN_SCALE, MAX_SCALE);
      setViewport({
        scale,
        x: rect.width / 2 - worldX * scale,
        y: rect.height / 2 - worldY * scale
      });
    },
    [viewport.scale]
  );

  const centerOnNode = useCallback(
    (nodeId: string | null, nextScale?: number) => {
      if (!nodeId) {
        return;
      }
      const node = layout.nodes.find((item) => item.pandaId === nodeId);
      if (!node) {
        return;
      }
      centerOnWorldPoint(WORLD_ORIGIN_X + node.x, WORLD_ORIGIN_Y + node.y, nextScale);
    },
    [centerOnWorldPoint, layout.nodes]
  );

  const zoomAroundPoint = useCallback((clientX: number, clientY: number, nextScale: number) => {
    const stage = stageRef.current;
    if (!stage) {
      return;
    }
    const rect = stage.getBoundingClientRect();
    const scale = clamp(nextScale, MIN_SCALE, MAX_SCALE);
    const pointX = clientX - rect.left;
    const pointY = clientY - rect.top;

    setViewport((current) => {
      const worldX = (pointX - current.x) / current.scale;
      const worldY = (pointY - current.y) / current.scale;
      return {
        scale,
        x: pointX - worldX * scale,
        y: pointY - worldY * scale
      };
    });
  }, []);

  const zoomByStep = useCallback(
    (step: number) => {
      const stage = stageRef.current;
      if (!stage) {
        return;
      }
      const rect = stage.getBoundingClientRect();
      const nextScale = clamp(viewport.scale + step, MIN_SCALE, MAX_SCALE);
      zoomAroundPoint(rect.left + rect.width / 2, rect.top + rect.height / 2, nextScale);
    },
    [viewport.scale, zoomAroundPoint]
  );

  useEffect(() => {
    if (!focusId || hasCenteredRef.current) {
      return;
    }
    if (layout.nodes.length === 0) {
      return;
    }
    centerOnNode(focusId, 1);
    hasCenteredRef.current = true;
  }, [centerOnNode, focusId, layout.nodes.length]);

  useEffect(() => {
    if (viewMode === "tree") {
      centerOnNode(focusId, viewport.scale);
      return;
    }
    centerOnNode(founderId, viewport.scale);
  }, [centerOnNode, focusId, founderId, viewMode, viewport.scale]);

  const handleStagePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) {
        return;
      }
      const target = event.target as HTMLElement;
      if (target.closest("[data-ui='control'], [data-node='true']")) {
        return;
      }
      const current = event.currentTarget;
      dragRef.current = {
        startX: event.clientX,
        startY: event.clientY,
        originX: viewport.x,
        originY: viewport.y
      };
      hasDraggedRef.current = false;
      current.setPointerCapture(event.pointerId);
    },
    [viewport.x, viewport.y]
  );

  const handleStagePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) {
      return;
    }
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
      hasDraggedRef.current = true;
    }
    setViewport((current) => ({
      ...current,
      x: drag.originX + dx,
      y: drag.originY + dy
    }));
  }, []);

  const handleStagePointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current) {
      dragRef.current = null;
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  const handleStageClick = useCallback(() => {
    if (hasDraggedRef.current) {
      hasDraggedRef.current = false;
      return;
    }
    setSelectedPandaId(null);
  }, []);

  const handleWheel = useCallback(
    (event: React.WheelEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement;
      if (target.closest("[data-ui='control']")) {
        return;
      }
      event.preventDefault();
      const zoomFactor = event.deltaY < 0 ? 1.08 : 0.92;
      zoomAroundPoint(event.clientX, event.clientY, viewport.scale * zoomFactor);
    },
    [viewport.scale, zoomAroundPoint]
  );

  const handleCompareToggle = useCallback((enabled: boolean) => {
    setCompareMode(enabled);
    if (!enabled) {
      setCompareSelection([]);
    }
  }, []);

  const handleNodeClick = useCallback(
    (node: PositionedNode) => {
      if (node.type === "bubble") {
        setExpandedClusters((current) => {
          const next = new Set(current);
          if (next.has(node.key)) {
            next.delete(node.key);
          } else {
            next.add(node.key);
          }
          return next;
        });
        return;
      }

      if (!node.pandaId) {
        return;
      }

      setSelectedPandaId(node.pandaId);

      if (!compareMode) {
        return;
      }

      setCompareSelection((current) => {
        if (current.includes(node.pandaId!)) {
          return current.filter((item) => item !== node.pandaId);
        }
        if (current.length < 2) {
          return [...current, node.pandaId!];
        }
        return [current[1], node.pandaId!];
      });
    },
    [compareMode]
  );

  const comparisonIsActive = compareMode && compareSelection.length === 2;

  return (
    <section className="lineage-module">
      <div className="lineage-topbar" data-ui="control">
        <div className="lineage-topbar-title">
          <h1>{LINEAGE_COPY.title}</h1>
          <p>{LINEAGE_COPY.subtitle}</p>
        </div>
        <div className="lineage-topbar-actions">
          <label className="lineage-compare-toggle">
            <input
              type="checkbox"
              aria-label={LINEAGE_COPY.compare}
              checked={compareMode}
              onChange={(event) => handleCompareToggle(event.target.checked)}
            />
            <span>
              <GitCompareArrows size={16} />
              {LINEAGE_COPY.compare}
            </span>
          </label>
          {compareMode ? <div className="lineage-compare-hint">{formatCompareHint(compareSelection.length)}</div> : null}
          {compareSelection.length > 0 ? (
            <div className="lineage-compare-badges">
              {compareSelection.map((id, index) => {
                const panda = graph.byId.get(id);
                if (!panda) {
                  return null;
                }
                return (
                  <span key={id} className="lineage-compare-pill">
                    {index + 1}. {panda.name_zh}
                  </span>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>

      <div
        ref={stageRef}
        className="lineage-stage"
        onPointerDown={handleStagePointerDown}
        onPointerMove={handleStagePointerMove}
        onPointerUp={handleStagePointerUp}
        onPointerCancel={handleStagePointerUp}
        onWheel={handleWheel}
        onClick={handleStageClick}
      >
        <div
          className="lineage-dot-grid"
          aria-hidden="true"
          style={{
            backgroundPosition: `${viewport.x}px ${viewport.y}px`
          }}
        />

        <div
          className="lineage-world"
          style={{
            width: WORLD_WIDTH,
            height: WORLD_HEIGHT,
            transform: `translate3d(${viewport.x}px, ${viewport.y}px, 0) scale(${viewport.scale})`
          }}
        >
          <svg className="lineage-links-layer" width={WORLD_WIDTH} height={WORLD_HEIGHT} aria-hidden="true">
            {layout.edges.map((edge) => {
              const from = nodesByKey.get(edge.fromKey);
              const to = nodesByKey.get(edge.toKey);
              if (!from || !to) {
                return null;
              }
              const edgePair =
                edge.fromPandaId && edge.toPandaId
                  ? toPairKey(edge.fromPandaId, edge.toPandaId)
                  : null;
              const isHighlighted = edgePair ? highlighted.edgePairs.has(edgePair) : false;
              const shouldDim = comparisonIsActive && !isHighlighted;
              return (
                <path
                  key={edge.key}
                  d={buildEdgePath(from, to, viewMode)}
                  className={cn(
                    "lineage-link",
                    edge.kind === "cluster" && "lineage-link--cluster",
                    isHighlighted && "lineage-link--highlighted",
                    shouldDim && "lineage-link--dimmed"
                  )}
                />
              );
            })}
          </svg>

          <div className="lineage-nodes-layer">
            {layout.nodes.map((node) => {
              const panda = node.pandaId ? pandaByRenderKey.get(node.key) : null;
              const compareOrder = panda ? compareOrderById.get(panda.id) : undefined;
              const isAncestorFocus =
                panda && comparisonIsActive ? highlighted.commonAncestorIds.has(panda.id) : false;
              const isHighlighted = panda && comparisonIsActive ? highlighted.nodeIds.has(panda.id) : false;

              const bubbleRelatesHighlight =
                node.type === "bubble" &&
                comparisonIsActive &&
                ((node.parentId && highlighted.nodeIds.has(node.parentId)) ||
                  (node.hiddenIds ?? []).some((id) => highlighted.nodeIds.has(id)));
              const isDimmed =
                comparisonIsActive &&
                !(isHighlighted || bubbleRelatesHighlight) &&
                !(node.type === "panda" && compareOrder);

              return (
                <div
                  key={node.key}
                  className="lineage-node-anchor"
                  style={{
                    left: WORLD_ORIGIN_X + node.x,
                    top: WORLD_ORIGIN_Y + node.y
                  }}
                >
                  {node.type === "bubble" ? (
                    <button
                      type="button"
                      data-node="true"
                      className={cn("lineage-bubble-node", isDimmed && "is-dimmed")}
                      aria-label={buildBubbleAriaLabel(node.hiddenIds ?? [], graph, expandedClusters.has(node.key))}
                      aria-expanded={expandedClusters.has(node.key)}
                      onClick={(event) => {
                        event.stopPropagation();
                        handleNodeClick(node);
                      }}
                      title={getBubbleNames(node.hiddenIds ?? [], graph).join("、")}
                    >
                      +{node.hiddenIds?.length ?? 0}
                      <span className="lineage-bubble-tooltip">{getBubbleNames(node.hiddenIds ?? [], graph).join("、")}</span>
                    </button>
                  ) : panda ? (
                    <button
                      type="button"
                      data-node="true"
                      className={cn(
                        "lineage-panda-node",
                        `gender-${panda.gender}`,
                        selectedPandaId === panda.id && "is-selected",
                        isAncestorFocus && "is-common-ancestor",
                        isHighlighted && "is-highlighted",
                        isDimmed && "is-dimmed"
                      )}
                      onClick={(event) => {
                        event.stopPropagation();
                        handleNodeClick(node);
                      }}
                    >
                      <span className="lineage-avatar-wrap">
                        {panda.avatar_url ? (
                          <Image src={panda.avatar_url} alt={panda.name_zh} width={84} height={84} />
                        ) : (
                          <span className="lineage-avatar-fallback">{panda.name_zh.slice(0, 2).toUpperCase()}</span>
                        )}
                      </span>
                      {typeof compareOrder === "number" ? (
                        <span className="lineage-compare-order">{compareOrder}</span>
                      ) : null}
                      <span className="lineage-name-zh">{panda.name_zh}</span>
                      <span className="lineage-name-en">{panda.name_en}</span>
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>

        <aside className="lineage-control-island" data-ui="control">
          <div className="lineage-view-toggle">
            <button
              type="button"
              className={cn(viewMode === "tree" && "is-active")}
              aria-label="切换到树状谱系视图"
              onClick={() => setViewMode("tree")}
            >
              <TreePine size={16} />
              {LINEAGE_COPY.views.tree}
            </button>
            <button
              type="button"
              className={cn(viewMode === "radial" && "is-active")}
              aria-label="切换到环状谱系视图"
              onClick={() => setViewMode("radial")}
            >
              <Radar size={16} />
              {LINEAGE_COPY.views.radial}
            </button>
          </div>

          <div className="lineage-zoom-controls">
            <button type="button" onClick={() => zoomByStep(-0.1)} aria-label={LINEAGE_COPY.controls.zoomOut}>
              <Minus size={14} />
            </button>
            <input
              type="range"
              aria-label={LINEAGE_COPY.controls.zoomSlider}
              min={MIN_SCALE}
              max={MAX_SCALE}
              step={0.01}
              value={viewport.scale}
              onChange={(event) => {
                const stage = stageRef.current;
                if (!stage) {
                  return;
                }
                const rect = stage.getBoundingClientRect();
                zoomAroundPoint(rect.left + rect.width / 2, rect.top + rect.height / 2, Number(event.target.value));
              }}
            />
            <button type="button" onClick={() => zoomByStep(0.1)} aria-label={LINEAGE_COPY.controls.zoomIn}>
              <Plus size={14} />
            </button>
          </div>
          <div className="lineage-zoom-readout">{Math.round(viewport.scale * 100)}%</div>

          <button
            type="button"
            className="lineage-center-btn"
            aria-label={LINEAGE_COPY.controls.centerCurrent}
            onClick={() => centerOnNode(selectedPandaId ?? focusId, 1)}
          >
            <Crosshair size={15} />
            {LINEAGE_COPY.controls.centerCurrent}
          </button>
        </aside>

        {viewMode === "tree" && ancestorDepth < layout.maxAncestorDepth ? (
          <button
            type="button"
            className="lineage-expand-arrow lineage-expand-arrow--up"
            data-ui="control"
            aria-label={LINEAGE_COPY.controls.expandAncestors}
            onClick={(event) => {
              event.stopPropagation();
              setAncestorDepth((value) => value + 1);
            }}
          >
            <ArrowUp size={16} />
            {LINEAGE_COPY.controls.expandAncestors}
          </button>
        ) : null}

        {viewMode === "tree" && descendantDepth < layout.maxDescendantDepth ? (
          <button
            type="button"
            className="lineage-expand-arrow lineage-expand-arrow--down"
            data-ui="control"
            aria-label={LINEAGE_COPY.controls.expandDescendants}
            onClick={(event) => {
              event.stopPropagation();
              setDescendantDepth((value) => value + 1);
            }}
          >
            <ArrowDown size={16} />
            {LINEAGE_COPY.controls.expandDescendants}
          </button>
        ) : null}

        <aside
          className={cn("lineage-drawer", selectedPanda ? "is-open" : "")}
          data-ui="control"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="lineage-drawer-head">
            <h2>{LINEAGE_COPY.drawer.title}</h2>
            <button type="button" onClick={() => setSelectedPandaId(null)} aria-label="关闭个体档案面板">
              <X size={16} />
            </button>
          </div>
          {selectedPanda ? (
            <div className="lineage-drawer-body">
              <div className="lineage-drawer-cover">
                {selectedPanda.avatar_url ? (
                  <Image src={selectedPanda.avatar_url} alt={`${selectedPanda.name_zh} 档案封面`} width={800} height={600} />
                ) : (
                  <div className="lineage-drawer-cover-empty">{selectedPanda.name_zh}</div>
                )}
              </div>
              <h3>{selectedPanda.name_zh}</h3>
              <p className="lineage-drawer-en">{selectedPanda.name_en}</p>
              <p className="lineage-drawer-intro">{selectedPanda.intro}</p>
              <div className="lineage-drawer-actions">
                <Link href={`/atlas/${selectedPanda.slug}`}>{LINEAGE_COPY.drawer.openProfile}</Link>
              </div>
              <dl className="lineage-drawer-kv">
                <div>
                  <dt>{LINEAGE_COPY.drawer.birthDate}</dt>
                  <dd>{formatDate(selectedPanda.birth_date)}</dd>
                </div>
                <div>
                  <dt>{LINEAGE_COPY.drawer.gender}</dt>
                  <dd>{formatGender(selectedPanda.gender)}</dd>
                </div>
                <div>
                  <dt>{LINEAGE_COPY.drawer.location}</dt>
                  <dd>{formatText(selectedPanda.current_location)}</dd>
                </div>
                <div>
                  <dt>{LINEAGE_COPY.drawer.parents}</dt>
                  <dd>
                    {selectedParents.length > 0 ? (
                      <span className="lineage-drawer-links">
                        {selectedParents.map((item) => (
                          <Link key={item.id} href={`/atlas/${item.slug}`}>
                            {item.name_zh}
                          </Link>
                        ))}
                      </span>
                    ) : (
                      LINEAGE_COPY.fallback.unknown
                    )}
                  </dd>
                </div>
                <div>
                  <dt>{LINEAGE_COPY.drawer.childrenCount}</dt>
                  <dd>{formatChildrenCount(selectedChildren.length)}</dd>
                </div>
              </dl>
              {selectedChildren.length > 0 ? (
                <>
                  <h4>{LINEAGE_COPY.drawer.children}</h4>
                  <ul className="lineage-drawer-list">
                    {selectedChildren.map((item) => (
                      <li key={item.id}>
                        <Link href={`/atlas/${item.slug}`}>{item.name_zh}</Link>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
              {selectedPanda.highlights.length > 0 ? (
                <>
                  <h4>{LINEAGE_COPY.drawer.highlights}</h4>
                  <ul className="lineage-drawer-list">
                    {selectedPanda.highlights.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </>
              ) : null}
            </div>
          ) : (
            <div className="lineage-drawer-empty">{LINEAGE_COPY.drawer.empty}</div>
          )}
        </aside>
      </div>
    </section>
  );
}
