import { getActor, assertActorCanAccessTable } from "@/application/actor";
import { loadSnapshot } from "@/application/queries/snapshot";
import { subscribeToTables } from "@/application/realtime/bus";
import { DomainError } from "@/domain/errors";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ tableId: string }> },
) {
  const { tableId } = await context.params;
  const actor = await getActor({ tableId });
  if (!actor) {
    return new Response("Sign in required.", { status: 401 });
  }
  try {
    assertActorCanAccessTable(actor, tableId);
  } catch (error) {
    if (error instanceof DomainError) {
      return new Response(error.message, { status: error.httpStatus });
    }
    throw error;
  }
  const viewerId = actor.id;

  try {
    await loadSnapshot(tableId, viewerId);
  } catch (error) {
    if (error instanceof DomainError) {
      return new Response(error.message, { status: error.httpStatus });
    }
    throw error;
  }

  const encoder = new TextEncoder();
  let unsubscribe: () => void = () => undefined;
  const stream = new ReadableStream({
    start(controller) {
      let sendGeneration = 0;
      const send = async () => {
        const generation = ++sendGeneration;
        if (request.signal.aborted) return;
        try {
          const snapshot = await loadSnapshot(tableId, viewerId);
          if (request.signal.aborted || generation !== sendGeneration) return;
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(snapshot)}\n\n`));
        } catch {
          if (request.signal.aborted || generation !== sendGeneration) return;
          try {
            controller.enqueue(encoder.encode(`event: error\ndata: {}\n\n`));
          } catch {
            // The client already disconnected.
          }
        }
      };
      void send();
      unsubscribe = subscribeToTables((id) => {
        if (id === tableId) void send();
      });
      const heartbeat = setInterval(() => {
        if (request.signal.aborted) return;
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          // The client already disconnected.
        }
      }, 15000);
      request.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        unsubscribe();
        controller.close();
      });
    },
    cancel() {
      unsubscribe();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
