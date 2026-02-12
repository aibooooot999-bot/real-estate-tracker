<script setup lang="ts">
defineProps<{
  sidebarOpen: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'navigate', tab: string): void
}>()

const menuItems = [
  { id: 'overview', icon: '📊', label: '總覽', group: 'main' },
  { id: 'search', icon: '🔍', label: '交易查詢', group: 'main' },
  { id: 'analysis', icon: '📈', label: '區域分析', group: 'main' },
  { id: 'heatmap', icon: '🗺️', label: '價格熱力圖', group: 'main' },
  { id: 'settings', icon: '⚙️', label: '資料更新', group: 'settings' },
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
      'absolute left-0 top-0 z-9999 flex h-screen w-72.5 flex-col overflow-y-hidden bg-boxdark duration-300 ease-linear dark:bg-boxdark lg:static lg:translate-x-0',
      sidebarOpen ? 'translate-x-0' : '-translate-x-full'
    ]"
  >
    <!-- Sidebar Header -->
    <div class="flex items-center justify-between gap-2 px-6 py-5.5 lg:py-6.5">
      <a href="#" class="flex items-center gap-3">
        <span class="text-3xl">🏠</span>
        <span class="text-xl font-semibold text-white">預售屋追蹤</span>
      </a>
      <button
        class="block lg:hidden text-white hover:text-bodydark1"
        @click="emit('close')"
      >
        <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>

    <!-- Sidebar Menu -->
    <div class="no-scrollbar flex flex-col overflow-y-auto duration-300 ease-linear">
      <nav class="mt-5 py-4 px-4 lg:mt-9 lg:px-6">
        <!-- Main Menu Group -->
        <div>
          <h3 class="mb-4 ml-4 text-sm font-medium text-bodydark2">
            功能選單
          </h3>
          <ul class="mb-6 flex flex-col gap-1.5">
            <li v-for="item in menuItems.filter(i => i.group === 'main')" :key="item.id">
              <button
                @click="handleNavigate(item.id)"
                :class="[
                  'group relative flex w-full items-center gap-2.5 rounded-sm py-2 px-4 font-medium text-bodydark1 duration-300 ease-in-out hover:bg-graydark dark:hover:bg-meta-4',
                  activeTab === item.id ? 'bg-graydark dark:bg-meta-4' : ''
                ]"
              >
                <span class="text-xl">{{ item.icon }}</span>
                {{ item.label }}
              </button>
            </li>
          </ul>
        </div>

        <!-- Settings Group -->
        <div>
          <h3 class="mb-4 ml-4 text-sm font-medium text-bodydark2">
            設定
          </h3>
          <ul class="mb-6 flex flex-col gap-1.5">
            <li v-for="item in menuItems.filter(i => i.group === 'settings')" :key="item.id">
              <button
                @click="handleNavigate(item.id)"
                :class="[
                  'group relative flex w-full items-center gap-2.5 rounded-sm py-2 px-4 font-medium text-bodydark1 duration-300 ease-in-out hover:bg-graydark dark:hover:bg-meta-4',
                  activeTab === item.id ? 'bg-graydark dark:bg-meta-4' : ''
                ]"
              >
                <span class="text-xl">{{ item.icon }}</span>
                {{ item.label }}
              </button>
            </li>
          </ul>
        </div>

        
      </nav>
    </div>
  </aside>
</template>
