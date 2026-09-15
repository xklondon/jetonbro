"use client";

import { PhoneShell } from "@/ui/skins/classic/components/PhoneShell";
import { useRouter } from "next/navigation";

export function HomeClient({
  name,
  tables,
}: {
  name: string;
  tables: { id: string; name: string; phase: string }[];
}) {
  const router = useRouter();
  return (
    <PhoneShell>
      <div className="phase-head">
        <strong>Hello {name.split("@")[0]}</strong>
        <span>Keep the same table across hands. Jetons have no built-in cash value.</span>
      </div>
      <main className="felt">
        <div className="setup-list">
          {tables.length === 0 ? (
            <div className="setup-card">No open tables yet.</div>
          ) : (
            tables.map((table) => (
              <button
                key={table.id}
                className="member-row"
                type="button"
                onClick={() => router.push(`/tables/${table.id}`)}
              >
                <div>
                  <strong>{table.name}</strong>
                  <div className="muted">{table.phase.replaceAll("_", " ")}</div>
                </div>
              </button>
            ))
          )}
        </div>
      </main>
      <footer className="dock">
        <button className="gold-button" type="button" onClick={() => router.push("/tables/new")}>
          Create a table
        </button>
      </footer>
    </PhoneShell>
  );
}
