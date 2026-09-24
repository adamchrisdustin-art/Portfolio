/**
 * Chart color roles. Magnitude charts (bar, boxplot) use this site's
 * existing amber accent via CSS custom properties (already swaps for
 * dark mode in app/globals.css) - per the dataviz skill's "compare
 * magnitude -> one hue" rule, and keeps charts feeling like part of the
 * same product rather than a bolted-on generic chart library.
 *
 * Identity/part-to-whole charts (donut, 2+ categories) need real
 * distinguishable hues - these use the dataviz skill's validated
 * categorical order (references/palette.md), light-mode values only for
 * simplicity; a full light/dark-tuned categorical set would need
 * re-running the CVD validator per mode, out of scope for this pass.
 */

export const MAGNITUDE_HUE = "var(--accent-strong)";

export const CATEGORICAL = [
  "#2a78d6", // blue
  "#eb6834", // orange
  "#1baf7a", // aqua
  "#eda100", // yellow
  "#e87ba4", // magenta
  "#4a3aa7", // violet
];

export const INK_PRIMARY = "var(--text)";
export const INK_SECONDARY = "var(--text-muted)";
export const GRIDLINE = "var(--border)";
