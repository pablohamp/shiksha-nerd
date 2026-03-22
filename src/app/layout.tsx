import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Shiksha Nerd — Education Consultancy CRM",
  description: "Premium lead management system by Hampton",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
