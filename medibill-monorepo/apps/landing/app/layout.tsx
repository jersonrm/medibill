import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";

export const metadata: Metadata = {
  title: {
    default: "Medibill | Facturación Médica Inteligente con IA",
    template: "%s | Medibill",
  },
  description:
    "Clasifica códigos RIPS con inteligencia artificial, genera facturas electrónicas y gestiona glosas. La plataforma todo-en-uno para profesionales de salud en Colombia.",
  keywords: [
    "facturación médica",
    "RIPS",
    "CUPS",
    "CIE-10",
    "glosas",
    "factura electrónica",
    "salud Colombia",
    "inteligencia artificial médica",
    "clasificación RIPS",
    "Medibill",
  ],
  authors: [{ name: "Medibill" }],
  creator: "Medibill",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_LANDING_URL || "https://medibill.co"
  ),
  openGraph: {
    type: "website",
    locale: "es_CO",
    siteName: "Medibill",
    title: "Medibill | Facturación Médica Inteligente con IA",
    description:
      "Clasifica códigos RIPS con IA, genera facturas electrónicas y gestiona glosas. Todo en una plataforma para profesionales de salud en Colombia.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Medibill | Facturación Médica Inteligente con IA",
    description:
      "Clasifica códigos RIPS con IA, factura y gestiona glosas. Para profesionales de salud en Colombia.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="bg-white text-medi-deep antialiased">
        <Navbar />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
