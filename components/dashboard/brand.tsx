import Link from "next/link";
import { WalletIcon } from "@/components/shared/icons";
import { dashboardContent } from "@/content/dashboard";

export function Brand() {
  return (
    <Link
      href="/visao-geral"
      className="brand"
      aria-label={dashboardContent.brand.homeAriaLabel}
    >
      <span className="brand-mark finance-brand-mark" aria-hidden="true">
        <WalletIcon />
      </span>
      <span>{dashboardContent.brand.name}</span>
    </Link>
  );
}
