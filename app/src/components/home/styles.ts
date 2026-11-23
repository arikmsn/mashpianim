// Class recipes of the home page (design package v3 "Pop warm"). Pill buttons 48px tall, display headings
// Rubik 900 with tight tracking, mono tags for digits and Latin only. No Hebrew here: texts come from the
// content registry.

export const pill = "inline-flex items-center justify-center gap-2 h-12 px-6 rounded-full font-semibold text-[15px] leading-none transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring";
export const pillPrimary = `${pill} bg-primary text-white hover:bg-primary-hover`;
export const pillCreator = `${pill} bg-lemon-400 text-ink-900 hover:bg-lemon-300`;
export const pillDark = `${pill} bg-surface-ink text-on-ink hover:opacity-90`;
export const pillInkLemon = `${pill} bg-surface-ink text-lemon-400 hover:opacity-90`;
export const pillOutline = `${pill} border-[1.5px] border-border-strong text-ink-900 hover:border-ink-900`;
export const pillOutlineLight = `${pill} border-[1.5px] border-white/40 text-on-ink hover:border-on-ink`;
export const pillSmall = "h-10 px-4 text-sm";

export const display = "font-display text-ink-900";
export const eyebrow = "inline-flex items-center gap-2 text-xs font-medium tracking-[1.2px] text-ink-700 before:content-[''] before:w-1.5 before:h-1.5 before:rounded-full before:bg-lemon-400";
export const eyebrowLight = "inline-flex items-center gap-2 text-xs font-medium tracking-[1.2px] text-lemon-400 before:content-[''] before:w-1.5 before:h-1.5 before:rounded-full before:bg-lemon-400";
export const mono = "font-mono tabular-nums";

// IBM Plex Mono is for digits and Latin only: a tag the admin wrote in Hebrew falls back to Rubik
export const isMonoText = (text: string) => /^[\x20-\x7E·₪–—]*$/.test(text);
export const tagClass = (text: string) => (isMonoText(text) ? mono : "tabular-nums");
export const container = "mx-auto w-full max-w-[1200px] px-4 md:px-6";
export const bento = "relative overflow-hidden rounded-3xl border border-border bg-surface p-6 md:p-8";
