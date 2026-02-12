import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dbPath = path.join(__dirname, '../../data/real_estate.db');
const dbDir = path.dirname(dbPath);

// 確保資料庫目錄存在
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);

// 初始化資料表
export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      district TEXT,
      transaction_type TEXT,
      address TEXT,
      project_name TEXT,
      land_area REAL,
      building_area REAL,
      floor TEXT,
      total_floor INTEGER,
      building_type TEXT,
      main_use TEXT,
      construction TEXT,
      build_year TEXT,
      transaction_date TEXT,
      total_price INTEGER,
      unit_price INTEGER,
      parking_type TEXT,
      parking_price INTEGER,
      note TEXT,
      source TEXT,
      raw_data TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(district, address, transaction_date, total_price)
    );

    CREATE INDEX IF NOT EXISTS idx_district ON transactions(district);
    CREATE INDEX IF NOT EXISTS idx_transaction_date ON transactions(transaction_date);
    CREATE INDEX IF NOT EXISTS idx_total_price ON transactions(total_price);
    CREATE INDEX IF NOT EXISTS idx_unit_price ON transactions(unit_price);
    CREATE INDEX IF NOT EXISTS idx_project_name ON transactions(project_name);
  `);

  // 檢查並新增 project_name 欄位（相容舊資料庫）
  try {
    const columns = db.prepare("PRAGMA table_info(transactions)").all() as { name: string }[];
    const hasProjectName = columns.some(col => col.name === 'project_name');
    if (!hasProjectName) {
      db.exec('ALTER TABLE transactions ADD COLUMN project_name TEXT');
      console.log('✅ 已新增 project_name 欄位');
    }
  } catch (e) {
    // 忽略
  }
  
  console.log('✅ 資料庫初始化完成');
}

// 插入交易資料
export function insertTransaction(data: {
  district: string;
  transaction_type: string;
  address: string;
  project_name: string | null;
  land_area: number | null;
  building_area: number | null;
  floor: string | null;
  total_floor: number | null;
  building_type: string | null;
  main_use: string | null;
  construction: string | null;
  build_year: string | null;
  transaction_date: string;
  total_price: number;
  unit_price: number | null;
  parking_type: string | null;
  parking_price: number | null;
  note: string | null;
  source: string;
  raw_data: string;
}) {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO transactions (
      district, transaction_type, address, project_name, land_area, building_area,
      floor, total_floor, building_type, main_use, construction,
      build_year, transaction_date, total_price, unit_price,
      parking_type, parking_price, note, source, raw_data
    ) VALUES (
      @district, @transaction_type, @address, @project_name, @land_area, @building_area,
      @floor, @total_floor, @building_type, @main_use, @construction,
      @build_year, @transaction_date, @total_price, @unit_price,
      @parking_type, @parking_price, @note, @source, @raw_data
    )
  `);
  
  return stmt.run(data);
}

// 批量插入
export function insertTransactionsBatch(dataList: Parameters<typeof insertTransaction>[0][]) {
  const insert = db.transaction((items: typeof dataList) => {
    let inserted = 0;
    for (const item of items) {
      const result = insertTransaction(item);
      if (result.changes > 0) inserted++;
    }
    return inserted;
  });
  
  return insert(dataList);
}

// 查詢交易資料
export function queryTransactions(params: {
  district?: string;
  minPrice?: number;
  maxPrice?: number;
  startDate?: string;
  endDate?: string;
  projectName?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}) {
  let sql = 'SELECT * FROM transactions WHERE 1=1';
  const bindings: any[] = [];
  
  if (params.district) {
    sql += ' AND district LIKE ?';
    bindings.push(`%${params.district}%`);
  }
  if (params.minPrice) {
    sql += ' AND total_price >= ?';
    bindings.push(params.minPrice);
  }
  if (params.maxPrice) {
    sql += ' AND total_price <= ?';
    bindings.push(params.maxPrice);
  }
  if (params.startDate) {
    sql += ' AND transaction_date >= ?';
    bindings.push(params.startDate);
  }
  if (params.endDate) {
    sql += ' AND transaction_date <= ?';
    bindings.push(params.endDate);
  }
  if (params.projectName) {
    sql += ' AND project_name LIKE ?';
    bindings.push(`%${params.projectName}%`);
  }
  
  // 排序邏輯
  const allowedSortFields = ['transaction_date', 'total_price', 'unit_price', 'project_name', 'building_area'];
  const sortField = allowedSortFields.includes(params.sortBy || '') ? params.sortBy : 'transaction_date';
  const sortOrder = params.sortOrder === 'asc' ? 'ASC' : 'DESC';
  sql += ` ORDER BY ${sortField} ${sortOrder}`;
  
  if (params.limit) {
    sql += ' LIMIT ?';
    bindings.push(params.limit);
  }
  if (params.offset) {
    sql += ' OFFSET ?';
    bindings.push(params.offset);
  }
  
  return db.prepare(sql).all(...bindings);
}

// 取得統計資料
export function getStatistics() {
  const totalCount = db.prepare('SELECT COUNT(*) as count FROM transactions').get() as { count: number };
  const avgPrice = db.prepare('SELECT AVG(unit_price) as avg FROM transactions WHERE unit_price > 0').get() as { avg: number };
  const districts = db.prepare('SELECT DISTINCT district FROM transactions ORDER BY district').all() as { district: string }[];
  const latestDate = db.prepare('SELECT MAX(transaction_date) as date FROM transactions').get() as { date: string };
  
  return {
    totalCount: totalCount.count,
    avgUnitPrice: Math.round(avgPrice.avg || 0),
    districts: districts.map(d => d.district),
    latestDate: latestDate.date
  };
}

// 取得價格趨勢
export function getPriceTrend(district?: string) {
  let sql = `
    SELECT 
      substr(transaction_date, 1, 7) as month,
      AVG(unit_price) as avg_price,
      COUNT(*) as count
    FROM transactions 
    WHERE unit_price > 0
  `;
  
  const bindings: any[] = [];
  if (district) {
    sql += ' AND district LIKE ?';
    bindings.push(`%${district}%`);
  }
  
  sql += ' GROUP BY substr(transaction_date, 1, 7) ORDER BY month DESC';
  
  return db.prepare(sql).all(...bindings);
}

// 取得區域行情分析
export function getDistrictAnalysis() {
  const sql = `
    SELECT 
      district,
      COUNT(*) as transaction_count,
      AVG(unit_price) as avg_unit_price,
      MIN(unit_price) as min_unit_price,
      MAX(unit_price) as max_unit_price,
      AVG(total_price) as avg_total_price,
      AVG(building_area) as avg_area,
      MIN(transaction_date) as earliest_date,
      MAX(transaction_date) as latest_date
    FROM transactions 
    WHERE unit_price > 0 AND district IS NOT NULL AND district != ''
    GROUP BY district
    ORDER BY avg_unit_price DESC
  `;
  
  return db.prepare(sql).all();
}

// 取得熱力圖資料（各區域平均單價）
export function getHeatmapData() {
  const sql = `
    SELECT 
      district,
      AVG(unit_price) as avg_unit_price,
      COUNT(*) as count
    FROM transactions 
    WHERE unit_price > 0 AND district IS NOT NULL AND district != ''
    GROUP BY district
    HAVING count >= 1
    ORDER BY avg_unit_price DESC
  `;
  
  const data = db.prepare(sql).all() as { district: string; avg_unit_price: number; count: number }[];
  
  // 計算價格區間用於熱力圖顏色
  if (data.length === 0) return { districts: [], min: 0, max: 0 };
  
  const prices = data.map(d => d.avg_unit_price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  
  return {
    districts: data.map(d => ({
      district: d.district,
      avgUnitPrice: Math.round(d.avg_unit_price),
      count: d.count,
      // 計算熱力值 0-1
      heat: max > min ? (d.avg_unit_price - min) / (max - min) : 0.5
    })),
    min: Math.round(min),
    max: Math.round(max)
  };
}