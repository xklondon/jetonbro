import type { CanResolve } from '../escrow/types.js';
import { peekAuthorityUserId } from './table.js';
import type { ProtocolTableState } from './types.js';

/** Real canResolve for EscrowService — standing or rotating authority from table state. */
export function canResolveForTable(state: ProtocolTableState): CanResolve {
  const authorityId = peekAuthorityUserId(state);
  return (actorId) => Boolean(authorityId && actorId === authorityId);
}
