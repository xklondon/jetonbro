export function allowDevMailbox(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  return process.env.ALLOW_DEV_MAILBOX === "true";
}

