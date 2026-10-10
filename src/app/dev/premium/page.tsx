"use client";

import { Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import {
  PREMIUM_FIXTURE_IDS,
  renderPremiumFixture,
  type PremiumFixtureId,
} from "@/ui/skins/premium/fixtures/screens";

function GalleryBody() {
  const params = useSearchParams();
  const screen = (params.get("screen") || PREMIUM_FIXTURE_IDS[0]) as PremiumFixtureId;
  const contact = params.get("contact") === "1";

  return useMemo(() => {
    if (contact) {
      return (
        <div
          data-premium-contact="true"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 390px)",
            gap: 16,
            padding: 16,
            background: "#0a0806",
            width: "max-content",
          }}
        >
          {PREMIUM_FIXTURE_IDS.map((id) => (
            <figure key={id} style={{ margin: 0, width: 390 }}>
              <figcaption
                style={{
                  color: "#d4b882",
                  fontFamily: "Georgia, serif",
                  fontSize: 11,
                  letterSpacing: "0.08em",
                  marginBottom: 6,
                  textTransform: "uppercase",
                }}
              >
                {id}
              </figcaption>
              <div style={{ width: 390, height: 844, overflow: "hidden", position: "relative" }}>
                {renderPremiumFixture(id)}
              </div>
            </figure>
          ))}
        </div>
      );
    }
    return (
      <div data-premium-fixture={screen} style={{ width: 390, height: 844, margin: "0 auto" }}>
        {renderPremiumFixture(screen)}
      </div>
    );
  }, [contact, screen]);
}

/**
 * Dev-only static gallery for Premium visual proof.
 * Unavailable in production builds.
 */
export default function PremiumGalleryPage() {
  if (process.env.NODE_ENV === "production") {
    return (
      <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", background: "#0a0806", color: "#d4b882" }}>
        <p>Not found</p>
      </main>
    );
  }

  return (
    <div data-premium-gallery="true" style={{ minHeight: "100dvh", background: "#0a0806" }}>
      <Suspense fallback={<div style={{ color: "#d4b882", padding: 24 }}>Loading Premium gallery…</div>}>
        <GalleryBody />
      </Suspense>
    </div>
  );
}
