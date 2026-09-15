import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { joinQrDataUrl } from "./join-qr";
import { ClassicCreateTable } from "@/ui/skins/classic/components/ClassicCreateTable";
import { isBlockedOrigin } from "@/application/auth-urls";
import jsQR from "jsqr";
import { PNG } from "pngjs";

test("setup mask puts the shared QR above email invite and SET UP TABLE", () => {
  const joinUrl = "http://127.0.0.1:3000/join/shared-token";
  const html = renderToStaticMarkup(
    createElement(ClassicCreateTable, {
      defaultTableName: "Salon",
      joinUrl,
      onBack: () => undefined,
      onCreate: async () => undefined,
    }),
  );
  expect(html).toContain("SCAN TO JOIN TABLE");
  expect(html).toContain(`data-join-url="${joinUrl}"`);
  expect(html.indexOf("SCAN TO JOIN TABLE")).toBeLessThan(html.indexOf("OR INVITE BY EMAIL"));
  expect(html.indexOf("COPY LINK")).toBeLessThan(html.indexOf("OR INVITE BY EMAIL"));
  expect(html.indexOf("setup-sheet-body")).toBeLessThan(html.indexOf("SET UP TABLE"));
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
