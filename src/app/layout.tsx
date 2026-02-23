import type { Metadata, Viewport } from "next";
import { Nunito } from "next/font/google";
import PwaRegister from "@/components/PwaRegister";
import "./globals.css";

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Mosaico de Foto",
  description: "Convierte fotos en patrones de mosaico editables.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#146c5f",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={`${nunito.variable} antialiased`}>
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
