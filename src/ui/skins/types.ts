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
    defaultTableName: string;
    tables: HomeTableCard[];
    notice?: string | null;
    onCreateTable: () => Promise<void>;
    onJoinTable: (destination: string) => void;
    onOpenTable: (tableId: string) => void;
    onTableCommand?: (tableId: string, command: "saveTable" | "closeTable" | "deleteTable") => Promise<void>;
  }>;
  CreateTable: ComponentType<{
    defaultTableName: string;
    notice?: string | null;
    onBack: () => void;
    onCreate: (fields: {
      name: string;
      game: "BLACKJACK";
      startingJetonsPerPlayer: string;
      emails: string[];
    }) => Promise<void>;
    embedded?: boolean;
    joinUrl?: string | null;
    defaultStartingJetons?: string;
    initialEmails?: string[];
  }>;
};
