import React, { useState, useEffect } from 'react';
import { getTableMetaList } from '../utils/dataUtils.js';

export default function ConfigPanel({ config, onSave }) {
  const [tables,    setTables]    = useState([]);
  const [tableId,   setTableId]   = useState(config?.tableId || '');
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState('');

  useEffect(() => {
    getTableMetaList()
      .then(list => { setTables(list); setLoading(false); })
      .catch(e  => { setError('获取表格列表失败：' + e.message); setLoading(false); });
  }, []);

  async function handleSave() {
    if (!tableId) return;
    setSaving(true);
    try {
      await onSave({
        dataConditions: [{ tableId }],
        customConfig: { tableId },
      });
    } catch (e) {
      setError('保存失败：' + e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="config-panel">
      <div className="config-title">⚙️ 配置数据源</div>

      <div>
        <div className="config-label">选择数据表</div>
        {loading ? (
          <div style={{fontSize:'12px',color:'var(--gray1)'}}>加载中...</div>
        ) : (
          <select
            className="config-select"
            value={tableId}
            onChange={e => setTableId(e.target.value)}>
            <option value="">— 请选择表格 —</option>
            {tables.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        )}
      </div>

      <div style={{fontSize:'12px',color:'var(--gray1)',lineHeight:1.6,background:'var(--gray6)',borderRadius:'8px',padding:'10px 12px'}}>
        <div style={{fontWeight:600,color:'var(--label2)',marginBottom:'4px'}}>表格列名要求</div>
        插件会自动匹配以下列名：<br/>
        日期、ASIN、品名、店铺、销量、销售额、二级分类、Sessions-Total、
        广告订单量、点击、广告花费、净销售额、订单毛利润、退货率、评分、小类排名
        <br/>等（顺序不限）
      </div>

      {error && <div style={{fontSize:'12px',color:'var(--red)'}}>{error}</div>}

      <div className="config-footer">
        <button
          className="btn-primary"
          style={{width:'100%',padding:'10px',borderRadius:'10px',fontSize:'14px'}}
          disabled={!tableId || saving}
          onClick={handleSave}>
          {saving ? '保存中...' : '确认并保存'}
        </button>
      </div>
    </div>
  );
}
