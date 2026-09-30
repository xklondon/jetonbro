import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { joinQrDataUrl } from "./join-qr";
import { ClassicSetupTable } from "@/ui/skins/classic/components/ClassicSetupTable";
import { isBlockedOrigin } from "@/application/auth-urls";
import jsQR from "jsqr";
import { PNG } from "pngjs";
import type { SetupTableView } from "@/application/queries/views";

test("Table Setup keeps the shared join URL for QR and copy link", () => {
  const joinUrl = "http://127.0.0.1:3000/join/shared-token";
  const view: SetupTableView = {
    role: "SETUP",
    phase: "TABLE_SETUP",
    tableName: "Salon",
    game: "Blackjack",
    gameOptions: [],
    ownerName: "Alex",
    bankName: "Alex",
    startingJetonsPerPlayer: { millis: "100000", label: "100" },
    seats: [{ id: "bank", name: "Alex", status: "Bank / Dealer" }],
    members: [],
    invitations: [],
    joinUrl,
    minBet: null,
    maxBet: null,
    blackjackPayout: "THREE_TWO",
    maxBoxesPerPlayer: 3,
    insuranceEnabled: true,
    bankMayDistributeJetons: true,
    canStartBetting: false,
    startBlockedReason: "Waiting for a player to join",
    isOwner: true,
    setupCompleted: true,
    tableStatus: "SETUP",
    paused: false,
    closePreview: null,
  };
  const html = renderToStaticMarkup(createElement(ClassicSetupTable, { view, onCommand: () => undefined }));
  expect(html).toContain(`data-join-url="${joinUrl}"`);
  expect(html).toContain("Invite Player");
  expect(html).toContain("OPEN BETTING");
  expect(isBlockedOrigin(joinUrl, "test")).toBe(false);
});

test("join QR encodes the shared table URL", async () => {
  const joinUrl = "https://jetonbro.example/join/shared-token";
  const dataUrl = await joinQrDataUrl(joinUrl);
  expect(dataUrl.startsWith("data:image/png;base64,")).toBe(true);
  const png = PNG.sync.read(Buffer.from(dataUrl.split(",")[1]!, "base64"));
  const decoded = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
  expect(decoded?.data).toBe(joinUrl);
});
