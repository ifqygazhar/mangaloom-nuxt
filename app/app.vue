<template>
  <NuxtRouteAnnouncer />
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>

<script setup lang="ts">
useHead({
  titleTemplate: (title) => (title ? `${title} — Mangaloom` : "Mangaloom"),
  link: [
    {
      rel: "icon",
      type: "image/png",
      href: "/favicon-96x96.png",
      sizes: "96x96",
    },
    { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
    { rel: "shortcut icon", href: "/favicon.ico" },
    {
      rel: "apple-touch-icon",
      sizes: "180x180",
      href: "/apple-touch-icon.png",
    },
    { rel: "manifest", href: "/site.webmanifest" },
    { rel: "preconnect", href: "https://fonts.googleapis.com" },
    {
      rel: "preconnect",
      href: "https://fonts.gstatic.com",
      crossorigin: "",
    },
    {
      rel: "stylesheet",
      href: "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap",
    },
  ],
  meta: [
    { name: "apple-mobile-web-app-title", content: "Mangaloom" },
    { name: "application-name", content: "Mangaloom" },
    {
      name: "description",
      content:
        "Read manga, manhwa, manhua and webtoons online for free. Mangaloom aggregates multiple comic sources in one place.",
    },
    { name: "theme-color", content: "#202020" },
    { property: "og:image", content: "/og-image.png" },
    { property: "og:title", content: "Mangaloom" },
    {
      property: "og:description",
      content:
        "Read manga, manhwa, manhua and webtoons online for free. Mangaloom aggregates multiple comic sources in one place.",
    },
    { property: "og:type", content: "website" },
  ],
  htmlAttrs: { lang: "en" },
});
</script>
