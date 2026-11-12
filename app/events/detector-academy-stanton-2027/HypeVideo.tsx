"use client";

import { useRef, useState } from "react";
import { Pause, Play, Volume2, VolumeX } from "lucide-react";
import { DETECTOR_ACADEMY_HYPE_VIDEO, DETECTOR_ACADEMY_NAME } from "@/lib/detector-academy";

export function HypeVideo() {
  const ref = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [paused, setPaused] = useState(false);

  function toggleSound() {
    const v = ref.current;
    if (!v) return;
    v.muted = !v.muted;
    if (!v.muted) {
      v.currentTime = 0;
      void v.play();
    }
    setMuted(v.muted);
  }

  function togglePlay() {
    const v = ref.current;
    if (!v) return;
    if (v.paused) void v.play();
    else v.pause();
  }

  return (
    <section className="bg-black">
      <div className="relative mx-auto w-full max-w-[min(100%,calc(80vh*16/9))] aspect-video">
        <video
          ref={ref}
          className="absolute inset-0 h-full w-full object-cover"
          src={DETECTOR_ACADEMY_HYPE_VIDEO.src}
          poster={DETECTOR_ACADEMY_HYPE_VIDEO.poster}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          aria-label={`${DETECTOR_ACADEMY_NAME} trailer`}
          onPlay={() => setPaused(false)}
          onPause={() => setPaused(true)}
        />
        <div className="absolute bottom-2 right-2 md:bottom-5 md:right-5 flex gap-1.5 md:gap-2">
          <button
            type="button"
            onClick={togglePlay}
            aria-label={paused ? "Play video" : "Pause video"}
            className="inline-flex items-center justify-center w-8 h-8 md:w-11 md:h-11 rounded-full bg-black/60 backdrop-blur border border-[#d4af37]/50 text-[#f0d48f] hover:bg-black/80 transition-colors"
          >
            {paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={toggleSound}
            className="inline-flex items-center gap-1.5 md:gap-2 h-8 md:h-11 px-3 md:px-4 rounded-full bg-black/60 backdrop-blur border border-[#d4af37]/50 text-xs md:text-sm font-semibold text-[#f0d48f] hover:bg-black/80 transition-colors"
          >
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            {muted ? "Tap for sound" : "Mute"}
          </button>
        </div>
      </div>
    </section>
  );
}
