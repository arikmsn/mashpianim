"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

// The one entrance the home page allows: rise 16px + fade, 0.5s, once, staggered by `delay`. Reduced motion
// turns it off (the content is simply there).
export function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}
