import { auth } from "@/application/auth";
import { loadSnapshot } from "@/application/queries/snapshot";
import { subscribeToTables } from "@/application/realtime/bus";
import { DomainError } from "@/domain/errors";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ tableId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Sign in required.", { status: 401 });
  }
  const { tableId } = await context.params;
  const viewerId = session.user.id;

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
      const send = async () => {
        if (request.signal.aborted) return;
        try {
          const snapshot = await loadSnapshot(tableId, viewerId);
          if (request.signal.aborted) return;
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(snapshot)}\n\n`));
        } catch {
          if (request.signal.aborted) return;
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
