import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import { AuthProvider } from "@/components/providers/auth-provider";
import { DesktopProtectionProvider } from "@/components/providers/desktop-protection-provider";
import { DesktopSecurityProvider } from "@/components/providers/desktop-security-provider";
import { DesktopUpdaterProvider } from "@/components/providers/desktop-updater-provider";
import { DesktopExperienceProvider } from "@/components/providers/desktop-experience-provider";
import { BackgroundTasksProvider } from "@/components/providers/background-tasks-provider";
import { DesktopRecoveryGate } from "@/components/providers/desktop-recovery-gate";
import { AppRouteShell } from "@/components/providers/app-route-shell";
import { ClientErrorBoundary } from "@/components/providers/client-error-boundary";
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
    const desktop = JSON.parse(window.localStorage.getItem("finnacialux-desktop-experience-v1") || "{}");
    document.documentElement.dataset.reduceMotion = desktop.reduceMotion === true ? "true" : "false";
    document.documentElement.dataset.highContrast = desktop.highContrast === true ? "true" : "false";
    document.documentElement.dataset.enhancedFocus = desktop.enhancedFocus === false ? "false" : "true";
    document.documentElement.dataset.compactInterface = desktop.compactInterface === true ? "true" : "false";
    const scale = [90, 100, 110, 120].includes(Number(desktop.textScale)) ? Number(desktop.textScale) : 100;
    document.documentElement.style.setProperty("--desktop-text-scale", String(scale / 100));
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
        <ClientErrorBoundary>
          <DesktopRecoveryGate>
            <AuthProvider>
              <DesktopSecurityProvider>
                <DesktopProtectionProvider>
                  <DesktopUpdaterProvider>
                    <DesktopExperienceProvider>
                      <BackgroundTasksProvider>
                        <AppRouteShell>{children}</AppRouteShell>
                      </BackgroundTasksProvider>
                    </DesktopExperienceProvider>
                  </DesktopUpdaterProvider>
                </DesktopProtectionProvider>
              </DesktopSecurityProvider>
            </AuthProvider>
          </DesktopRecoveryGate>
        </ClientErrorBoundary>
      </body>
    </html>
  );
}
