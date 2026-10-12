"use client";

import { useMemo, useState } from "react";
import type { MemberView, PlayerTableView } from "@/application/queries/views";
import { blackjackPlayerControls } from "@/ui/core/blackjack-phase-controls";
import { blackjackPhaseCopy } from "@/ui/core/phase-copy";
import type { CommandHandler } from "@/ui/skins/types";
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
  const showTray = !payout;

  async function retractChip(boxId: string, amount: string) {
    if (retractBusy || view.phase !== "BETTING" || !view.actions.retract) return;
    setRetractBusy(boxId);
    try {
      // Canonical retract path — there is no "retract" command on the API.
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
      onClick: () => void onCommand("placeBet", { boxId: selected?.id ?? "", amount: selectedChip ?? "25", mode: "ADD" }),
    };
    // ADD BOX stays available while betting even after a stake is placed (retract is on-chip ×).
    secondary = controls.addBox
      ? { label: "ADD BOX", onClick: () => void onCommand("addBox") }
      : null;
  } else if (playing) {
    primary = controls.double
      ? { label: "2×", onClick: () => void onCommand("double", { boxId: selected?.id ?? "" }) }
      : null;
    secondary = controls.split
      ? { label: "SPLIT", onClick: () => void onCommand("split", { boxId: selected?.id ?? "" }) }
      : null;
  }

  return (
    <PremiumShell
      title="JETONBRO"
      balance={view.available.label}
      board="BLACKJACK_PLAYER"
      dock={
        <CasinoConsole
          variant="blackjack"
          notice={notice ? <div className="pm-console-notice">{notice}</div> : null}
          available={view.available.label}
          showTray={showTray}
          trayEnabled={Boolean(controls.trayEnabled)}
          selectedChip={selectedChip}
          onChip={(value) => {
            setSelectedChip(value);
            if (selected && controls.placeBet) {
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
        {setup ? null : staged.length > 0 ? (
          staged.map((box) => (
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
            />
          ))
        ) : (
          <p className="pm-bj-empty">Waiting for a box</p>
        )}
      </BlackjackTable>
    </PremiumShell>
  );
}
