import React, { useState, useEffect } from 'react';

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'];

export default function CalendarPicker({ open, title, allDates, currentEnd, onClose, onConfirm }) {
  const [step, setStep]           = useState(0); // 0=idle 1=start picked 2=done
  const [tmpStart, setTmpStart]   = useState('');
  const [hover, setHover]         = useState('');
  const [viewYear, setViewYear]   = useState(0);
  const [viewMonth, setViewMonth] = useState(0); // left month (0-based)

  const dataSet = new Set(allDates);

  // Preset helpers
  const sliceLast   = n    => { const s = allDates.slice(-n); return s.length ? [s[0], s[s.length-1]] : ['','']; };
  const sliceOffset = (n,off) => { const a = allDates.slice(-(n+off), -off||undefined); return a.length ? [a[0],a[a.length-1]] : [allDates[0],allDates[0]]; };
  const monthDates  = off  => {
    const last = allDates[allDates.length-1]; if (!last) return ['',''];
    let y = parseInt(last.slice(0,4)), m = parseInt(last.slice(5,7)) + off;
    if (m<=0){y--;m+=12;} if(m>12){y++;m-=12;}
    const pfx = `${y}-${String(m).padStart(2,'0')}`;
    const arr = allDates.filter(d => d.startsWith(pfx));
    return arr.length ? [arr[0],arr[arr.length-1]] : [allDates[0],allDates[0]];
  };
  const yearDates = off => {
    const last = allDates[allDates.length-1]; if (!last) return ['',''];
    const y = parseInt(last.slice(0,4)) + off;
    const arr = allDates.filter(d => d.startsWith(`${y}-`));
    return arr.length ? [arr[0],arr[arr.length-1]] : [allDates[0],allDates[0]];
  };

  const PRESETS = [
    { label:'近7天',  fn: ()=>sliceLast(7)       },
    { label:'前7天',  fn: ()=>sliceOffset(7,7)    },
    { label:'近30天', fn: ()=>sliceLast(30)       },
    { label:'前30天', fn: ()=>sliceOffset(30,30)  },
    { label:'本月',   fn: ()=>monthDates(0)        },
    { label:'上月',   fn: ()=>monthDates(-1)       },
    { label:'近6月',  fn: ()=>sliceLast(180)      },
    { label:'今年',   fn: ()=>yearDates(0)         },
    { label:'去年',   fn: ()=>yearDates(-1)        },
  ];

  useEffect(() => {
    if (!open || !allDates.length) return;
    setStep(0); setTmpStart(''); setHover('');
    const ref = currentEnd || allDates[allDates.length-1];
    let vy = parseInt(ref.slice(0,4)), vm = parseInt(ref.slice(5,7)) - 2;
    if (vm < 0) { vm += 12; vy--; }
    setViewYear(vy); setViewMonth(vm);
  }, [open]);

  // Effective range lo/hi
  const lo = tmpStart && hover ? (tmpStart < hover ? tmpStart : hover) : tmpStart;
  const hi = tmpStart && hover ? (tmpStart < hover ? hover : tmpStart) : tmpStart;

  function dayClass(dateStr) {
    if (!dataSet.has(dateStr)) return 'cal-day no-data';
    let cls = 'cal-day has-data';
    if (!tmpStart) return cls;
    if (dateStr === lo && dateStr === hi) return cls + ' range-solo';
    if (dateStr === lo)  return cls + ' range-start';
    if (dateStr === hi)  return cls + ' range-end';
    if (dateStr > lo && dateStr < hi) return cls + ' in-range';
    return cls;
  }

  function handleDay(dateStr) {
    if (!dataSet.has(dateStr)) return;
    if (step === 0 || step === 2) { setTmpStart(dateStr); setHover(dateStr); setStep(1); }
    else { setHover(dateStr); setStep(2); }
  }

  function handlePreset(preset) {
    const [s, e] = preset.fn(); if (!s) return;
    setTmpStart(s); setHover(e); setStep(2);
    let vy = parseInt(e.slice(0,4)), vm = parseInt(e.slice(5,7)) - 2;
    if (vm < 0) { vm += 12; vy--; }
    setViewYear(vy); setViewMonth(vm);
  }

  function prevMonth() {
    let vm = viewMonth - 1, vy = viewYear;
    if (vm < 0) { vm = 11; vy--; }
    setViewMonth(vm); setViewYear(vy);
  }
  function nextMonth() {
    let vm = viewMonth + 1, vy = viewYear;
    if (vm > 11) { vm = 0; vy++; }
    setViewMonth(vm); setViewYear(vy);
  }

  let rYear = viewYear, rMonth = viewMonth + 1;
  if (rMonth > 11) { rMonth = 0; rYear++; }

  function renderMonth(year, month, isLeft) {
    const firstDay    = new Date(year, month, 1).getDay();
    const startOffset = firstDay === 0 ? 6 : firstDay - 1;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const monthName   = `${year} 年 ${month + 1} 月`;

    const cells = [];
    for (let i = 0; i < startOffset; i++) cells.push(<div key={`b${i}`} className="cal-day other-month" />);
    for (let day = 1; day <= daysInMonth; day++) {
      const ds = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
      const inData = dataSet.has(ds);
      cells.push(
        <div key={ds} className={dayClass(ds)}
          onMouseEnter={() => { if (step === 1 && inData) setHover(ds); }}
          onClick={() => handleDay(ds)}>
          {day}
        </div>
      );
    }

    return (
      <div className="cal-month-col">
        <div className="cal-month-nav">
          {isLeft
            ? <button className="cal-nav-btn" onClick={prevMonth}>‹</button>
            : <button className="cal-nav-btn" style={{visibility:'hidden'}}>‹</button>}
          <span>{monthName}</span>
          {!isLeft
            ? <button className="cal-nav-btn" onClick={nextMonth}>›</button>
            : <button className="cal-nav-btn" style={{visibility:'hidden'}}>›</button>}
        </div>
        <div className="cal-grid">
          {WEEKDAYS.map(w => <div key={w} className="cal-wd">{w}</div>)}
          {cells}
        </div>
      </div>
    );
  }

  const footerText = step === 0 ? '—' : lo === hi ? lo
    : `${lo}  ~  ${hi}（${allDates.filter(d=>d>=lo&&d<=hi).length} 天）`;
  const hintText = step === 0 ? '请选择开始日期' : step === 1 ? '请选择结束日期' : '点击确定应用';

  if (!open) return null;
  return (
    <div className="cal-overlay open" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="cal-picker">
        <div className="cal-presets">
          {PRESETS.map(p => (
            <div key={p.label} className="cal-preset" onClick={() => handlePreset(p)}>{p.label}</div>
          ))}
        </div>
        <div className="cal-right">
          <div className="cal-hd">
            <span className="cal-hd-title">{title}</span>
            <span className="cal-hd-hint">{hintText}</span>
          </div>
          <div className="cal-months-wrap">
            {renderMonth(viewYear, viewMonth, true)}
            {renderMonth(rYear, rMonth, false)}
          </div>
          <div className="cal-ft">
            <span className="cal-selected-text">{footerText}</span>
            <button className="btn-cancel" onClick={onClose}>取消</button>
            <button className="btn-copy" disabled={step !== 2} onClick={() => onConfirm(lo, hi)}>确定</button>
          </div>
        </div>
      </div>
    </div>
  );
}
