import { getCurrentTenantId } from "@/lib/tenant";
import { listLeads, parseFilter } from "@/lib/leads";
import { leadsToCsv } from "@/lib/csv";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const t = await getCurrentTenantId();
  const sp = Object.fromEntries(new URL(req.url).searchParams.entries());
  const leads = listLeads(t, parseFilter(sp), 100000);
  const date = new Date().toISOString().slice(0, 10);
  return new Response(leadsToCsv(leads), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="leads-${date}.csv"`,
    },
  });
}
