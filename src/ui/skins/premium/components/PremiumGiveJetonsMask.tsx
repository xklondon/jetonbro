"use client";

import { useEffect, useState } from "react";
import type { MemberView } from "@/application/queries/views";
import type { CommandHandler } from "@/ui/skins/types";

/** Owner allocate / buy-in — existing `giveJetons` command only. */
export function PremiumGiveJetonsMask({
  open,
  onClose,
  members,
  onCommand,
  title = "GIVE JETONS",
  notice,
}: {
  open: boolean;
  onClose: () => void;
  members: MemberView[];
  onCommand: CommandHandler;
  title?: string;
  notice?: string | null;
}) {
  const recipients = members.filter((member) => Boolean(member.userId));
  const [userId, setUserId] = useState("");
  const [amount, setAmount] = useState("100");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setUserId(recipients[0]?.userId ?? "");
    setAmount("100");
    setError(null);
    setBusy(false);
    // Reset when opened; member list identity is enough for first pick.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional open reset
  }, [open, members]);

  if (!open) return null;

  async function confirm() {
    if (!userId || !amount.trim()) {
      setError("Pick a player and amount.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const ok = await onCommand("giveJetons", { userId, amount: amount.trim() });
      if (ok === false) {
        setError(notice || "Could not give jetons.");
        return;
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not give jetons.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pm-sheet-mask" data-give-jetons-mask="true" role="dialog" aria-modal="true" aria-label={title}>
      <div className="pm-sheet">
        <h3>{title}</h3>
        <label className="pm-field">
          Player
          <select
            className="pm-input"
            aria-label="Player"
            value={userId}
            onChange={(event) => setUserId(event.target.value)}
          >
            {recipients.map((member) => (
              <option key={member.userId} value={member.userId}>
                {member.name}
                {member.available?.label ? ` · ${member.available.label}` : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="pm-field">
          Amount
          <input
            className="pm-input"
            aria-label="Jeton amount"
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </label>
        {error || notice ? (
          <p className="pm-error" data-give-jetons-error="true">
            {error || notice}
          </p>
        ) : null}
        <div className="pm-sheet-actions">
          <button type="button" className="pm-console-btn is-ghost" disabled={busy} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="pm-console-btn is-primary" disabled={busy || !recipients.length} onClick={() => void confirm()}>
            {busy ? "Giving…" : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}
