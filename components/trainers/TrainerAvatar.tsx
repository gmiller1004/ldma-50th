"use client";

import { useState } from "react";
import Image from "next/image";
import { isOptimizableImage, nonEmpty, trainerInitials } from "./format";

type TrainerAvatarProps = {
  name: string;
  photoUrl: string | null;
  /** Empty string marks the photo as decorative (the name is in adjacent text). */
  alt: string;
  sizes: string;
  priority?: boolean;
  frame?: "card" | "profile";
  imageClassName?: string;
  className?: string;
};

const FRAME = {
  card: "aspect-[4/3] w-full shrink-0",
  profile:
    "mx-auto aspect-[3/4] w-full max-w-72 shrink-0 rounded-2xl border border-[#d4af37]/35 shadow-[0_22px_50px_-32px_rgba(212,175,55,0.65)] md:mx-0 md:w-72",
} as const;

export function TrainerAvatar({
  name,
  photoUrl,
  alt,
  sizes,
  priority = false,
  frame = "card",
  imageClassName = "object-cover object-top",
  className = "",
}: TrainerAvatarProps) {
  const src = nonEmpty(photoUrl) ?? "";
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showPhoto = Boolean(src) && failedSrc !== src;
  const initials = trainerInitials(name);
  const monogram =
    frame === "profile" ? "h-36 w-36 text-5xl" : "h-24 w-24 text-4xl sm:h-28 sm:w-28 sm:text-5xl";

  return (
    <div className={`relative overflow-hidden bg-[#0f3d1e] ${FRAME[frame]} ${className}`}>
      {showPhoto ? (
        isOptimizableImage(src) ? (
          <Image
            src={src}
            alt={alt}
            fill
            sizes={sizes}
            priority={priority}
            className={imageClassName}
            onError={() => setFailedSrc(src)}
          />
        ) : (
          // Hosts outside next.config remotePatterns cannot go through next/image.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={alt}
            className={`absolute inset-0 h-full w-full ${imageClassName}`}
            onError={() => setFailedSrc(src)}
          />
        )
      ) : (
        <div
          className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(ellipse_at_center,rgba(212,175,55,0.2),transparent_58%),linear-gradient(165deg,#163528_0%,#1a120b_74%)]"
          role={alt ? "img" : undefined}
          aria-label={alt || undefined}
          aria-hidden={alt ? undefined : true}
        >
          <div
            className={`flex items-center justify-center rounded-full border border-[#d4af37]/55 bg-[#0f3d1e]/80 shadow-[inset_0_0_0_7px_rgba(15,10,6,0.35)] ${monogram}`}
          >
            <span className="font-serif font-semibold tracking-wide text-[#f0d48f]">{initials}</span>
          </div>
        </div>
      )}
    </div>
  );
}
