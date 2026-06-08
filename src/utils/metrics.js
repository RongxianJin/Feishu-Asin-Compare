export const METRICS = [
  { key: 'sales',   label: '销量',       fmt: 'num',   agg: 'sum'  },
  { key: 'revenue', label: '销售额',     fmt: 'money', agg: 'sum'  },
  { key: 'margin',  label: '订单毛利率', fmt: 'pct',   agg: 'calc' },
  { key: 'cvr',     label: 'CVR',        fmt: 'pct',   agg: 'calc' },
  { key: 'natcvr',  label: '自然CVR',    fmt: 'pct',   agg: 'calc' },
  { key: 'acoas',   label: 'ACoAS',      fmt: 'pct',   agg: 'calc' },
  { key: 'price',   label: '销售均价',   fmt: 'money', agg: 'wavg' },
  { key: 'rank',    label: '小类排名',   fmt: 'rank',  agg: 'last', inv: true },
  { key: 'return',  label: '退货率',     fmt: 'pct',   agg: 'calc' },
  { key: 'rating',  label: '评分',       fmt: 'num2',  agg: 'avg'  },
  { key: 'adcvr',   label: '广告CVR',    fmt: 'pct',   agg: 'calc' },
];

export function aggMetrics(asin, s, e, allData) {
  const rows = allData.filter(d => d.asin === asin && d.date >= s && d.date <= e);
  if (!rows.length) return null;

  const out = {
    _days: rows.length,
    _name:  rows[0].name,
    _store: rows[0].store,
    _cat2:  rows[0].cat2,
  };

  METRICS.forEach(m => {
    if (m.agg === 'sum') {
      const vals = rows.map(r => r[m.key]).filter(v => v != null);
      out[m.key] = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) : null;
    } else if (m.agg === 'avg') {
      const vs = rows.map(r => r[m.key]).filter(v => v != null);
      out[m.key] = vs.length ? vs.reduce((a, b) => a + b, 0) / vs.length : null;
    } else if (m.agg === 'last') {
      const last = rows.slice().sort((a, b) => (a.date > b.date ? 1 : -1)).pop();
      out[m.key] = last ? last[m.key] : null;
    }
    // 'calc' and 'wavg' handled below
  });

  const hasCol = k => rows.some(r => r[k] != null);
  const sumCol = k => hasCol(k) ? rows.reduce((a, r) => a + (r[k] ?? 0), 0) : null;
  const totSessions   = sumCol('sessions')   ?? 0;
  const totAdOrders   = sumCol('adOrders')   ?? 0;
  const totClicks     = sumCol('clicks')     ?? 0;
  const totAdSpend    = sumCol('adSpend');
  const totNetRevenue = sumCol('netRevenue');
  const totProfit     = sumCol('profit');
  const totRevenue    = out.revenue;
  const totSales      = out.sales ?? 0;
  const hasOrders     = rows.some(r => r.orders != null);
  const totOrders     = hasOrders ? rows.reduce((a, r) => a + (r.orders ?? 0), 0) : totSales;
  const hasRefunds    = rows.some(r => r.refunds != null);

  out.price  = (totSales > 0 && totRevenue != null) ? totRevenue / totSales : null;
  out.margin = (totRevenue != null && totRevenue > 0 && totProfit != null) ? totProfit / totRevenue : null;
  out.cvr    = totSessions > 0 ? totOrders / totSessions : null;
  const natDenom = totSessions - totClicks;
  out.natcvr = natDenom > 0 ? (totOrders - totAdOrders) / natDenom : null;
  out.acoas  = (totNetRevenue != null && totNetRevenue > 0 && totAdSpend != null) ? totAdSpend / totNetRevenue : null;
  out.adcvr  = totClicks > 0 ? totAdOrders / totClicks : null;

  if (hasRefunds) {
    const totRefunds = rows.reduce((a, r) => a + (r.refunds ?? 0), 0);
    out['return'] = totSales > 0 ? totRefunds / totSales : null;
  } else {
    const wSum = rows.reduce((a, r) => a + ((r.returnRate ?? 0) * (r.sales ?? 0)), 0);
    out['return'] = totSales > 0 ? wSum / totSales : null;
  }

  return out;
}

export function chg(t, c) {
  if (t == null && c == null) return { diff: null, pct: null };
  if (c == null || c === 0)   return { diff: t, pct: null };
  if (t == null)               return { diff: -c, pct: -1 };
  return { diff: t - c, pct: (t - c) / Math.abs(c) };
}

export function fv(v, fmt) {
  if (v == null) return '—';
  if (fmt === 'pct')   return (v * 100).toFixed(2) + '%';
  if (fmt === 'money') return v.toFixed(2);
  if (fmt === 'num2')  return v.toFixed(2);
  if (fmt === 'rank')  return Math.round(v).toLocaleString();
  return Number.isInteger(v) ? v.toLocaleString() : v.toFixed(1);
}

export function fp(v) {
  if (v == null) return '—';
  return (v >= 0 ? '+' : '') + (v * 100).toFixed(1) + '%';
}

export function bcls(pct, inv) {
  if (pct == null || Math.abs(pct) < 0.001) return 'flat';
  const up = pct > 0;
  return inv ? (up ? 'down' : 'up') : (up ? 'up' : 'down');
}
