import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Sotech · Sistema",
    short_name: "Sotech",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f3ef",
    theme_color: "#111111",
    lang: "es",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
