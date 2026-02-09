import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(__dirname, '../../data/real_estate.db');
const db = new Database(dbPath);

// 初始化資料表
export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      district TEXT,
      transaction_type TEXT,
      address TEXT,
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
  `);
  
  console.log('✅ 資料庫初始化完成');
}

// 插入交易資料
export function insertTransaction(data: {
  district: string;
  transaction_type: string;
  address: string;
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
      district, transaction_type, address, land_area, building_area,
      floor, total_floor, building_type, main_use, construction,
      build_year, transaction_date, total_price, unit_price,
      parking_type, parking_price, note, source, raw_data
    ) VALUES (
      @district, @transaction_type, @address, @land_area, @building_area,
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
  
  sql += ' ORDER BY transaction_date DESC';
  
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
  
  sql += ' GROUP BY month ORDER BY month DESC LIMIT 24';
  
  return db.prepare(sql).all(...bindings);
}

export default db;
