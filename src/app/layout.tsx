import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Sotech · Sistema", template: "%s · Sotech" },
  description: "Órdenes, tareas y clientes de Sotech - Caracasprint",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Sotech", statusBarStyle: "default" },
};
export const viewport: Viewport = {
  width: "device-width", initialScale: 1, viewportFit: "cover",
  themeColor: "#111111",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..900&family=IBM+Plex+Mono:wght@500;600&display=swap" />
      </head>
      <body>{children}</body>
    </html>
  );
}
