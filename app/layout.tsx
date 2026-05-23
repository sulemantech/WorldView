import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WORLDVIEW — 4D OSINT Command Center",
  description: "Real-time geospatial intelligence and threat visualization platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;600;700;900&family=Space+Mono:ital,wght@0,400;0,700;1,400&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="overflow-hidden">{children}</body>
    </html>
  );
}
