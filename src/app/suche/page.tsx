import { SOURCES, defaultSourceId } from "@/lib/sources";
import { SearchForm } from "./search-form";
import { KNOWN_INDUSTRIES } from "@/lib/sources/osm";

export const dynamic = "force-dynamic";

export default function SuchePage() {
  const sources = SOURCES.map((s) => {
    const a = s.availability();
    return { id: s.id, label: s.label, description: s.description, costs: s.costs, ok: a.ok, reason: a.ok ? undefined : a.reason };
  });
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Neue Suche</h1>
          <p>Sag mir, welche Firmen du suchst und wo. Ich sammle sie für dich.</p>
        </div>
      </div>
      <SearchForm sources={sources} defaultSource={defaultSourceId()} industries={KNOWN_INDUSTRIES} />
    </>
  );
}
