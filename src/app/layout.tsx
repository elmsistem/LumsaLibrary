import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "LumsaLibrary ERP — Sistema Integral de Librería y Papelería",
  description: "ERP especializado de alta disponibilidad para librerías y papelerías en Ecuador con cumplimiento tributario SRI, Kardex PMP inmutable y control de temporada escolar.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-slate-900 text-slate-100" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
