import { Router } from 'express';
import { queryTransactions, getStatistics, getPriceTrend } from '../database';
import { crawlAllCities } from '../crawler';

const router = Router();

// 取得交易資料列表
router.get('/transactions', (req, res) => {
  try {
    const { district, minPrice, maxPrice, startDate, endDate, limit = '50', offset = '0' } = req.query;
    
    const data = queryTransactions({
      district: district as string,
      minPrice: minPrice ? parseInt(minPrice as string) : undefined,
      maxPrice: maxPrice ? parseInt(maxPrice as string) : undefined,
      startDate: startDate as string,
      endDate: endDate as string,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
    });
    
    res.json({ success: true, data, count: data.length });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// 取得統計資料
router.get('/statistics', (req, res) => {
  try {
    const data = getStatistics();
    res.json({ success: true, data });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// 取得價格趨勢
router.get('/trend', (req, res) => {
  try {
    const { district } = req.query;
    const data = getPriceTrend(district as string);
    res.json({ success: true, data });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// 手動觸發抓取
router.post('/crawl', async (req, res) => {
  try {
    const { season } = req.body;
    const count = await crawlAllCities(season);
    res.json({ success: true, message: `已新增 ${count} 筆資料` });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

export default router;
