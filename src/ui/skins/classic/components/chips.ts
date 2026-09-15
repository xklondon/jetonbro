import { chipCompositionFromMillis } from "@/domain/jetons/chips";

export type VisualChip = {
  label: string;
  amount: string;
  className: "c5" | "c10" | "c25" | "c50" | "c-exact";
  exact: boolean;
};

const CLASS_BY_LABEL: Record<string, VisualChip["className"]> = {
  "5": "c5",
  "10": "c10",
  "25": "c25",
  "50": "c50",
};

export function chipsFromMillis(millis: string): VisualChip[] {
  return chipCompositionFromMillis(BigInt(millis)).map((chip) => ({
    label: chip.label,
    amount: chip.label,
    className: chip.exact ? "c-exact" : (CLASS_BY_LABEL[chip.label] ?? "c-exact"),
    exact: chip.exact,
  }));
}
