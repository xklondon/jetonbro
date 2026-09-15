import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, expect, test, vi } from "vitest";
import { allowDevMailbox } from "./dev-only";
import {
  sendInvitationEmail,
  sendMagicLinkEmail,
  setMailLoggerForTests,
  setResendEmailPortForTests,
} from "./mail";

afterEach(() => {
  setResendEmailPortForTests(null);
  setMailLoggerForTests(null);
  vi.unstubAllEnvs();
});

function productionResendEnv() {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("ALLOW_DEV_MAILBOX", "true");
  vi.stubEnv("RESEND_API_KEY", "re_test_not_for_logs");
  vi.stubEnv("EMAIL_FROM", "JetonBro <noreply@example.com>");
}

test("magic-link delivery calls the Resend adapter", async () => {
  productionResendEnv();
  const send = vi.fn(async () => ({ id: "msg_magic_1" }));
  setResendEmailPortForTests({ send });
  const logs: string[] = [];
  setMailLoggerForTests({
    info: (message) => logs.push(message),
    error: (message) => logs.push(message),
  });

  await sendMagicLinkEmail(
    "alex@example.com",
    "https://jetonbro.example/api/auth/callback/email?token=secret-auth-token",
  );

  expect(send).toHaveBeenCalledOnce();
  expect(send.mock.calls[0]?.[0]).toMatchObject({
    from: "JetonBro <noreply@example.com>",
    to: "alex@example.com",
    subject: "Sign in to JetonBro",
  });
  expect(send.mock.calls[0]?.[0].from).not.toContain("re_");
  expect(logs.some((line) => line.includes("id=msg_magic_1"))).toBe(true);
  expect(logs.join("\n")).not.toContain("secret-auth-token");
  expect(logs.join("\n")).not.toContain("re_test_not_for_logs");
});

test("invitation delivery calls the same Resend adapter", async () => {
  productionResendEnv();
  const send = vi.fn(async () => ({ id: "msg_invite_1" }));
  setResendEmailPortForTests({ send });

  await sendInvitationEmail({
    to: "jo@example.com",
    tableName: "Salon",
    url: "https://jetonbro.example/join/invite-secret-token",
  });

  expect(send).toHaveBeenCalledOnce();
  expect(send.mock.calls[0]?.[0]).toMatchObject({
    from: "JetonBro <noreply@example.com>",
    to: "jo@example.com",
    subject: "Join Salon on JetonBro",
  });
});

test("missing RESEND_API_KEY fails safely in production", async () => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("ALLOW_DEV_MAILBOX", "true");
  vi.stubEnv("RESEND_API_KEY", "");
  vi.stubEnv("EMAIL_FROM", "JetonBro <noreply@example.com>");
  const send = vi.fn(async () => ({ id: "should-not-send" }));
  setResendEmailPortForTests({ send });

  await expect(
    sendMagicLinkEmail("alex@example.com", "https://jetonbro.example/join/should-not-leak"),
  ).rejects.toThrow(/Set RESEND_API_KEY and EMAIL_FROM/);
  expect(send).not.toHaveBeenCalled();
  expect(allowDevMailbox()).toBe(false);
});

test("API key and invitation or auth tokens never appear in logged errors", async () => {
  productionResendEnv();
  const secretKey = "re_live_should_never_be_logged";
  const inviteUrl = "https://jetonbro.example/join/super-secret-invite";
  const logs: string[] = [];
  setMailLoggerForTests({
    info: (message) => logs.push(message),
    error: (message) => logs.push(message),
  });
  setResendEmailPortForTests({
    send: async () => {
      throw new Error(`Resend rejected ${secretKey} for ${inviteUrl}`);
    },
  });

  await expect(
    sendInvitationEmail({
      to: "jo@example.com",
      tableName: "Salon",
      url: inviteUrl,
    }),
  ).rejects.toThrow("Email delivery failed.");

  const recorded = logs.join("\n");
  expect(recorded).toContain("[jetonbro-mail] delivery failed");
  expect(recorded).not.toContain(secretKey);
  expect(recorded).not.toContain("super-secret-invite");
  expect(recorded).not.toContain(inviteUrl);
  expect(recorded).not.toContain("re_test_not_for_logs");
});

test("/api/dev remains unavailable in production", async () => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("ALLOW_DEV_MAILBOX", "true");
  expect(allowDevMailbox()).toBe(false);
  const { GET, POST } = await import("@/app/api/dev/session/route");
  expect(GET().status).toBe(404);
  const response = await POST(
    new Request("http://127.0.0.1/api/dev/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "probe@example.com" }),
    }),
  );
  expect(response.status).toBe(404);
  expect(await response.json()).toEqual({ error: "Not found." });
});

test("Auth.js and invitations share the mail adapter", () => {
  const root = join(process.cwd(), "src");
  const auth = readFileSync(join(root, "application/auth.ts"), "utf8");
  const invitations = readFileSync(join(root, "application/services/invitations.ts"), "utf8");
  expect(auth).toContain("sendMagicLinkEmail");
  expect(auth).not.toContain("nodemailer");
  expect(auth).not.toContain("EMAIL_SERVER");
  expect(auth).not.toContain("smtp://");
  expect(invitations).toContain("sendInvitationEmail");
});
