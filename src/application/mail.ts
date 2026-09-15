import { appendFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { rateLimit } from "./rate-limit";

export type MailKind = "magic-link" | "table-invite";

export type MailMessage = {
  to: string;
  subject: string;
  text: string;
  url?: string;
  kind: MailKind;
};

const mailboxPath = join(process.cwd(), "tmp", "mailbox.jsonl");

export async function deliverMail(message: MailMessage, ip = "local"): Promise<void> {
  rateLimit(`mail:email:${message.to.toLowerCase()}`, 5, 15 * 60_000);
  rateLimit(`mail:ip:${ip}`, 20, 15 * 60_000);

  const record = {
    ...message,
    to: message.to.toLowerCase(),
    sentAt: new Date().toISOString(),
  };

  await mkdir(dirname(mailboxPath), { recursive: true });
  await appendFile(mailboxPath, `${JSON.stringify(record)}\n`, "utf8");
  console.info(`[jetonbro-mail] ${record.kind} to ${record.to}${record.url ? ` ${record.url}` : ""}`);

  if (process.env.NODE_ENV === "production" && !process.env.EMAIL_SERVER) {
    console.warn(
      "[jetonbro-mail] EMAIL_SERVER is not set. Invitation and sign-in links were not delivered by SMTP; they were only written locally.",
    );
  }

  if (process.env.EMAIL_SERVER) {
    const nodemailer = await import("nodemailer");
    const transporter = nodemailer.createTransport(process.env.EMAIL_SERVER);
    await transporter.sendMail({
      to: message.to,
      from: process.env.EMAIL_FROM ?? "JetonBro <noreply@localhost>",
      subject: message.subject,
      text: message.text,
    });
  }
}

export function mailboxFilePath(): string {
  return mailboxPath;
}
