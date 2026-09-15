import { auth } from "@/application/auth";
import { SignInClient } from "./sign-in-client";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const session = await auth();
  const params = await searchParams;
  return (
    <SignInClient
      signedIn={Boolean(session?.user)}
      callbackUrl={params.callbackUrl ?? "/"}
    />
  );
}
