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
  const payout = view.phase === "PAYOUT" || view.phase === "ROUND_COMPLETE";
  const playing = view.phase === "PLAYING";

  let primary = null as null | { label: string; disabled?: boolean; onClick?: () => void };
  let secondary = null as null | { label: string; disabled?: boolean; onClick?: () => void };

  if (controls.placeBet) {
    primary = {
      label: "PLACE BET",
      disabled: !controls.placeBet,
      onClick: () => void onCommand("placeBet", { boxId: selected?.id ?? "", amount: selectedChip ?? "25" }),
    };
    secondary = controls.retract
      ? {
          label: "RETRACT",
          onClick: () => void onCommand("retract", { boxId: selected?.id ?? "" }),
        }
      : controls.addBox
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
      title={view.tableName}
      balance={view.available.label}
      board="BLACKJACK_PLAYER"
      dock={
        <CasinoConsole
          notice={notice ? <div className="pm-bj-empty">{notice}</div> : null}
          available={view.available.label}
          showTray={!payout}
          trayEnabled={Boolean(controls.trayEnabled)}
          selectedChip={selectedChip}
          onChip={(value) => {
            setSelectedChip(value);
            if (selected && controls.placeBet) {
              void onCommand("placeBet", { boxId: selected.id, amount: value });
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
      >
        {staged.length > 0 ? (
          staged.map((box) => (
            <BlackjackBox
              key={box.id}
              box={box}
              selected={box.id === selected?.id}
              onSelect={() => onSelectBox(box.id)}
            />
          ))
        ) : (
          <BlackjackBox empty />
        )}
      </BlackjackTable>
    </PremiumShell>
  );
}
