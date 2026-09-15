import { auth } from "@/application/auth";
import { safeCallbackPath } from "@/application/auth-urls";
import { SignInClient } from "./sign-in-client";
import { redirect } from "next/navigation";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const session = await auth();
  const params = await searchParams;
  const callbackUrl = safeCallbackPath(params.callbackUrl);
  if (session?.user) {
    redirect(callbackUrl);
  }
  return <SignInClient signedIn={false} callbackUrl={callbackUrl} />;
}
