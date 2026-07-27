import Link from "next/link";
import { CheckIcon, ShieldIcon, WalletIcon } from "@/components/shared/icons";
import { authContent } from "@/content/acessos";

export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="auth-page">
      <section className="auth-showcase" aria-label={authContent.panel.eyebrow}>
        <Link className="auth-brand" href="/login">
          <span><WalletIcon /></span>
          <strong>{authContent.brand.name}</strong>
        </Link>

        <div className="auth-showcase-copy">
          <span className="auth-eyebrow">{authContent.panel.eyebrow}</span>
          <h1>{authContent.panel.title}</h1>
          <p>{authContent.panel.description}</p>

          <div className="auth-benefits">
            {authContent.panel.benefits.map((benefit) => (
              <span key={benefit}>
                <CheckIcon />
                {benefit}
              </span>
            ))}
          </div>
        </div>

        <div className="auth-privacy-note">
          <ShieldIcon />
          <span>{authContent.panel.privacy}</span>
        </div>
      </section>

      <section className="auth-form-side">
        <div className="auth-mobile-brand">
          <span><WalletIcon /></span>
          <strong>{authContent.brand.name}</strong>
          <small>{authContent.brand.tagline}</small>
        </div>
        {children}
      </section>
    </main>
  );
}
