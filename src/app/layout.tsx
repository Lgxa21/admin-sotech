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
  themeColor: [{ media: "(prefers-color-scheme: light)", color: "#f4f5f8" }, { media: "(prefers-color-scheme: dark)", color: "#101218" }],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
