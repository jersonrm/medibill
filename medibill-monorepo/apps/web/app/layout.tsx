import React from "react";
import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Medibill | IA Clínica",
  description: "Clasificación de códigos RIPS automatizada",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element { // <-- Aquí está la magia que silencia el error
  return (
    <html lang="es">
      <body className="bg-slate-50 antialiased">{children}</body>
    </html>
  );
}