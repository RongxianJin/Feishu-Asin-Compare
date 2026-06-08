import React, { useState, useEffect, useCallback } from 'react';
import { bitable, DashboardState } from '@lark-base-open/js-sdk';
import ConfigPanel from './components/ConfigPanel.jsx';
import AnalysisView from './components/AnalysisView.jsx';
import { fetchRecords } from './utils/dataUtils.js';

export default function App() {
  // dashboard.state is a sync property; check once on mount
  const [dashState,  setDashState]  = useState(() => bitable.dashboard.state);
  const [config,     setConfig]     = useState(null);
  const [allData,    setAllData]    = useState([]);
  const [loadStatus, setLoadStatus] = useState('idle'); // 'idle'|'loading'|'error'
  const [loadError,  setLoadError]  = useState('');
  const [loadCount,  setLoadCount]  = useState(0);

  const loadData = useCallback(async (cfg) => {
    const tableId = cfg?.customConfig?.tableId || cfg?.tableId;
    if (!tableId) return;
    setLoadStatus('loading'); setLoadError(''); setLoadCount(0);
    try {
      const data = await fetchRecords(tableId, count => setLoadCount(count));
      setAllData(data);
      setLoadStatus('idle');
    } catch (e) {
      setLoadError(e.message || '数据加载失败');
      setLoadStatus('error');
    }
  }, []);

  useEffect(() => {
    async function init() {
      const cfg = await bitable.dashboard.getConfig().catch(() => null);
      setConfig(cfg);
      if (bitable.dashboard.state === DashboardState.View && cfg) {
        await loadData(cfg);
      }
    }
    init();

    // Re-fetch when underlying table data changes (fires in View mode)
    const offData = bitable.dashboard.onDataChange(async () => {
      const cfg = await bitable.dashboard.getConfig().catch(() => null);
      if (cfg) await loadData(cfg);
    });

    return () => { offData?.(); };
  }, []);

  async function handleSaveConfig(newConfig) {
    await bitable.dashboard.saveConfig(newConfig);
    setConfig(newConfig);
    // Load preview immediately so the left side shows data
    await loadData(newConfig);
  }

  // ── View mode ─────────────────────────────────────────────────────────────
  if (dashState === DashboardState.View) {
    if (loadStatus === 'loading') return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <div>加载数据中{loadCount > 0 ? `（已读取 ${loadCount} 条）` : '...'}</div>
      </div>
    );
    if (loadStatus === 'error') return (
      <div className="loading-screen" style={{color:'var(--red)'}}>
        <div style={{fontSize:'32px'}}>⚠️</div>
        <div>{loadError}</div>
        <button className="btn-primary" style={{marginTop:'8px'}} onClick={() => loadData(config)}>重试</button>
      </div>
    );
    if (!config?.customConfig?.tableId) return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <div>初始化中...</div>
      </div>
    );
    return <AnalysisView allData={allData} onRefresh={() => loadData(config)} />;
  }

  // ── Config / Create mode ──────────────────────────────────────────────────
  return (
    <div style={{display:'flex', height:'100vh', overflow:'hidden'}}>
      {/* Left: preview */}
      <div style={{flex:1, overflow:'auto'}}>
        {allData.length > 0
          ? <AnalysisView allData={allData} onRefresh={() => loadData(config)} />
          : (
            <div className="loading-screen" style={{height:'100%'}}>
              <div style={{fontSize:'48px', opacity:.4}}>📊</div>
              <div style={{color:'var(--gray1)'}}>请在右侧选择数据表并保存</div>
              {loadStatus === 'loading' && (
                <><div className="loading-spinner" /><div style={{color:'var(--gray1)',fontSize:'12px'}}>加载中{loadCount > 0 ? `... ${loadCount} 条` : '...'}</div></>
              )}
              {loadError && <div style={{color:'var(--red)',fontSize:'12px'}}>{loadError}</div>}
            </div>
          )
        }
      </div>

      {/* Right: config panel (340px fixed per Feishu spec) */}
      <div style={{
        width: '340px', flexShrink: 0,
        borderLeft: '1px solid var(--gray5)',
        height: '100%', overflowY: 'auto',
        paddingBottom: '70px', position: 'relative',
        background: 'var(--surface)',
      }}>
        <ConfigPanel config={config?.customConfig} onSave={handleSaveConfig} />
      </div>
    </div>
  );
}
