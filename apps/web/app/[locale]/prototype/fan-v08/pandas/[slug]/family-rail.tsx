"use client";

/* eslint-disable @next/next/no-img-element -- prototype family portraits use reviewed external individual media. */

import { ArrowUpRight } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";

import styles from "./family-rail.module.css";

export interface FamilyRailPerson {
  id: string;
  name: string;
  role: string;
  href?: string | null;
  image?: string | null;
}

export interface FamilyRailGroup {
  label: string;
  items: FamilyRailPerson[];
}

interface Props {
  groups: FamilyRailGroup[];
  noPhotoLabel: string;
  ariaLabel: string;
}

function Portrait({
  name,
  image,
  noPhotoLabel,
}: {
  name: string;
  image?: string | null;
  noPhotoLabel: string;
}) {
  return (
    <span className={styles.portrait}>
      {image ? (
        <img src={image} alt="" loading="lazy" />
      ) : (
        <span aria-label={`${name}${noPhotoLabel}`}>{name.slice(0, 1)}</span>
      )}
    </span>
  );
}

export function FamilyRail({ groups, noPhotoLabel, ariaLabel }: Props) {
  const people = [...new Map(
    groups
      .flatMap((group) => group.items)
      .map((person) => [`${person.role}:${person.name.trim().toLocaleLowerCase()}`, person] as const),
  ).values()].slice(0, 6);

  return (
    <div className={styles.composition} data-family-count={people.length}>
      <ul className={styles.grid} aria-label={ariaLabel}>
        {people.map((person) => {
          const content = (
            <>
              <Portrait name={person.name} image={person.image} noPhotoLabel={noPhotoLabel} />
              <span className={styles.personCopy}>
                <small className={styles.role}>{person.role}</small>
                <strong className={styles.name}>{person.name}</strong>
              </span>
              {person.href ? <ArrowUpRight aria-hidden="true" /> : null}
            </>
          );

          return (
            <li key={`${person.role}:${person.id}`}>
              {person.href ? (
                <Link className={styles.person} href={person.href as Route}>
                  {content}
                </Link>
              ) : (
                <div className={styles.person}>{content}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
