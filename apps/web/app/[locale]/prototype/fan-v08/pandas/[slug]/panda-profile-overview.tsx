"use client";

import {
  CalendarDays,
  Compass,
  HeartPulse,
  MapPin,
  PanelRightClose,
  PanelRightOpen,
  PawPrint,
  Route,
  UserRound,
  UsersRound,
} from "lucide-react";
import { useEffect, useState } from "react";

import styles from "./panda-profile-overview.module.css";

export type PandaOverviewRowKind =
  | "identity"
  | "sex"
  | "birth"
  | "place"
  | "status"
  | "family"
  | "rescue"
  | "release";

export interface PandaOverviewRow {
  kind: PandaOverviewRowKind;
  label: string;
  value: string;
  muted?: boolean;
}

const iconByKind = {
  identity: PawPrint,
  sex: UserRound,
  birth: CalendarDays,
  place: MapPin,
  status: HeartPulse,
  family: UsersRound,
  rescue: Compass,
  release: Route,
} satisfies Record<PandaOverviewRowKind, typeof PawPrint>;

export function PandaProfileOverview({
  displayName,
  alternateName,
  rows,
  titleId,
  openLabel,
  closeLabel,
}: {
  displayName: string;
  alternateName: string | null;
  rows: PandaOverviewRow[];
  titleId: string;
  openLabel: string;
  closeLabel: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = window.setTimeout(() => setOpen(true), reduceMotion ? 0 : 1400);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className={styles.stage} data-profile-stage>
      <button
        className={styles.trigger}
        type="button"
        aria-controls="profile-overview"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? <PanelRightClose aria-hidden="true" /> : <PanelRightOpen aria-hidden="true" />}
        <span>{open ? closeLabel : openLabel}</span>
      </button>
      <aside
        className={`${styles.panel} ${open ? styles.panelOpen : styles.panelClosed}`}
        id="profile-overview"
        aria-labelledby={titleId}
        data-profile-open={open ? "true" : "false"}
      >
        <div className={styles.inner}>
          <div className={styles.identity}>
            <h1 id={titleId}>{displayName}</h1>
            {alternateName ? <p>{alternateName}</p> : null}
          </div>
          <dl className={styles.rows}>
            {rows.map((row) => {
              const Icon = iconByKind[row.kind];
              return (
                <div className={styles.row} data-kind={row.kind} key={`${row.kind}:${row.label}`}>
                  <Icon aria-hidden="true" />
                  <div>
                    <dt>{row.label}</dt>
                    <dd className={row.muted ? styles.muted : undefined}>{row.value}</dd>
                  </div>
                </div>
              );
            })}
          </dl>
        </div>
      </aside>
    </div>
  );
}
