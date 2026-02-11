<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
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
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend)

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

const transactions = ref<Transaction[]>([])
const statistics = ref<Statistics | null>(null)
const trendData = ref<TrendData[]>([])
const loading = ref(false)
const crawling = ref(false)

// 計算當前民國年份和季度
function getCurrentRocYearAndSeason() {
  const now = new Date()
  const year = now.getFullYear() - 1911 // 民國年
  const month = now.getMonth() + 1
  let season: number
  
  if (month <= 3) season = 4 // Q1 看上一季
  else if (month <= 6) season = 1
  else if (month <= 9) season = 2
  else season = 3
  
  const actualYear = month <= 3 ? year - 1 : year
  return { year: actualYear, season }
}

const currentPeriod = getCurrentRocYearAndSeason()

// 年份和季度選擇
const selectedYear = ref(currentPeriod.year.toString())
const selectedSeason = ref(currentPeriod.season.toString())

// 生成年份選項（民國100年到當前+1年）
const yearOptions = computed(() => {
  const currentYear = new Date().getFullYear() - 1911
  const years: string[] = []
  for (let y = 100; y <= currentYear + 1; y++) {
    years.push(y.toString())
  }
  return years.reverse() // 新的年份在前
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

// 切換排序
function toggleSort(field: string) {
  if (sortBy.value === field) {
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortBy.value = field
    sortOrder.value = 'desc'
  }
  fetchTransactions()
}

// 取得排序圖示
function getSortIcon(field: string): string {
  if (sortBy.value !== field) return '↕️'
  return sortOrder.value === 'asc' ? '↑' : '↓'
}

// 取得統計資料
async function fetchStatistics() {
  try {
    const { data } = await axios.get('/api/statistics')
    if (data.success) {
      statistics.value = data.data
    }

    console.log('Fetched statistics:', data.data)
  } catch (e) {
    console.error('Failed to fetch statistics:', e)
  }
}

// 取得交易資料
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

// 取得價格趨勢
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

// 手動抓取資料
async function triggerCrawl() {
  const season = `${selectedYear.value}S${selectedSeason.value}`
  const yearAD = parseInt(selectedYear.value) + 1911
  const seasonText = seasonOptions.find(s => s.value === selectedSeason.value)?.label || ''
  
  if (!confirm(`確定要抓取 民國${selectedYear.value}年 ${seasonText} (西元${yearAD}年) 的資料？\n這可能需要幾分鐘時間。`)) return
  
  crawling.value = true
  try {
    const { data } = await axios.post('/api/crawl', { season })
    alert(data.message || '抓取完成')
    await Promise.all([fetchStatistics(), fetchTransactions(), fetchTrend()])
  } catch (e: any) {
    alert('抓取失敗: ' + (e.response?.data?.error || e.message))
  } finally {
    crawling.value = false
  }
}

// 搜尋
function search() {
  fetchTransactions()
  fetchTrend()
  fetchStatistics()
}

// 重置篩選
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
  fetchStatistics()
}

// 格式化價格
function formatPrice(price: number): string {
  if (price >= 100000000) {
    return (price / 100000000).toFixed(2) + ' 億'
  } else if (price >= 10000) {
    return (price / 10000).toFixed(0) + ' 萬'
  }
  return price.toLocaleString()
}

// 格式化單價
function formatUnitPrice(price: number): string {
  if (!price) return '-'
  return (price / 10000).toFixed(1) + ' 萬/坪'
}

// 格式化日期
function formatDate(dateStr: string): string {
  if (!dateStr) return '-'
  // 確保日期格式正確 YYYY-MM-DD
  const match = dateStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (!match) return dateStr
  
  const [, year, month, day] = match
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
}

// 圖表資料
const chartData = computed(() => ({
  labels: trendData.value.map(d => d.month),
  datasets: [
    {
      label: '平均單價 (萬/坪)',
      data: trendData.value.map(d => d.avg_price / 10000),
      borderColor: '#667eea',
      backgroundColor: 'rgba(102, 126, 234, 0.1)',
      tension: 0.3,
      fill: true,
    }
  ]
}))

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
  },
  scales: {
    y: {
      beginAtZero: false,
      ticks: {
        callback: (value: string | number) => value + ' 萬'
      }
    }
  }
}

onMounted(() => {
  fetchStatistics()
  fetchTransactions()
  fetchTrend()
})
</script>

<template>
  <div class="container">
    <div class="header">
      <h1>🏠 台灣實價登錄查詢</h1>
      <p>不動產交易資料查詢與分析工具</p>
    </div>

    <!-- 統計卡片 -->
    <div class="stats-grid" v-if="statistics">
      <div class="stat-card">
        <div class="value">{{ statistics.totalCount.toLocaleString() }}</div>
        <div class="label">總交易筆數</div>
      </div>
      <div class="stat-card">
        <div class="value">{{ (statistics.avgUnitPrice / 10000).toFixed(1) }}</div>
        <div class="label">平均單價 (萬/坪)</div>
      </div>
      <div class="stat-card">
        <div class="value">{{ statistics.districts.length }}</div>
        <div class="label">涵蓋區域</div>
      </div>
      <div class="stat-card">
        <div class="value">{{ formatDate(statistics.latestDate) }}</div>
        <div class="label">最新資料日期</div>
      </div>
    </div>

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
      <div class="card-header">
        🔄 資料更新
      </div>
      <div class="card-body">
        <div class="filter-row">
          <label style="display: flex; align-items: center; gap: 8px;">
            <span style="white-space: nowrap;">民國年份：</span>
            <select v-model="selectedYear" style="flex: 1;">
              <option v-for="y in yearOptions" :key="y" :value="y">
                民國{{ y }}年 (西元{{ parseInt(y) + 1911 }}年)
              </option>
            </select>
          </label>
          <label style="display: flex; align-items: center; gap: 8px;">
            <span style="white-space: nowrap;">季度：</span>
            <select v-model="selectedSeason" style="flex: 1;">
              <option v-for="s in seasonOptions" :key="s.value" :value="s.value">
                {{ s.label }}
              </option>
            </select>
          </label>
          <button class="btn btn-primary" @click="triggerCrawl" :disabled="crawling" style="white-space: nowrap;">
            {{ crawling ? '抓取中...' : '🔄 抓取資料' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 搜尋篩選 -->
    <div class="card">
      <div class="card-header">
        🔍 搜尋條件
      </div>
      <div class="card-body">
        <div class="filter-row">
          <select v-model="filters.district">
            <option value="">所有區域</option>
            <option v-for="d in statistics?.districts" :key="d" :value="d">{{ d }}</option>
          </select>
          <input v-model="filters.projectName" type="text" placeholder="案名搜尋">
          <input v-model="filters.minPrice" type="number" placeholder="最低總價 (元)">
          <input v-model="filters.maxPrice" type="number" placeholder="最高總價 (元)">
          <input v-model="filters.startDate" type="date" placeholder="開始日期">
          <input v-model="filters.endDate" type="date" placeholder="結束日期">
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
      <div class="card-body" style="overflow-x: auto;">
        <div v-if="loading" class="loading">載入中...</div>
        <div v-else-if="transactions.length === 0" class="empty">
          尚無資料，請點擊「更新資料」抓取最新實價登錄
        </div>
        <table v-else>
          <thead>
            <tr>
              <th>交易日期</th>
              <th>區域</th>
              <th class="sortable" @click="toggleSort('project_name')">
                案名 {{ getSortIcon('project_name') }}
              </th>
              <th>地址</th>
              <th>坪數</th>
              <th class="sortable" @click="toggleSort('total_price')">
                總價 {{ getSortIcon('total_price') }}
              </th>
              <th class="sortable" @click="toggleSort('unit_price')">
                單價 {{ getSortIcon('unit_price') }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="t in transactions" :key="t.id">
              <td>{{ formatDate(t.transaction_date) }}</td>
              <td>{{ t.district }}</td>
              <td class="project-name">{{ t.project_name || '-' }}</td>
              <td>{{ t.address?.substring(0, 20) }}...</td>
              <td>{{ t.building_area?.toFixed(1) || '-' }} 坪</td>
              <td class="price">{{ formatPrice(t.total_price) }}</td>
              <td class="unit-price">{{ formatUnitPrice(t.unit_price) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
