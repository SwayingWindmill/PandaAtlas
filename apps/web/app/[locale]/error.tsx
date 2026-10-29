"use client";

import { useEffect } from "react";

import { PublicUnavailableMessage } from "@/features/public-content/public-unavailable-message";

export default function PublicErrorState({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <PublicUnavailableMessage
      action={<button type="button" onClick={reset}>重新尝试 / Try again</button>}
    />
  );
}
