import { AuthLayout } from "@/components/auth/auth-layout";
import { RegisterForm } from "@/components/auth/register-form";

export default function RegistroPage() {
  return (
    <AuthLayout>
      <RegisterForm />
    </AuthLayout>
  );
}
