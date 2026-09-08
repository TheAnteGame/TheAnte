import type { Metadata } from "next";
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

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // "auto" (the default, and every signed-out visitor) sets no attribute at all —
  // globals.css's @media (prefers-color-scheme) then decides, no server read needed.
  // An explicit choice sets data-theme so it wins over the system setting either way
  // (D-059 pattern: base tokens + media-query override + [data-theme] override).
  // This makes the root layout, and therefore every route under it, request-dynamic —
  // a real cost (only /rules was static before this), accepted so the theme is right
  // on first paint with no client-side flash.
  const state = await getPlayerState();
  const theme = state?.player?.themePreference;
  const dataTheme = theme === "light" || theme === "dark" ? theme : undefined;

  return (
    <ClerkProvider>
      <html lang="en" data-theme={dataTheme} className={`${archivo.variable} ${chakraPetch.variable}`}>
        <body className="antialiased">{children}</body>
      </html>
    </ClerkProvider>
  );
}
