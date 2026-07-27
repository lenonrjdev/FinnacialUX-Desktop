import { Suspense } from "react";
import { AuthLayout } from "@/components/auth/auth-layout";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export default function RedefinirSenhaPage() {
  return (
    <AuthLayout>
      <Suspense fallback={null}><ResetPasswordForm /></Suspense>
    </AuthLayout>
  );
}
