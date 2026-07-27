import { AuthLayout } from "@/components/auth/auth-layout";
import { PasswordRecoveryForm } from "@/components/auth/password-recovery-form";

export default function RecuperarSenhaPage() {
  return (
    <AuthLayout>
      <PasswordRecoveryForm />
    </AuthLayout>
  );
}
