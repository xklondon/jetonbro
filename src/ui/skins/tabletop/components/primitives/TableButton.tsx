"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

export type TableButtonVariant = "primary" | "secondary" | "compact" | "result" | "ghost";
export type ResultKind = "lost" | "push" | "blackjack" | "won";

type Props = {
  variant?: TableButtonVariant;
  result?: ResultKind;
  disabled?: boolean;
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  type?: "button" | "submit" | "reset";
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type" | "onClick" | "disabled" | "className" | "children">;

/** Canonical Tabletop control. Disabled stays readable (~0.55 opacity). */
export function TableButton({
  variant = "secondary",
  result,
  disabled,
  children,
  onClick,
  className,
  type = "button",
  ...rest
}: Props) {
  const resultClass = variant === "result" && result ? ` is-${result}` : "";
  return (
    <button
      type={type}
      className={`tt-btn tt-btn-${variant}${resultClass}${className ? ` ${className}` : ""}`}
      disabled={disabled}
      onClick={onClick}
      {...rest}
    >
      {children}
    </button>
  );
}
