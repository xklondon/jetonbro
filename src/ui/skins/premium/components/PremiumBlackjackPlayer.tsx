"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { MemberView, PlayerTableView } from "@/application/queries/views";
import { blackjackPlayerControls } from "@/ui/core/blackjack-phase-controls";
import { blackjackPhaseCopy } from "@/ui/core/phase-copy";
import type { CommandHandler } from "@/ui/skins/types";
import { orderBoxesForFelt } from "./blackjackBoxOrder";
import {
  BlackjackBoardViewToggle,
  type BlackjackPlayerBoardView,
  PremiumBlackjackJetonView,
  readBlackjackPlayerBoardView,
  writeBlackjackPlayerBoardView,
} from "./PremiumBlackjackJetonView";
import { PremiumGiveJetonsMask } from "./PremiumGiveJetonsMask";
import { PremiumInviteMask } from "./PremiumInviteMask";
import { PremiumOutcomeFx } from "./PremiumOutcomeFx";
import { PremiumShell } from "./PremiumShell";
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
  initialBoardView,
}: {
  view: PlayerTableView;
  selectedBoxId: string | null;
  onSelectBox: (id: string) => void;
  onCommand: CommandHandler;
  notice?: string | null;
  members?: MemberView[];
  /** Dev/fixture override — production uses localStorage after mount. */
  initialBoardView?: BlackjackPlayerBoardView;
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
  const [boardView, setBoardView] = useState<BlackjackPlayerBoardView>(
    () => initialBoardView ?? "table",
  );
  /** Pending (uncommitted) bet text — chips accumulate locally; PLACE BET commits SET once. */
  const [pendingText, setPendingText] = useState("");
  const [pendingChips, setPendingChips] = useState<string[]>([]);
  const [localNotice, setLocalNotice] = useState<string | null>(null);
  const [placeBusy, setPlaceBusy] = useState(false);
  const setup = view.phase === "TABLE_SETUP";
  const payout = view.phase === "PAYOUT";
  const roundComplete = view.phase === "ROUND_COMPLETE";
  const playing = view.phase === "PLAYING";
  const betting = view.phase === "BETTING";
  /** Next-round compose window (independent of whether the selected box is already locked). */
  const nextRoundBetting =
    view.phase === "ROUND_COMPLETE" && Boolean(view.actions.nextRoundBet);
  const boxLocked =
    Boolean(selected) &&
    (nextRoundBetting
      ? Number(selected?.nextRoundBet?.label ?? "0") > 0
      : betting && Number(selected?.bet.label ?? "0") > 0);
  /** Keep tray well during payout so dock height matches betting while dealer awards. */
  const showTray = true;
  const trayInteractive =
    ((betting && Boolean(controls.placeBet)) ||
      (nextRoundBetting && Boolean(controls.nextRoundBet))) &&
    !boxLocked;
  const [fxActive, setFxActive] = useState(false);
  const [fxTone, setFxTone] = useState<"win" | "loss">("win");
  const [fxSeed, setFxSeed] = useState("");
  const fxLatchKey = useRef<string | null>(null);
  const [allInArmed, setAllInArmed] = useState(false);
  const [exitOpen, setExitOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [giveOpen, setGiveOpen] = useState(false);
  const [changeOpen, setChangeOpen] = useState(false);
  const [resetBalances, setResetBalances] = useState(false);
  const [dealerPickOpen, setDealerPickOpen] = useState(false);
  const [dealerId, setDealerId] = useState(members?.[0]?.userId ?? "");
  const betweenHands = setup || roundComplete;
  const canLeave = Boolean(view.canLeaveTable || view.actions.leaveTable);
  const availableWhole = Number(view.available.label) || 0;
  const selectedCommitted = nextRoundBetting
    ? Number(selected?.nextRoundBet?.label ?? "0") || 0
    : Number(selected?.bet.label ?? "0") || 0;
  const allInAmount = availableWhole + (nextRoundBetting || betting ? selectedCommitted : 0);
  const showAllIn = trayInteractive && Boolean(selected) && allInAmount > 0;

  useEffect(() => {
    if (initialBoardView) {
      setBoardView(initialBoardView);
      return;
    }
    setBoardView(readBlackjackPlayerBoardView());
  }, [initialBoardView]);

  useEffect(() => {
    // Switching boxes clears the compose draft so chips do not bleed across boxes.
    setPendingText("");
    setPendingChips([]);
    setLocalNotice(null);
    setAllInArmed(false);
  }, [selected?.id]);

  function changeBoardView(mode: BlackjackPlayerBoardView) {
    setBoardView(mode);
    writeBlackjackPlayerBoardView(mode);
  }

  useEffect(() => {
    setAllInArmed(false);
  }, [view.phase, view.available.label]);

  useEffect(() => {
    if (boxLocked) {
      setPendingText(
        nextRoundBetting
          ? selected?.nextRoundBet?.label ?? "0"
          : selected?.bet.label ?? "0",
      );
      setPendingChips([]);
      setAllInArmed(false);
    }
  }, [boxLocked, nextRoundBetting, selected?.bet.label, selected?.nextRoundBet?.label]);

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

  function addChip(value: string) {
    if (!trayInteractive || !selected || boxLocked) return;
    setLocalNotice(null);
    setAllInArmed(false);
    const chip = parseWhole(value);
    if (chip == null) return;
    setPendingChips((prev) => [...prev, value]);
    setPendingText((prev) => {
      const current = parseWhole(prev) ?? 0;
      // First chip tap sets the bet; subsequent taps add to it.
      return String(current + chip);
    });
  }

  function removePendingChip(index: number) {
    if (!trayInteractive || boxLocked) return;
    setLocalNotice(null);
    setAllInArmed(false);
    setPendingChips((prev) => {
      const next = prev.filter((_, i) => i !== index);
      const sum = next.reduce((total, face) => total + (parseWhole(face) ?? 0), 0);
      setPendingText(sum > 0 ? String(sum) : "");
      return next;
    });
  }

  async function confirmPlaceBet() {
    if ((!controls.placeBet && !controls.nextRoundBet) || !selected || placeBusy || boxLocked) return;
    setLocalNotice(null);
    const amount = parseWhole(pendingText);
    if (amount == null || amount <= 0) {
      setLocalNotice("Enter or tap your bet before PLACE BET.");
      return;
    }
    const available = Number(view.available.label);
    if (amount > available) {
      setLocalNotice(`Need ${amount} jetons; AVAILABLE is ${view.available.label}.`);
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
        setLocalNotice("PLACE BET failed — check your bet and try again.");
        return;
      }
      setPendingChips([]);
      setAllInArmed(false);
    } finally {
      setPlaceBusy(false);
    }
  }

  async function confirmAllIn() {
    if (!showAllIn || !selected || placeBusy || boxLocked) return;
    if (!allInArmed) {
      setPendingText(String(allInAmount));
      setPendingChips([]);
      setAllInArmed(true);
      setLocalNotice(`Confirm ALL IN ${allInAmount}.`);
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
      setPendingChips([]);
      setAllInArmed(false);
    } finally {
      setPlaceBusy(false);
    }
  }

  let primary = null as null | { label: string; disabled?: boolean; onClick?: () => void };
  let secondary = null as null | { label: string; disabled?: boolean; onClick?: () => void };
  let tertiary = null as null | { label: string; disabled?: boolean; onClick?: () => void };
  let allIn = null as null | { label: string; disabled?: boolean; title?: string; onClick?: () => void };

  // Player never owns phase progression (START HAND / DEAL / NEXT ROUND).
  // Betting + next-round staging both use PLACE BET in the permanent centre slot.
  // ADD BOX is BETTING-only; left slot stays reserved via playerSlots grid.
  if (betting || nextRoundBetting) {
    secondary =
      betting && controls.addBox
        ? { label: "ADD BOX", onClick: () => void onCommand("addBox") }
        : null;
    if (controls.placeBet || controls.nextRoundBet) {
      primary = {
        label: "PLACE BET",
        disabled: placeBusy || !selected || boxLocked,
        onClick: () => void confirmPlaceBet(),
      };
      if (showAllIn) {
        allIn = {
          label: allInArmed ? `CONFIRM ALL IN ${allInAmount}` : `ALL IN ${allInAmount}`,
          title: allInArmed
            ? `Commit ${allInAmount} jetons (all available)`
            : `All in ${allInAmount} — tap again to confirm`,
          disabled: placeBusy || boxLocked,
          onClick: () => void confirmAllIn(),
        };
      }
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

  if (view.isOwner && view.actions.addPlayer && !secondary && !betting && !nextRoundBetting) {
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
  if (betweenHands && canLeave && !secondary && !betting && !nextRoundBetting) {
    secondary = { label: "EXIT TABLE", onClick: () => setExitOpen(true) };
  } else if (betweenHands && canLeave && !tertiary) {
    tertiary = { label: "EXIT TABLE", onClick: () => setExitOpen(true) };
  }

  const dockNotice = localNotice || notice;
  const pendingByBoxId =
    !boxLocked &&
    !nextRoundBetting &&
    selected &&
    pendingText &&
    parseWhole(pendingText) != null
      ? { [selected.id]: pendingText }
      : undefined;
  const nextRoundByBoxId = (() => {
    const map: Record<string, string | null | undefined> = {};
    for (const box of staged) {
      if (
        nextRoundBetting &&
        box.id === selected?.id &&
        !boxLocked &&
        pendingText &&
        parseWhole(pendingText) != null
      ) {
        map[box.id] = pendingText;
      } else if (box.nextRoundBet?.label && box.nextRoundBet.label !== "0") {
        map[box.id] = box.nextRoundBet.label;
      }
    }
    return Object.keys(map).length ? map : undefined;
  })();
  const badges = (
    <>
      <BlackjackBoardViewToggle mode={boardView} onChange={changeBoardView} />
      {view.isOwner ? (
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
      ) : null}
    </>
  );

  return (
    <PremiumShell
      title="JETONBRO"
      board="BLACKJACK_PLAYER"
      badges={badges}
      dock={
        <CasinoConsole
          variant="blackjack"
          playerSlots
          notice={dockNotice ? <div className="pm-console-notice">{dockNotice}</div> : null}
          available={view.available.label}
          showTray={showTray}
          reserveTray
          trayEnabled={Boolean(trayInteractive && controls.trayEnabled)}
          composeAmount={
            boxLocked || playing
              ? nextRoundBetting
                ? selected?.nextRoundBet?.label ?? "0"
                : selected?.bet.label ?? "0"
              : pendingText
          }
          composeLocked={boxLocked || playing}
          composeLabel="YOUR BET"
          onComposeAmount={
            trayInteractive
              ? (value) => {
                  setLocalNotice(null);
                  setAllInArmed(false);
                  setPendingChips([]);
                  setPendingText(value);
                }
              : boxLocked || playing
                ? () => undefined
                : undefined
          }
          onChip={trayInteractive ? addChip : undefined}
          statusMessage={setup ? "WAITING FOR DEALER TO START THE GAME" : null}
          primary={primary}
          secondary={secondary}
          tertiary={tertiary}
          allIn={allIn}
        />
      }
    >
      {boardView === "jeton" ? (
        <PremiumBlackjackJetonView
          boxes={
            setup && staged.length === 0 && view.available.label !== "0"
              ? [
                  setupSeatBox(
                    { userId: "viewer", name: "You", available: view.available },
                    1,
                  ),
                ]
              : staged
          }
          selectedBoxId={selected?.id ?? selectedBoxId}
          pendingByBoxId={pendingByBoxId}
          nextRoundByBoxId={nextRoundByBoxId}
          onSelectBox={onSelectBox}
          phaseLabel="Your boxes only."
        />
      ) : (
        <BlackjackTable
          tableName={view.tableName}
          phaseLabel={phaseCopy.primary}
          phaseInstruction={phaseCopy.instruction}
          dealerName="Dealer"
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
                !boxLocked &&
                box.id === selected?.id &&
                pendingText &&
                parseWhole(pendingText) != null
                  ? pendingText
                  : null;
              const pendingChipsForBox =
                pendingForBox && pendingChips.length > 0 ? pendingChips : null;
              const nextRoundForBox =
                box.nextRoundBet?.label && box.nextRoundBet.label !== "0"
                  ? box.nextRoundBet.label
                  : null;
              return (
                <BlackjackBox
                  key={box.id}
                  box={box}
                  selected={box.id === selected?.id}
                  pendingLabel={pendingForBox}
                  pendingChips={pendingChipsForBox}
                  onRemovePendingChip={
                    pendingChipsForBox && trayInteractive ? removePendingChip : undefined
                  }
                  nextRoundLabel={nextRoundForBox}
                  onSelect={() => onSelectBox(box.id)}
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
      )}
      <PremiumOutcomeFx active={fxActive} tone={fxTone} seed={fxSeed} prefs={view.outcomeFx} />
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
