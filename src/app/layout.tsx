import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import "./globals.css";

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["300", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Kacific ERP", template: "%s · Kacific ERP" },
  description:
    "Procurement, inventory and vendor operations for the Kacific satellite broadband network.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${montserrat.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
