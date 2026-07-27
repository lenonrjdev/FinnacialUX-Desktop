"use client";

import { useEffect } from "react";
import { DashboardLoadingSkeleton } from "@/components/dashboard/dashboard-loading-skeleton";

export default function HomePage() {
  useEffect(() => {
    window.location.replace("/login/");
  }, []);

  return <DashboardLoadingSkeleton variant="page" label="Abrindo o FinnacialUX Desktop..." />;
}
