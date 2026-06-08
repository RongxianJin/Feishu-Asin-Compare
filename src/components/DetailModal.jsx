import React from 'react';
import { METRICS, fv, fp, chg } from '../utils/metrics.js';

export default function DetailModal({ result, asin, onClose }) {
  if (!asin || !result) return null;
  const { tS, tE, cS, cE, rows } = result;
  const r = rows.find(x => x.asin === asin);
  if (!r) return null;

  const tL = tS === tE ? tS : `${tS} ~ ${tE}`;
  const cL = cS === cE ? cS : `${cS} ~ ${cE}`;

  const lines = [
    `产品：${r.name}`, `ASIN：${r.asin}`,
    `店铺：${r.store}　二级分类：${r.cat2}`, '',
    `查询区间：${tL}（${r.target?._days || 0} 天）`,
    `对比区间：${cL}（${r.compare?._days || 0} 天）`,
    '━'.repeat(28),
  ];
  METRICS.forEach(m => {
    const tv = r.target  ? r.target[m.key]  : null;
    const cv = r.compare ? r.compare[m.key] : null;
    const c  = chg(tv, cv);
    let chStr = '';
    if (c.pct != null) chStr = (c.pct >= 0 ? '▲' : '▼') + '（' + fp(c.pct) + '）';
    else if (tv != null && cv == null) chStr = '（新增）';
    else if (tv == null && cv != null) chStr = '（消失）';
    lines.push(`${m.label}${m.inv ? '（越小越好）' : ''}：${fv(cv, m.fmt)}  →  ${fv(tv, m.fmt)}  ${chStr}`);
  });
  const text = lines.join('\n');

  function copyText() {
    navigator.clipboard.writeText(text).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); document.body.removeChild(ta);
    });
  }

  return (
    <div className="overlay open" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <div className="modal-hd">
          <div>
            <div className="m-title">{r.name}</div>
            <div className="m-sub">{r.asin}</div>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <textarea className="modal-ta" readOnly value={text} />
        </div>
        <div className="modal-ft">
          <button className="btn-cancel" onClick={onClose}>关闭</button>
          <button className="btn-copy" onClick={copyText}>复制全部</button>
        </div>
      </div>
    </div>
  );
}
