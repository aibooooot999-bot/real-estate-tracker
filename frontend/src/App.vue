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

// 篩選條件
const filters = ref({
  district: '',
  minPrice: '',
  maxPrice: '',
  startDate: '',
  endDate: '',
})

// 取得統計資料
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
  if (!confirm('確定要開始抓取最新資料？這可能需要幾分鐘時間。')) return
  
  crawling.value = true
  try {
    const { data } = await axios.post('/api/crawl')
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
}

// 重置篩選
function resetFilters() {
  filters.value = {
    district: '',
    minPrice: '',
    maxPrice: '',
    startDate: '',
    endDate: '',
  }
  fetchTransactions()
  fetchTrend()
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
        callback: (value: number) => value + ' 萬'
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
        <div class="value">{{ statistics.latestDate || '-' }}</div>
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

    <!-- 搜尋篩選 -->
    <div class="card">
      <div class="card-header">
        🔍 搜尋條件
        <button class="btn btn-primary" @click="triggerCrawl" :disabled="crawling">
          {{ crawling ? '抓取中...' : '更新資料' }}
        </button>
      </div>
      <div class="card-body">
        <div class="filter-row">
          <select v-model="filters.district">
            <option value="">所有區域</option>
            <option v-for="d in statistics?.districts" :key="d" :value="d">{{ d }}</option>
          </select>
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
              <th>地址</th>
              <th>建物型態</th>
              <th>坪數</th>
              <th>總價</th>
              <th>單價</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="t in transactions" :key="t.id">
              <td>{{ t.transaction_date }}</td>
              <td>{{ t.district }}</td>
              <td>{{ t.address?.substring(0, 20) }}...</td>
              <td>{{ t.building_type || '-' }}</td>
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
