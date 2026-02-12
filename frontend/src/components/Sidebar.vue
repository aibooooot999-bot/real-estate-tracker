<script setup lang="ts">
defineProps<{
  sidebarOpen: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'navigate', tab: string): void
}>()

const menuItems = [
  { id: 'overview', icon: '📊', label: '總覽' },
  { id: 'search', icon: '🔍', label: '交易查詢' },
  { id: 'analysis', icon: '📈', label: '區域分析' },
  { id: 'heatmap', icon: '🗺️', label: '價格熱力圖' },
  { id: 'settings', icon: '⚙️', label: '資料更新' },
]

const activeTab = defineModel<string>('activeTab', { default: 'overview' })

function handleNavigate(id: string) {
  activeTab.value = id
  emit('navigate', id)
  emit('close')
}
</script>

<template>
  <aside
    :class="[
      'fixed left-0 top-0 z-50 flex h-screen w-72 flex-col overflow-y-hidden bg-boxdark duration-300 ease-linear lg:static lg:translate-x-0',
      sidebarOpen ? 'translate-x-0' : '-translate-x-full'
    ]"
  >
    <!-- Sidebar Header -->
    <div class="flex items-center justify-between gap-2 px-6 py-5.5 lg:py-6.5">
      <a href="#" class="flex items-center gap-3">
        <span class="text-3xl">🏠</span>
        <span class="text-xl font-bold text-white">預售屋追蹤</span>
      </a>
      <button
        class="block lg:hidden text-white"
        @click="emit('close')"
      >
        <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>

    <!-- Sidebar Menu -->
    <div class="no-scrollbar flex flex-col overflow-y-auto duration-300 ease-linear">
      <nav class="mt-5 py-4 px-4 lg:px-6">
        <div>
          <h3 class="mb-4 ml-4 text-sm font-semibold text-bodydark2 uppercase">
            功能選單
          </h3>
          <ul class="mb-6 flex flex-col gap-1.5">
            <li v-for="item in menuItems" :key="item.id">
              <button
                @click="handleNavigate(item.id)"
                :class="[
                  'group relative flex w-full items-center gap-2.5 rounded-sm py-2 px-4 font-medium text-bodydark1 duration-300 ease-in-out hover:bg-graydark',
                  activeTab === item.id ? 'bg-graydark' : ''
                ]"
              >
                <span class="text-xl">{{ item.icon }}</span>
                {{ item.label }}
              </button>
            </li>
          </ul>
        </div>

        <div>
          <h3 class="mb-4 ml-4 text-sm font-semibold text-bodydark2 uppercase">
            其他
          </h3>
          <ul class="mb-6 flex flex-col gap-1.5">
            <li>
              <a
                href="https://github.com/aibooooot999-bot/real-estate-tracker"
                target="_blank"
                class="group relative flex items-center gap-2.5 rounded-sm py-2 px-4 font-medium text-bodydark1 duration-300 ease-in-out hover:bg-graydark"
              >
                <span class="text-xl">📦</span>
                GitHub
                <svg class="w-4 h-4 ml-auto opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </li>
          </ul>
        </div>
      </nav>
    </div>
  </aside>
</template>
