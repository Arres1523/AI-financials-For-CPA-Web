import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Financials for CPA Web",
  description: "Annual financial workflow: import bank statements, classify transactions, generate P&L and Balance Sheet"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-paper text-ink antialiased">{children}</body>
    </html>
  );
}
