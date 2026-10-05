import type { Metadata } from "next";
import { Suspense } from "react";

import { AuthDivider, GoogleButton } from "@/components/auth/google-button";
import { LoginForm } from "@/components/auth/login-form";
import { Skeleton } from "@/components/ui/skeleton";
import { googleAuthEnabled } from "@/server/env";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <div className="space-y-5">
      {googleAuthEnabled && (
        <>
          <GoogleButton label="Sign in with Google" />
          <AuthDivider />
        </>
      )}
      {/* useSearchParams needs a boundary so the shell can still be prerendered. */}
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-2xl" />}>
        <LoginForm googleEnabled={googleAuthEnabled} />
      </Suspense>
    </div>
  );
}
