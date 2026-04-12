// https://nuxt.com/docs/api/configuration/nuxt-config
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";

export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  devtools: { enabled: true },
  modules: ["@nuxt/icon", "@nuxt/image"],
  css: ["./app/assets/css/main.css"],
  alias: {
    "#lib": fileURLToPath(new URL("./lib", import.meta.url)),
    preset: "cloudflare-pages",
  },
  nitro: {
    alias: {
      "#lib": fileURLToPath(new URL("./lib", import.meta.url)),
    },
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
