import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import * as XLSX from 'xlsx';
import { METRICS, aggMetrics, chg, fv, fp, bcls } from '../utils/metrics.js';
import CalendarPicker from './CalendarPicker.jsx';
import DetailModal from './DetailModal.jsx';

export default function AnalysisView({ allData, onRefresh }) {
  // ── Derived from allData ──────────────────────────────────────────────────
  const allDates = useMemo(() => [...new Set(allData.map(d => d.date))].sort(), [allData]);
  const stores   = useMemo(() => [...new Set(allData.map(d => d.store).filter(Boolean))], [allData]);
  const cat2s    = useMemo(() => [...new Set(allData.map(d => d.cat2).filter(Boolean))],  [allData]);

  // ── Filter state ──────────────────────────────────────────────────────────
  const [selectedStores, setSelectedStores] = useState(new Set());
  const [selectedCat2,   setSelectedCat2]   = useState(new Set());
  const [selectedAsins,  setSelectedAsins]  = useState(new Set());
  const [displayMode,    setDisplayMode]    = useState('name'); // 'name' | 'asin'
  const [search,         setSearch]         = useState('');

  // ── Date state ────────────────────────────────────────────────────────────
  const [pickedTStart, setPickedTStart] = useState('');
  const [pickedTEnd,   setPickedTEnd]   = useState('');
  const [pickedCStart, setPickedCStart] = useState('');
  const [pickedCEnd,   setPickedCEnd]   = useState('');
  const [calOpen,      setCalOpen]      = useState(false);
  const [calMode,      setCalMode]      = useState('target'); // 'target' | 'compare'

  // ── Result state ──────────────────────────────────────────────────────────
  const [result,     setResult]     = useState(null);
  const [detailAsin, setDetailAsin] = useState(null);
  const [toastMsg,   setToastMsg]   = useState('');
  const toastTimer = useRef(null);

  // ── Init when data changes ────────────────────────────────────────────────
  useEffect(() => {
    if (!allData.length) return;
    setSelectedStores(new Set(stores));
    setSelectedCat2(new Set(cat2s));
    setSelectedAsins(new Set());
    setResult(null);
    const n = allDates.length;
    if (n > 0) {
      const tE = allDates[n-1],   tS = allDates[Math.max(0, n-7)];
      const cE = allDates[Math.max(0, n-8)], cS = allDates[Math.max(0, n-14)];
      setPickedTStart(tS); setPickedTEnd(tE);
      setPickedCStart(cS); setPickedCEnd(cE);
    }
  }, [allData]);

  // ── Toast ─────────────────────────────────────────────────────────────────
  function toast(msg) {
    setToastMsg(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(''), 2200);
  }

  // ── Filtered product list ─────────────────────────────────────────────────
  const filteredProds = useMemo(() => {
    const q = search.toLowerCase();
    const seen = new Set();
    return allData
      .filter(d => selectedStores.has(d.store) && selectedCat2.has(d.cat2))
      .filter(d => { if (!seen.has(d.asin)) { seen.add(d.asin); return true; } return false; })
      .filter(d => !q || d.asin.toLowerCase().includes(q) || d.name.toLowerCase().includes(q));
  }, [allData, selectedStores, selectedCat2, search]);

  // ── Toggle helpers ────────────────────────────────────────────────────────
  function toggleStore(s) {
    setSelectedStores(prev => { const n = new Set(prev); n.has(s) ? n.delete(s) : n.add(s); return n; });
  }
  function toggleCat2(c) {
    setSelectedCat2(prev => { const n = new Set(prev); n.has(c) ? n.delete(c) : n.add(c); return n; });
  }
  function toggleAsin(asin) {
    setSelectedAsins(prev => { const n = new Set(prev); n.has(asin) ? n.delete(asin) : n.add(asin); return n; });
  }
  function selectAll(val) {
    setSelectedAsins(val ? new Set(filteredProds.map(p => p.asin)) : new Set());
  }

  // ── Query ─────────────────────────────────────────────────────────────────
  function runQuery() {
    if (!pickedTStart || !pickedCStart) return toast('请先选择日期区间');
    if (!selectedAsins.size)            return toast('请至少勾选一个产品');
    const rows = [];
    selectedAsins.forEach(asin => {
      const t = aggMetrics(asin, pickedTStart, pickedTEnd, allData);
      const c = aggMetrics(asin, pickedCStart, pickedCEnd, allData);
      if (!t && !c) return;
      const ref = t || c;
      rows.push({ asin, name: ref._name, store: ref._store, cat2: ref._cat2, target: t, compare: c });
    });
    rows.sort((a, b) => (b.target?.revenue || 0) - (a.target?.revenue || 0));
    setResult({ tS: pickedTStart, tE: pickedTEnd, cS: pickedCStart, cE: pickedCEnd, rows });
  }

  // ── Export ────────────────────────────────────────────────────────────────
  function exportXlsx() {
    if (!result) return;
    const { tS, tE, cS, cE, rows } = result;
    const tL = tS === tE ? tS : `${tS}~${tE}`;
    const cL = cS === cE ? cS : `${cS}~${cE}`;
    const out = [['ASIN', '品名', '店铺', '二级分类']];
    METRICS.forEach(m => out[0].push(`${m.label}(${tL})`, `${m.label}(${cL})`, `${m.label}变化%`));
    rows.forEach(r => {
      const row = [r.asin, r.name, r.store, r.cat2];
      METRICS.forEach(m => {
        const tv = r.target  ? r.target[m.key]  : null;
        const cv = r.compare ? r.compare[m.key] : null;
        const c  = chg(tv, cv);
        row.push(tv ?? '', cv ?? '', c.pct != null ? (c.pct * 100).toFixed(2) + '%' : '');
      });
      out.push(row);
    });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(out), '环比数据');
    XLSX.writeFile(wb, `环比查询_${tL}_vs_${cL}.xlsx`);
  }

  // ── Date label helpers ────────────────────────────────────────────────────
  const fmtRange = (s, e) => !s ? '点击选择' : s === e ? s : `${s} ~ ${e}`;
  const fmtDays  = (s, e) => s ? `共 ${allDates.filter(d => d >= s && d <= e).length} 天` : '';

  // ── Summary cards ─────────────────────────────────────────────────────────
  function renderCards() {
    if (!result) return null;
    const { rows } = result;
    let tR = 0, cR = 0, tS2 = 0, cS2 = 0, up = 0, dn = 0;
    rows.forEach(r => {
      tR  += r.target?.revenue  || 0; cR  += r.compare?.revenue  || 0;
      tS2 += r.target?.sales    || 0; cS2 += r.compare?.sales    || 0;
      const c = chg(r.target?.revenue, r.compare?.revenue);
      if ((c.pct ?? 0) > 0.001) up++; else if ((c.pct ?? 0) < -0.001) dn++;
    });
    const rc = chg(tR, cR), sc = chg(tS2, cS2);
    const cards = [
      { label: '查询期销售额', val: '$' + tR.toFixed(0), sub: fp(rc.pct), cls: (rc.pct || 0) >= 0 ? 'up' : 'down' },
      { label: '查询期销量',   val: tS2.toLocaleString(), sub: fp(sc.pct), cls: (sc.pct || 0) >= 0 ? 'up' : 'down' },
      { label: '销售额增长品', val: up, sub: '个产品增长', cls: 'up' },
      { label: '销售额下降品', val: dn, sub: '个产品下降', cls: 'down' },
    ];
    return (
      <div className="cards">
        {cards.map(c => (
          <div key={c.label} className="card">
            <div className="card-label">{c.label}</div>
            <div className="card-val">{c.val}</div>
            <div className={`card-sub ${c.cls}`}>{c.sub}</div>
          </div>
        ))}
      </div>
    );
  }

  // ── Result table ──────────────────────────────────────────────────────────
  function renderTable() {
    if (!result) return null;
    const { tS, tE, cS, cE, rows } = result;
    const tL = tS === tE ? tS : `${tS} ~ ${tE}`;
    const cL = cS === cE ? cS : `${cS} ~ ${cE}`;
    return (
      <div className="table-wrap">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th className="th-left" rowSpan="2" style={{minWidth:'110px'}}>ASIN</th>
                <th className="th-left" rowSpan="2" style={{minWidth:'130px'}}>品名</th>
                <th rowSpan="2">店铺</th>
                <th rowSpan="2">二级分类</th>
                {METRICS.map(m => (
                  <th key={m.key} colSpan="3">
                    {m.label}
                    {m.inv && <div style={{fontSize:'9px',fontWeight:400,color:'var(--gray1)'}}>越小越好</div>}
                  </th>
                ))}
              </tr>
              <tr>
                {METRICS.map(m => (
                  <React.Fragment key={m.key}>
                    <th className="th-tgt">{tL}</th>
                    <th className="th-cmp">{cL}</th>
                    <th className="th-chg">变化</th>
                  </React.Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.asin}>
                  <td>
                    <div className="asin-cell">
                      <span className="asin-text">{r.asin}</span>
                      <button className="detail-btn" onClick={() => setDetailAsin(r.asin)}>详情</button>
                    </div>
                  </td>
                  <td>{r.name}</td>
                  <td className="td-center">{r.store}</td>
                  <td className="td-center">{r.cat2}</td>
                  {METRICS.map(m => {
                    const tv = r.target  ? r.target[m.key]  : null;
                    const cv = r.compare ? r.compare[m.key] : null;
                    const c  = chg(tv, cv);
                    let badge = null;
                    if      (c.pct != null)              badge = <span className={`badge ${bcls(c.pct, m.inv)}`}>{fp(c.pct)}</span>;
                    else if (tv != null && cv == null)    badge = <span className="badge new">新增</span>;
                    else if (tv == null && cv != null)    badge = <span className="badge gone">消失</span>;
                    return (
                      <React.Fragment key={m.key}>
                        <td className="td-right td-tgt">{fv(tv, m.fmt)}</td>
                        <td className="td-right td-cmp">{fv(cv, m.fmt)}</td>
                        <td className="td-center">{badge}</td>
                      </React.Fragment>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="layout">
      {/* ── Sidebar ── */}
      <aside className="sidebar">

        {/* Data source info */}
        <div>
          <div className="s-header">数据</div>
          <div className="s-group">
            <div className="s-row" style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}>
              <span style={{fontSize:'12px',color:'var(--label2)'}}>共 {allData.length} 条记录</span>
              <button className="btn-ghost" style={{padding:'4px 10px',fontSize:'11px'}} onClick={onRefresh}>刷新</button>
            </div>
          </div>
        </div>

        {/* Store filter */}
        {stores.length > 0 && (
          <div>
            <div className="s-header">店铺</div>
            <div className="s-group">
              <div className="chip-group">
                {stores.map(s => (
                  <div key={s} className={`chip ${selectedStores.has(s) ? 'on' : ''}`} onClick={() => toggleStore(s)}>{s}</div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Category filter */}
        {cat2s.length > 0 && (
          <div>
            <div className="s-header">二级分类</div>
            <div className="s-group">
              <div className="chip-group">
                {cat2s.map(c => (
                  <div key={c} className={`chip ${selectedCat2.has(c) ? 'on' : ''}`} onClick={() => toggleCat2(c)}>{c}</div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Product list */}
        <div>
          <div className="s-header">产品</div>
          <div className="s-group">
            <div style={{padding:'7px 12px 5px'}}>
              <input className="prod-search" placeholder="🔍  搜索 ASIN 或品名"
                value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div className="prod-actions">
              <button className={`prod-act-btn ${displayMode==='name'?'on':''}`} onClick={() => setDisplayMode('name')}>品名</button>
              <button className={`prod-act-btn ${displayMode==='asin'?'on':''}`} onClick={() => setDisplayMode('asin')}>ASIN</button>
              <button className="prod-act-btn" onClick={() => selectAll(true)}>全选</button>
              <button className="prod-act-btn" onClick={() => selectAll(false)}>清空</button>
            </div>
            <div className="prod-list">
              {filteredProds.map(p => {
                const primary   = displayMode === 'name' ? p.name : p.asin;
                const secondary = displayMode === 'name' ? p.asin : p.name;
                return (
                  <div key={p.asin} className="prod-item" onClick={() => toggleAsin(p.asin)}>
                    <input type="checkbox" readOnly checked={selectedAsins.has(p.asin)}
                      onClick={e => e.stopPropagation()} onChange={() => toggleAsin(p.asin)} />
                    <div>
                      <div className="prod-name">{primary || '—'}</div>
                      <div className="prod-asin">{secondary}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Date ranges */}
        <div>
          <div className="s-header">日期区间</div>
          <div className="s-group">
            <div className="date-btn" onClick={() => { setCalMode('target'); setCalOpen(true); }}>
              <div className="range-title t">查询区间</div>
              <div className="date-btn-val">{fmtRange(pickedTStart, pickedTEnd)}</div>
              <div className="range-days">{fmtDays(pickedTStart, pickedTEnd)}</div>
            </div>
            <div className="date-btn" onClick={() => { setCalMode('compare'); setCalOpen(true); }}>
              <div className="range-title c">对比区间</div>
              <div className="date-btn-val">{fmtRange(pickedCStart, pickedCEnd)}</div>
              <div className="range-days">{fmtDays(pickedCStart, pickedCEnd)}</div>
            </div>
          </div>
        </div>

        {/* Query button */}
        <div className="query-btn-wrap">
          <button className="query-btn" onClick={runQuery}>查询环比数据</button>
        </div>
      </aside>

      {/* ── Content ── */}
      <main className="content">
        {!result ? (
          <div className="empty-state">
            <div className="empty-icon">📈</div>
            <div className="empty-text">选择产品和日期，点击查询</div>
            <div className="empty-sub">已加载 {allData.length} 条记录，{allDates.length} 天数据</div>
          </div>
        ) : (
          <>
            <div className="result-topbar">
              <div className="result-title">
                {result.tS === result.tE ? result.tS : `${result.tS} ~ ${result.tE}`}
                {'  vs  '}
                {result.cS === result.cE ? result.cS : `${result.cS} ~ ${result.cE}`}
              </div>
              <span className="result-meta">{result.rows.length} 个产品</span>
              <button className="btn-ghost" style={{padding:'5px 12px',fontSize:'12px'}} onClick={exportXlsx}>导出 Excel</button>
            </div>
            {renderCards()}
            {renderTable()}
          </>
        )}
      </main>

      {/* ── Calendar picker ── */}
      <CalendarPicker
        open={calOpen}
        title={calMode === 'target' ? '查询区间' : '对比区间'}
        allDates={allDates}
        currentEnd={calMode === 'target' ? pickedTEnd : pickedCEnd}
        onClose={() => setCalOpen(false)}
        onConfirm={(s, e) => {
          if (calMode === 'target') { setPickedTStart(s); setPickedTEnd(e); }
          else { setPickedCStart(s); setPickedCEnd(e); }
          setCalOpen(false);
        }}
      />

      {/* ── Detail modal ── */}
      <DetailModal result={result} asin={detailAsin} onClose={() => setDetailAsin(null)} />

      {/* ── Toast ── */}
      <div className={`toast ${toastMsg ? 'show' : ''}`}>{toastMsg}</div>
    </div>
  );
}
