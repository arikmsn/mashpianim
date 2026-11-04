"use client";

import { motion } from "framer-motion";

// Re-mounts per navigation so every page gets a quick fade-in.
// Opacity only — a transform here would break position:fixed children (modals, chat view).
export default function AppTemplate({ children }: { children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.08, ease: "easeOut" }}>
      {children}
    </motion.div>
  );
}
