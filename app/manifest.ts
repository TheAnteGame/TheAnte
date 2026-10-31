import type { MetadataRoute } from "next";

// What a phone needs to put The Ante on its home screen (D-120). On iPhone that is
// not optional: iOS only delivers web push to sites added to the home screen.
// Opens on the dashboard, standalone, on the black table the brand greets with.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "The Ante",
    short_name: "ANTE",
    description: "A season-long NFL chip pool.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#0b0b0d",
    theme_color: "#0b0b0d",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
