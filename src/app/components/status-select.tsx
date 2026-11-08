"use client";

import { useTransition } from "react";
import { setLeadStatus } from "@/lib/actions";
import { LEAD_STATUSES } from "@/lib/status";

export function StatusSelect({ id, status }: { id: number; status: string }) {
  const [pending, start] = useTransition();
  return (
    <select
      aria-label="Status ändern"
      className={`status-select st-${status}`}
      defaultValue={status}
      disabled={pending}
      onChange={(e) => {
        const v = e.target.value;
        e.target.className = `status-select st-${v}`;
        start(() => setLeadStatus(id, v));
      }}
    >
      {LEAD_STATUSES.map((s) => (
        <option key={s.id} value={s.id}>{s.label}</option>
      ))}
    </select>
  );
}
