import type { Metadata } from "next";

import { OfficialVideoAuditionClient } from "@/components/blocks/zhipanda/official-video-audition-client";
import {
  OFFICIAL_PANDA_VIDEO_SHOT_POOL,
  OFFICIAL_PANDA_VIDEO_SHOT_POOL_SEGMENT_COUNT,
  OFFICIAL_PANDA_VIDEO_SHOT_POOL_SOURCE_COUNT,
  OFFICIAL_PANDA_VIDEO_SHOT_POOL_SOURCE_SHOT_COUNT,
} from "@/features/home/official-video-shot-pool";

export const metadata: Metadata = {
  title: "ZhiPanda Official Video Audition",
  description: "Internal review surface for official panda video candidates.",
};

export default async function MediaAuditionPage({
  params,
}: {
  params: Promise<{ locale: "zh" | "en" }>;
}) {
  const { locale } = await params;
  const zh = locale === "zh";

  return (
    <main className="min-h-screen bg-[#0b1715] px-4 py-10 text-[#fffff2] sm:px-6 lg:px-10">
      <div className="mx-auto max-w-[92rem]">
        <header className="mb-8 max-w-4xl">
          <p className="mb-3 text-sm font-semibold text-[#fbff36]">
            {zh ? "内部选片台" : "Internal video audition"}
          </p>
          <h1 className="font-[var(--font-display)] text-5xl font-[780] tracking-[-0.05em] sm:text-7xl">
            {zh ? "官方熊猫视频镜头全集" : "Official panda video shot pool"}
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-7 text-white/68">
            {zh
              ? `当前完整池包含 ${OFFICIAL_PANDA_VIDEO_SHOT_POOL_SOURCE_COUNT} 条去重后的官方视频源、${OFFICIAL_PANDA_VIDEO_SHOT_POOL_SOURCE_SHOT_COUNT} 个熊猫主体 source shots、${OFFICIAL_PANDA_VIDEO_SHOT_POOL_SEGMENT_COUNT} 个可直接用于 Hero 的片段。候选先通过首/中/尾三帧 COCO + MobileNet 熊猫主体筛选，再对人物做每 0.75 秒密集扫描；出现人物、片头、空景、熊猫占比过小和重复上传的镜头不会进入这个池。单个 source shot 超过 8 秒时不会在镜头中间硬切；过短镜头只与相邻且同样合格的 source shot 组合，并完整保留原视频的 cut。`
              : `The full pool contains ${OFFICIAL_PANDA_VIDEO_SHOT_POOL_SOURCE_COUNT} deduplicated official sources, ${OFFICIAL_PANDA_VIDEO_SHOT_POOL_SOURCE_SHOT_COUNT} panda-primary source shots and ${OFFICIAL_PANDA_VIDEO_SHOT_POOL_SEGMENT_COUNT} Hero-ready ranges. Candidates pass COCO + MobileNet panda checks at the start, middle and end, followed by a dense person scan every 0.75 seconds. Shots with people, intros, empty scenes, tiny panda appearances or duplicate uploads are excluded. Source shots longer than 8 seconds are not cut artificially; very short adjacent accepted shots may be grouped while preserving every original source cut.`}
          </p>
        </header>

        <OfficialVideoAuditionClient
          candidates={OFFICIAL_PANDA_VIDEO_SHOT_POOL}
          locale={locale}
        />
      </div>
    </main>
  );
}
