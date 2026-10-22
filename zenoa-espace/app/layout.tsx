import type { Metadata, Viewport } from "next";
import { Big_Shoulders, Manrope } from "next/font/google";
import "./globals.css";

const titre = Big_Shoulders({ subsets: ["latin"], variable: "--font-titre" });
const texte = Manrope({ subsets: ["latin"], variable: "--font-texte" });

export const metadata: Metadata = {
  title: "Zenoa Espace",
  description: "Suivi de la visibilité Google de votre commerce.",
  robots: { index: false, follow: false }, // espace privé : pas d'indexation
};
export const viewport: Viewport = { themeColor: "#0A0A0B" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${titre.variable} ${texte.variable}`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
