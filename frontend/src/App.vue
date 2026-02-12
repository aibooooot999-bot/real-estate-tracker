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

// Tab navigation
const activeTab = ref('overview')
const tabs = [
  { id: 'overview', label: '總覽', icon: '📊' },
  { id: 'search', label: '交易查詢', icon: '🔍' },
  { id: 'analysis', label: '區域分析', icon: '📈' },
  { id: 'heatmap', label: '熱力圖', icon: '🗺️' },
]

// Theme
const isDark = ref(false)

function toggleTheme() {
  isDark.value = !isDark.value
  document.documentElement.setAttribute('data-theme', isDark.value ? 'dark' : 'light')
  localStorage.setItem('theme', isDark.value ? 'dark' : 'light')
}

// 計算當前民國年份和季度
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
  for (let y = 100; y <= currentYear + 1; y++) {
    years.push(y.toString())
  }
  return years.reverse()
})

const seasonOptions = [
  { value: '1', label: '第一季 (1-3月)' },
  { value: '2', label: '第二季 (4-6月)' },
  { value: '3', label: '第三季 (7-9月)' },
  { value: '4', label: '第四季 (10-12月)' },
]

// 篩選條件
const filters = ref({
  district: '',
  minPrice: '',
  maxPrice: '',
  startDate: '',
  endDate: '',
  projectName: '',
})

// 排序狀態
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

function getSortIcon(field: string): string {
  if (sortBy.value !== field) return '↕'
  return sortOrder.value === 'asc' ? '↑' : '↓'
}

// ===== API Calls =====
async function fetchStatistics() {
  try {
    const { data } = await axios.get('/api/statistics')
    if (data.success) {
      statistics.value = data.data
    }
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
    if (data.success) {
      transactions.value = data.data
    }
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
    if (data.success) {
      trendData.value = data.data.reverse()
    }
  } catch (e) {
    console.error('Failed to fetch trend:', e)
  }
}

async function fetchDistrictAnalysis() {
  try {
    const { data } = await axios.get('/api/district-analysis')
    if (data.success) {
      districtAnalysis.value = data.data
    }
  } catch (e) {
    console.error('Failed to fetch district analysis:', e)
  }
}

async function fetchHeatmap() {
  try {
    const { data } = await axios.get('/api/heatmap')
    if (data.success) {
      heatmapData.value = data.data
    }
  } catch (e) {
    console.error('Failed to fetch heatmap:', e)
  }
}

async function triggerCrawl() {
  const season = `${selectedYear.value}S${selectedSeason.value}`
  const yearAD = parseInt(selectedYear.value) + 1911
  const seasonText = seasonOptions.find(s => s.value === selectedSeason.value)?.label || ''
  
  if (!confirm(`確定要抓取 民國${selectedYear.value}年 ${seasonText} (西元${yearAD}年) 的資料？`)) return
  
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
  await Promise.all([
    fetchStatistics(),
    fetchTransactions(),
    fetchTrend(),
    fetchDistrictAnalysis(),
    fetchHeatmap()
  ])
}

function search() {
  fetchTransactions()
  fetchTrend()
}

function resetFilters() {
  filters.value = {
    district: '',
    minPrice: '',
    maxPrice: '',
    startDate: '',
    endDate: '',
    projectName: '',
  }
  sortBy.value = 'transaction_date'
  sortOrder.value = 'desc'
  fetchTransactions()
  fetchTrend()
}

// ===== Formatters =====
function formatPrice(price: number): string {
  if (!price) return '-'
  if (price >= 100000000) {
    return (price / 100000000).toFixed(2) + ' 億'
  } else if (price >= 10000) {
    return (price / 10000).toFixed(0) + ' 萬'
  }
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
  const [, year, month, day] = match
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
}

function getHeatColor(heat: number): string {
  // 從綠色(低價)到紅色(高價)
  if (heat < 0.5) {
    const ratio = heat * 2
    const r = Math.round(16 + (245 - 16) * ratio)
    const g = Math.round(185 - (185 - 158) * ratio)
    const b = Math.round(129 - (129 - 11) * ratio)
    return `rgb(${r}, ${g}, ${b})`
  } else {
    const ratio = (heat - 0.5) * 2
    const r = Math.round(245 - (245 - 239) * ratio)
    const g = Math.round(158 - (158 - 68) * ratio)
    const b = Math.round(11 + (68 - 11) * ratio)
    return `rgb(${r}, ${g}, ${b})`
  }
}

function getRankClass(index: number): string {
  if (index === 0) return 'rank-1'
  if (index === 1) return 'rank-2'
  if (index === 2) return 'rank-3'
  return ''
}

// ===== Chart Config =====
const chartData = computed(() => ({
  labels: trendData.value.map(d => d.month),
  datasets: [
    {
      label: '平均單價 (萬/坪)',
      data: trendData.value.map(d => d.avg_price / 10000),
      borderColor: '#0ea5e9',
      backgroundColor: 'rgba(14, 165, 233, 0.1)',
      tension: 0.4,
      fill: true,
      pointRadius: 4,
      pointHoverRadius: 6,
    }
  ]
}))

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: isDark.value ? '#1e293b' : '#fff',
      titleColor: isDark.value ? '#f1f5f9' : '#1e293b',
      bodyColor: isDark.value ? '#94a3b8' : '#64748b',
      borderColor: isDark.value ? '#334155' : '#e2e8f0',
      borderWidth: 1,
    }
  },
  scales: {
    y: {
      beginAtZero: false,
      grid: {
        color: isDark.value ? '#334155' : '#e2e8f0',
      },
      ticks: {
        color: isDark.value ? '#94a3b8' : '#64748b',
        callback: (value: number) => value + ' 萬'
      }
    },
    x: {
      grid: { display: false },
      ticks: {
        color: isDark.value ? '#94a3b8' : '#64748b',
      }
    }
  }
}))

// ===== Computed Stats =====
const avgPriceTrend = computed(() => {
  if (trendData.value.length < 2) return { value: 0, direction: 'up' }
  const current = trendData.value[trendData.value.length - 1]?.avg_price || 0
  const previous = trendData.value[trendData.value.length - 2]?.avg_price || 0
  if (previous === 0) return { value: 0, direction: 'up' }
  const change = ((current - previous) / previous) * 100
  return {
    value: Math.abs(change).toFixed(1),
    direction: change >= 0 ? 'up' : 'down'
  }
})

const topDistrict = computed(() => {
  if (districtAnalysis.value.length === 0) return '-'
  return districtAnalysis.value[0]?.district?.replace(/^.*[市縣]/, '') || '-'
})

// ===== Lifecycle =====
onMounted(() => {
  // Load theme preference
  const savedTheme = localStorage.getItem('theme')
  if (savedTheme === 'dark') {
    isDark.value = true
    document.documentElement.setAttribute('data-theme', 'dark')
  }
  
  refreshAll()
})
</script>

<template>
  <div class="container">
    <!-- Header -->
    <div class="header">
      <div class="header-top">
        <div>
          <h1>🏠 台灣預售屋追蹤</h1>
          <p>實價登錄資料分析與追蹤工具</p>
        </div>
        <button class="theme-toggle" @click="toggleTheme" :title="isDark ? '切換淺色' : '切換深色'">
          {{ isDark ? '☀️' : '🌙' }}
        </button>
      </div>
      
      <div class="header-stats" v-if="statistics">
        <div class="header-stat">
          <div class="value">{{ (statistics.avgUnitPrice / 10000).toFixed(1) }}</div>
          <div class="trend" :class="avgPriceTrend.direction">
            {{ avgPriceTrend.direction === 'up' ? '↑' : '↓' }} {{ avgPriceTrend.value }}%
          </div>
          <div class="label">平均單價 (萬/坪)</div>
        </div>
        <div class="header-stat">
          <div class="value">{{ statistics.totalCount.toLocaleString() }}</div>
          <div class="label">總交易筆數</div>
        </div>
        <div class="header-stat">
          <div class="value">{{ statistics.districts.length }}</div>
          <div class="label">涵蓋區域</div>
        </div>
        <div class="header-stat">
          <div class="value">{{ topDistrict }}</div>
          <div class="label">最高價區域</div>
        </div>
      </div>
    </div>

    <!-- Tab Navigation -->
    <div class="tab-nav">
      <button 
        v-for="tab in tabs" 
        :key="tab.id"
        class="tab-btn"
        :class="{ active: activeTab === tab.id }"
        @click="activeTab = tab.id"
      >
        <span>{{ tab.icon }}</span>
        <span>{{ tab.label }}</span>
      </button>
    </div>

    <!-- Tab: Overview -->
    <div v-show="activeTab === 'overview'">
      <!-- 價格趨勢圖 -->
      <div class="card" v-if="trendData.length > 0">
        <div class="card-header">
          📈 價格趨勢
        </div>
        <div class="chart-container">
          <Line :data="chartData" :options="chartOptions" />
        </div>
      </div>

      <!-- 資料更新 -->
      <div class="card">
        <div class="card-header">🔄 資料更新</div>
        <div class="card-body">
          <div class="filter-row">
            <label style="display: flex; align-items: center; gap: 8px;">
              <span style="white-space: nowrap;">民國年份：</span>
              <select v-model="selectedYear">
                <option v-for="y in yearOptions" :key="y" :value="y">
                  民國{{ y }}年 (西元{{ parseInt(y) + 1911 }}年)
                </option>
              </select>
            </label>
            <label style="display: flex; align-items: center; gap: 8px;">
              <span style="white-space: nowrap;">季度：</span>
              <select v-model="selectedSeason">
                <option v-for="s in seasonOptions" :key="s.value" :value="s.value">
                  {{ s.label }}
                </option>
              </select>
            </label>
            <button class="btn btn-primary" @click="triggerCrawl" :disabled="crawling">
              {{ crawling ? '⏳ 抓取中...' : '🔄 抓取資料' }}
            </button>
          </div>
        </div>
      </div>

      <!-- 快速統計 -->
      <div class="stats-grid">
        <div class="stat-card" v-for="d in districtAnalysis.slice(0, 4)" :key="d.district">
          <div class="icon">🏢</div>
          <div class="value">{{ (d.avg_unit_price / 10000).toFixed(1) }} <small style="font-size: 0.5em">萬/坪</small></div>
          <div class="label">{{ d.district.replace(/^.*[市縣]/, '') }}</div>
        </div>
      </div>
    </div>

    <!-- Tab: Search -->
    <div v-show="activeTab === 'search'">
      <!-- 搜尋篩選 -->
      <div class="card">
        <div class="card-header">🔍 搜尋條件</div>
        <div class="card-body">
          <div class="filter-row">
            <select v-model="filters.district">
              <option value="">所有區域</option>
              <option v-for="d in statistics?.districts" :key="d" :value="d">{{ d }}</option>
            </select>
            <input v-model="filters.projectName" type="text" placeholder="案名搜尋">
            <input v-model="filters.minPrice" type="number" placeholder="最低總價 (元)">
            <input v-model="filters.maxPrice" type="number" placeholder="最高總價 (元)">
            <input v-model="filters.startDate" type="date">
            <input v-model="filters.endDate" type="date">
            <button class="btn btn-primary" @click="search">搜尋</button>
            <button class="btn btn-secondary" @click="resetFilters">重置</button>
          </div>
        </div>
      </div>

      <!-- 交易資料表 -->
      <div class="card">
        <div class="card-header">
          📋 交易資料 ({{ transactions.length }} 筆)
        </div>
        <div class="card-body">
          <div v-if="loading" class="loading">
            <div class="loading-spinner"></div>
            載入中...
          </div>
          <div v-else-if="transactions.length === 0" class="empty">
            <div class="empty-icon">📭</div>
            尚無資料，請點擊「抓取資料」
          </div>
          <div v-else class="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>交易日期</th>
                  <th>區域</th>
                  <th class="sortable" :class="{ active: sortBy === 'project_name' }" @click="toggleSort('project_name')">
                    案名 <span class="sort-icon">{{ getSortIcon('project_name') }}</span>
                  </th>
                  <th>坪數</th>
                  <th class="sortable" :class="{ active: sortBy === 'total_price' }" @click="toggleSort('total_price')">
                    總價 <span class="sort-icon">{{ getSortIcon('total_price') }}</span>
                  </th>
                  <th class="sortable" :class="{ active: sortBy === 'unit_price' }" @click="toggleSort('unit_price')">
                    單價 <span class="sort-icon">{{ getSortIcon('unit_price') }}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="t in transactions" :key="t.id">
                  <td>{{ formatDate(t.transaction_date) }}</td>
                  <td>{{ t.district?.replace(/^.*[市縣]/, '') }}</td>
                  <td class="project-name" :title="t.project_name">{{ t.project_name || '-' }}</td>
                  <td>{{ t.building_area?.toFixed(1) || '-' }} 坪</td>
                  <td class="price">{{ formatPrice(t.total_price) }}</td>
                  <td class="unit-price">{{ formatUnitPrice(t.unit_price) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <!-- Tab: Analysis -->
    <div v-show="activeTab === 'analysis'">
      <div class="card" v-if="districtAnalysis.length > 0">
        <div class="card-header">📊 區域行情排名</div>
        <div class="card-body">
          <div class="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th style="width: 60px">排名</th>
                  <th>區域</th>
                  <th>平均單價</th>
                  <th>單價範圍</th>
                  <th>平均總價</th>
                  <th>平均坪數</th>
                  <th>交易筆數</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(d, index) in districtAnalysis" :key="d.district">
                  <td>
                    <span class="rank" :class="getRankClass(index)">{{ index + 1 }}</span>
                  </td>
                  <td><strong>{{ d.district }}</strong></td>
                  <td class="unit-price">{{ formatUnitPrice(d.avg_unit_price) }}</td>
                  <td class="price-range">
                    {{ formatUnitPrice(d.min_unit_price) }} ~ {{ formatUnitPrice(d.max_unit_price) }}
                  </td>
                  <td class="price">{{ formatPrice(d.avg_total_price) }}</td>
                  <td>{{ d.avg_area?.toFixed(1) || '-' }} 坪</td>
                  <td>{{ d.transaction_count }} 筆</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
      
      <div v-else class="card">
        <div class="card-body">
          <div class="empty">
            <div class="empty-icon">📊</div>
            尚無分析資料
          </div>
        </div>
      </div>
    </div>

    <!-- Tab: Heatmap -->
    <div v-show="activeTab === 'heatmap'">
      <div class="card" v-if="heatmapData && heatmapData.districts.length > 0">
        <div class="card-header">
          🔥 價格熱力圖
          <span class="heatmap-legend">
            <span>低價</span>
            <span class="legend-bar"></span>
            <span>高價</span>
          </span>
        </div>
        <div class="card-body">
          <div class="heatmap-info">
            單價範圍：{{ formatUnitPrice(heatmapData.min) }} ~ {{ formatUnitPrice(heatmapData.max) }}
          </div>
          <div class="heatmap-grid">
            <div 
              v-for="d in heatmapData.districts" 
              :key="d.district"
              class="heatmap-cell"
              :style="{ backgroundColor: getHeatColor(d.heat) }"
              :title="`${d.district}\n平均單價：${formatUnitPrice(d.avgUnitPrice)}\n交易筆數：${d.count}`"
            >
              <div class="cell-district">{{ d.district.replace(/^.*[市縣]/, '') }}</div>
              <div class="cell-price">{{ (d.avgUnitPrice / 10000).toFixed(1) }}萬</div>
            </div>
          </div>
          
          <div class="map-legend">
            <span>{{ formatUnitPrice(heatmapData.min) }}</span>
            <div class="map-legend-bar"></div>
            <span>{{ formatUnitPrice(heatmapData.max) }}</span>
          </div>
        </div>
      </div>
      
      <div v-else class="card">
        <div class="card-body">
          <div class="empty">
            <div class="empty-icon">🗺️</div>
            尚無熱力圖資料
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
