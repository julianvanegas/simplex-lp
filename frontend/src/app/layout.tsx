import type { Metadata } from "next";
import { Hanken_Grotesk, STIX_Two_Text } from "next/font/google";
import "./globals.css";

const interfaceFont = Hanken_Grotesk({
  variable: "--font-interface",
  subsets: ["latin"],
});

const mathFont = STIX_Two_Text({
  variable: "--font-math",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "SimpleX LP",
  description: "Programación lineal con el método Simplex de la Gran M y el método gráfico.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${interfaceFont.variable} ${mathFont.variable}`}>
      <body>{children}</body>
    </html>
  );
}
