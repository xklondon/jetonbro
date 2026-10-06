import type { ComponentType } from "react";
import type { HomeTableCard } from "@/application/queries/home";
import type { BankTableView, MemberView, PlayerTableView, PokerTableView, SetupTableView, WaitingTableView } from "@/application/queries/views";

export type CommandHandler = (
  command: string,
  payload?: Record<string, string>,
) => void | boolean | Promise<void | boolean>;

export type JetonBroSkin = {
  id: "classic" | "tabletop";
  name: string;
  PlayerTable: ComponentType<{
    view: PlayerTableView;
    selectedBoxId: string | null;
    onSelectBox: (id: string) => void;
    onCommand: CommandHandler;
    notice?: string | null;
    members?: MemberView[];
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
  PokerDealer: ComponentType<{
    view: PokerTableView;
    members: MemberView[];
    onCommand: CommandHandler;
    notice?: string | null;
    guestJoinUrl?: string | null;
    verifiedJoinUrl?: string | null;
  }>;
  PokerPlayer: ComponentType<{
    view: PokerTableView;
    onCommand: CommandHandler;
    notice?: string | null;
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
    onTableCommand?: (
      tableId: string,
      command: "saveTable" | "closeTable" | "deleteTable" | "endAndDelete",
    ) => Promise<void>;
    onDeleteAllMyTables?: (confirmation: string) => Promise<void>;
    onWipeAllMyTables?: (confirmation: string) => Promise<void>;
    canWipeAllTables?: boolean;
    ownedTableCount?: number;
    showPersonalLedger?: boolean;
  }>;
  CreateTable: ComponentType<{
    defaultTableName: string;
    notice?: string | null;
    onBack: () => void;
    onCreate: (fields: {
      name: string;
      game: "BLACKJACK" | "POKER";
      startingJetonsPerPlayer: string;
      emails: string[];
      hostName?: string;
      cardAssist?: string;
      bankFundingMode?: string;
      startingBank?: string;
      smallBlind?: string;
      bigBlind?: string;
      seatOrder?: string;
    }) => Promise<void>;
    embedded?: boolean;
    joinUrl?: string | null;
    defaultStartingJetons?: string;
    initialEmails?: string[];
    needsHostName?: boolean;
    defaultHostName?: string;
    view?: SetupTableView | null;
    onCommand?: CommandHandler;
  }>;
  PhaseZero: ComponentType<{
    setup: SetupTableView | null;
    waiting: WaitingTableView | null;
    poker: PokerTableView | null;
    members: MemberView[];
    onCommand: CommandHandler;
    notice?: string | null;
    isOwner: boolean;
    isBank: boolean;
    viewerId: string;
    game: "BLACKJACK" | "POKER";
  }>;
};
