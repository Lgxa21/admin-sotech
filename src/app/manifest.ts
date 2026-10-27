import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Sotech · Sistema",
    short_name: "Sotech",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f5f8",
    theme_color: "#2c47f5",
    lang: "es",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
