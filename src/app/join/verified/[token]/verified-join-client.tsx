"use client";

import { getSkin } from "@/ui/skins/registry";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export function VerifiedJoinClient({
  token,
  signedIn,
  emailBound,
  state,
}: {
  token: string;
  signedIn: boolean;
  emailBound: string | null;
  state: "invalid" | "ready";
}) {
  const skin = getSkin();
  const router = useRouter();
  const joining = useRef(false);
  const [notice, setNotice] = useState<string | null>(
    state === "invalid" ? "This invitation is not valid or has expired." : null,
  );

  useEffect(() => {
    if (state !== "ready" || !signedIn || joining.current) return;
    joining.current = true;
    void (async () => {
      const response = await fetch(`/api/join/verified/${token}`, { method: "POST" });
      const data = (await response.json()) as { tableId?: string; error?: string };
      if (!response.ok || !data.tableId) {
        joining.current = false;
        setNotice(data.error ?? "This invitation is not valid or has expired.");
        return;
      }
      router.replace(`/tables/${data.tableId}`);
    })();
  }, [router, signedIn, state, token]);

  if (signedIn) {
    return (
      <skin.Entry
        title="Join table"
        copy="Confirming your email and joining the table."
        actionLabel="Open JetonBro"
        notice={notice ?? "Joining the table…"}
        requireEmail={false}
        onSubmit={async () => undefined}
      />
    );
  }

  return (
    <skin.Entry
      title="Verified player"
      copy={
        emailBound
          ? `Confirm ${emailBound} with a magic link. You will return to this table.`
          : "Scan, enter your email, then confirm the magic link. You will return to this table."
      }
      actionLabel="Email me a link"
      notice={notice}
      requireEmail={!emailBound}
      onSubmit={async ({ email }) => {
        const result = await signIn("email", {
          email: emailBound || email,
          callbackUrl: `/join/verified/${token}`,
          redirect: false,
        });
        if (result?.error) {
          setNotice("If that email can be used, a link is on its way.");
          return;
        }
        setNotice("If that email can be used, a link is on its way.");
      }}
    />
  );
}
