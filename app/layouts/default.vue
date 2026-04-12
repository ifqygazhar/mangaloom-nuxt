<template>
  <div class="min-h-dvh flex flex-col bg-surface">
    <Navbar />
    <main class="flex-1">
      <slot />
    </main>
    <Footer />
    <MobileMenu />
  </div>
</template>

<script setup lang="ts"></script>
