"use client";

import { useState, type ReactNode } from "react";
import type { BankTableView, BoxView, MemberView } from "@/application/queries/views";
import type { BoxOutcome } from "@/domain/blackjack/payouts";
import { blackjackDealerControls } from "@/ui/core/blackjack-phase-controls";
import { blackjackPhaseCopy } from "@/ui/core/phase-copy";
import type { CommandHandler } from "@/ui/skins/types";
import { PremiumShell } from "./PremiumShell";
import { PremiumInviteMask } from "./PremiumInviteMask";
import { CasinoConsole } from "./primitives/CasinoConsole";
import { BlackjackTable } from "./primitives/BlackjackTable";
import { BlackjackBox, JoinedBettingMark } from "./primitives/BlackjackBox";
import { BlackjackSettlementBar } from "./primitives/BlackjackSettlementBar";

function activeBoxes(view: BankTableView): BoxView[] {
  const fromPlayers = view.players.flatMap((player) => player.boxes);
  return fromPlayers.length > 0 ? fromPlayers : view.boxes;
}

function seated(view: BankTableView) {
  return view.players.filter((player) => Boolean(player.userId));
}

function orderNewestLeft(boxes: BoxView[]) {
  return [...boxes].sort((a, b) => b.boxNumber - a.boxNumber);
}

export function PremiumBlackjackDealer({
  view,
  members,
  onCommand,
  notice,
}: {
  view: BankTableView;
  members: MemberView[];
  onCommand: CommandHandler;
  notice?: string | null;
}) {
  const [inviteOpen, setInviteOpen] = useState(false);
  const controls = blackjackDealerControls(view);
  const joined = seated(view);
  const boxes = activeBoxes(view);
  const staged = orderNewestLeft(boxes);
  const setup = view.phase === "TABLE_SETUP";
  const payout = view.phase === "PAYOUT" || view.phase === "ROUND_COMPLETE";
  const play = view.phase === "BETTING" || view.phase === "PLAYING";
  const phaseCopy = blackjackPhaseCopy({
    role: "DEALER",
    phase: view.phase,
    insuranceOpen: view.insurance.window === "OPEN",
    seatedPlayerCount: joined.length,
  });

  const badges = (
    <>
      {view.isOwner ? <span className="pm-badge">OWNER</span> : null}
      <span className="pm-badge">DEALER</span>
    </>
  );

  let layer: ReactNode = null;
  if (setup) {
    layer =
      joined.length > 0 ? (
        joined.map((player) => (
          <JoinedBettingMark key={player.userId} name={player.name} availableLabel={player.available.label} />
        ))
      ) : (
        <p className="pm-bj-empty" data-dealer-empty="true">
          Waiting for players
        </p>
      );
  } else if (payout && boxes.length > 0) {
    layer = (
      <div className="pm-bj-settle-list">
        {boxes.map((box) => (
          <BlackjackSettlementBar
            key={box.id}
            box={box}
            enabled={controls.showPayoutResults}
            onSettle={(outcome: BoxOutcome) => void onCommand("settleBox", { boxId: box.id, outcome })}
          />
        ))}
      </div>
    );
  } else if (play && staged.length > 0) {
    layer = staged.map((box) => <BlackjackBox key={box.id} box={box} showPlayerName />);
  } else if (!setup) {
    layer = (
      <p className="pm-bj-empty" data-dealer-empty="true">
        Waiting for the first wager.
      </p>
    );
  }

  return (
    <PremiumShell
      title="JETONBRO"
      badges={badges}
      board="BLACKJACK_DEALER"
      dock={
        <CasinoConsole
          variant="blackjack"
          notice={notice ? <div className="pm-console-notice">{notice}</div> : null}
          reserveTray
          primary={
            controls.primary
              ? {
                  label: controls.primary.label,
                  disabled: !controls.primary.enabled,
                  onClick: () => void onCommand(controls.primary!.command),
                }
              : null
          }
          secondary={
            controls.showAddPlayer
              ? { label: "ADD PLAYER", onClick: () => setInviteOpen(true) }
              : controls.insurance
                ? {
                    label: controls.insurance.label,
                    disabled: !controls.insurance.enabled,
                    onClick: () => void onCommand(controls.insurance!.command),
                  }
                : null
          }
        />
      }
    >
      <BlackjackTable
        tableName={view.tableName}
        phaseLabel={phaseCopy.primary}
        phaseInstruction={phaseCopy.instruction}
        dealerName={view.dealerName || "Dealer"}
        dealerRanks={view.dealerHand?.ranks}
        setup={setup}
      >
        {layer}
      </BlackjackTable>
      <PremiumInviteMask
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        guestJoinUrl={view.guestJoinUrl}
        verifiedJoinUrl={view.verifiedJoinUrl}
        emailConfigured={view.emailConfigured !== false}
        startingJetons={view.startingJetons?.label ?? "100"}
        members={members}
        onCommand={onCommand}
        notice={notice}
      />
    </PremiumShell>
  );
}
