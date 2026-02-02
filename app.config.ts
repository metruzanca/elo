import { defineConfig } from "@solidjs/start/config";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  vite: {
    plugins: [tailwindcss()],
    ssr: { external: ["drizzle-orm"] },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./drizzle"),
        "~": path.resolve(__dirname, "./src"),
      },
    },
  },
});
