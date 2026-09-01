"use client";

import dynamic from "next/dynamic";

import type { PandaMapWorkspaceItem, PandaMapWorkspaceMode } from "./panda-map-workspace";

const PandaMapWorkspace = dynamic(
  () => import("./panda-map-workspace").then((module) => module.PandaMapWorkspace),
  { ssr: false },
);

interface PandaMapWorkspaceLoaderProps {
  locale: "zh" | "en";
  mode: PandaMapWorkspaceMode;
  focus: string;
  selectedId: string;
  snapshot: string;
  routeBase: string;
  items: PandaMapWorkspaceItem[];
  tileUrl: string;
  attribution: string;
}

export function PandaMapWorkspaceLoader(props: PandaMapWorkspaceLoaderProps) {
  return <PandaMapWorkspace {...props} />;
}
