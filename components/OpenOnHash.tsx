"use client";

import { useEffect } from "react";

/** Findings live inside closed <details>; open every ancestor of the #hash target so anchor links land on something visible. */
export default function OpenOnHash() {
  useEffect(() => {
    const open = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      const target = id ? document.getElementById(id) : null;
      if (!target) return;
      for (let el: HTMLElement | null = target; el; el = el.parentElement) {
        if (el instanceof HTMLDetailsElement) el.open = true;
      }
      target.querySelector("details")?.setAttribute("open", "");
      target.scrollIntoView();
    };
    open();
    window.addEventListener("hashchange", open);
    return () => window.removeEventListener("hashchange", open);
  }, []);
  return null;
}
