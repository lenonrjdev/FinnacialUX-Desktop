"use client";

import { useEffect } from "react";
import { DashboardLoadingSkeleton } from "@/components/dashboard/dashboard-loading-skeleton";

const immediateLoginRedirect = `
(() => {
  try {
    if (window.location.pathname === "/" || window.location.pathname === "") {
      window.location.replace("/login/");
    }
  } catch {}
})();`;

export default function HomePage() {
  useEffect(() => {
    if (window.location.pathname === "/" || window.location.pathname === "") {
      window.location.replace("/login/");
    }
  }, []);

  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: immediateLoginRedirect }} />
      <DashboardLoadingSkeleton variant="page" label="Abrindo o FinnacialUX Desktop..." />
    </>
  );
}
