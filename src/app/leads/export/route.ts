import { getCurrentTenantId } from "@/lib/tenant";
import { listLeads, listLeadsByIds, parseFilter } from "@/lib/leads";
import { leadsToCsv } from "@/lib/csv";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const t = await getCurrentTenantId();
  const params = new URL(req.url).searchParams;
  const ids = params.getAll("id").map(Number);
  // Mit Häkchen ausgewählte Leads, sonst alle, die zum Filter passen
  const leads = ids.length
    ? listLeadsByIds(t, ids)
    : listLeads(t, parseFilter(Object.fromEntries(params.entries())), 100000);
  const date = new Date().toISOString().slice(0, 10);
  return new Response(leadsToCsv(leads), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="leads-${date}.csv"`,
    },
  });
}
