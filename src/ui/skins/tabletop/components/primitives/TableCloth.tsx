"use client";

import { TableName } from "./TableName";

/**
 * Shared cloth region under Dealer/Player content — same felt mark on both boards.
 * Table name is printed once on the cloth; never a title card.
 */
export function TableCloth({ name }: { name: string }) {
  return (
    <div className="tt-table-cloth" data-table-cloth="true" aria-label="Table">
      <div className="tt-table-cloth-rail" aria-hidden="true" />
      <TableName name={name} />
    </div>
  );
}
