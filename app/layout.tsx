import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import { AuthProvider } from "@/components/providers/auth-provider";
import { AppRouteShell } from "@/components/providers/app-route-shell";
import { metadataContent } from "@/content/metadata";
import "./globals.css";

export const metadata: Metadata = metadataContent;

const poppins = Poppins({
  subsets: ["latin", "latin-ext"],
  weight: ["300", "400", "500", "600", "700", "800"],
  style: ["normal"],
  display: "swap",
  variable: "--font-poppins",
});

const appearanceBootstrap = `
(() => {
  try {
    const saved = window.localStorage.getItem("finance-dashboard-appearance");
    const preference = saved === "light" || saved === "dark" || saved === "system"
      ? saved
      : "system";
    const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const resolved = preference === "system" ? (systemDark ? "dark" : "light") : preference;
    document.documentElement.dataset.theme = resolved;
    document.documentElement.dataset.appearancePreference = preference;
    document.documentElement.style.colorScheme = resolved;
  } catch {
    const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.dataset.theme = systemDark ? "dark" : "light";
    document.documentElement.dataset.appearancePreference = "system";
    document.documentElement.style.colorScheme = systemDark ? "dark" : "light";
  }
})();`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={poppins.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: appearanceBootstrap }} />
      </head>
      <body>
        <AuthProvider><AppRouteShell>{children}</AppRouteShell></AuthProvider>
      </body>
    </html>
  );
}
