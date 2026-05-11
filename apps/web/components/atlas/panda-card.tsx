import Image from "next/image";
import type { Route } from "next";
import Link from "next/link";
import { ArrowRight, MapPinned } from "lucide-react";
import type { AtlasPandaCard } from "@/lib/atlas-presenters";

export function PandaCard({ panda }: { panda: AtlasPandaCard }) {
  return (
    <Link
      href={panda.href as Route}
      data-testid={`panda-card-link-${panda.slug}`}
      className="group flex h-full flex-col overflow-hidden rounded-[1.45rem] border border-[rgba(47,92,69,0.06)] bg-white shadow-[0_14px_32px_rgba(30,44,31,0.06)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_20px_42px_rgba(30,44,31,0.1)]"
    >
      <div className="relative aspect-[4/3] overflow-hidden">
        <Image
          src={panda.image}
          alt={`${panda.nameZh} 档案照片`}
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
          className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
        />
      </div>

      <div className="flex flex-1 flex-col p-5">
        <h3
          className="text-[1.45rem] leading-8 text-[var(--fg)] transition-colors group-hover:text-[var(--accent)]"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {panda.nameZh}
        </h3>

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-[var(--muted)]">
          {panda.nameEn ? <span>{panda.nameEn}</span> : null}
          <span>
            {panda.genderLabel} / {panda.ageStageLabel}
          </span>
        </div>

        <p className="mt-3 flex items-center gap-1.5 text-sm font-medium text-[var(--accent)]">
          <MapPinned className="h-4 w-4" />
          {panda.locationShort}
        </p>

        <p
          className="mt-3 text-sm leading-7 text-[var(--muted)]"
          style={{
            display: "-webkit-box",
            overflow: "hidden",
            WebkitBoxOrient: "vertical",
            WebkitLineClamp: 1,
          }}
        >
          {panda.summary}
        </p>

        <div className="mt-auto border-t border-[rgba(47,92,69,0.08)] pt-4">
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--accent)]">
            查看档案
            <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </Link>
  );
}
