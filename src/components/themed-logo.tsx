"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import Image from "next/image";

export function ThemedLogo({ className }: { className?: string }) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const src =
    mounted && resolvedTheme === "dark"
      ? "/admx-logo-gold.png"
      : "/admx-logo-ink.png";

  return (
    <Image
      src={src}
      alt="Admx Dev"
      width={1037}
      height={608}
      priority
      className={className}
    />
  );
}
