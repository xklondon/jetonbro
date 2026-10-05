import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import { getSkin } from "@/ui/skins/registry";
import { Providers } from "./providers";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-inter",
  display: "swap",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "JetonBro",
  description: "A live table companion for virtual jetons used alongside physical games.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  getSkin();
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable}`} style={{ height: "100%", overflow: "hidden" }}>
      <body style={{ margin: 0, height: "100%", overflow: "hidden", background: "#071714" }}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
