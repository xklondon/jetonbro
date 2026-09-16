"use client";

import { useEffect, useState } from "react";
import { PhoneShell } from "./PhoneShell";
import { ClassicGameCards } from "./ClassicGameCards";
import { BLACKJACK_TABLE_DEFAULTS } from "@/domain/blackjack/settings";
import { joinQrDataUrl } from "@/ui/core/join-qr";

export type CreateTableFields = {
  name: string;
  game: "BLACKJACK" | "POKER";
  startingJetonsPerPlayer: string;
  emails: string[];
  cardAssist?: string;
  bankFundingMode?: string;
  startingBank?: string;
  smallBlind?: string;
  bigBlind?: string;
  seatOrder?: string;
};

export type CreateTableMember = {
  userId: string;
  name: string;
};

export function ClassicCreateTable({
  defaultTableName,
  defaultStartingJetons,
  initialEmails,
  joinUrl,
  notice,
  members,
  onBack,
  onCreate,
  embedded,
}: {
  defaultTableName: string;
  defaultStartingJetons?: string;
  initialEmails?: string[];
  joinUrl?: string | null;
  notice?: string | null;
  members?: CreateTableMember[];
  onBack: () => void;
  onCreate: (fields: CreateTableFields) => Promise<void>;
  embedded?: boolean;
}) {
  const [game, setGame] = useState<"BLACKJACK" | "POKER">("BLACKJACK");
  const [name, setName] = useState(defaultTableName);
  const [startingJetonsPerPlayer, setStartingJetonsPerPlayer] = useState<string>(
    defaultStartingJetons ?? BLACKJACK_TABLE_DEFAULTS.startingAllocation,
  );
  const extraInitial = (initialEmails ?? []).filter((email) => email.trim());
  const [cardAssist, setCardAssist] = useState<"OFF" | "CONFIRM" | "AUTO">("OFF");
  const [bankFundingMode, setBankFundingMode] = useState<"OPEN" | "LIMITED">("OPEN");
  const [startingBank, setStartingBank] = useState<string>(BLACKJACK_TABLE_DEFAULTS.startingBank);
  const [smallBlind, setSmallBlind] = useState("5");
  const [bigBlind, setBigBlind] = useState("10");
  const [seatOrder, setSeatOrder] = useState<CreateTableMember[]>(members ?? []);
  const [emails, setEmails] = useState<string[]>(extraInitial.length ? extraInitial : [""]);
  const [pending, setPending] = useState(false);
  const [qrData, setQrData] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!joinUrl) return;
    void joinQrDataUrl(joinUrl).then(setQrData);
  }, [joinUrl]);

  useEffect(() => {
    setSeatOrder(members ?? []);
  }, [members]);

  async function copyLink() {
    if (!joinUrl) return;
    await navigator.clipboard.writeText(joinUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  async function shareLink() {
    if (!joinUrl) return;
    if (navigator.share) {
      await navigator.share({ title: name, url: joinUrl });
      return;
    }
    await copyLink();
  }

  function moveSeat(index: number, direction: -1 | 1) {
    setSeatOrder((rows) => {
      const target = index + direction;
      if (target < 0 || target >= rows.length) return rows;
      const next = [...rows];
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item!);
      return next;
    });
  }

  const form = (
    <form
      className="entry-form create-table-form"
      onSubmit={async (event) => {
        event.preventDefault();
        if (pending) return;
        setPending(true);
        try {
          await onCreate({
            name,
            game,
            startingJetonsPerPlayer,
            emails,
            cardAssist: game === "BLACKJACK" ? cardAssist : undefined,
            bankFundingMode: game === "BLACKJACK" ? bankFundingMode : undefined,
            startingBank: game === "BLACKJACK" ? startingBank : undefined,
            smallBlind: game === "POKER" ? smallBlind : undefined,
            bigBlind: game === "POKER" ? bigBlind : undefined,
            seatOrder: game === "POKER" ? seatOrder.map((seat) => seat.userId).join(",") : undefined,
          });
        } finally {
          setPending(false);
        }
      }}
    >
      <div className="setup-sheet-body">
        {notice ? <div className="error">{notice}</div> : null}
        <div>
          <div className="field-label">Game</div>
          <ClassicGameCards
            selectedId={game}
            onSelect={(id) => {
              if (id === "BLACKJACK" || id === "POKER") setGame(id);
            }}
            compact
          />
        </div>
        <label>
          Table name
          <input name="name" value={name} onChange={(event) => setName(event.target.value)} required />
        </label>
        <label>
          Starting jetons per player
          <input
            name="startingJetonsPerPlayer"
            inputMode="numeric"
            pattern="[0-9]*"
            value={startingJetonsPerPlayer}
            onChange={(event) => setStartingJetonsPerPlayer(event.target.value)}
          />
        </label>
        {game === "POKER" ? (
          <>
            <label>
              Small blind
              <input
                name="smallBlind"
                aria-label="Small blind"
                inputMode="numeric"
                pattern="[0-9]*"
                value={smallBlind}
                onChange={(event) => setSmallBlind(event.target.value)}
              />
            </label>
            <label>
              Big blind
              <input
                name="bigBlind"
                aria-label="Big blind"
                inputMode="numeric"
                pattern="[0-9]*"
                value={bigBlind}
                onChange={(event) => setBigBlind(event.target.value)}
              />
            </label>
            <div>
              <div className="field-label">Dealer rotation order</div>
              <ol className="seat-order" aria-label="Dealer rotation order">
                {seatOrder.map((seat, index) => (
                  <li key={seat.userId} className="seat-order-row">
                    <span>
                      {index + 1}. {seat.name}
                    </span>
                    <span className="seat-order-controls">
                      <button type="button" aria-label={`Move ${seat.name} up`} disabled={index === 0} onClick={() => moveSeat(index, -1)}>
                        Move up
                      </button>
                      <button
                        type="button"
                        aria-label={`Move ${seat.name} down`}
                        disabled={index === seatOrder.length - 1}
                        onClick={() => moveSeat(index, 1)}
                      >
                        Move down
                      </button>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </>
        ) : (
          <>
            <div>
              <div className="field-label">CARD ASSIST</div>
              <div className="setting-row">
                {(["OFF", "CONFIRM", "AUTO"] as const).map((mode) => (
                  <button key={mode} type="button" className={cardAssist === mode ? "active" : ""} onClick={() => setCardAssist(mode)}>
                    {mode}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="field-label">BANK FUNDING</div>
              <div className="setting-row">
                <button type="button" className={bankFundingMode === "OPEN" ? "active" : ""} onClick={() => setBankFundingMode("OPEN")}>
                  OPEN BANK
                </button>
                <button type="button" className={bankFundingMode === "LIMITED" ? "active" : ""} onClick={() => setBankFundingMode("LIMITED")}>
                  LIMITED BANK
                </button>
              </div>
              {bankFundingMode === "LIMITED" ? (
                <label>
                  Starting Bank jetons
                  <input
                    name="startingBank"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={startingBank}
                    onChange={(event) => setStartingBank(event.target.value)}
                  />
                </label>
              ) : null}
            </div>
          </>
        )}
        {joinUrl ? (
          <div className="qr-panel setup-qr" data-join-url={joinUrl} aria-label="Shared table join QR code">
            <div className="qr-kicker">SCAN TO JOIN TABLE</div>
            {qrData ? (
              <img src={qrData} width={240} height={240} alt="Shared table join QR code" />
            ) : (
              <div className="muted">Preparing table QR…</div>
            )}
            <div className="qr-actions">
              <button type="button" onClick={() => void copyLink()}>
                {copied ? "Copied" : "COPY LINK"}
              </button>
              <button type="button" onClick={() => void shareLink()}>
                SHARE
              </button>
            </div>
          </div>
        ) : null}
        <div className="setup-email">
          <div className="field-label">OR INVITE BY EMAIL</div>
          {emails.map((email, index) => (
            <div className="email-row" key={index}>
              <input
                type="email"
                autoComplete="email"
                aria-label="Player email"
                placeholder="Email"
                value={email}
                onChange={(event) =>
                  setEmails((rows) => rows.map((row, rowIndex) => (rowIndex === index ? event.target.value : row)))
                }
              />
              {emails.length > 1 ? (
                <button
                  type="button"
                  className="text-link"
                  aria-label="Remove player email"
                  onClick={() => setEmails((rows) => rows.filter((_, rowIndex) => rowIndex !== index))}
                >
                  Remove
                </button>
              ) : null}
            </div>
          ))}
          <button type="button" className="text-link add-email" onClick={() => setEmails((rows) => [...rows, ""])}>
            + ADD ANOTHER
          </button>
        </div>
      </div>
      <div className="setup-sheet-actions">
        <button className="gold-button" type="submit" disabled={pending}>
          {pending ? "Creating table" : "CREATE TABLE"}
        </button>
        {embedded ? (
          <button className="text-link" type="button" onClick={onBack}>
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );

  if (embedded) {
    return form;
  }

  return (
    <PhoneShell>
      <div className="phase-head">
        <strong>Set up a table</strong>
        <span>One step. Invite friends, then run the Bank.</span>
      </div>
      <main className="felt home-stack">{form}</main>
      <footer className="dock">
        <button className="text-link" type="button" onClick={onBack}>
          Cancel
        </button>
      </footer>
    </PhoneShell>
  );
}
