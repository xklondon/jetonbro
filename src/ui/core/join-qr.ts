export const JOIN_QR_OPTIONS = {
  margin: 1,
  width: 140,
  errorCorrectionLevel: "M" as const,
  color: { dark: "#10261f", light: "#f4ead5" },
};

export async function joinQrDataUrl(joinUrl: string): Promise<string> {
  const QRCode = await import("qrcode");
  return QRCode.toDataURL(joinUrl, JOIN_QR_OPTIONS);
}
