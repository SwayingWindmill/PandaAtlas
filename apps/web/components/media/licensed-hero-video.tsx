import { cn } from "@/lib/utils";

export interface LicensedHeroVideoProps {
  src: string;
  poster?: string | null;
  className?: string;
  videoClassName?: string;
  creditClassName?: string;
  mobilePosterOnly?: boolean;
  mediaType?: string;
  credit: string;
  creditHref: string;
  license: string;
  licenseHref: string;
}

export function LicensedHeroVideo({
  src,
  poster,
  className,
  videoClassName,
  creditClassName,
  mobilePosterOnly = true,
  mediaType = "video/webm",
  credit,
  creditHref,
  license,
  licenseHref,
}: LicensedHeroVideoProps) {
  return (
    <div className={cn("relative size-full overflow-hidden", className)}>
      {mobilePosterOnly && poster ? (
        <div
          className="absolute inset-0 bg-cover bg-center md:hidden"
          style={{ backgroundImage: `url("${poster}")` }}
          aria-hidden="true"
        />
      ) : null}
      <video
        className={cn(
          "size-full object-cover",
          mobilePosterOnly && poster ? "hidden md:block" : null,
          videoClassName,
        )}
        poster={poster ?? undefined}
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        aria-hidden="true"
        tabIndex={-1}
      >
        <source
          src={src}
          type={mediaType}
          media={mobilePosterOnly ? "(min-width: 768px)" : undefined}
        />
      </video>
      <div className={cn("absolute bottom-3 right-3 z-10 rounded-full bg-black/45 px-2.5 py-1 text-[10px] leading-4 text-white/80 backdrop-blur-sm", creditClassName)}>
        <a href={creditHref} target="_blank" rel="noreferrer" className="hover:text-white">
          {credit}
        </a>
        <span aria-hidden="true"> · </span>
        <a href={licenseHref} target="_blank" rel="noreferrer" className="hover:text-white">
          {license}
        </a>
      </div>
    </div>
  );
}
