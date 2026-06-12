"use client";

import { useState, useEffect, useRef } from "react";

interface Props {
  images: string[];
  alt: string;
}

export function ProductImageCarousel({ images, alt }: Props) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const hasCarousel = images.length > 1;

  useEffect(() => {
    if (!hasCarousel || paused) return;
    intervalRef.current = setInterval(() => {
      setActiveIdx((i) => (i + 1) % images.length);
    }, 2500);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [hasCarousel, paused, images.length]);

  if (images.length === 0) {
    return (
      <div className="w-full h-32 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground text-xs">
        Sem imagem
      </div>
    );
  }

  return (
    <div
      className="relative w-full h-32 rounded-lg bg-secondary overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {images.map((src, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={src}
          src={src}
          alt={i === 0 ? alt : `${alt} — variante ${i + 1}`}
          className="absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ease-in-out"
          style={{ opacity: i === activeIdx ? 1 : 0 }}
        />
      ))}
      {hasCarousel && (
        <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1 pointer-events-none">
          {images.map((_, i) => (
            <span
              key={i}
              className={`w-1.5 h-1.5 rounded-full transition-all ${
                i === activeIdx ? "bg-white scale-125" : "bg-white/50"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
