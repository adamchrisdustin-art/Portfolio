"use client";

import { useRef } from "react";

export interface MenuSection {
  id: string;
  label: string;
}

/**
 * A bar that stays at the top of the dashboard page while scrolling: a
 * "Jump to" menu for every section, plus a direct link to the Executive
 * Pulse (Adam, 2026-09-25: the agent roster stays above the Pulse, so the
 * findings need a shortcut instead). Native <details>, so it works before
 * hydration; the click handler only closes it after a jump.
 */
export default function SectionMenu({ sections, primary }: { sections: MenuSection[]; primary: MenuSection }) {
  const menu = useRef<HTMLDetailsElement>(null);
  const close = () => menu.current?.removeAttribute("open");
  return (
    <div className="section-menu">
      <div className="container section-menu-inner">
        <details ref={menu} className="section-menu-details">
          <summary>Jump to</summary>
          <nav aria-label="Sections on this page">
            <ul>
              {sections.map((s) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} onClick={close}>
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </details>
        <a className="section-menu-primary" href={`#${primary.id}`}>
          {primary.label} →
        </a>
      </div>
    </div>
  );
}
