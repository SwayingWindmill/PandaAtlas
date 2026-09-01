"use client";

import type { Route } from "next";
import Link from "next/link";
import { MapPin } from "lucide-react";
import { useMemo, useState } from "react";

import styles from "./prototype.module.css";

export interface HomeMapMarker {
  id: string;
  title: string;
  subtitle: string;
  href: string;
  coordinates: [number, number];
}

const MAP_WIDTH = 1000;
const MAP_HEIGHT = 520;

function project([longitude, latitude]: [number, number]) {
  return {
    x: ((longitude + 180) / 360) * MAP_WIDTH,
    y: ((90 - latitude) / 180) * MAP_HEIGHT,
  };
}

export function HomeMap({ locale, markers }: { locale: "zh" | "en"; markers: HomeMapMarker[] }) {
  const zh = locale === "zh";
  const [selectedId, setSelectedId] = useState(markers[0]?.id ?? "");
  const selected = markers.find((marker) => marker.id === selectedId) ?? markers[0] ?? null;
  const projected = useMemo(() => markers.map((marker) => ({ marker, ...project(marker.coordinates) })), [markers]);

  return (
    <div className={styles.homeMapShell}>
      <svg
        className={styles.homeWorldMap}
        viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
        role="img"
        aria-label={zh ? "熊猫地点世界地图" : "World map of panda places"}
      >
        <rect width={MAP_WIDTH} height={MAP_HEIGHT} className={styles.homeMapOcean} />

        <g className={styles.homeMapGrid} aria-hidden="true">
          <path d="M0 130H1000M0 260H1000M0 390H1000" />
          <path d="M250 0V520M500 0V520M750 0V520" />
        </g>

        <g className={styles.homeMapLand} aria-hidden="true">
          <path d="M82 112C116 77 173 56 230 66L274 92L315 95L333 125L299 149L270 176L233 184L205 214L167 216L151 196L120 186L105 156L78 142Z" />
          <path d="M278 211L306 224L323 263L316 301L335 328L319 365L300 407L279 442L264 421L267 381L250 345L246 302L256 268L244 238Z" />
          <path d="M355 76L387 64L409 82L399 106L366 116L347 98Z" />
          <path d="M447 129L468 111L501 110L518 126L513 145L486 151L468 144Z" />
          <path d="M480 166L514 153L548 162L567 189L561 226L577 252L563 291L540 327L512 323L500 287L480 265L468 229L471 195Z" />
          <path d="M514 106L562 83L625 78L674 90L720 86L774 106L817 131L842 159L825 183L785 185L756 203L714 198L681 211L644 201L607 177L573 168L548 145L520 142Z" />
          <path d="M746 212L769 216L786 233L778 252L755 248L742 231Z" />
          <path d="M814 327L846 314L882 324L904 350L891 380L860 395L828 386L807 358Z" />
          <path d="M902 220L912 225L918 243L909 253L900 240Z" />
          <path d="M891 270L900 275L905 287L896 295L888 284Z" />
        </g>

        <g className={styles.homeMapIslands} aria-hidden="true">
          <circle cx="926" cy="170" r="4" />
          <circle cx="938" cy="185" r="3" />
          <circle cx="796" cy="242" r="4" />
          <circle cx="811" cy="249" r="3" />
          <circle cx="837" cy="262" r="2.5" />
        </g>

        <g>
          {projected.map(({ marker, x, y }) => {
            const active = marker.id === selected?.id;
            return (
              <g
                key={marker.id}
                className={active ? styles.homeMapPointActive : styles.homeMapPoint}
                transform={`translate(${x} ${y})`}
                role="button"
                tabIndex={0}
                aria-label={marker.title}
                onClick={() => setSelectedId(marker.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setSelectedId(marker.id);
                  }
                }}
              >
                <circle r={active ? 13 : 10} className={styles.homeMapPointHalo} />
                <circle r={active ? 6 : 5} className={styles.homeMapPointCore} />
              </g>
            );
          })}
        </g>
      </svg>

      {selected ? (
        <div className={styles.homeMapCard}>
          <div className={styles.homeMapCardIcon}><MapPin aria-hidden="true" /></div>
          <div>
            <strong>{selected.title}</strong>
            <span>{selected.subtitle}</span>
          </div>
          <Link href={selected.href as Route}>{zh ? "查看 →" : "Open →"}</Link>
        </div>
      ) : null}

      <div className={styles.homeMapLegend}>
        {markers.slice(0, 5).map((marker) => (
          <button
            key={marker.id}
            type="button"
            onClick={() => setSelectedId(marker.id)}
            className={selected?.id === marker.id ? styles.homeMapLegendActive : undefined}
          >
            <span />{marker.title}
          </button>
        ))}
      </div>
    </div>
  );
}
