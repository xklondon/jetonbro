"use client";

import "./tabletop.css";
import { PlayerTable } from "./components/PlayerTable";
import { BankTable } from "./components/BankTable";
import { SetupTable } from "./components/SetupTable";
import { WaitingTable } from "./components/WaitingTable";
import { Entry } from "./components/Entry";
import { Home } from "./components/Home";
import { CreateTable } from "./components/CreateTable";
import { PokerDealer } from "./components/PokerDealer";
import { PokerPlayer } from "./components/PokerPlayer";
import { PhaseZero } from "./components/PhaseZero";
import type { JetonBroSkin } from "../types";

export const tabletopSkin: JetonBroSkin = {
  id: "tabletop",
  name: "Tabletop",
  PlayerTable,
  BankTable,
  SetupTable,
  WaitingTable,
  PokerDealer,
  PokerPlayer,
  Entry,
  Home,
  CreateTable,
  PhaseZero,
};
