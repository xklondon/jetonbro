"use client";

import { useState } from "react";
import { PhoneShell } from "./PhoneShell";

export function ClassicEntry({
  title,
  copy,
  actionLabel,
  onSubmit,
  notice,
  extraFields,
  requireEmail = true,
}: {
  title: string;
  copy: string;
  actionLabel: string;
  onSubmit: (fields: Record<string, string>) => Promise<void> | void;
  notice?: string | null;
  extraFields?: { name: string; label: string; type?: string; placeholder?: string }[];
  requireEmail?: boolean;
}) {
  const [email, setEmail] = useState("");
  const [extra, setExtra] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);

  return (
    <PhoneShell>
      <div className="phase-head">
        <strong>{title}</strong>
        <span>{copy}</span>
      </div>
      <main className="felt">
        <form
          className="entry-form"
          onSubmit={async (event) => {
            event.preventDefault();
            setPending(true);
            try {
              await onSubmit({ email, ...extra });
            } finally {
              setPending(false);
            }
          }}
        >
          {notice ? <div className="error">{notice}</div> : null}
          {requireEmail ? (
          <input
            type="email"
            name="email"
            autoComplete="email"
            placeholder="Email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          ) : null}
          {extraFields?.map((field) => (
            <input
              key={field.name}
              name={field.name}
              type={field.type ?? "text"}
              placeholder={field.placeholder ?? field.label}
              value={extra[field.name] ?? ""}
              onChange={(event) => setExtra((current) => ({ ...current, [field.name]: event.target.value }))}
            />
          ))}
          <button className="gold-button" type="submit" disabled={pending}>
            {pending ? "Please wait" : actionLabel}
          </button>
        </form>
      </main>
      <footer className="dock">
        <div className="muted" style={{ textAlign: "center" }}>
          Virtual jetons only. Cards and any cash stay at the physical table.
        </div>
      </footer>
    </PhoneShell>
  );
}
