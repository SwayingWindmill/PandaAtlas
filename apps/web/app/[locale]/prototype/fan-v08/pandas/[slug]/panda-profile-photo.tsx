"use client";

import { useState } from "react";

export function PandaProfilePhoto({
  src,
  alt,
  name,
  fallbackText,
  fallbackClassName,
  imageClassName,
  loading,
}: {
  src: string | null;
  alt: string;
  name: string;
  fallbackText: string;
  fallbackClassName: string;
  imageClassName?: string;
  loading?: "eager" | "lazy";
}) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className={fallbackClassName} role="img" aria-label={`${name} · ${fallbackText}`}>
        <strong>{name}</strong>
        <span>{fallbackText}</span>
      </div>
    );
  }

  return (
    <img
      className={imageClassName}
      src={src}
      alt={alt}
      loading={loading}
      onError={() => setFailed(true)}
    />
  );
}
