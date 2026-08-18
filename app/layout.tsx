import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Archivo, Chakra_Petch } from "next/font/google";
import "./globals.css";

// D-006: Google Fonts only, self-hosted via next/font. Display = Chakra Petch
// (angular, rhymes with the chiseled wordmark without imitating it); body = Archivo,
// a neutral grotesque with expanded widths available for display duty if needed.

const archivo = Archivo({
  subsets: ["latin"],
  variable: "--font-archivo",
});

const chakraPetch = Chakra_Petch({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-chakra-petch",
});

export const metadata: Metadata = {
  title: "ANTE",
  description:
    "A season-long NFL chip pool. Everyone starts with 500. Nobody sees a pick until everyone is locked in. Biggest stack on the last Sunday wins.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <ClerkProvider>
      <html lang="en" className={`${archivo.variable} ${chakraPetch.variable}`}>
        <body className="antialiased">{children}</body>
      </html>
    </ClerkProvider>
  );
}
