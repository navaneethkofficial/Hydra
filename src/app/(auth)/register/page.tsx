import type { Metadata } from "next";

import { AuthDivider, GoogleButton } from "@/components/auth/google-button";
import { RegisterForm } from "@/components/auth/register-form";
import { googleAuthEnabled } from "@/server/env";

export const metadata: Metadata = { title: "Create your account" };

export default function RegisterPage() {
  return (
    <div className="space-y-5">
      {googleAuthEnabled && (
        <>
          <GoogleButton label="Sign up with Google" />
          <AuthDivider />
        </>
      )}
      <RegisterForm />
    </div>
  );
}
