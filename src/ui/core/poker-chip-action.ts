export function addChipToAmount(current: string, chipJetons: string): string {
  const trimmed = current.trim();
  const cur = /^\d+$/.test(trimmed) ? BigInt(trimmed) : 0n;
  if (!/^\d+$/.test(chipJetons)) return trimmed;
  const chip = BigInt(chipJetons);
  if (chip <= 0n) return trimmed;
  return (cur + chip).toString();
}
