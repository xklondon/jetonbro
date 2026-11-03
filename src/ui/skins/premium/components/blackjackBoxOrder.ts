import type { BoxView } from "@/application/queries/views";

/**
 * Felt order: keep each player's boxes together; place split offshoots
 * immediately beside their parent (after the parent in display order).
 * Newest-left overall for multi-player rails without breaking adjacency.
 */
export function orderBoxesForFelt(boxes: BoxView[]): BoxView[] {
  if (boxes.length <= 1) return [...boxes];

  const byPlayer = new Map<string, BoxView[]>();
  const playerOrder: string[] = [];
  for (const box of boxes) {
    const list = byPlayer.get(box.playerId);
    if (list) list.push(box);
    else {
      byPlayer.set(box.playerId, [box]);
      playerOrder.push(box.playerId);
    }
  }

  const orderedPlayers = [...playerOrder].sort((a, b) => {
    const aMin = Math.min(...(byPlayer.get(a) ?? []).map((box) => box.boxNumber));
    const bMin = Math.min(...(byPlayer.get(b) ?? []).map((box) => box.boxNumber));
    return bMin - aMin;
  });

  const out: BoxView[] = [];
  for (const playerId of orderedPlayers) {
    out.push(...orderPlayerBoxesAdjacent(byPlayer.get(playerId) ?? []));
  }
  return out;
}

function orderPlayerBoxesAdjacent(boxes: BoxView[]): BoxView[] {
  const roots = boxes
    .filter((box) => !box.isSplit || !box.parentBoxId)
    .sort((a, b) => a.boxNumber - b.boxNumber);
  const children = boxes.filter((box) => box.isSplit && box.parentBoxId);
  const used = new Set<string>();
  const out: BoxView[] = [];

  for (const root of roots) {
    out.push(root);
    used.add(root.id);
    const kids = children
      .filter((box) => box.parentBoxId === root.id)
      .sort((a, b) => a.boxNumber - b.boxNumber);
    for (const kid of kids) {
      out.push(kid);
      used.add(kid.id);
    }
  }

  // Orphans / unmatched (defensive).
  for (const box of [...boxes].sort((a, b) => a.boxNumber - b.boxNumber)) {
    if (!used.has(box.id)) out.push(box);
  }
  return out;
}
