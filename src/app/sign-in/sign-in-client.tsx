"use client";

import { getSkin } from "@/ui/skins/registry";
import { signIn } from "next-auth/react";
import { useState } from "react";

export function SignInClient({
  signedIn,
  callbackUrl,
}: {
  signedIn: boolean;
  callbackUrl: string;
}) {
  const skin = getSkin();
  const [notice, setNotice] = useState<string | null>(
    signedIn ? "You are already signed in." : null,
  );
  return (
    <skin.Entry
      title="Sign in"
      copy="Use your email. We send a short-lived link. No password."
      actionLabel="Email me a link"
      notice={notice}
      onSubmit={async ({ email }) => {
        const result = await signIn("email", {
          email,
          callbackUrl,
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
