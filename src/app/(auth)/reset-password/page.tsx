import type { Metadata } from "next";
import { Suspense } from "react";

import { ResetPasswordForm } from "@/components/auth/password-reset-forms";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Choose a new password" };

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<Skeleton className="h-72 w-full rounded-2xl" />}>
      <ResetPasswordForm />
    </Suspense>
  );
}
