import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NiftyDesk | Paper Trading",
  description: "A disciplined Indian equity paper-trading desk. Scan, review, and practice with deterministic risk controls.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
