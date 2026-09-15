import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { mailboxFilePath } from "@/application/mail";
import { allowDevMailbox } from "@/application/dev-only";

export async function GET(request: Request) {
  if (!allowDevMailbox()) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  const url = new URL(request.url);
  const to = url.searchParams.get("to")?.toLowerCase();
  try {
    const raw = await readFile(mailboxFilePath(), "utf8");
    const lines = raw
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as { to: string; url?: string; kind: string; sentAt: string });
    const messages = to ? lines.filter((line) => line.to === to) : lines;
    return NextResponse.json({ messages: messages.reverse() });
  } catch {
    return NextResponse.json({ messages: [] });
  }
}
