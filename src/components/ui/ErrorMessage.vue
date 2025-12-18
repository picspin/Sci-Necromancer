<template>
  <div
    class="bg-red-900/50 border border-red-700 text-red-300 px-4 py-3 rounded-lg animate-fade-in"
    role="alert"
    aria-live="assertive"
  >
    <strong class="font-bold">Error: </strong>
    <span class="block sm:inline">{{ message }}</span>
  </div>
</template>

<script setup lang="ts">
interface Props {
  message: string;
}

defineProps<Props>();
</script>
