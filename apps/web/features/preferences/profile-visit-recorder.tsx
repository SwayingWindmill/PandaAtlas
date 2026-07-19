"use client";

import { useEffect } from "react";
import { recordRecentProfile } from "@/features/preferences/profile-preferences";

interface ProfileVisitRecorderProps {
  stableId: string;
  slug: string;
}

export function ProfileVisitRecorder({ stableId, slug }: ProfileVisitRecorderProps) {
  useEffect(() => {
    recordRecentProfile(stableId, [{ id: stableId, aliases: [slug] }]);
  }, [slug, stableId]);

  return null;
}
