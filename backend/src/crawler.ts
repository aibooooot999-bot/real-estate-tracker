import https from 'https';
import http from 'http';
import { parse } from 'csv-parse/sync';
import iconv from 'iconv-lite';
import path from 'path';
import fs from 'fs';
import { initDatabase, insertTransactionsBatch } from './database';

// 內政部實價登錄 Open Data 下載連結
// 資料來源：https://plvr.land.moi.gov.tw/DownloadOpenData
const CITIES = [
  // { code: 'A', name: '臺北市' },
  { code: 'B', name: '臺中市' },
  // { code: 'C', name: '基隆市' },
  // { code: 'D', name: '臺南市' },
  // { code: 'E', name: '高雄市' },
  // { code: 'F', name: '新北市' },
  // { code: 'G', name: '宜蘭縣' },
  // { code: 'H', name: '桃園市' },
  // { code: 'I', name: '嘉義市' },
  // { code: 'J', name: '新竹縣' },
  // { code: 'K', name: '苗栗縣' },
  // { code: 'L', name: '臺中縣' },
  // { code: 'M', name: '南投縣' },
  // { code: 'N', name: '彰化縣' },
  // { code: 'O', name: '新竹市' },
  // { code: 'P', name: '雲林縣' },
  // { code: 'Q', name: '嘉義縣' },
  // { code: 'T', name: '屏東縣' },
  // { code: 'U', name: '花蓮縣' },
  // { code: 'V', name: '臺東縣' },
  // { code: 'W', name: '金門縣' },
  // { code: 'X', name: '澎湖縣' },
  // { code: 'Z', name: '連江縣' },
];

// 取得最新一季的代碼（民國年 + 季度 S1/S2/S3/S4）
function getCurrentSeason(): string {
  const now = new Date();
  const year = now.getFullYear() - 1911; // 民國年
  const month = now.getMonth() + 1;
  let season: number;

  if (month <= 3) season = 4; // Q1 看上一季
  else if (month <= 6) season = 1;
  else if (month <= 9) season = 2;
  else season = 3;

  const actualYear = month <= 3 ? year - 1 : year;
  return `${actualYear}S${season}`;
}

function buildSeason(rocYear?: number, quarter?: number): string {
  if (!rocYear || !quarter) return getCurrentSeason();
  if (rocYear < 1 || rocYear > 200) return getCurrentSeason();
  if (quarter < 1 || quarter > 4) return getCurrentSeason();
  return `${rocYear}S${quarter}`;
}

// 下載 CSV 資料
function downloadCSV(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const client = url.startsWith('https') ? https : http;
      
      const request = client.get(url, { 
        headers: { 
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 30000
      }, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          // Follow redirect
          if (res.headers.location) {
            downloadCSV(res.headers.location).then(resolve).catch(reject);
            return;
          }
        }
        
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }
        
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => resolve(Buffer.concat(chunks)));
        res.on('error', reject);
      });
      
      request.on('error', reject);
      request.on('timeout', () => {
        request.destroy();
        reject(new Error('下載超時'));
      });
    } catch (e) {
      reject(e);
    }
  });
}

// 解析 CSV 資料
function parseCSV(buffer: Buffer): any[] {
  // 嘗試 UTF-8，失敗則用 Big5
  let content: string;
  try {
    content = buffer.toString('utf-8');
    if (content.includes('�')) throw new Error('Invalid UTF-8');
  } catch {
    content = iconv.decode(buffer, 'big5');
  }
  
  try {
    return parse(content, {
      columns: true,
      skip_empty_lines: true,
      relaxColumnCount: true,
      relaxQuotes: true,
    });
  } catch (e) {
    console.error('CSV 解析錯誤:', e);
    return [];
  }
}

// 轉換民國年日期為西元年
function convertDate(rocDate: string): string {
  if (!rocDate) return '';

  const digits = rocDate.replace(/\D/g, '');
  if (digits.length < 5) return '';

  let year: number | null = null;
  let month = '';
  let day = '';

  if (digits.length === 8 && /^(19|20)/.test(digits)) {
    year = parseInt(digits.substring(0, 4));
    month = digits.substring(4, 6);
    day = digits.substring(6, 8);
  } else {
    const yearLen = digits.length - 4;
    const rocYear = parseInt(digits.substring(0, yearLen));
    if (!isNaN(rocYear)) {
      year = rocYear + 1911;
      month = digits.substring(yearLen, yearLen + 2);
      day = digits.substring(yearLen + 2, yearLen + 4);
    }
  }

  if (!year || month.length !== 2 || day.length !== 2) return '';

  const parsedYear = year;
  const parsedMonth = parseInt(month);
  const parsedDay = parseInt(day);

  if (parsedYear < 1911 || parsedYear > 2100) return '';
  if (parsedMonth < 1 || parsedMonth > 12) return '';
  if (parsedDay < 1 || parsedDay > 31) return '';

  return `${year}-${month}-${day}`;
}

function getDistrict(row: any, cityName: string): string {
  const direct = (row['鄉鎮市區'] || '').trim();
  if (direct) return direct;

  const location = (row['土地區段位置或建物區門牌'] || row['土地位置建物門牌'] || '').trim();
  if (!location) return '';

  const cityMatch = location.match(/^(.*?[市縣])(.+?(區|市|鎮|鄉))/);
  if (cityMatch && cityMatch[2]) {
    return cityMatch[2];
  }

  const districtMatch = location.match(/(.+?(區|市|鎮|鄉))/);
  return districtMatch ? districtMatch[1] : '';
}

// 轉換面積（平方公尺 -> 坪）
function toPin(sqm: string | number): number | null {
  const val = typeof sqm === 'string' ? parseFloat(sqm) : sqm;
  if (isNaN(val) || val <= 0) return null;
  return Math.round(val / 3.30579 * 100) / 100;
}

// 保存 CSV 檔案到 data 資料夾
function saveCSVFile(buffer: Buffer, season: string, cityName: string): string {
  const csvDir = path.join(__dirname, '../../data/csv', season);
  
  // 確保目錄存在
  if (!fs.existsSync(csvDir)) {
    fs.mkdirSync(csvDir, { recursive: true });
  }
  
  const filename = `${cityName}_${season}.csv`;
  const filepath = path.join(csvDir, filename);
  
  fs.writeFileSync(filepath, buffer);
  console.log(`💾 已保存 CSV 檔案: ${filepath}`);
  
  return filepath;
}

// 處理單一城市的資料
async function crawlCity(cityCode: string, cityName: string, season: string) {
  // 不動產買賣資料 URL 格式
  const baseUrl = 'https://plvr.land.moi.gov.tw/DownloadSeason';
  const url = `${baseUrl}?season=${season}&type=zip&fileName=${cityCode}_lvr_land_b.csv`;
  
  console.log(`📥 下載 ${cityName} (${season})...`);
  
  try {
    const buffer = await downloadCSV(url);
    const records = parseCSV(buffer);
    
    if (records.length === 0) {
      console.log(`⚠️ ${cityName} 無資料`);
      return 0;
    }
    
    // 保存原始 CSV 檔案
    saveCSVFile(buffer, season, cityName);
    
    const transactions = records.map((row: any) => {
      // 欄位名稱可能因版本不同而異，需要彈性處理
      const district = getDistrict(row, cityName);
      const address = row['土地位置建物門牌'] || row['土地區段位置或建物區門牌'] || '';
      const transactionDate = convertDate(row['交易年月日'] || '');
      const totalPrice = parseInt(row['總價元'] || row['總價(元)'] || '0') || 0;
      const unitPrice = parseInt(row['單價元平方公尺'] || row['單價(元/平方公尺)'] || '0') || 0;
      
      const fullDistrict = district
        ? (district.startsWith(cityName) ? district : `${cityName}${district}`)
        : cityName;

      return {
        district: fullDistrict,
        transaction_type: row['交易標的'] || '房地(土地+建物)',
        address,
        land_area: toPin(row['土地移轉總面積平方公尺'] || row['土地移轉總面積(平方公尺)'] || 0),
        building_area: toPin(row['建物移轉總面積平方公尺'] || row['建物移轉總面積(平方公尺)'] || 0),
        floor: row['移轉層次'] || null,
        total_floor: parseInt(row['總樓層數'] || '0') || null,
        building_type: row['建物型態'] || null,
        main_use: row['主要用途'] || null,
        construction: row['主要建材'] || null,
        build_year: row['建築完成年月'] || null,
        transaction_date: transactionDate,
        total_price: totalPrice,
        unit_price: unitPrice ? Math.round(unitPrice * 3.30579) : null, // 轉換為每坪價格
        parking_type: row['車位類別'] || null,
        parking_price: parseInt(row['車位總價元'] || row['車位總價(元)'] || '0') || null,
        note: row['備註'] || null,
        source: `${cityName}_${season}`,
        raw_data: JSON.stringify(row),
      };
    }).filter((t: any) => t.transaction_date && t.total_price > 0);
    
    const inserted = insertTransactionsBatch(transactions);
    console.log(`✅ ${cityName}: 新增 ${inserted}/${transactions.length} 筆`);
    
    return inserted;
  } catch (e: any) {
    console.error(`❌ ${cityName} 錯誤: ${e.message}`);
    return 0;
  }
}

// 主要抓取函數
export async function crawlAllCities(season?: string, rocYear?: number, quarter?: number) {
  const targetSeason = season || buildSeason(rocYear, quarter);
  console.log(`\n🚀 開始抓取實價登錄資料 (${targetSeason})\n`);
  
  initDatabase();
  
  let totalInserted = 0;
  
  for (const city of CITIES) {
    const inserted = await crawlCity(city.code, city.name, targetSeason);
    totalInserted += inserted;
    
    // 避免請求過快
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log(`\n📊 總計新增 ${totalInserted} 筆資料\n`);
  return totalInserted;
}

// 直接執行時的入口
if (require.main === module) {
  const season = process.argv[2];
  const rocYear = process.argv[3] ? parseInt(process.argv[3]) : undefined;
  const quarter = process.argv[4] ? parseInt(process.argv[4]) : undefined;
  
  crawlAllCities(season, rocYear, quarter)
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
