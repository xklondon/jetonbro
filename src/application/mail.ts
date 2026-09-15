import { appendFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { allowDevMailbox } from "./dev-only";
import { rateLimit } from "./rate-limit";

export type MailKind = "magic-link" | "table-invite";

export type MailMessage = {
  to: string;
  subject: string;
  text: string;
  url?: string;
  kind: MailKind;
};

export type ResendEmailPort = {
  send: (input: { from: string; to: string; subject: string; text: string }) => Promise<{ id: string }>;
};

export type MailLogger = {
  info: (message: string) => void;
  error: (message: string) => void;
};

const mailboxPath = join(process.cwd(), "tmp", "mailbox.jsonl");

const defaultLogger: MailLogger = {
  info: (message) => console.info(message),
  error: (message) => console.error(message),
};

let logger: MailLogger = defaultLogger;
let resendPort: ResendEmailPort | null = null;

export function setMailLoggerForTests(next: MailLogger | null): void {
  logger = next ?? defaultLogger;
}

export function setResendEmailPortForTests(next: ResendEmailPort | null): void {
  resendPort = next;
}

export function mailboxFilePath(): string {
  return mailboxPath;
}

function productionEmailConfigError(): Error {
  return new Error("Email delivery is not configured. Set RESEND_API_KEY and EMAIL_FROM.");
}

function developmentEmailConfigError(): Error {
  return new Error(
    "Email delivery is not configured. Set RESEND_API_KEY and EMAIL_FROM, or set ALLOW_DEV_MAILBOX=true for the local mailbox.",
  );
}

function assertEmailConfig(): { apiKey: string; from: string } {
  const apiKey = process.env.RESEND_API_KEY?.trim() ?? "";
  const from = process.env.EMAIL_FROM?.trim() ?? "";
  if (!apiKey || !from) {
    throw process.env.NODE_ENV === "production" ? productionEmailConfigError() : developmentEmailConfigError();
  }
  return { apiKey, from };
}

function logFailure(): void {
  logger.error("[jetonbro-mail] delivery failed");
}

async function sendViaResend(message: MailMessage): Promise<void> {
  const { apiKey, from } = assertEmailConfig();
  try {
    const port = resendPort ?? createResendPort(apiKey);
    const result = await port.send({
      from,
      to: message.to,
      subject: message.subject,
      text: message.text,
    });
    if (!result.id) {
      logFailure();
      throw new Error("Email delivery failed.");
    }
    logger.info(`[jetonbro-mail] ${message.kind} delivered id=${result.id}`);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Email delivery is not configured.")) {
      throw error;
    }
    logFailure();
    throw new Error("Email delivery failed.");
  }
}

function createResendPort(apiKey: string): ResendEmailPort {
  return {
    async send(input) {
      const { Resend } = await import("resend");
      const resend = new Resend(apiKey);
      const { data, error } = await resend.emails.send({
        from: input.from,
        to: input.to,
        subject: input.subject,
        text: input.text,
      });
      if (error || !data?.id) {
        throw new Error("Email delivery failed.");
      }
      return { id: data.id };
    },
  };
}

async function writeDevMailbox(message: MailMessage): Promise<void> {
  const record = {
    to: message.to.toLowerCase(),
    subject: message.subject,
    text: message.text,
    url: message.url,
    kind: message.kind,
    sentAt: new Date().toISOString(),
  };
  await mkdir(dirname(mailboxPath), { recursive: true });
  await appendFile(mailboxPath, `${JSON.stringify(record)}\n`, "utf8");
  logger.info(`[jetonbro-mail] ${message.kind} queued for development mailbox`);
}

export async function deliverMail(message: MailMessage, ip = "local"): Promise<void> {
  rateLimit(`mail:email:${message.to.toLowerCase()}`, 5, 15 * 60_000);
  rateLimit(`mail:ip:${ip}`, 20, 15 * 60_000);

  if (allowDevMailbox()) {
    await writeDevMailbox(message);
    return;
  }

  await sendViaResend(message);
}

export async function sendMagicLinkEmail(identifier: string, url: string, ip = "local"): Promise<void> {
  await deliverMail(
    {
      to: identifier,
      kind: "magic-link",
      subject: "Sign in to JetonBro",
      text: `Open this link to sign in to JetonBro:\n${url}\n\nThis link expires. JetonBro records virtual jetons only; they have no built-in cash value.`,
      url,
    },
    ip,
  );
}

export async function sendInvitationEmail(input: {
  to: string;
  tableName: string;
  url: string;
  ip?: string;
}): Promise<void> {
  await deliverMail(
    {
      to: input.to,
      kind: "table-invite",
      subject: `Join ${input.tableName} on JetonBro`,
      text: `You are invited to join ${input.tableName} on JetonBro. Open this link to sit at the table:\n${input.url}\n\nThis link expires. Jetons tracked in JetonBro have no built-in cash value.`,
      url: input.url,
    },
    input.ip,
  );
}
