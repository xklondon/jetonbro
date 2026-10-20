"use client";

import { useEffect, useMemo, useState } from "react";
import type { MemberView, PlayerTableView } from "@/application/queries/views";
import { blackjackPlayerControls } from "@/ui/core/blackjack-phase-controls";
import { blackjackPhaseCopy } from "@/ui/core/phase-copy";
import type { CommandHandler } from "@/ui/skins/types";
import { PremiumOutcomeFx } from "./PremiumOutcomeFx";
import { PremiumShell } from "./PremiumShell";
import { CasinoConsole } from "./primitives/CasinoConsole";
import { BlackjackTable } from "./primitives/BlackjackTable";
import { BlackjackBox } from "./primitives/BlackjackBox";

function orderNewestLeft<T extends { boxNumber: number }>(boxes: T[]) {
  return [...boxes].sort((a, b) => b.boxNumber - a.boxNumber);
}

export function PremiumBlackjackPlayer({
  view,
  selectedBoxId,
  onSelectBox,
  onCommand,
  notice,
}: {
  view: PlayerTableView;
  selectedBoxId: string | null;
  onSelectBox: (id: string) => void;
  onCommand: CommandHandler;
  notice?: string | null;
  members?: MemberView[];
}) {
  const staged = orderNewestLeft(view.boxes);
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
  const [selectedChip, setSelectedChip] = useState<string | null>("25");
  const [retractBusy, setRetractBusy] = useState<string | null>(null);
  const setup = view.phase === "TABLE_SETUP";
  const payout = view.phase === "PAYOUT" || view.phase === "ROUND_COMPLETE";
  const playing = view.phase === "PLAYING";
  /** Keep tray well during payout so dock height matches betting while dealer awards. */
  const showTray = true;
  const trayInteractive = !payout && !setup;
  const [fxActive, setFxActive] = useState(false);
  const [fxTone, setFxTone] = useState<"win" | "loss">("win");
  const [fxSeed, setFxSeed] = useState("");

  useEffect(() => {
    if (!payout) {
      setFxActive(false);
      return;
    }
    const settled = view.boxes.find((box) => box.outcome);
    if (!settled?.outcome) {
      setFxActive(false);
      return;
    }
    const win = settled.outcome === "WON" || settled.outcome === "BLACKJACK";
    setFxTone(win ? "win" : "loss");
    setFxSeed(`${view.phase}-${settled.id}-${settled.outcome}`);
    setFxActive(true);
  }, [payout, view.boxes, view.phase]);

  async function retractChip(boxId: string, amount: string) {
    if (retractBusy || view.phase !== "BETTING" || !view.actions.retract) return;
    setRetractBusy(boxId);
    try {
      await onCommand("placeBet", { boxId, amount, mode: "RETRACT" });
    } finally {
      setRetractBusy(null);
    }
  }

  let primary = null as null | { label: string; disabled?: boolean; onClick?: () => void };
  let secondary = null as null | { label: string; disabled?: boolean; onClick?: () => void };

  if (controls.placeBet) {
    primary = {
      label: "PLACE BET",
      disabled: !controls.placeBet,
      onClick: () =>
        void onCommand("placeBet", {
          boxId: selected?.id ?? "",
          amount: selectedChip ?? "25",
          mode: "ADD",
        }),
    };
    secondary = controls.addBox
      ? { label: "ADD BOX", onClick: () => void onCommand("addBox") }
      : null;
  } else if (playing) {
    // Canonical command names — API route cases are doubleBox / splitBox.
    primary = controls.double
      ? { label: "2×", onClick: () => void onCommand("doubleBox", { boxId: selected?.id ?? "" }) }
      : null;
    secondary = controls.split
      ? { label: "SPLIT", onClick: () => void onCommand("splitBox", { boxId: selected?.id ?? "" }) }
      : null;
  }

  return (
    <PremiumShell
      title="JETONBRO"
      board="BLACKJACK_PLAYER"
      dock={
        <CasinoConsole
          variant="blackjack"
          notice={notice ? <div className="pm-console-notice">{notice}</div> : null}
          available={view.available.label}
          showTray={showTray}
          reserveTray
          trayEnabled={Boolean(trayInteractive && controls.trayEnabled)}
          selectedChip={selectedChip}
          onChip={(value) => {
            setSelectedChip(value);
            if (selected && controls.placeBet && trayInteractive) {
              void onCommand("placeBet", { boxId: selected.id, amount: value, mode: "ADD" });
            }
          }}
          primary={primary}
          secondary={secondary}
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
          <p className="pm-bj-empty">Waiting for betting to open</p>
        ) : staged.length > 0 ? (
          staged.map((box) => {
            const canInsure =
              playing &&
              view.insuranceWindowOpen &&
              view.actions.insurance &&
              box.coverage?.insurance !== false &&
              (!box.insurance || box.insurance.label === "0");
            return (
              <BlackjackBox
                key={box.id}
                box={box}
                selected={box.id === selected?.id}
                onSelect={() => onSelectBox(box.id)}
                onRetractChip={
                  view.phase === "BETTING" && view.actions.retract
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
      <PremiumOutcomeFx active={fxActive} tone={fxTone} seed={fxSeed} />
    </PremiumShell>
  );
}
