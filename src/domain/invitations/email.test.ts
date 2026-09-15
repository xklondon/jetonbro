import { expect, test } from "vitest";
import { collectInviteEmails } from "./email";
import { DomainError } from "../errors";

test("empty rows are ignored and duplicates are rejected", () => {
  expect(collectInviteEmails(["", "  alex@example.com  ", ""])).toEqual(["alex@example.com"]);
  expect(() => collectInviteEmails(["a@x.com", "A@x.com"])).toThrow(DomainError);
});
