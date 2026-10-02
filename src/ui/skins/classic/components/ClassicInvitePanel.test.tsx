import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { ClassicInviteInline } from "./ClassicInvitePanel";

const urls = {
  guestJoinUrl: "http://127.0.0.1:3000/join/guest/guest-token",
  verifiedJoinUrl: "http://127.0.0.1:3000/join/verified/verified-token",
  emailConfigured: true,
  startingJetons: "100",
  onCommand: () => undefined,
};

test("GUEST QR mounts the guest QR panel and Copy Link", () => {
  const html = renderToStaticMarkup(createElement(ClassicInviteInline, { ...urls, selectedMethod: "guest" }));
  expect(html).toContain('data-selected-invite="guest"');
  expect(html).toContain('data-invite-kind="guest"');
  expect(html).toContain('data-join-url="http://127.0.0.1:3000/join/guest/guest-token"');
  expect(html).toContain("Copy Link");
  expect(html).toContain("Join this table without email. Starts with 100 jetons.");
  expect(html).toContain("Guest QR — no email");
  expect(html).not.toContain('data-invite-kind="verified"');
  expect(html).not.toContain('data-invite-kind="email"');
  expect(html).not.toContain("SEND INVITE");
});

test("VERIFIED QR mounts the verified QR panel and Copy Link", () => {
  const html = renderToStaticMarkup(createElement(ClassicInviteInline, { ...urls, selectedMethod: "verified" }));
  expect(html).toContain('data-selected-invite="verified"');
  expect(html).toContain('data-invite-kind="verified"');
  expect(html).toContain('data-join-url="http://127.0.0.1:3000/join/verified/verified-token"');
  expect(html).toContain("Copy Link");
  expect(html).toContain("Confirm email to become a verified user");
  expect(html).toContain("Verified QR — email confirmation");
  expect(html).not.toContain('data-invite-kind="guest"');
  expect(html).not.toContain('data-invite-kind="email"');
  expect(html).not.toContain("SEND INVITE");
});

test("EMAIL mounts the email field and SEND INVITE", () => {
  const html = renderToStaticMarkup(createElement(ClassicInviteInline, { ...urls, selectedMethod: "email" }));
  expect(html).toContain('data-selected-invite="email"');
  expect(html).toContain('data-invite-kind="email"');
  expect(html).toContain('aria-label="Player email"');
  expect(html).toContain("SEND INVITE");
  expect(html).not.toContain("Copy Link");
  expect(html).not.toContain('data-invite-kind="guest"');
  expect(html).not.toContain('data-invite-kind="verified"');
});

test("Create Table mounts no invite controls until a method is selected", () => {
  const html = renderToStaticMarkup(createElement(ClassicInviteInline, { ...urls, selectedMethod: null }));
  expect(html).toContain('data-selected-invite="none"');
  expect(html).not.toContain("Copy Link");
  expect(html).not.toContain("SEND INVITE");
  expect(html).not.toContain('data-invite-kind="guest"');
});
