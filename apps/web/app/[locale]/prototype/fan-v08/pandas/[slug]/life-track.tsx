"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useMemo, useRef, useState } from "react";

import styles from "./life-track.module.css";

export interface LifeTrackEvent {
  id: string;
  date: string;
  title: string;
  category?: string | null;
}

export interface LifeTrackRange {
  id: string;
  label: string;
  startDate: string;
  endDate?: string | null;
}

interface Props {
  events: LifeTrackEvent[];
  ranges?: LifeTrackRange[];
  birthDate?: string | null;
  asOfDate?: string | null;
  locale: "zh" | "en";
}

const YEAR_MS = 365.2425 * 24 * 60 * 60 * 1000;

function dateValue(value: string): number {
  const normalized = /^\d{4}$/.test(value) ? `${value}-01-01` : /^\d{4}-\d{2}$/.test(value) ? `${value}-01` : value;
  const time = Date.parse(`${normalized}T00:00:00Z`);
  return Number.isNaN(time) ? 0 : time;
}

function formatDate(value: string, locale: "zh" | "en"): string {
  const time = dateValue(value);
  if (!time) return value;
  const precision = value.split("-").length;
  return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
    year: "numeric",
    ...(precision >= 2 ? { month: "short" as const } : {}),
    ...(precision >= 3 ? { day: "numeric" as const } : {}),
    timeZone: "UTC",
  }).format(new Date(time));
}

function ageLabel(date: string, birthDate: string | null | undefined, locale: "zh" | "en"): string | null {
  if (!birthDate) return null;
  const eventTime = dateValue(date);
  const birthTime = dateValue(birthDate);
  if (!eventTime || !birthTime || eventTime < birthTime) return null;
  const years = (eventTime - birthTime) / YEAR_MS;
  if (years < 1) {
    const months = Math.max(0, Math.floor(years * 12));
    return locale === "zh" ? `${months}个月` : `${months} mo`;
  }
  const wholeYears = Math.floor(years);
  return locale === "zh" ? `${wholeYears}岁` : `Age ${wholeYears}`;
}

function categoryLabel(category: string | null | undefined, locale: "zh" | "en"): string | null {
  if (!category) return null;
  const zh = locale === "zh";
  const labels: Record<string, [string, string]> = {
    birth: ["出生", "Birth"],
    birth_event: ["出生", "Birth"],
    transfer: ["迁居", "Move"],
    capture: ["被捕获", "Captured"],
    location: ["地点", "Place"],
    residency_history: ["居住", "Residence"],
    public_debut: ["亮相", "Public debut"],
    reproduction: ["繁育", "Breeding"],
    maternal_care: ["育幼", "Parenting"],
    health: ["健康", "Health"],
    veterinary_care: ["医疗", "Veterinary care"],
    milestone: ["重要时刻", "Milestone"],
    rescue: ["救护", "Rescue"],
    release: ["放归", "Release"],
    wild_monitoring: ["野外追踪", "Wild follow-up"],
    rewilding: ["野化", "Rewilding"],
    conservation: ["保护", "Conservation"],
    research: ["科研", "Research"],
    diplomacy: ["交流", "Diplomacy"],
    death: ["离世", "Death"],
  };
  const value = labels[category];
  return value ? value[zh ? 0 : 1] : null;
}

export function LifeTrack({ events, ranges = [], birthDate, asOfDate, locale }: Props) {
  const reduceMotion = useReducedMotion();
  const trackRef = useRef<HTMLDivElement>(null);
  const sortedEvents = useMemo(
    () => [...events].filter((event) => dateValue(event.date)).sort((left, right) => left.date.localeCompare(right.date)),
    [events],
  );
  const validRanges = useMemo(
    () => ranges.filter((range) => dateValue(range.startDate)),
    [ranges],
  );
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selected = sortedEvents[selectedIndex] ?? null;

  const scale = useMemo(() => {
    const openRangeEnd = asOfDate ? dateValue(asOfDate) : 0;
    const values = [
      ...sortedEvents.map((event) => dateValue(event.date)),
      ...validRanges.map((range) => dateValue(range.startDate)),
      ...validRanges.map((range) => range.endDate ? dateValue(range.endDate) : 0),
      openRangeEnd,
    ].filter(Boolean);
    if (!values.length) return null;
    const min = Math.min(...values);
    let max = Math.max(...values);
    if (max <= min) max = min + YEAR_MS;
    const spanYears = Math.max(1, (max - min) / YEAR_MS);
    const width = Math.min(2800, Math.max(760, sortedEvents.length * 150, spanYears * 46));
    const pct = (time: number) => Math.min(98, Math.max(2, ((time - min) / (max - min)) * 96 + 2));
    return { min, max, width, pct };
  }, [sortedEvents, validRanges, asOfDate]);

  const eventPositions = useMemo(() => {
    if (!scale || !sortedEvents.length) return [];
    const minX = 56;
    const maxX = scale.width - 56;
    const minGap = 112;
    const positions = sortedEvents.map((event) => (scale.pct(dateValue(event.date)) / 100) * scale.width);

    positions[0] = Math.max(minX, positions[0]);
    for (let index = 1; index < positions.length; index += 1) {
      positions[index] = Math.max(positions[index], positions[index - 1] + minGap);
    }
    if (positions.at(-1)! > maxX) {
      positions[positions.length - 1] = maxX;
      for (let index = positions.length - 2; index >= 0; index -= 1) {
        positions[index] = Math.min(positions[index], positions[index + 1] - minGap);
      }
    }
    if (positions[0] < minX) {
      positions[0] = minX;
      for (let index = 1; index < positions.length; index += 1) {
        positions[index] = Math.max(positions[index], positions[index - 1] + minGap);
      }
    }
    return positions;
  }, [scale, sortedEvents]);

  function select(index: number) {
    if (!sortedEvents.length) return;
    const next = Math.min(Math.max(index, 0), sortedEvents.length - 1);
    setSelectedIndex(next);
    const node = trackRef.current?.querySelector<HTMLElement>(`[data-life-event-index="${next}"]`);
    node?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "nearest", inline: "center" });
  }

  if (!selected || !scale) return null;

  return (
    <div className={styles.lifeTrack}>
      <div className={styles.trackViewport} ref={trackRef}>
        <div className={styles.trackCanvas} style={{ width: `${scale.width}px` }}>
          {validRanges.length ? (
            <div className={styles.rangeLane} aria-label={locale === "zh" ? "生活地点区间" : "Residence periods"}>
              {validRanges.map((range) => {
                const left = scale.pct(dateValue(range.startDate));
                const endTime = range.endDate ? dateValue(range.endDate) : scale.max;
                const right = scale.pct(endTime);
                const width = Math.max(3, right - left);
                return (
                  <div
                    key={range.id}
                    className={`${styles.rangeBand} ${!range.endDate ? styles.rangeBandOpen : ""}`}
                    style={{ left: `${left}%`, width: `${width}%` }}
                    title={`${range.label} · ${formatDate(range.startDate, locale)}${range.endDate ? ` — ${formatDate(range.endDate, locale)}` : locale === "zh" ? " — 至今" : " — present"}`}
                  >
                    <span>{range.label}</span>
                  </div>
                );
              })}
            </div>
          ) : null}

          <div className={styles.trackRail} aria-hidden="true" />
          {sortedEvents.map((event, index) => {
            const active = index === selectedIndex;
            return (
              <button
                key={event.id}
                type="button"
                className={`${styles.eventNode} ${active ? styles.eventNodeActive : ""}`}
                style={{ left: `${eventPositions[index] ?? 56}px` }}
                onClick={() => select(index)}
                data-life-event-index={index}
                aria-pressed={active}
              >
                <span className={styles.eventDate}>{event.date.slice(0, 4)}</span>
                <span className={styles.eventDot} aria-hidden="true" />
                <span className={styles.eventTitle}>{categoryLabel(event.category, locale) ?? (locale === "zh" ? "经历" : "Event")}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className={styles.detailBar}>
        <button type="button" onClick={() => select(selectedIndex - 1)} disabled={selectedIndex === 0} aria-label={locale === "zh" ? "上一条经历" : "Previous life event"}>
          <ChevronLeft aria-hidden="true" />
        </button>
        <motion.div
          key={selected.id}
          className={styles.selectedEvent}
          initial={reduceMotion ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.22, ease: "easeOut" }}
        >
          <div className={styles.selectedMeta}>
            <time dateTime={selected.date}>{formatDate(selected.date, locale)}</time>
            {ageLabel(selected.date, birthDate, locale) ? <span>{ageLabel(selected.date, birthDate, locale)}</span> : null}
            {categoryLabel(selected.category, locale) ? <span>{categoryLabel(selected.category, locale)}</span> : null}
          </div>
          <p>{selected.title}</p>
        </motion.div>
        <button type="button" onClick={() => select(selectedIndex + 1)} disabled={selectedIndex === sortedEvents.length - 1} aria-label={locale === "zh" ? "下一条经历" : "Next life event"}>
          <ChevronRight aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
