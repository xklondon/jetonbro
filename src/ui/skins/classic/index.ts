"use client";

import "./tokens.css";
import "./layouts.css";
import "./jetons.css";
import "./home.css";
import "./welcome-celebration.css";
import { ClassicPlayerTable } from "./components/ClassicPlayerTable";
import { ClassicBankTable } from "./components/ClassicBankTable";
import { ClassicSetupTable } from "./components/ClassicSetupTable";
import { ClassicWaitingTable } from "./components/ClassicWaitingTable";
import { ClassicEntry } from "./components/ClassicEntry";
import { ClassicHome } from "./components/ClassicHome";
import { ClassicCreateTable } from "./components/ClassicCreateTable";
import type { JetonBroSkin } from "../types";

export const classicSkin: JetonBroSkin = {
  id: "classic",
  name: "Classic",
  PlayerTable: ClassicPlayerTable,
  BankTable: ClassicBankTable,
  SetupTable: ClassicSetupTable,
  WaitingTable: ClassicWaitingTable,
  Entry: ClassicEntry,
  Home: ClassicHome,
  CreateTable: ClassicCreateTable,
};
