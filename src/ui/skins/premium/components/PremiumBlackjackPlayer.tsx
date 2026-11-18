"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { MemberView, PlayerTableView } from "@/application/queries/views";
import { blackjackPlayerControls } from "@/ui/core/blackjack-phase-controls";
import { blackjackPhaseCopy } from "@/ui/core/phase-copy";
import type { CommandHandler } from "@/ui/skins/types";
import { orderBoxesForFelt } from "./blackjackBoxOrder";
import { PremiumBlackjackCardSheet } from "./PremiumBlackjackCardSheet";
import { PremiumGiveJetonsMask } from "./PremiumGiveJetonsMask";
import { PremiumInviteMask } from "./PremiumInviteMask";
import { PremiumOutcomeFx } from "./PremiumOutcomeFx";
import { PremiumShell } from "./PremiumShell";
import { PremiumTrayCards } from "./PremiumTrayCards";
import { CasinoConsole } from "./primitives/CasinoConsole";
import { BlackjackTable } from "./primitives/BlackjackTable";
import { BlackjackBox, setupSeatBox } from "./primitives/BlackjackBox";

function parseWhole(text: string): number | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (!/^\d+(\.\d{1,3})?$/.test(trimmed)) return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < 0) return null;
  return value;
}

export function PremiumBlackjackPlayer({
  view,
  selectedBoxId,
  onSelectBox,
  onCommand,
  notice,
  members = [],
}: {
  view: PlayerTableView;
  selectedBoxId: string | null;
  onSelectBox: (id: string) => void;
  onCommand: CommandHandler;
  notice?: string | null;
  members?: MemberView[];
}) {
  const staged = orderBoxesForFelt(view.boxes);
  const selected = useMemo(
    () => staged.find((box) => box.id === selectedBoxId) ?? staged[0],
    [staged, selectedBoxId],
  );
  const controls = blackjackPlayerControls(view, selected);
  const phaseCopy = blackjackPhaseCopy({
    role: "PLAYER",
    phase: view.phase,
    insuranceOpen: view.insuranceWindowOpen,
  });
  /** Pending (uncommitted) wager text — chips accumulate locally; PLACE BET commits SET once. */
  const [pendingText, setPendingText] = useState("");
  const [localNotice, setLocalNotice] = useState<string | null>(null);
  const [placeBusy, setPlaceBusy] = useState(false);
  const [retractBusy, setRetractBusy] = useState<string | null>(null);
  const setup = view.phase === "TABLE_SETUP";
  const payout = view.phase === "PAYOUT";
  const roundComplete = view.phase === "ROUND_COMPLETE";
  const playing = view.phase === "PLAYING";
  const betting = view.phase === "BETTING";
  const nextRoundBetting = Boolean(controls.nextRoundBet);
  /** Keep tray well during payout so dock height matches betting while dealer awards. */
  const showTray = true;
  const trayInteractive = (betting && Boolean(controls.placeBet)) || nextRoundBetting;
  const [fxActive, setFxActive] = useState(false);
  const [fxTone, setFxTone] = useState<"win" | "loss">("win");
  const [fxSeed, setFxSeed] = useState("");
  const fxLatchKey = useRef<string | null>(null);
  const [allInArmed, setAllInArmed] = useState(false);
  const [cardSheetOpen, setCardSheetOpen] = useState(false);
  const [exitOpen, setExitOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [giveOpen, setGiveOpen] = useState(false);
  const [changeOpen, setChangeOpen] = useState(false);
  const [resetBalances, setResetBalances] = useState(false);
  const [dealerPickOpen, setDealerPickOpen] = useState(false);
  const [dealerId, setDealerId] = useState(members?.[0]?.userId ?? "");
  const cardsEnabled = playing && Boolean(selected?.hand?.canEdit);
  const ownRanks = selected?.hand?.ranks ?? [];
  const betweenHands = setup || roundComplete;
  const canLeave = Boolean(view.canLeaveTable || view.actions.leaveTable);
  const availableWhole = Number(view.available.label) || 0;
  const selectedCommitted = nextRoundBetting
    ? Number(selected?.nextRoundBet?.label ?? "0") || 0
    : Number(selected?.bet.label ?? "0") || 0;
  const allInAmount = availableWhole + (nextRoundBetting || betting ? selectedCommitted : 0);
  const showAllIn = trayInteractive && Boolean(selected) && allInAmount > 0;

  useEffect(() => {
    // Switching boxes clears the compose draft so chips do not bleed across boxes.
    setPendingText("");
    setLocalNotice(null);
    setAllInArmed(false);
  }, [selected?.id]);

  useEffect(() => {
    setAllInArmed(false);
  }, [view.phase, view.available.label]);

  useEffect(() => {
    if (!payout) {
      fxLatchKey.current = null;
      setFxActive(false);
      return;
    }
    const settled = view.boxes.filter((box) => box.outcome);
    if (settled.length === 0) {
      setFxActive(false);
      return;
    }
    const key = settled
      .map((box) => `${box.id}:${box.outcome}:${box.settledKey ?? ""}`)
      .sort()
      .join("|");
    if (fxLatchKey.current === key) {
      setFxActive(true);
      return;
    }
    // Latch on the first settlement snapshot for this set — later polls keep the same seed.
    if (fxLatchKey.current && fxLatchKey.current.split("|").length <= key.split("|").length) {
      setFxActive(true);
      return;
    }
    const win = settled.some((box) => box.outcome === "WON" || box.outcome === "BLACKJACK");
    setFxTone(win ? "win" : "loss");
    setFxSeed(key);
    fxLatchKey.current = key;
    setFxActive(true);
  }, [payout, view.boxes]);

  async function retractChip(boxId: string, amount: string) {
    if (retractBusy || !view.actions.retract) return;
    if (view.phase !== "BETTING" && !nextRoundBetting) return;
    setRetractBusy(boxId);
    setLocalNotice(null);
    try {
      await onCommand("placeBet", { boxId, amount, mode: "RETRACT" });
    } finally {
      setRetractBusy(null);
    }
  }

  function addChip(value: string) {
    if (!trayInteractive || !selected) return;
    setLocalNotice(null);
    setAllInArmed(false);
    const chip = parseWhole(value);
    if (chip == null) return;
    setPendingText((prev) => {
      const current = parseWhole(prev) ?? 0;
      // First chip tap sets the wager; subsequent taps add to it.
      return String(current + chip);
    });
  }

  async function confirmPlaceBet() {
    if ((!controls.placeBet && !controls.nextRoundBet) || !selected || placeBusy) return;
    setLocalNotice(null);
    const amount = parseWhole(pendingText);
    const alreadyLocked = nextRoundBetting
      ? Number(selected.nextRoundBet?.label ?? "0")
      : Number(selected.bet.label);
    if (amount == null || amount < 0) {
      setLocalNotice(
        nextRoundBetting
          ? "Enter or tap a NEXT ROUND wager before confirming."
          : "Enter or tap a wager before PLACE BET.",
      );
      return;
    }
    if (amount === 0) {
      if (!nextRoundBetting || alreadyLocked <= 0) {
        setLocalNotice(
          nextRoundBetting
            ? "Enter or tap a NEXT ROUND wager before confirming."
            : "Enter or tap a wager before PLACE BET.",
        );
        return;
      }
      setPlaceBusy(true);
      try {
        const ok = await onCommand("placeBet", {
          boxId: selected.id,
          amount: String(alreadyLocked),
          mode: "RETRACT",
        });
        if (ok === false) {
          setLocalNotice("Could not clear the NEXT ROUND bet.");
          return;
        }
        setPendingText("");
        setAllInArmed(false);
      } finally {
        setPlaceBusy(false);
      }
      return;
    }
    const available = Number(view.available.label);
    // SET replaces the box stake; only the delta leaves AVAILABLE.
    const delta = amount - alreadyLocked;
    if (delta > available) {
      setLocalNotice(`Need ${delta} jetons; AVAILABLE is ${view.available.label}.`);
      return;
    }
    setPlaceBusy(true);
    try {
      const ok = await onCommand("placeBet", {
        boxId: selected.id,
        amount: String(amount),
        mode: "SET",
      });
      if (ok === false) {
        setLocalNotice(
          nextRoundBetting
            ? "NEXT ROUND bet failed — check your wager and try again."
            : "PLACE BET failed — check your wager and try again.",
        );
        return;
      }
      setPendingText("");
      setAllInArmed(false);
    } finally {
      setPlaceBusy(false);
    }
  }

  async function confirmAllIn() {
    if (!showAllIn || !selected || placeBusy) return;
    if (!allInArmed) {
      setPendingText(String(allInAmount));
      setAllInArmed(true);
      setLocalNotice(
        nextRoundBetting
          ? `Confirm NEXT ROUND ALL IN ${allInAmount}.`
          : `Confirm ALL IN ${allInAmount}.`,
      );
      return;
    }
    setPendingText(String(allInAmount));
    setPlaceBusy(true);
    setLocalNotice(null);
    try {
      const ok = await onCommand("placeBet", {
        boxId: selected.id,
        amount: String(allInAmount),
        mode: "SET",
      });
      if (ok === false) {
        setLocalNotice("ALL IN failed — check available jetons and try again.");
        return;
      }
      setPendingText("");
      setAllInArmed(false);
    } finally {
      setPlaceBusy(false);
    }
  }

  let primary = null as null | { label: string; disabled?: boolean; onClick?: () => void };
  let secondary = null as null | { label: string; disabled?: boolean; onClick?: () => void };
  let tertiary = null as null | { label: string; disabled?: boolean; onClick?: () => void };
  let allIn = null as null | { label: string; disabled?: boolean; title?: string; onClick?: () => void };

  if (controls.placeBet || controls.nextRoundBet) {
    primary = {
      label: nextRoundBetting ? "NEXT ROUND" : "PLACE BET",
      disabled: placeBusy || !selected,
      onClick: () => void confirmPlaceBet(),
    };
    secondary = controls.addBox
      ? { label: "ADD BOX", onClick: () => void onCommand("addBox") }
      : null;
    if (showAllIn) {
      allIn = {
        label: allInArmed ? `CONFIRM ALL IN ${allInAmount}` : `ALL IN ${allInAmount}`,
        title: allInArmed
          ? `Commit ${allInAmount} jetons (all available)`
          : `All in ${allInAmount} — tap again to confirm`,
        disabled: placeBusy,
        onClick: () => void confirmAllIn(),
      };
    }
  } else if (playing) {
    // Canonical command names — API route cases are doubleBox / splitBox.
    primary = controls.double
      ? { label: "2×", onClick: () => void onCommand("doubleBox", { boxId: selected?.id ?? "" }) }
      : null;
    secondary = controls.split
      ? { label: "SPLIT", onClick: () => void onCommand("splitBox", { boxId: selected?.id ?? "" }) }
      : null;
  }

  if (view.isOwner && view.actions.addPlayer && !secondary) {
    secondary = { label: "ADD PLAYER", onClick: () => setInviteOpen(true) };
  }
  if (view.isOwner && view.actions.giveJetons && !tertiary) {
    tertiary = { label: "BUY-IN", onClick: () => setGiveOpen(true) };
  }
  if (view.isOwner && view.actions.switchGame && !tertiary) {
    tertiary = {
      label: "CHANGE GAME",
      onClick: () => {
        setResetBalances(false);
        setChangeOpen(true);
      },
    };
  }
  if (betweenHands && canLeave && !secondary) {
    secondary = { label: "EXIT TABLE", onClick: () => setExitOpen(true) };
  } else if (betweenHands && canLeave && !tertiary) {
    tertiary = { label: "EXIT TABLE", onClick: () => setExitOpen(true) };
  }

  const dockNotice = localNotice || notice;
  const badges = view.isOwner ? (
    <>
      <span className="pm-badge" data-owner-badge="true">
        OWNER
      </span>
      {view.actions.changeBank ? (
        <button
          type="button"
          className="pm-badge is-action"
          data-owner-change-dealer="true"
          aria-label="Assign dealer"
          onClick={() => {
            setDealerId(members.find((m) => m.isBankDealer)?.userId ?? members[0]?.userId ?? "");
            setDealerPickOpen(true);
          }}
        >
          DEALER
        </button>
      ) : null}
    </>
  ) : null;

  return (
    <PremiumShell
      title="JETONBRO"
      board="BLACKJACK_PLAYER"
      badges={badges}
      dock={
        <CasinoConsole
          variant="blackjack"
          notice={dockNotice ? <div className="pm-console-notice">{dockNotice}</div> : null}
          available={view.available.label}
          showTray={showTray}
          reserveTray
          trayEnabled={Boolean(trayInteractive && controls.trayEnabled)}
          composeAmount={pendingText}
          onComposeAmount={
            trayInteractive
              ? (value) => {
                  setLocalNotice(null);
                  setAllInArmed(false);
                  setPendingText(value);
                }
              : undefined
          }
          onChip={trayInteractive ? addChip : undefined}
          trayCards={
            <PremiumTrayCards
              cards={ownRanks}
              enabled={cardsEnabled}
              label={selected?.isSplit ? `BOX ${selected.boxNumber} CARDS` : "YOUR CARDS"}
              onAdd={() => setCardSheetOpen(true)}
              onRemoveLast={
                cardsEnabled && ownRanks.length && selected
                  ? () => void onCommand("removeCard", { boxId: selected.id })
                  : undefined
              }
            />
          }
          primary={primary}
          secondary={secondary}
          tertiary={tertiary}
          allIn={allIn}
        />
      }
    >
      <BlackjackTable
        tableName={view.tableName}
        phaseLabel={phaseCopy.primary}
        phaseInstruction={phaseCopy.instruction}
        dealerName="Dealer"
        dealerRanks={view.dealerHand?.ranks}
        setup={setup}
      >
        {setup && staged.length === 0 ? (
          view.available.label !== "0" ? (
            <BlackjackBox
              box={setupSeatBox(
                { userId: "viewer", name: "You", available: view.available },
                1,
              )}
              showPlayerName
              bankroll={view.available}
              showAvailable
            />
          ) : (
            <p className="pm-bj-empty">Waiting for betting to open</p>
          )
        ) : staged.length > 0 ? (
          staged.map((box) => {
            const canInsure =
              playing &&
              view.insuranceWindowOpen &&
              view.actions.insurance &&
              box.coverage?.insurance !== false &&
              (!box.insurance || box.insurance.label === "0");
            const pendingForBox =
              !nextRoundBetting &&
              box.id === selected?.id &&
              pendingText &&
              parseWhole(pendingText) != null
                ? pendingText
                : null;
            const nextRoundForBox =
              nextRoundBetting &&
              box.id === selected?.id &&
              pendingText &&
              parseWhole(pendingText) != null
                ? pendingText
                : box.nextRoundBet?.label && box.nextRoundBet.label !== "0"
                  ? box.nextRoundBet.label
                  : null;
            return (
              <BlackjackBox
                key={box.id}
                box={box}
                selected={box.id === selected?.id}
                pendingLabel={pendingForBox}
                nextRoundLabel={nextRoundForBox}
                onSelect={() => onSelectBox(box.id)}
                onRetractChip={
                  (view.phase === "BETTING" || nextRoundBetting) && view.actions.retract
                    ? (amount) => void retractChip(box.id, amount)
                    : undefined
                }
                retractBusy={retractBusy === box.id}
                onInsurance={
                  playing && view.insuranceWindowOpen
                    ? () =>
                        void onCommand("buyInsurance", {
                          boxId: box.id,
                          amount: box.insuranceMax.label,
                        })
                    : undefined
                }
                insuranceEnabled={canInsure}
              />
            );
          })
        ) : (
          <p className="pm-bj-empty">Waiting for a box</p>
        )}
      </BlackjackTable>
      <PremiumOutcomeFx active={fxActive} tone={fxTone} seed={fxSeed} prefs={view.outcomeFx} />
      {cardSheetOpen && selected ? (
        <PremiumBlackjackCardSheet
          title={selected.isSplit ? `Box ${selected.boxNumber} cards` : "Your cards"}
          ranks={ownRanks}
          enabled={cardsEnabled}
          onAdd={(rank) => void onCommand("addCard", { boxId: selected.id, rank })}
          onRemoveLast={() => void onCommand("removeCard", { boxId: selected.id })}
          onClose={() => setCardSheetOpen(false)}
        />
      ) : null}
      {exitOpen ? (
        <div className="pm-sheet-mask" role="dialog" aria-modal="true" aria-label="Exit table">
          <div className="pm-sheet">
            <h3>Exit table?</h3>
            <p className="pm-sheet-hint">You will leave seating for future hands. Ledger history is kept.</p>
            <div className="pm-sheet-actions">
              <button
                type="button"
                className="pm-console-btn is-primary"
                data-exit-confirm="true"
                onClick={() => {
                  void onCommand("leaveTable");
                  setExitOpen(false);
                }}
              >
                CONFIRM EXIT
              </button>
              <button type="button" className="pm-sheet-cancel" onClick={() => setExitOpen(false)}>
                CANCEL
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <PremiumInviteMask
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        guestJoinUrl={view.guestJoinUrl ?? null}
        verifiedJoinUrl={view.verifiedJoinUrl ?? null}
        emailConfigured={view.emailConfigured !== false}
        startingJetons={view.startingJetons?.label ?? "100"}
        members={members}
        invitations={view.invitations}
        onCommand={onCommand}
        notice={notice}
      />
      <PremiumGiveJetonsMask
        open={giveOpen}
        onClose={() => setGiveOpen(false)}
        members={members}
        onCommand={onCommand}
        title="BUY-IN"
        notice={notice}
      />
      {changeOpen ? (
        <div className="pm-sheet-mask" role="dialog" aria-modal="true" aria-label="Change game">
          <div className="pm-sheet">
            <h3>CHANGE GAME</h3>
            <p className="pm-sheet-hint">New game: POKER</p>
            <label className="pm-sheet-check">
              <input
                type="checkbox"
                checked={resetBalances}
                onChange={(event) => setResetBalances(event.target.checked)}
                data-reset-balances="true"
              />
              <span>RESET ALL PLAYER BALANCES to {view.startingJetons?.label ?? "100"}</span>
            </label>
            {resetBalances ? (
              <p className="pm-sheet-warn">Every player will be reset to the starting allocation.</p>
            ) : null}
            <div className="pm-sheet-actions">
              <button
                type="button"
                className="pm-console-btn is-primary"
                onClick={() => {
                  void onCommand("switchGame", {
                    game: "POKER",
                    resetBalances: resetBalances ? "true" : "false",
                    seatOrder: members.map((m) => m.userId).join(","),
                  });
                  setChangeOpen(false);
                }}
              >
                CONFIRM CHANGE
              </button>
              <button type="button" className="pm-sheet-cancel" onClick={() => setChangeOpen(false)}>
                CANCEL
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {dealerPickOpen ? (
        <div className="pm-sheet-mask" role="dialog" aria-modal="true" aria-label="Assign dealer">
          <div className="pm-sheet">
            <h3>Assign dealer</h3>
            <div className="pm-sheet-actions is-stack">
              {members.map((member) => (
                <button
                  key={member.userId}
                  type="button"
                  className={`pm-console-btn ${dealerId === member.userId ? "is-primary" : "is-ghost"}`}
                  onClick={() => setDealerId(member.userId)}
                >
                  {member.name}
                </button>
              ))}
            </div>
            <div className="pm-sheet-actions">
              <button
                type="button"
                className="pm-console-btn is-primary"
                onClick={() => {
                  void onCommand("assignBank", { userId: dealerId });
                  setDealerPickOpen(false);
                }}
              >
                CONFIRM
              </button>
              <button type="button" className="pm-sheet-cancel" onClick={() => setDealerPickOpen(false)}>
                CANCEL
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </PremiumShell>
  );
}
