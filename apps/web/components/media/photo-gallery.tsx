"use client";

import * as React from "react";
import { RowsPhotoAlbum, type Photo } from "react-photo-album";
import Lightbox from "yet-another-react-lightbox";
import Captions from "yet-another-react-lightbox/plugins/captions";
import Zoom from "yet-another-react-lightbox/plugins/zoom";

import "react-photo-album/rows.css";
import "yet-another-react-lightbox/styles.css";
import "yet-another-react-lightbox/plugins/captions.css";

import { cn } from "@/lib/utils";

export interface PhotoGalleryItem extends Photo {
  caption?: string | null;
}

interface PhotoGalleryProps {
  photos: PhotoGalleryItem[];
  openLabel?: string;
  className?: string;
  targetRowHeight?: number;
}

export function PhotoGallery({
  photos,
  openLabel = "Open photo",
  className,
  targetRowHeight = 240,
}: PhotoGalleryProps) {
  const [index, setIndex] = React.useState(-1);
  const slides = React.useMemo(
    () => photos.map((photo) => ({
      src: photo.src,
      width: photo.width,
      height: photo.height,
      alt: photo.alt,
      title: photo.alt,
      description: photo.caption ?? undefined,
    })),
    [photos],
  );

  if (!photos.length) return null;

  return (
    <div className={cn("[&_.react-photo-album--button]:overflow-hidden [&_.react-photo-album--image]:h-full [&_.react-photo-album--image]:w-full [&_.react-photo-album--image]:object-cover", className)}>
      <RowsPhotoAlbum
        photos={photos}
        spacing={8}
        targetRowHeight={(containerWidth) => containerWidth < 600 ? Math.min(160, targetRowHeight) : targetRowHeight}
        rowConstraints={{ singleRowMaxHeight: Math.max(280, targetRowHeight + 60) }}
        onClick={({ index: nextIndex }) => setIndex(nextIndex)}
        componentsProps={{ button: { "aria-label": openLabel } }}
      />
      <Lightbox
        open={index >= 0}
        index={Math.max(0, index)}
        close={() => setIndex(-1)}
        slides={slides}
        plugins={[Zoom, Captions]}
        controller={{ closeOnBackdropClick: true }}
        carousel={{ finite: false }}
        styles={{ container: { backgroundColor: "rgba(11, 17, 13, 0.96)" } }}
      />
    </div>
  );
}
