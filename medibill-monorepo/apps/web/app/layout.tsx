import React from "react";
import "./globals.css";
import type { Metadata } from "next";
import LayoutShell from "@/components/LayoutShell";

export const metadata: Metadata = {
  title: "Medibill | IA Clínica",
  description: "Clasificación de códigos RIPS automatizada",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <html lang="es">
      <body className="bg-slate-50 antialiased">
        <LayoutShell>{children}</LayoutShell>
      </body>
    </html>
  );
}