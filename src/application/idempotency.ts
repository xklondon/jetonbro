import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { sha256 } from "./ids";

function serialize(value: unknown): string {
  return JSON.stringify(value, (_key, current) =>
    typeof current === "bigint" ? current.toString() : current,
  );
}

export async function withIdempotency<T>(
  actorId: string,
  key: string,
  command: string,
  payload: unknown,
  handler: () => Promise<T>,
): Promise<T> {
  const requestHash = sha256(serialize({ command, payload }));
  const existing = await prisma.idempotencyRecord.findUnique({
    where: { actorId_key: { actorId, key } },
  });
  if (existing) {
    if (existing.requestHash !== requestHash || existing.command !== command) {
      throw new Error("Idempotency key was reused with a different command.");
    }
    return existing.responseJson as T;
  }

  const result = await handler();
  try {
    await prisma.idempotencyRecord.create({
      data: {
        actorId,
        key,
        command,
        requestHash,
        responseJson: JSON.parse(serialize(result)) as Prisma.InputJsonValue,
      },
    });
  } catch (error) {
    const raced = await prisma.idempotencyRecord.findUnique({
      where: { actorId_key: { actorId, key } },
    });
    if (raced) return raced.responseJson as T;
    throw error;
  }
  return result;
}
