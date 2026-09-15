import { expect, test, vi } from "vitest";
import { allowDevMailbox } from "./dev-only";

test("ALLOW_DEV_MAILBOX is ignored in production", () => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("ALLOW_DEV_MAILBOX", "true");
  expect(allowDevMailbox()).toBe(false);
  vi.unstubAllEnvs();
});

test("ALLOW_DEV_MAILBOX defaults off outside production", () => {
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("ALLOW_DEV_MAILBOX", "false");
  expect(allowDevMailbox()).toBe(false);
  vi.stubEnv("ALLOW_DEV_MAILBOX", "true");
  expect(allowDevMailbox()).toBe(true);
  vi.unstubAllEnvs();
});
