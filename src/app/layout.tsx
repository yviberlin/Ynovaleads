import type { Metadata } from "next";
import "./globals.css";
import { Nav } from "./nav";

export const metadata: Metadata = {
  title: "Ynovaleads",
  description: "B2B-Leads finden, bewerten und verwalten",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: Browser-Erweiterungen ändern oft Attribute an <html>/<body>,
    // das soll keine Fehlermeldung auslösen
    <html lang="de" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700;12..96,800&family=Figtree:wght@400;500;600&family=Barlow+Condensed:wght@600;700&display=swap"
        />
      </head>
      <body suppressHydrationWarning>
        <div className="shell">
          <aside className="side">
            <a href="/" className="logo" aria-label="Ynovaleads, zum Dashboard">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.svg" alt="" className="logo-mark" width={888} height={706} />
              <span className="logo-word">YNOVALEADS</span>
            </a>
            <Nav />
            <div className="side-foot">Master-Version</div>
          </aside>
          <main className="main">{children}</main>
        </div>
      </body>
    </html>
  );
}
