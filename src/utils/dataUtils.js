import { bitable } from '@lark-base-open/js-sdk';

// Convert Feishu SDK cell value to a plain primitive
function cellToPrimitive(val) {
  if (val == null) return null;
  if (typeof val === 'number') return val;
  if (typeof val === 'string') return val;
  if (typeof val === 'boolean') return val ? 1 : 0;
  if (Array.isArray(val)) {
    if (!val.length) return null;
    const f = val[0];
    if (f && typeof f === 'object') {
      if ('text' in f) return val.map(s => s.text || '').join(''); // rich text
      if ('id' in f && 'text' in f) return f.text; // select option
      if ('name' in f) return f.name; // person
    }
    return null;
  }
  if (typeof val === 'object') {
    if ('text' in val) return val.text;
    if ('value' in val) return val.value;
  }
  return null;
}

function parsePct(v) {
  if (v == null) return null;
  if (typeof v === 'number') return v <= 1 ? v : v / 100;
  if (typeof v === 'string') { const n = parseFloat(v.replace('%', '')); return isNaN(n) ? null : n / 100; }
  return null;
}
function parseNum(v) {
  if (v == null) return null;
  if (typeof v === 'number') return v;
  // Strip currency symbols (Mex$, $, ¥, €, R$, etc.), keep digits / dot / minus / comma
  const cleaned = String(v).replace(/[^\d.,-]/g, '').replace(/,/g, '');
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}
function parseRank(v) {
  if (v == null) return null;
  const m = String(v).match(/(\d[\d,]*)/);
  if (!m) return null;
  const n = parseInt(m[1].replace(/,/g, ''));
  return isNaN(n) ? null : n;
}
function tsToDate(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Excel column name → { internalKey, parseFn }
const COL_MAP = {
  '日期':           { key: 'date',       parse: 'date' },
  'ASIN':           { key: 'asin',       parse: 'text' },
  '国家':           { key: 'country',    parse: 'text' },
  '品名':           { key: 'name',       parse: 'text' },
  '销量':           { key: 'sales',      parse: 'num'  },
  '销售额':         { key: 'revenue',    parse: 'num'  },
  '小类排名':       { key: 'rank',       parse: 'rank' },
  '退货率':         { key: 'returnRate', parse: 'pct'  },
  '评分':           { key: 'rating',     parse: 'num'  },
  '店铺':           { key: 'store',      parse: 'text' },
  '一级分类':       { key: 'cat1',       parse: 'text' },
  '二级分类':       { key: 'cat2',       parse: 'text' },
  '三级分类':       { key: 'cat3',       parse: 'text' },
  'Sessions-Total': { key: 'sessions',   parse: 'num'  },
  '广告订单量':     { key: 'adOrders',   parse: 'num'  },
  '点击':           { key: 'clicks',     parse: 'num'  },
  '广告花费':       { key: 'adSpend',    parse: 'num'  },
  '净销售额':       { key: 'netRevenue', parse: 'num'  },
  '订单毛利润':     { key: 'profit',     parse: 'num'  },
  '订单量':         { key: 'orders',     parse: 'num'  },
  '退款量':         { key: 'refunds',    parse: 'num'  },
};

const PARSE_FNS = { num: parseNum, pct: parsePct, rank: parseRank, text: v => (v == null ? null : String(v).trim()), date: null };

export async function getTableMetaList() {
  return bitable.base.getTableMetaList();
}

export async function fetchRecords(tableId, onProgress) {
  const table = await bitable.base.getTableById(tableId);
  const fieldMetas = await table.getFieldMetaList();

  const nameToId = {};
  fieldMetas.forEach(f => { nameToId[f.name] = f.id; });

  // Build internalKey → { fieldId, parseFn }
  const keyToField = {};
  Object.entries(COL_MAP).forEach(([colName, { key, parse }]) => {
    if (nameToId[colName]) {
      keyToField[key] = { fieldId: nameToId[colName], parse };
    }
  });

  if (!keyToField.date) throw new Error('未找到"日期"列，请检查表格列名');
  if (!keyToField.asin) throw new Error('未找到"ASIN"列，请检查表格列名');

  // Paginate all records
  let allRecords = [], pageToken;
  do {
    const res = await table.getRecords({ pageSize: 500, ...(pageToken ? { pageToken } : {}) });
    allRecords = allRecords.concat(res.records || []);
    pageToken = res.pageToken;
    onProgress?.(allRecords.length);
  } while (pageToken);

  // Parse each record
  return allRecords.map(rec => {
    const get = key => {
      const f = keyToField[key];
      return f ? cellToPrimitive(rec.fields[f.fieldId]) : null;
    };

    let dateVal = get('date');
    if (typeof dateVal === 'number') dateVal = tsToDate(dateVal);
    else if (dateVal) dateVal = String(dateVal).trim().slice(0, 10);
    if (!dateVal) return null;

    const asinVal = get('asin');
    if (!asinVal) return null;

    const p = (key) => {
      const f = keyToField[key];
      if (!f) return null;
      const raw = cellToPrimitive(rec.fields[f.fieldId]);
      const fn = PARSE_FNS[f.parse];
      return fn ? fn(raw) : raw;
    };

    return {
      date:       dateVal,
      asin:       String(asinVal).trim(),
      country:    String(get('country') || '').trim(),
      name:       String(get('name')    || '').trim(),
      sales:      p('sales'),
      revenue:    p('revenue'),
      rank:       p('rank'),
      returnRate: p('returnRate'),
      rating:     p('rating'),
      store:      String(get('store') || '').trim(),
      cat1:       String(get('cat1')  || '').trim(),
      cat2:       String(get('cat2')  || '').trim(),
      cat3:       String(get('cat3')  || '').trim(),
      sessions:   p('sessions'),
      adOrders:   p('adOrders'),
      clicks:     p('clicks'),
      adSpend:    p('adSpend'),
      netRevenue: p('netRevenue'),
      profit:     p('profit'),
      orders:     p('orders'),
      refunds:    p('refunds'),
    };
  }).filter(Boolean);
}
