import { Router, Request, Response } from 'express';
import { queryTransactions, getStatistics, getPriceTrend, getDistrictAnalysis, getHeatmapData } from '../database';
import { crawlAllCities } from '../crawler';

const router = Router();

// 異步路由包裝器
const asyncHandler = (fn: (req: Request, res: Response) => Promise<void>) => 
  (req: Request, res: Response, next: any) => {
    Promise.resolve(fn(req, res)).catch(next);
  };

// 取得交易資料列表
router.get('/transactions', (req, res) => {
  try {
    const {
      district,
      minPrice,
      maxPrice,
      startDate,
      endDate,
      projectName,
      sortBy,
      sortOrder,
      limit = '50',
      offset = '0'
    } = req.query;
    
    const data = queryTransactions({
      district: district as string,
      minPrice: minPrice ? parseInt(minPrice as string) : undefined,
      maxPrice: maxPrice ? parseInt(maxPrice as string) : undefined,
      startDate: startDate as string,
      endDate: endDate as string,
      projectName: projectName as string,
      sortBy: sortBy as string,
      sortOrder: sortOrder as 'asc' | 'desc',
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
    });
    
    res.json({ success: true, data, count: data.length });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e?.message || '未知錯誤' });
  }
});

// 取得統計資料
router.get('/statistics', (req, res) => {
  try {
    const data = getStatistics();
    res.json({ success: true, data });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e?.message || '未知錯誤' });
  }
});

// 取得價格趨勢
router.get('/trend', (req, res) => {
  try {
    const { district } = req.query;
    const data = getPriceTrend(district as string);
    res.json({ success: true, data });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e?.message || '未知錯誤' });
  }
});

// 取得區域行情分析
router.get('/district-analysis', (req, res) => {
  try {
    const data = getDistrictAnalysis();
    res.json({ success: true, data });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e?.message || '未知錯誤' });
  }
});

// 取得熱力圖資料
router.get('/heatmap', (req, res) => {
  try {
    const data = getHeatmapData();
    res.json({ success: true, data });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e?.message || '未知錯誤' });
  }
});

// 手動觸發抓取
router.post('/crawl', asyncHandler(async (req, res) => {
  const { season, year, quarter } = req.body;
  const rocYear = typeof year === 'string' ? parseInt(year) : year;
  const seasonQuarter = typeof quarter === 'string' ? parseInt(quarter) : quarter;
  const count = await crawlAllCities(season, rocYear, seasonQuarter);
  res.json({ success: true, message: `已新增 ${count} 筆資料` });
}));

export default router;
