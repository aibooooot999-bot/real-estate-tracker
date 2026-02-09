import express from 'express';
import cors from 'cors';
import cron from 'node-cron';
import { initDatabase } from './database';
import apiRoutes from './routes/api';
import { crawlAllCities } from './crawler';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// 初始化資料庫
initDatabase();

// API 路由
app.use('/api', apiRoutes);

// 健康檢查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 首頁
app.get('/', (req, res) => {
  res.json({
    name: '台灣實價登錄 API',
    version: '1.0.0',
    endpoints: {
      'GET /api/transactions': '查詢交易資料',
      'GET /api/statistics': '取得統計資料',
      'GET /api/trend': '取得價格趨勢',
      'POST /api/crawl': '手動觸發資料抓取',
    }
  });
});

// 定時抓取資料 (每月 2, 12, 22 日凌晨 3 點)
cron.schedule('0 3 2,12,22 * *', async () => {
  console.log('⏰ 定時任務：開始抓取實價登錄資料...');
  try {
    await crawlAllCities();
    console.log('✅ 定時抓取完成');
  } catch (e) {
    console.error('❌ 定時抓取失敗:', e);
  }
}, {
  timezone: 'Asia/Taipei'
});

// 啟動伺服器
app.listen(PORT, () => {
  console.log(`
🏠 台灣實價登錄 API 伺服器已啟動
📍 http://localhost:${PORT}
📊 API: http://localhost:${PORT}/api
⏰ 定時抓取: 每月 2, 12, 22 日 03:00
  `);
});
