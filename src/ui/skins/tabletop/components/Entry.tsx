"use client";

import { useState } from "react";
import { Shell } from "./Shell";

/** Simple sign-in / join entry form on the felt. */
export function Entry({
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
    <Shell
      feltClassName="tt-entry"
      rail={
        <div className="tt-muted tt-center">Virtual jetons only. Cards and any cash stay at the physical table.</div>
      }
    >
      <div className="tt-entry-head">
        <h1>{title}</h1>
        <p>{copy}</p>
      </div>
      <form
        className="tt-entry-form"
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
        {notice ? <div className="tt-error">{notice}</div> : null}
        {requireEmail ? (
          <input
            className="tt-input"
            type="email"
            name="email"
            autoComplete="email"
            placeholder="Email"
            aria-label="Email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        ) : null}
        {extraFields?.map((field) => (
          <input
            key={field.name}
            className="tt-input"
            name={field.name}
            type={field.type ?? "text"}
            placeholder={field.placeholder ?? field.label}
            aria-label={field.label}
            value={extra[field.name] ?? ""}
            onChange={(event) => setExtra((current) => ({ ...current, [field.name]: event.target.value }))}
            required
          />
        ))}
        <button className="tt-btn gold" type="submit" disabled={pending}>
          {pending ? "Please wait" : actionLabel}
        </button>
      </form>
    </Shell>
  );
}
