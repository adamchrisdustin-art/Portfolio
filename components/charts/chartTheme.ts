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

/**
 * Shared chart-title style, used by every chart component so a global
 * size/spacing change (e.g. Adam's 2026-09 feedback: bigger titles, more
 * breathing room before the chart itself) happens once, not per-file.
 */
export const CHART_TITLE_STYLE = {
  fontSize: "0.92rem",
  color: INK_SECONDARY,
  marginBottom: 12,
} as const;

/**
 * Shared scroll-wrapper style for any chart wider than its card (see
 * DASHBOARD_BLUEPRINT.md's chart conventions). Deliberately does NOT use
 * `display: flex; justifyContent: "center"` on the scroll container - a
 * real bug (caught from Adam's screenshots showing labels like
 * "Diagnostic Radiology" and "UnitedHealth Group, Inc." clipped on their
 * left edge): centering an overflowing flex child leaves the initial
 * scrollLeft centered rather than 0, permanently hiding the left portion
 * of any chart wider than its container (scrollLeft can't go negative).
 * `margin: "0 auto"` on the child instead centers a chart that fits
 * without that side effect, and naturally starts a scrollable chart at
 * its left edge (labels visible first, then scroll right for more).
 */
export const CHART_SCROLL_WRAPPER_STYLE = {
  overflowX: "auto",
} as const;

export const CHART_CENTERED_CHILD_STYLE = {
  display: "block",
  margin: "0 auto",
} as const;
