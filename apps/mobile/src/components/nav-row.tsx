import type { Href } from "expo-router";

import { ListCell } from "@/components/grouped-list";

/** A grouped row that opens another screen. Put siblings inside one ListSection. */
export function NavRow({
  label,
  detail,
  meta,
  href,
  last,
}: {
  label: string;
  detail?: string;
  meta?: string;
  href: Href;
  last?: boolean;
}) {
  return <ListCell label={label} detail={detail} meta={meta} href={href} last={last} />;
}
