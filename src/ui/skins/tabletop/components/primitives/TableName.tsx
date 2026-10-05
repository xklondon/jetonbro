"use client";

/** Compact cloth mark — restrained tracking, no emboss/outline stroke. */
export function TableName({ name, className }: { name: string; className?: string }) {
  return (
    <div className={`tt-table-name${className ? ` ${className}` : ""}`} data-table-name={name}>
      {name}
    </div>
  );
}
