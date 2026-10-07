"use client";

/** Embroidered cloth mark — full name visible, wrap up to two lines, never ellipsised. */
export function TableName({ name, className }: { name: string; className?: string }) {
  return (
    <div
      className={`tt-table-name${className ? ` ${className}` : ""}`}
      data-table-name={name}
      title={name}
    >
      {name}
    </div>
  );
}
