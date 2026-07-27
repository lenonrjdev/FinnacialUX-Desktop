"use client";

import { usePathname } from "next/navigation";
import DashboardShell from "@/components/dashboard/dashboard-shell";

const publicPaths = new Set([
  "/",
  "/login",
  "/registro",
  "/recuperar-senha",
  "/redefinir-senha",
]);

function normalizePathname(pathname: string) {
  if (pathname === "/") return pathname;
  return pathname.replace(/\/+$/, "") || "/";
}

export function AppRouteShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const normalizedPathname = normalizePathname(pathname || "/");

  if (publicPaths.has(normalizedPathname)) {
    return children;
  }

  return <DashboardShell>{children}</DashboardShell>;
}
