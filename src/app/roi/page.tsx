import { getCurrentTenantId } from "@/lib/tenant";
import { countLeads, statusCounts } from "@/lib/leads";
import { RoiCalculator, type RealNumbers } from "./roi-calculator";

export const dynamic = "force-dynamic";

export default async function RoiPage() {
  const t = await getCurrentTenantId();
  const total = countLeads(t);
  const c = statusCounts(t);
  const contacted = (c.kontaktiert ?? 0) + (c.termin ?? 0) + (c.kunde ?? 0) + (c.kein_interesse ?? 0);
  const real: RealNumbers = { total, contacted, meetings: (c.termin ?? 0) + (c.kunde ?? 0), customers: c.kunde ?? 0 };
  return (
    <>
      <div className="page-head">
        <div>
          <h1>ROI-Rechner</h1>
          <p>Was bringen dir deine Leads? Trag deine Werte ein, das Ergebnis rechnet sich sofort.</p>
        </div>
      </div>
      <RoiCalculator real={real} />
    </>
  );
}
