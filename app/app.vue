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
    {
      name: "description",
      content:
        "Read manga, manhwa, manhua and webtoons online for free. Mangaloom aggregates multiple comic sources in one place.",
    },
    { name: "theme-color", content: "#202020" },
  ],
  htmlAttrs: { lang: "en" },
});
</script>
