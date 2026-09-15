import type { ComponentType } from "react";
import type { HomeTableCard } from "@/application/queries/home";
import type { BankTableView, MemberView, PlayerTableView, SetupTableView, WaitingTableView } from "@/application/queries/views";

export type CommandHandler = (command: string, payload?: Record<string, string>) => void;

export type JetonBroSkin = {
  id: "classic";
  name: string;
  PlayerTable: ComponentType<{
    view: PlayerTableView;
    selectedBoxId: string | null;
    onSelectBox: (id: string) => void;
    onCommand: CommandHandler;
    notice?: string | null;
  }>;
  BankTable: ComponentType<{
    view: BankTableView;
    members: MemberView[];
    onCommand: CommandHandler;
    notice?: string | null;
  }>;
  SetupTable: ComponentType<{
    view: SetupTableView;
    onCommand: CommandHandler;
    notice?: string | null;
  }>;
  WaitingTable: ComponentType<{
    view: WaitingTableView;
  }>;
  Entry: ComponentType<{
    title: string;
    copy: string;
    actionLabel: string;
    onSubmit: (fields: Record<string, string>) => Promise<void> | void;
    notice?: string | null;
    extraFields?: { name: string; label: string; type?: string; placeholder?: string }[];
  requireEmail?: boolean;
  }>;
  Home: ComponentType<{
    displayName: string;
    tables: HomeTableCard[];
    onCreateTable: () => void;
    onJoinTable: (destination: string) => void;
    onOpenTable: (tableId: string) => void;
  }>;
  CreateTable: ComponentType<{
    defaultTableName: string;
    initialGame: "BLACKJACK" | null;
    notice?: string | null;
    onBack: () => void;
    onCreate: (fields: {
      name: string;
      game: "BLACKJACK";
      startingAllocation: string;
      blackjackPayout: "THREE_TWO" | "SIX_FIVE";
      maxBoxesPerPlayer: string;
      insuranceEnabled: boolean;
    }) => Promise<void>;
  }>;
};
