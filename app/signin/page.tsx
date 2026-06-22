import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { SignInPanel, safeCallback } from "./SignInPanel";

// Dedicated sign-in route. Shares the same panel as the signed-out home page.
export const dynamic = "force-dynamic";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; callbackUrl?: string }>;
}) {
  const session = await auth();
  if (session?.user) redirect("/");
  const { error, callbackUrl } = await searchParams;
  const dest = safeCallback(callbackUrl ?? "/");

  return <SignInPanel error={error} dest={dest} />;
}
