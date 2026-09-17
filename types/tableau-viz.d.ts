// Tableau's Embedding API v3 custom element (<tableau-viz>) isn't a
// standard HTML element, so JSX needs to be told it exists. React 19's
// types nest the JSX namespace inside the "react" module itself (not
// globally), so that's what has to be augmented here - see
// components/TableauEmbed.tsx for where it's loaded and used.
import type { DetailedHTMLProps, HTMLAttributes } from "react";

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "tableau-viz": DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & {
        src?: string;
        toolbar?: "top" | "bottom" | "hidden";
        device?: "desktop" | "tablet" | "phone";
        "hide-tabs"?: string;
      };
    }
  }
}

export {};
