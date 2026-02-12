<script setup lang="ts">
import { ref } from 'vue'

defineProps<{
  sidebarOpen: boolean
}>()

const emit = defineEmits<{
  (e: 'toggleSidebar'): void
}>()

const isDark = defineModel<boolean>('isDark', { default: false })

function toggleTheme() {
  isDark.value = !isDark.value
  document.documentElement.classList.toggle('dark', isDark.value)
  localStorage.setItem('theme', isDark.value ? 'dark' : 'light')
}

const searchQuery = ref('')
</script>

<template>
  <header class="sticky top-0 z-40 flex w-full bg-white drop-shadow-1 dark:bg-boxdark dark:drop-shadow-none">
    <div class="flex flex-grow items-center justify-between px-4 py-4 shadow-2 md:px-6 2xl:px-11">
      <!-- Left: Hamburger + Search -->
      <div class="flex items-center gap-2 sm:gap-4 lg:hidden">
        <!-- Hamburger -->
        <button
          class="z-99999 block rounded-sm border border-stroke bg-white p-1.5 shadow-sm dark:border-strokedark dark:bg-boxdark lg:hidden"
          @click="emit('toggleSidebar')"
        >
          <span class="relative block h-5.5 w-5.5 cursor-pointer">
            <span class="du-block absolute right-0 h-full w-full">
              <span
                :class="[
                  'relative left-0 top-0 my-1 block h-0.5 w-0 rounded-sm bg-black delay-[0] duration-200 ease-in-out dark:bg-white',
                  !sidebarOpen ? '!w-full delay-300' : ''
                ]"
              ></span>
              <span
                :class="[
                  'relative left-0 top-0 my-1 block h-0.5 w-0 rounded-sm bg-black delay-150 duration-200 ease-in-out dark:bg-white',
                  !sidebarOpen ? '!w-full delay-400' : ''
                ]"
              ></span>
              <span
                :class="[
                  'relative left-0 top-0 my-1 block h-0.5 w-0 rounded-sm bg-black delay-200 duration-200 ease-in-out dark:bg-white',
                  !sidebarOpen ? '!w-full delay-500' : ''
                ]"
              ></span>
            </span>
            <span class="du-block absolute right-0 h-full w-full rotate-45">
              <span
                :class="[
                  'absolute left-2.5 top-0 block h-full w-0.5 rounded-sm bg-black delay-300 duration-200 ease-in-out dark:bg-white',
                  sidebarOpen ? '!h-0 delay-[0]' : ''
                ]"
              ></span>
              <span
                :class="[
                  'delay-400 absolute left-0 top-2.5 block h-0.5 w-full rounded-sm bg-black duration-200 ease-in-out dark:bg-white',
                  sidebarOpen ? '!h-0 delay-200' : ''
                ]"
              ></span>
            </span>
          </span>
        </button>
      </div>

      <!-- Search -->
      <div class="hidden sm:block">
        <div class="relative">
          <button class="absolute left-0 top-1/2 -translate-y-1/2 pl-4">
            <svg class="w-5 h-5 text-bodydark2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="搜尋案名或區域..."
            class="w-full bg-transparent pl-12 pr-4 font-medium focus:outline-none xl:w-125"
          />
        </div>
      </div>

      <!-- Right: Theme Toggle + Info -->
      <div class="flex items-center gap-3 2xsm:gap-7">
        <!-- Theme Toggle -->
        <button
          @click="toggleTheme"
          class="flex h-10 w-10 items-center justify-center rounded-full border border-stroke bg-gray hover:text-primary-600 dark:border-strokedark dark:bg-meta-4 dark:hover:text-white"
        >
          <span v-if="isDark" class="text-xl">☀️</span>
          <span v-else class="text-xl">🌙</span>
        </button>

        <!-- Notification -->
        <div class="relative">
          <button class="flex h-10 w-10 items-center justify-center rounded-full border border-stroke bg-gray hover:text-primary-600 dark:border-strokedark dark:bg-meta-4">
            <span class="text-xl">🔔</span>
          </button>
          <span class="absolute -top-0.5 right-0 z-1 h-2 w-2 rounded-full bg-meta-1">
            <span class="absolute -z-1 inline-flex h-full w-full animate-ping rounded-full bg-meta-1 opacity-75"></span>
          </span>
        </div>

        <!-- User -->
        <div class="flex items-center gap-4">
          <span class="hidden text-right lg:block">
            <span class="block text-sm font-medium text-black dark:text-white">小龍蝦</span>
            <span class="block text-xs text-bodydark2">管理員</span>
          </span>
          <span class="h-12 w-12 rounded-full bg-primary-500 flex items-center justify-center text-2xl">
            🦞
          </span>
        </div>
      </div>
    </div>
  </header>
</template>
