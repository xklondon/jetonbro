import { afterEach, expect, test } from "vitest";
import {
  isBlockedOrigin,
  parseJoinDestination,
  publicOrigin,
  resolveAuthRedirect,
  rewriteMagicLinkUrl,
  safeCallbackPath,
} from "@/application/auth-urls";

const originalAuthUrl = process.env.AUTH_URL;

afterEach(() => {
  if (originalAuthUrl === undefined) delete process.env.AUTH_URL;
  else process.env.AUTH_URL = originalAuthUrl;
});

test("production blocks localhost and railway.internal origins", () => {
  expect(isBlockedOrigin("http://localhost:8080", "production")).toBe(true);
  expect(isBlockedOrigin("http://127.0.0.1:3000", "production")).toBe(true);
  expect(isBlockedOrigin("http://web.railway.internal:8080", "production")).toBe(true);
  expect(isBlockedOrigin("https://jetonbro.example", "production")).toBe(false);
});

test("invitation callback paths are preserved", () => {
  expect(safeCallbackPath("/join/abcToken_12")).toBe("/join/abcToken_12");
  expect(safeCallbackPath("https://jetonbro.example/join/abcToken_12")).toBe("/join/abcToken_12");
  expect(safeCallbackPath("http://localhost:8080/join/inviteTok")).toBe("/join/inviteTok");
  expect(safeCallbackPath("http://app.railway.internal/join/inviteTok")).toBe("/join/inviteTok");
});

test("normal login without an invitation lands on home", () => {
  expect(safeCallbackPath(undefined)).toBe("/");
  expect(safeCallbackPath("/")).toBe("/");
  expect(safeCallbackPath("/sign-in")).toBe("/");
});

test("auth redirects never keep a blocked origin", () => {
  process.env.AUTH_URL = "https://jetonbro.example";
  expect(resolveAuthRedirect("http://localhost:8080/", "http://localhost:8080", "production")).toBe(
    "https://jetonbro.example/",
  );
  expect(resolveAuthRedirect("http://web.railway.internal/join/tok", "http://web.railway.internal", "production")).toBe(
    "https://jetonbro.example/join/tok",
  );
  expect(resolveAuthRedirect("/join/tok", "https://jetonbro.example", "production")).toBe(
    "https://jetonbro.example/join/tok",
  );
});

test("magic-link URLs are rewritten off localhost in production", () => {
  process.env.AUTH_URL = "https://jetonbro.example";
  expect(
    rewriteMagicLinkUrl("http://localhost:8080/api/auth/callback/email?token=1", "production"),
  ).toBe("https://jetonbro.example/api/auth/callback/email?token=1");
});

test("publicOrigin ignores railway internal request hosts", () => {
  process.env.AUTH_URL = "https://jetonbro.example";
  expect(publicOrigin("http://web.railway.internal:8080", "production")).toBe("https://jetonbro.example");
});

test("join destination parses existing invitation tokens only", () => {
  expect(parseJoinDestination("https://jetonbro.example/join/QrToken_abc")).toBe("/join/QrToken_abc");
  expect(parseJoinDestination("QrToken_abc")).toBe("/join/QrToken_abc");
  expect(parseJoinDestination("nope")).toBe(null);
});
