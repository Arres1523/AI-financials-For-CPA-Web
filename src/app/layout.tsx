import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Valoris CPA Package",
  description: "Annual CPA package workflow for Valoris LLCs"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
