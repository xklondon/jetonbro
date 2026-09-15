import type { Metadata } from "next";
import { getSkin } from "@/ui/skins/registry";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "JetonBro",
  description: "A live table companion for virtual jetons used alongside physical games.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  getSkin();
  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#071714", overflowX: "hidden" }}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
