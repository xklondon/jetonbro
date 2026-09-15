export const JOIN_QR_OPTIONS = {
  margin: 4,
  width: 240,
  errorCorrectionLevel: "M" as const,
  color: { dark: "#000000", light: "#ffffff" },
};

export async function joinQrDataUrl(joinUrl: string): Promise<string> {
  const QRCode = await import("qrcode");
  return QRCode.toDataURL(joinUrl, JOIN_QR_OPTIONS);
}
