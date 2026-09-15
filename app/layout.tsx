import type { Metadata, Viewport } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Archivo, Chakra_Petch } from "next/font/google";
import { getPlayerState } from "@/lib/player";
import "./globals.css";

// D-006: Google Fonts only, self-hosted via next/font. Display = Chakra Petch
// (angular, rhymes with the chiseled wordmark without imitating it) — only the two
// weights the app actually uses; body = Archivo,
// a neutral grotesque with expanded widths available for display duty if needed.

const archivo = Archivo({
  subsets: ["latin"],
  variable: "--font-archivo",
});

const chakraPetch = Chakra_Petch({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-chakra-petch",
});

export const metadata: Metadata = {
  title: "ANTE",
  description:
    "A season-long NFL chip pool. Everyone starts with 500. Nobody sees a pick until everyone is locked in. Biggest stack on the last Sunday wins.",
};

// The browser's own chrome (Safari/Chrome address bar, PWA title bar) follows the
// screen mode too (D-082). getPlayerState is React-cached, so this read is free.
const CANVAS_DARK = "#0b0b0d";
const CANVAS_LIGHT = "#ececee";
export async function generateViewport(): Promise<Viewport> {
  const state = await getPlayerState();
  const theme = state?.player?.themePreference;
  if (theme === "light") return { themeColor: CANVAS_LIGHT, colorScheme: "light" };
  if (theme === "auto") {
    return {
      themeColor: [
        { media: "(prefers-color-scheme: light)", color: CANVAS_LIGHT },
        { media: "(prefers-color-scheme: dark)", color: CANVAS_DARK },
      ],
      colorScheme: "light dark",
    };
  }
  return { themeColor: CANVAS_DARK, colorScheme: "dark" };
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // Screen mode (D-060, D-082). A signed-in player's choice goes on <html> as
  // data-theme — "light" and "dark" hold regardless of the device; "auto" (the
  // default) lets globals.css follow the device's prefers-color-scheme, live. A
  // signed-out visitor gets no attribute at all and sees the black table: the brand
  // greets every first visit (the surviving half of D-061). Server-side so the theme
  // is right on first paint with no client script and no flash; this is what makes
  // every route request-dynamic, an accepted cost.
  const state = await getPlayerState();
  const dataTheme = state?.player ? state.player.themePreference : undefined;

  return (
    <ClerkProvider>
      <html lang="en" data-theme={dataTheme} className={`${archivo.variable} ${chakraPetch.variable}`}>
        <body className="antialiased">{children}</body>
      </html>
    </ClerkProvider>
  );
}
