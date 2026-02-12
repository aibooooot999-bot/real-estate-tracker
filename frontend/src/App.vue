<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import axios from 'axios'
import { Line } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'
import Sidebar from './components/Sidebar.vue'
import Header from './components/Header.vue'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler)

// ===== Types =====
interface Transaction {
  id: number
  district: string
  address: string
  project_name: string
  building_area: number
  total_price: number
  unit_price: number
  transaction_date: string
  building_type: string
}

interface Statistics {
  totalCount: number
  avgUnitPrice: number
  districts: string[]
  latestDate: string
}

interface TrendData {
  month: string
  avg_price: number
  count: number
}

interface DistrictAnalysis {
  district: string
  transaction_count: number
  avg_unit_price: number
  min_unit_price: number
  max_unit_price: number
  avg_total_price: number
  avg_area: number
}

interface HeatmapDistrict {
  district: string
  avgUnitPrice: number
  count: number
  heat: number
}

interface HeatmapData {
  districts: HeatmapDistrict[]
  min: number
  max: number
}

// ===== State =====
const transactions = ref<Transaction[]>([])
const districtAnalysis = ref<DistrictAnalysis[]>([])
const heatmapData = ref<HeatmapData | null>(null)
const statistics = ref<Statistics | null>(null)
const trendData = ref<TrendData[]>([])
const loading = ref(false)
const crawling = ref(false)

// Layout
const sidebarOpen = ref(false)
const activeTab = ref('overview')
const isDark = ref(false)

// Season selector
function getCurrentRocYearAndSeason() {
  const now = new Date()
  const year = now.getFullYear() - 1911
  const month = now.getMonth() + 1
  let season: number
  if (month <= 3) season = 4
  else if (month <= 6) season = 1
  else if (month <= 9) season = 2
  else season = 3
  const actualYear = month <= 3 ? year - 1 : year
  return { year: actualYear, season }
}

const currentPeriod = getCurrentRocYearAndSeason()
const selectedYear = ref(currentPeriod.year.toString())
const selectedSeason = ref(currentPeriod.season.toString())

const yearOptions = computed(() => {
  const currentYear = new Date().getFullYear() - 1911
  const years: string[] = []
  for (let y = 100; y <= currentYear + 1; y++) years.push(y.toString())
  return years.reverse()
})

const seasonOptions = [
  { value: '1', label: 'Q1 (1-3月)' },
  { value: '2', label: 'Q2 (4-6月)' },
  { value: '3', label: 'Q3 (7-9月)' },
  { value: '4', label: 'Q4 (10-12月)' },
]

// Filters
const filters = ref({
  district: '',
  minPrice: '',
  maxPrice: '',
  startDate: '',
  endDate: '',
  projectName: '',
})

// Sorting
const sortBy = ref('transaction_date')
const sortOrder = ref<'asc' | 'desc'>('desc')

function toggleSort(field: string) {
  if (sortBy.value === field) {
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortBy.value = field
    sortOrder.value = 'desc'
  }
  fetchTransactions()
}

// ===== API Calls =====
async function fetchStatistics() {
  try {
    const { data } = await axios.get('/api/statistics')
    if (data.success) statistics.value = data.data
  } catch (e) {
    console.error('Failed to fetch statistics:', e)
  }
}

async function fetchTransactions() {
  loading.value = true
  try {
    const params = new URLSearchParams()
    if (filters.value.district) params.append('district', filters.value.district)
    if (filters.value.minPrice) params.append('minPrice', filters.value.minPrice)
    if (filters.value.maxPrice) params.append('maxPrice', filters.value.maxPrice)
    if (filters.value.startDate) params.append('startDate', filters.value.startDate)
    if (filters.value.endDate) params.append('endDate', filters.value.endDate)
    if (filters.value.projectName) params.append('projectName', filters.value.projectName)
    params.append('sortBy', sortBy.value)
    params.append('sortOrder', sortOrder.value)
    params.append('limit', '100')
    
    const { data } = await axios.get(`/api/transactions?${params}`)
    if (data.success) transactions.value = data.data
  } catch (e) {
    console.error('Failed to fetch transactions:', e)
  } finally {
    loading.value = false
  }
}

async function fetchTrend() {
  try {
    const params = filters.value.district ? `?district=${filters.value.district}` : ''
    const { data } = await axios.get(`/api/trend${params}`)
    if (data.success) trendData.value = data.data.reverse()
  } catch (e) {
    console.error('Failed to fetch trend:', e)
  }
}

async function fetchDistrictAnalysis() {
  try {
    const { data } = await axios.get('/api/district-analysis')
    if (data.success) districtAnalysis.value = data.data
  } catch (e) {
    console.error('Failed to fetch district analysis:', e)
  }
}

async function fetchHeatmap() {
  try {
    const { data } = await axios.get('/api/heatmap')
    if (data.success) heatmapData.value = data.data
  } catch (e) {
    console.error('Failed to fetch heatmap:', e)
  }
}

async function triggerCrawl() {
  const season = `${selectedYear.value}S${selectedSeason.value}`
  if (!confirm(`確定要抓取 民國${selectedYear.value}年 ${seasonOptions.find(s => s.value === selectedSeason.value)?.label} 的資料？`)) return
  
  crawling.value = true
  try {
    const { data } = await axios.post('/api/crawl', { season })
    alert(data.message || '抓取完成')
    await refreshAll()
  } catch (e: any) {
    alert('抓取失敗: ' + (e.response?.data?.error || e.message))
  } finally {
    crawling.value = false
  }
}

async function refreshAll() {
  await Promise.all([fetchStatistics(), fetchTransactions(), fetchTrend(), fetchDistrictAnalysis(), fetchHeatmap()])
}

function search() {
  fetchTransactions()
  fetchTrend()
}

function resetFilters() {
  filters.value = { district: '', minPrice: '', maxPrice: '', startDate: '', endDate: '', projectName: '' }
  sortBy.value = 'transaction_date'
  sortOrder.value = 'desc'
  fetchTransactions()
  fetchTrend()
}

// ===== Formatters =====
function formatPrice(price: number): string {
  if (!price) return '-'
  if (price >= 100000000) return (price / 100000000).toFixed(2) + ' 億'
  if (price >= 10000) return (price / 10000).toFixed(0) + ' 萬'
  return price.toLocaleString()
}

function formatUnitPrice(price: number): string {
  if (!price) return '-'
  return (price / 10000).toFixed(1) + ' 萬/坪'
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '-'
  const match = dateStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (!match) return dateStr
  return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`
}

function getHeatColor(heat: number): string {
  if (heat < 0.5) {
    const r = Math.round(16 + (245 - 16) * heat * 2)
    const g = Math.round(185 - (185 - 158) * heat * 2)
    const b = Math.round(129 - (129 - 11) * heat * 2)
    return `rgb(${r}, ${g}, ${b})`
  } else {
    const ratio = (heat - 0.5) * 2
    const r = Math.round(245 - 6 * ratio)
    const g = Math.round(158 - 90 * ratio)
    const b = Math.round(11 + 57 * ratio)
    return `rgb(${r}, ${g}, ${b})`
  }
}

// ===== Chart =====
const chartData = computed(() => ({
  labels: trendData.value.map(d => d.month),
  datasets: [{
    label: '平均單價 (萬/坪)',
    data: trendData.value.map(d => d.avg_price / 10000),
    borderColor: '#3b82f6',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    tension: 0.4,
    fill: true,
    pointRadius: 4,
    pointHoverRadius: 6,
  }]
}))

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
    y: {
      beginAtZero: false,
      grid: { color: isDark.value ? '#334155' : '#e2e8f0' },
      ticks: { color: isDark.value ? '#94a3b8' : '#64748b', callback: (v: number) => v + '萬' }
    },
    x: {
      grid: { display: false },
      ticks: { color: isDark.value ? '#94a3b8' : '#64748b' }
    }
  }
}))

const avgPriceTrend = computed(() => {
  if (trendData.value.length < 2) return { value: '0', direction: 'up' }
  const curr = trendData.value[trendData.value.length - 1]?.avg_price || 0
  const prev = trendData.value[trendData.value.length - 2]?.avg_price || 1
  const change = ((curr - prev) / prev) * 100
  return { value: Math.abs(change).toFixed(1), direction: change >= 0 ? 'up' : 'down' }
})

const topDistrict = computed(() => districtAnalysis.value[0]?.district?.replace(/^.*[市縣]/, '') || '-')

// ===== Lifecycle =====
onMounted(() => {
  const savedTheme = localStorage.getItem('theme')
  if (savedTheme === 'dark') {
    isDark.value = true
    document.documentElement.classList.add('dark')
  }
  refreshAll()
})
</script>

<template>
  <div class="flex h-screen overflow-hidden">
    <!-- Sidebar -->
    <Sidebar 
      :sidebar-open="sidebarOpen" 
      v-model:active-tab="activeTab"
      @close="sidebarOpen = false" 
    />

    <!-- Main Content -->
    <div class="relative flex flex-1 flex-col overflow-y-auto overflow-x-hidden">
      <!-- Header -->
      <Header 
        :sidebar-open="sidebarOpen" 
        v-model:is-dark="isDark"
        @toggle-sidebar="sidebarOpen = !sidebarOpen" 
      />

      <!-- Main -->
      <main class="mx-auto max-w-screen-2xl p-4 md:p-6 2xl:p-10">
        
        <!-- Overview Tab -->
        <div v-show="activeTab === 'overview'">
          <!-- Stats Cards -->
          <div class="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6 xl:grid-cols-4 2xl:gap-7.5 mb-6">
            <div class="stat-card">
              <div class="flex items-center justify-between">
                <div>
                  <h4 class="text-title-md font-bold text-black dark:text-white">
                    {{ statistics ? (statistics.avgUnitPrice / 10000).toFixed(1) : '0' }}
                    <span class="text-sm font-medium text-bodydark2">萬/坪</span>
                  </h4>
                  <span class="text-sm font-medium text-bodydark2">平均單價</span>
                </div>
                <div :class="['badge', avgPriceTrend.direction === 'up' ? 'badge-success' : 'badge-danger']">
                  {{ avgPriceTrend.direction === 'up' ? '↑' : '↓' }} {{ avgPriceTrend.value }}%
                </div>
              </div>
            </div>
            
            <div class="stat-card">
              <div class="flex items-center justify-between">
                <div>
                  <h4 class="text-title-md font-bold text-black dark:text-white">
                    {{ statistics?.totalCount?.toLocaleString() || '0' }}
                  </h4>
                  <span class="text-sm font-medium text-bodydark2">總交易筆數</span>
                </div>
                <span class="text-3xl">📊</span>
              </div>
            </div>
            
            <div class="stat-card">
              <div class="flex items-center justify-between">
                <div>
                  <h4 class="text-title-md font-bold text-black dark:text-white">
                    {{ statistics?.districts?.length || '0' }}
                  </h4>
                  <span class="text-sm font-medium text-bodydark2">涵蓋區域</span>
                </div>
                <span class="text-3xl">🗺️</span>
              </div>
            </div>
            
            <div class="stat-card">
              <div class="flex items-center justify-between">
                <div>
                  <h4 class="text-title-md font-bold text-black dark:text-white">{{ topDistrict }}</h4>
                  <span class="text-sm font-medium text-bodydark2">最高價區域</span>
                </div>
                <span class="text-3xl">🏆</span>
              </div>
            </div>
          </div>

          <!-- Chart -->
          <div class="card mb-6" v-if="trendData.length > 0">
            <div class="card-header">
              <h5 class="text-xl font-semibold text-black dark:text-white">📈 價格趨勢</h5>
            </div>
            <div class="card-body">
              <div class="chart-container">
                <Line :data="chartData" :options="chartOptions" />
              </div>
            </div>
          </div>

          <!-- Quick Stats -->
          <div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4 mb-6">
            <div v-for="d in districtAnalysis.slice(0, 4)" :key="d.district" class="card">
              <div class="card-body text-center">
                <h4 class="text-2xl font-bold text-primary-600">{{ (d.avg_unit_price / 10000).toFixed(1) }}</h4>
                <p class="text-sm text-bodydark2">萬/坪</p>
                <p class="mt-2 font-medium text-black dark:text-white">{{ d.district.replace(/^.*[市縣]/, '') }}</p>
                <p class="text-xs text-bodydark2">{{ d.transaction_count }} 筆交易</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Search Tab -->
        <div v-show="activeTab === 'search'">
          <div class="card mb-6">
            <div class="card-header">
              <h5 class="text-xl font-semibold text-black dark:text-white">🔍 搜尋條件</h5>
            </div>
            <div class="card-body">
              <div class="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-6">
                <select v-model="filters.district" class="select">
                  <option value="">所有區域</option>
                  <option v-for="d in statistics?.districts" :key="d" :value="d">{{ d }}</option>
                </select>
                <input v-model="filters.projectName" type="text" placeholder="案名搜尋" class="input">
                <input v-model="filters.minPrice" type="number" placeholder="最低總價" class="input">
                <input v-model="filters.maxPrice" type="number" placeholder="最高總價" class="input">
                <input v-model="filters.startDate" type="date" class="input">
                <input v-model="filters.endDate" type="date" class="input">
              </div>
              <div class="mt-4 flex gap-3">
                <button @click="search" class="btn btn-primary">搜尋</button>
                <button @click="resetFilters" class="btn btn-secondary">重置</button>
              </div>
            </div>
          </div>

          <div class="card">
            <div class="card-header flex justify-between">
              <h5 class="text-xl font-semibold text-black dark:text-white">📋 交易資料</h5>
              <span class="text-sm text-bodydark2">共 {{ transactions.length }} 筆</span>
            </div>
            <div class="card-body">
              <div v-if="loading" class="py-10 text-center">
                <div class="loading-spinner mx-auto mb-4"></div>
                <p class="text-bodydark2">載入中...</p>
              </div>
              <div v-else-if="transactions.length === 0" class="py-10 text-center">
                <p class="text-4xl mb-4">📭</p>
                <p class="text-bodydark2">尚無資料</p>
              </div>
              <div v-else class="table-wrapper">
                <table class="table">
                  <thead>
                    <tr>
                      <th>交易日期</th>
                      <th>區域</th>
                      <th class="cursor-pointer hover:text-primary-600" @click="toggleSort('project_name')">
                        案名 {{ sortBy === 'project_name' ? (sortOrder === 'asc' ? '↑' : '↓') : '' }}
                      </th>
                      <th>坪數</th>
                      <th class="cursor-pointer hover:text-primary-600" @click="toggleSort('total_price')">
                        總價 {{ sortBy === 'total_price' ? (sortOrder === 'asc' ? '↑' : '↓') : '' }}
                      </th>
                      <th class="cursor-pointer hover:text-primary-600" @click="toggleSort('unit_price')">
                        單價 {{ sortBy === 'unit_price' ? (sortOrder === 'asc' ? '↑' : '↓') : '' }}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="t in transactions" :key="t.id" class="hover:bg-gray-50 dark:hover:bg-meta-4">
                      <td>{{ formatDate(t.transaction_date) }}</td>
                      <td>{{ t.district?.replace(/^.*[市縣]/, '') }}</td>
                      <td class="max-w-[150px] truncate" :title="t.project_name">{{ t.project_name || '-' }}</td>
                      <td>{{ t.building_area?.toFixed(1) || '-' }} 坪</td>
                      <td class="text-meta-1 font-medium">{{ formatPrice(t.total_price) }}</td>
                      <td class="text-primary-600 font-medium">{{ formatUnitPrice(t.unit_price) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <!-- Analysis Tab -->
        <div v-show="activeTab === 'analysis'">
          <div class="card">
            <div class="card-header">
              <h5 class="text-xl font-semibold text-black dark:text-white">📊 區域行情排名</h5>
            </div>
            <div class="card-body">
              <div v-if="districtAnalysis.length === 0" class="py-10 text-center">
                <p class="text-4xl mb-4">📊</p>
                <p class="text-bodydark2">尚無分析資料</p>
              </div>
              <div v-else class="table-wrapper">
                <table class="table">
                  <thead>
                    <tr>
                      <th style="width:60px">排名</th>
                      <th>區域</th>
                      <th>平均單價</th>
                      <th>單價範圍</th>
                      <th>平均總價</th>
                      <th>平均坪數</th>
                      <th>交易筆數</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(d, i) in districtAnalysis" :key="d.district" class="hover:bg-gray-50 dark:hover:bg-meta-4">
                      <td>
                        <span :class="['rank', i === 0 ? 'rank-1' : i === 1 ? 'rank-2' : i === 2 ? 'rank-3' : 'bg-gray-200 dark:bg-meta-4']">
                          {{ i + 1 }}
                        </span>
                      </td>
                      <td class="font-medium text-black dark:text-white">{{ d.district }}</td>
                      <td class="text-primary-600 font-medium">{{ formatUnitPrice(d.avg_unit_price) }}</td>
                      <td class="text-sm text-bodydark2">{{ formatUnitPrice(d.min_unit_price) }} ~ {{ formatUnitPrice(d.max_unit_price) }}</td>
                      <td class="text-meta-1 font-medium">{{ formatPrice(d.avg_total_price) }}</td>
                      <td>{{ d.avg_area?.toFixed(1) || '-' }} 坪</td>
                      <td>{{ d.transaction_count }} 筆</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <!-- Heatmap Tab -->
        <div v-show="activeTab === 'heatmap'">
          <div class="card">
            <div class="card-header flex justify-between items-center">
              <h5 class="text-xl font-semibold text-black dark:text-white">🔥 價格熱力圖</h5>
              <div class="flex items-center gap-2 text-sm text-bodydark2">
                <span>低價</span>
                <div class="w-24 h-3 rounded-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-500"></div>
                <span>高價</span>
              </div>
            </div>
            <div class="card-body">
              <div v-if="!heatmapData || heatmapData.districts.length === 0" class="py-10 text-center">
                <p class="text-4xl mb-4">🗺️</p>
                <p class="text-bodydark2">尚無熱力圖資料</p>
              </div>
              <template v-else>
                <p class="text-center text-sm text-bodydark2 mb-6">
                  單價範圍：{{ formatUnitPrice(heatmapData.min) }} ~ {{ formatUnitPrice(heatmapData.max) }}
                </p>
                <div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
                  <div 
                    v-for="d in heatmapData.districts" 
                    :key="d.district"
                    class="heatmap-cell"
                    :style="{ backgroundColor: getHeatColor(d.heat) }"
                    :title="`${d.district}\n平均單價：${formatUnitPrice(d.avgUnitPrice)}\n交易筆數：${d.count}`"
                  >
                    <p class="font-semibold text-sm">{{ d.district.replace(/^.*[市縣]/, '') }}</p>
                    <p class="text-lg font-bold">{{ (d.avgUnitPrice / 10000).toFixed(1) }}萬</p>
                  </div>
                </div>
              </template>
            </div>
          </div>
        </div>

        <!-- Settings Tab -->
        <div v-show="activeTab === 'settings'">
          <div class="card">
            <div class="card-header">
              <h5 class="text-xl font-semibold text-black dark:text-white">⚙️ 資料更新</h5>
            </div>
            <div class="card-body">
              <p class="mb-6 text-bodydark2">選擇年份與季度，抓取內政部實價登錄公開資料。</p>
              <div class="grid grid-cols-1 gap-4 md:grid-cols-3 max-w-xl">
                <div>
                  <label class="mb-2.5 block text-black dark:text-white">民國年份</label>
                  <select v-model="selectedYear" class="select">
                    <option v-for="y in yearOptions" :key="y" :value="y">
                      民國{{ y }}年 ({{ parseInt(y) + 1911 }})
                    </option>
                  </select>
                </div>
                <div>
                  <label class="mb-2.5 block text-black dark:text-white">季度</label>
                  <select v-model="selectedSeason" class="select">
                    <option v-for="s in seasonOptions" :key="s.value" :value="s.value">{{ s.label }}</option>
                  </select>
                </div>
                <div class="flex items-end">
                  <button 
                    @click="triggerCrawl" 
                    :disabled="crawling"
                    class="btn btn-primary w-full"
                  >
                    {{ crawling ? '⏳ 抓取中...' : '🔄 開始抓取' }}
                  </button>
                </div>
              </div>
              
              <div class="mt-8 p-4 rounded-lg bg-gray-100 dark:bg-meta-4">
                <h6 class="font-medium text-black dark:text-white mb-2">💡 說明</h6>
                <ul class="text-sm text-bodydark2 space-y-1">
                  <li>• 資料來源：內政部不動產交易實價查詢服務網</li>
                  <li>• 更新頻率：每月 1、11、21 日公告</li>
                  <li>• 抓取時間約需 1-3 分鐘</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

      </main>
    </div>
  </div>
</template>
