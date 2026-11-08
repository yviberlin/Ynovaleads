"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/", label: "Dashboard" },
  { href: "/suche", label: "Neue Suche" },
  { href: "/leads", label: "Leads" },
  { href: "/roi", label: "ROI-Rechner" },
  { href: "/einstellungen", label: "Wunschkunden-Profil" },
];

export function Nav() {
  const path = usePathname();
  return (
    <nav className="nav" aria-label="Hauptmenü">
      {ITEMS.map((i) => {
        const active = i.href === "/" ? path === "/" : path.startsWith(i.href);
        return (
          <Link key={i.href} href={i.href} className={active ? "active" : undefined}>
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}
