"use client";

/* eslint-disable @next/next/no-img-element -- prototype lineage nodes render release-provided remote panda media. */

import Link from "next/link";
import type { Route } from "next";
import { useMemo, useState } from "react";
import dagre from "@dagrejs/dagre";
import {
  Background,
  BaseEdge,
  Controls,
  EdgeLabelRenderer,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
  getSmoothStepPath,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import { ArrowRight, ExternalLink, Focus, ShieldCheck } from "lucide-react";

import type { LineageQueryState } from "@/features/lineage/lineage-query";
import type {
  StructuredLineageGraph,
  StructuredRelationStatus,
} from "@/features/lineage/lineage-view-model";
import type { PublicLocale } from "@/foundation/content/locales";

import styles from "./lineage.module.css";

interface EvidenceSource {
  id: string;
  publisher: string;
  title: string;
  url: string | null;
  lastVerifiedAt: string | null;
  accessState: string;
}

export interface LineageEvidence {
  id: string;
  parentId: string;
  childId: string;
  role: "father" | "mother";
  status: "confirmed" | "tentative" | "disputed" | "superseded";
  sources: EvidenceSource[];
}

interface LineageFlowProps {
  locale: PublicLocale;
  state: LineageQueryState;
  graph: StructuredLineageGraph;
  evidence: LineageEvidence[];
}

type PandaNodeData = {
  locale: PublicLocale;
  id: string;
  slug: string;
  name: string;
  alternateName: string | null;
  imageUrl: string | null;
  birthYear: string | null;
  generation: number;
  focus: boolean;
  href: string;
};

type PandaFlowNode = Node<PandaNodeData, "panda">;
type RelationshipEdgeData = {
  role: "father" | "mother";
  status: StructuredRelationStatus;
  selected: boolean;
  locale: PublicLocale;
  dimmed: boolean;
  select: (edgeId: string) => void;
};
type RelationshipFlowEdge = Edge<RelationshipEdgeData, "lineage">;

const NODE_WIDTH = 190;
const NODE_HEIGHT = 188;

function generationLabel(locale: PublicLocale, generation: number): string {
  if (generation === 0) return locale === "zh" ? "当前同代" : "Focus generation";
  if (generation < 0) return locale === "zh" ? `向上 ${Math.abs(generation)} 代` : `${Math.abs(generation)} gen up`;
  return locale === "zh" ? `向下 ${generation} 代` : `${generation} gen down`;
}

function statusLabel(locale: PublicLocale, status: StructuredRelationStatus): string {
  const labels = locale === "zh"
    ? { confirmed: "已确认", tentative: "暂定", disputed: "有争议", superseded: "已取代", unknown: "未知" }
    : { confirmed: "Confirmed", tentative: "Tentative", disputed: "Disputed", superseded: "Superseded", unknown: "Unknown" };
  return labels[status];
}

function roleLabel(locale: PublicLocale, role: "father" | "mother"): string {
  return locale === "zh" ? (role === "father" ? "父" : "母") : role === "father" ? "Father" : "Mother";
}

function nodeHref(locale: PublicLocale, state: LineageQueryState, slug: string): string {
  const params = new URLSearchParams({ focus: slug });
  if (state.ancestorDepth !== 2) params.set("ancestors", String(state.ancestorDepth));
  if (state.descendantDepth !== 2) params.set("descendants", String(state.descendantDepth));
  return `/${locale}/prototype/fan-v07/lineage?${params}`;
}

function PandaNode({ data }: NodeProps<PandaFlowNode>) {
  return (
    <article className={styles.pandaNode} data-focus={data.focus ? "true" : undefined}>
      <Handle type="target" position={Position.Top} className={styles.handle} isConnectable={false} />
      <Link href={data.href as Route} className={styles.pandaNodeLink} aria-label={`${data.name} · ${data.focus ? (data.locale === "zh" ? "当前中心" : "Current focus") : (data.locale === "zh" ? "设为新的中心" : "Set as new focus")}`}>
        <span className={styles.nodePortrait} data-has-image={data.imageUrl ? "true" : undefined}>
          {data.imageUrl ? <img src={data.imageUrl} alt="" loading="lazy" /> : <span>{data.name.slice(0, 1)}</span>}
          {data.focus ? <i><Focus aria-hidden="true" /></i> : null}
        </span>
        <span className={styles.nodeCopy}>
          <small>{data.focus ? (data.locale === "zh" ? "当前中心" : "Current focus") : generationLabel(data.locale, data.generation)}</small>
          <strong>{data.name}</strong>
          {data.alternateName ? <em>{data.alternateName}</em> : null}
          {data.birthYear ? <span>{data.locale === "zh" ? `${data.birthYear} 年出生` : `Born ${data.birthYear}`}</span> : null}
        </span>
        <ArrowRight className={styles.nodeArrow} aria-hidden="true" />
      </Link>
      <Handle type="source" position={Position.Bottom} className={styles.handle} isConnectable={false} />
    </article>
  );
}

function RelationshipEdge(props: EdgeProps<RelationshipFlowEdge>) {
  const { id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, style } = props;
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 18,
  });
  const selected = data?.selected === true;
  const status = data?.status ?? "unknown";
  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        interactionWidth={28}
        style={style}
        className={styles.relationshipPath}
      />
      <EdgeLabelRenderer>
        <button
          type="button"
          className={styles.edgeLabel}
          data-role={data?.role}
          data-status={status}
          data-selected={selected ? "true" : undefined}
          style={{ transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`, opacity: data?.dimmed ? 0.18 : 1 }}
          onClick={(event) => {
            event.stopPropagation();
            data?.select(id);
          }}
          aria-label={`${roleLabel(data?.locale ?? "zh", data?.role ?? "father")} · ${statusLabel(data?.locale ?? "zh", status)}`}
        >
          <span>{roleLabel(data?.locale ?? "zh", data?.role ?? "father")}</span>
        </button>
      </EdgeLabelRenderer>
    </>
  );
}

const nodeTypes = { panda: PandaNode };
const edgeTypes = { lineage: RelationshipEdge };

function buildLayout(
  locale: PublicLocale,
  state: LineageQueryState,
  graph: StructuredLineageGraph,
): { nodes: PandaFlowNode[]; edges: RelationshipFlowEdge[] } {
  const dagreGraph = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({
    rankdir: "TB",
    nodesep: 38,
    ranksep: 86,
    marginx: 48,
    marginy: 48,
    ranker: "network-simplex",
  });

  graph.nodes.forEach((node) => dagreGraph.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT }));
  graph.edges.forEach((edge) => dagreGraph.setEdge(edge.parentId, edge.childId, { weight: edge.status === "confirmed" ? 2 : 1 }));
  dagre.layout(dagreGraph);

  const nodes: PandaFlowNode[] = graph.nodes.map((node) => {
    const layout = dagreGraph.node(node.id) as { x: number; y: number };
    return {
      id: node.id,
      type: "panda",
      position: { x: layout.x - (NODE_WIDTH / 2), y: layout.y - (NODE_HEIGHT / 2) },
      data: {
        locale,
        id: node.id,
        slug: node.slug,
        name: node.name,
        alternateName: node.alternateName,
        imageUrl: node.coverImageUrl,
        birthYear: node.birthYear,
        generation: node.generation,
        focus: node.id === graph.focusId,
        href: nodeHref(locale, state, node.slug),
      },
      draggable: false,
      selectable: false,
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
    };
  });

  const edges: RelationshipFlowEdge[] = graph.edges.map((edge) => ({
    id: edge.id,
    source: edge.parentId,
    target: edge.childId,
    type: "lineage",
    data: {
      role: edge.role,
      status: edge.status,
      selected: false,
      locale,
      dimmed: false,
      select: () => undefined,
    },
  }));
  return { nodes, edges };
}

function LineageCanvas({ locale, state, graph, evidence }: LineageFlowProps) {
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const base = useMemo(() => buildLayout(locale, state, graph), [locale, state, graph]);
  const evidenceById = useMemo(() => new Map(evidence.map((item) => [item.id, item])), [evidence]);
  const nodeById = useMemo(() => new Map(graph.nodes.map((node) => [node.id, node])), [graph.nodes]);

  const connected = useMemo(() => {
    if (!hoveredNodeId) return null;
    const ids = new Set([hoveredNodeId]);
    for (const edge of graph.edges) {
      if (edge.parentId === hoveredNodeId) ids.add(edge.childId);
      if (edge.childId === hoveredNodeId) ids.add(edge.parentId);
    }
    return ids;
  }, [graph.edges, hoveredNodeId]);

  const nodes = useMemo(() => base.nodes.map((node) => ({
    ...node,
    style: connected && !connected.has(node.id) ? { opacity: 0.18, transition: "opacity 180ms ease" } : { opacity: 1, transition: "opacity 180ms ease" },
  })), [base.nodes, connected]);

  const edges = useMemo(() => base.edges.map((edge) => {
    const sourceConnected = connected?.has(edge.source) ?? true;
    const targetConnected = connected?.has(edge.target) ?? true;
    const dimmed = connected ? !(sourceConnected && targetConnected) : false;
    const status = edge.data?.status ?? "unknown";
    const selected = edge.id === selectedEdgeId;
    const stroke = status === "disputed" ? "var(--lineage-disputed)" : status === "tentative" ? "var(--lineage-tentative)" : status === "superseded" ? "var(--lineage-superseded)" : "var(--lineage-edge)";
    return {
      ...edge,
      style: {
        stroke,
        strokeWidth: selected ? 3.2 : 1.8,
        strokeDasharray: status === "confirmed" ? undefined : status === "disputed" ? "4 5" : "8 6",
        opacity: dimmed ? 0.12 : selected ? 1 : 0.78,
        transition: "opacity 180ms ease, stroke-width 180ms ease",
      },
      data: {
        ...edge.data!,
        selected,
        dimmed,
        select: setSelectedEdgeId,
      },
    } satisfies RelationshipFlowEdge;
  }), [base.edges, connected, selectedEdgeId]);

  const selectedEvidence = selectedEdgeId ? evidenceById.get(selectedEdgeId) ?? null : null;
  const selectedParent = selectedEvidence ? nodeById.get(selectedEvidence.parentId) ?? null : null;
  const selectedChild = selectedEvidence ? nodeById.get(selectedEvidence.childId) ?? null : null;
  const zh = locale === "zh";

  return (
    <div className={styles.flowShell} data-has-selection={selectedEvidence ? "true" : undefined}>
      <div className={styles.flowCanvas}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          fitViewOptions={{ padding: 0.22, maxZoom: 1.05 }}
          minZoom={0.28}
          maxZoom={1.8}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          zoomOnDoubleClick={false}
          panOnScroll
          onNodeMouseEnter={(_, node) => setHoveredNodeId(node.id)}
          onNodeMouseLeave={() => setHoveredNodeId(null)}
          onPaneClick={() => setSelectedEdgeId(null)}
          proOptions={{ hideAttribution: false }}
          aria-label={zh ? "互动熊猫谱系图" : "Interactive panda lineage graph"}
        >
          <Background gap={26} size={1} color="var(--lineage-grid)" />
          <Controls position="bottom-left" showInteractive={false} />
          <MiniMap
            position="bottom-right"
            pannable
            zoomable
            nodeStrokeWidth={3}
            nodeColor={(node) => node.id === graph.focusId ? "var(--lineage-accent)" : "var(--lineage-minimap)"}
            maskColor="var(--lineage-minimap-mask)"
          />
        </ReactFlow>

        <div className={styles.flowLegend} aria-label={zh ? "关系图例" : "Relationship legend"}>
          <span><i data-status="confirmed" />{zh ? "确认" : "Confirmed"}</span>
          <span><i data-status="tentative" />{zh ? "暂定" : "Tentative"}</span>
          <span><i data-status="disputed" />{zh ? "争议" : "Disputed"}</span>
        </div>
      </div>

      <aside className={styles.evidencePanel} aria-live="polite">
        {selectedEvidence ? (
          <>
            <div className={styles.evidenceHeading}>
              <div>
                <small>{zh ? "正在查看关系" : "Selected relationship"}</small>
                <h3>{selectedParent?.name ?? "—"} <span>→</span> {selectedChild?.name ?? "—"}</h3>
              </div>
              <button type="button" onClick={() => setSelectedEdgeId(null)} aria-label={zh ? "关闭关系详情" : "Close relationship details"}>×</button>
            </div>
            <div className={styles.evidenceBadges}>
              <span data-role={selectedEvidence.role}>{roleLabel(locale, selectedEvidence.role)}</span>
              <span data-status={selectedEvidence.status}>{statusLabel(locale, selectedEvidence.status)}</span>
            </div>
            <p>{zh ? "这条线对应一条已发布亲本断言。状态和来源直接来自当前谱系数据，不根据名字或旧字段猜测。" : "This edge maps to a published parentage assertion. Status and sources come directly from the current lineage dataset rather than inferred legacy fields."}</p>
            <div className={styles.evidenceSources}>
              <strong><ShieldCheck aria-hidden="true" />{zh ? "关系来源" : "Relationship sources"}</strong>
              {selectedEvidence.sources.length ? (
                <ul>
                  {selectedEvidence.sources.map((source) => (
                    <li key={source.id}>
                      <div><strong>{source.publisher}</strong><span>{source.title}</span></div>
                      <small>{source.lastVerifiedAt ? `${zh ? "最后核实" : "Verified"} ${source.lastVerifiedAt}` : source.accessState}</small>
                      {source.url ? <a href={source.url} target="_blank" rel="noreferrer" aria-label={`${source.publisher}: ${source.title}`}><ExternalLink aria-hidden="true" /></a> : null}
                    </li>
                  ))}
                </ul>
              ) : <p>{zh ? "当前记录没有公开来源链接。" : "No public source link is attached to this assertion."}</p>}
            </div>
            {selectedChild?.profileAvailable ? (
              <Link className={styles.evidenceProfileLink} href={`/${locale}/prototype/fan-v07/panda/${selectedChild.slug}` as Route}>
                {zh ? `查看${selectedChild.name}的完整档案` : `Open ${selectedChild.name}'s profile`}<ArrowRight aria-hidden="true" />
              </Link>
            ) : null}
          </>
        ) : (
          <div className={styles.evidenceEmpty}>
            <span className={styles.evidenceGlyph}><GitBranchGlyph /></span>
            <small>{zh ? "关系检查器" : "Relationship inspector"}</small>
            <h3>{zh ? "点一条“父 / 母”关系线。" : "Select a father / mother link."}</h3>
            <p>{zh ? "这里会显示关系状态、来源和最后核实时间。悬停任意熊猫则可以快速看一跳亲属。" : "Its status, sources, and verification date will appear here. Hover any panda to isolate immediate relatives."}</p>
          </div>
        )}
      </aside>
    </div>
  );
}

function GitBranchGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 3v6a4 4 0 0 0 4 4h4a4 4 0 0 1 4 4v4M18 3v5a5 5 0 0 1-5 5h-3" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="6" cy="3" r="2" fill="currentColor" />
      <circle cx="18" cy="3" r="2" fill="currentColor" />
      <circle cx="18" cy="21" r="2" fill="currentColor" />
    </svg>
  );
}

export function LineageFlow(props: LineageFlowProps) {
  return (
    <ReactFlowProvider>
      <LineageCanvas {...props} />
    </ReactFlowProvider>
  );
}
