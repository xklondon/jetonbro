"use client";

export function DealerRow({ name, status }: { name: string; status?: string }) {
  return (
    <div className="dealer-spot" data-dealer-row="true">
      DEALER · {name}
      {status ? <span className="muted"> {status}</span> : null}
    </div>
  );
}
