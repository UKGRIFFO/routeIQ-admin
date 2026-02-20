'use client';

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from 'next/navigation';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell
} from "recharts";

const API = process.env.NEXT_PUBLIC_API_URL || "https://loan-broker-backend-production.up.railway.app/api";

// ═══════════════════════════════════════════════════════════════════
// DESIGN SYSTEM
// ═══════════════════════════════════════════════════════════════════
const C = {
  bg: "#06090D", panel: "#0C1017", card: "#111821", cardHover: "#161E28",
  border: "#1A2332", borderLight: "#243044",
  text: "#E2E8F0", textSoft: "#94A3B8", textDim: "#475569", textGhost: "#334155",
  mint: "#34D399", mintDim: "rgba(52,211,153,.12)", mintGlow: "rgba(52,211,153,.3)",
  gold: "#FBBF24", goldDim: "rgba(251,191,36,.12)",
  red: "#F87171", redDim: "rgba(248,113,113,.12)",
  sky: "#38BDF8", skyDim: "rgba(56,189,248,.12)",
  violet: "#A78BFA", violetDim: "rgba(167,139,250,.12)",
  rose: "#FB7185", roseDim: "rgba(251,113,133,.12)",
  orange: "#FB923C", orangeDim: "rgba(251,146,60,.12)",
  cyan: "#22D3EE", cyanDim: "rgba(34,211,238,.12)",
  teal: "#2DD4BF", tealDim: "rgba(45,212,191,.12)",
};

const STATUS = {
  new:                { bg: C.skyDim, fg: C.sky, label: "New", tip: "Lead just received, not yet processed" },
  pending:            { bg: C.goldDim, fg: C.gold, label: "Pending", tip: "Lead saved, waiting to be sent to lender" },
  distributed:        { bg: C.violetDim, fg: C.violet, label: "Distributed", tip: "Sent to lender and accepted, awaiting redirect confirmation" },
  redirected:         { bg: C.cyanDim, fg: C.cyan, label: "Redirected", tip: "Customer's browser confirmed redirected to lender" },
  accepted:           { bg: C.mintDim, fg: C.mint, label: "Accepted", tip: "Lender confirmed acceptance via postback" },
  sold:               { bg: C.mintDim, fg: C.mint, label: "Sold", tip: "Instant sale — revenue confirmed immediately via API response (e.g. ScoresMatter)" },
  converted:          { bg: C.tealDim, fg: C.teal, label: "Converted", tip: "Async sale — revenue confirmed later via lender postback (e.g. FiestaCredito)" },
  completed:          { bg: C.mintDim, fg: C.mint, label: "Completed", tip: "Customer completed the loan process with lender" },
  rejected:           { bg: C.redDim, fg: C.red, label: "Rejected", tip: "Lead rejected during processing" },
  rejected_by_lender: { bg: C.redDim, fg: C.red, label: "Buyer Reject", tip: "Lender API rejected this lead (check rejection reason)" },
  duplicate:          { bg: C.goldDim, fg: C.gold, label: "Duplicate", tip: "Duplicate lead detected — same email/phone/name combo" },
  error:              { bg: C.roseDim, fg: C.rose, label: "Error", tip: "Something went wrong processing this lead" },
};

const fm = {
  eur: v => v != null ? `€${Number(v).toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—",
  num: v => v != null ? Number(v).toLocaleString("en") : "—",
  pct: v => v != null ? `${(v * 100).toFixed(1)}%` : "—",
  date: d => d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—",
  time: d => d ? new Date(d).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "",
  dt: d => d ? `${fm.date(d)} ${fm.time(d)}` : "—",
  ms: v => v != null ? `${(Number(v) / 1000).toFixed(2)}s` : "—",
  msRaw: v => v != null ? `${Number(v).toLocaleString()}ms` : "—",
  short: d => d ? new Date(d + "T00:00").toLocaleDateString("en", { day: "numeric", month: "short" }) : "",
};

async function apiFetch(path, opts = {}) {
  const res = await fetch(`${API}${path}`, { headers: { "Content-Type": "application/json", ...opts.headers }, ...opts });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || e.message || `HTTP ${res.status}`); }
  return res.json();
}

// ═══════════════════════════════════════════════════════════════════
// SHARED COMPONENTS
// ═══════════════════════════════════════════════════════════════════
const RefreshIcon = ({ spinning }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: spinning ? "spin .8s linear infinite" : "none" }}>
    <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
  </svg>
);

const Badge = ({ status }) => { const s = STATUS[status] || STATUS.new; return (<span title={s.tip} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 99, fontSize: 10.5, fontWeight: 700, background: s.bg, color: s.fg, letterSpacing: ".04em", textTransform: "uppercase", cursor: s.tip ? "help" : "default", whiteSpace: "nowrap" }}><span style={{ width: 5, height: 5, borderRadius: "50%", background: s.fg }} />{s.label}</span>); };

const Spin = ({ sz = 18 }) => (<svg width={sz} height={sz} viewBox="0 0 24 24" style={{ animation: "spin .8s linear infinite" }}><circle cx="12" cy="12" r="10" stroke={C.border} strokeWidth="2.5" fill="none" /><path d="M12 2a10 10 0 0 1 10 10" stroke={C.mint} strokeWidth="2.5" fill="none" strokeLinecap="round" /></svg>);

const Empty = ({ icon, title, sub }) => (<div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "52px 20px", color: C.textDim }}><span style={{ fontSize: 36, marginBottom: 10, opacity: .45 }}>{icon}</span><div style={{ fontSize: 14, fontWeight: 700, color: C.textSoft }}>{title}</div>{sub && <div style={{ fontSize: 12, marginTop: 4 }}>{sub}</div>}</div>);

const Crd = ({ children, style, ...p }) => (<div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, ...style }} {...p}>{children}</div>);

const Btn = ({ children, v = "default", sz = "md", style, disabled, ...p }) => {
  const sizes = { sm: { padding: "6px 13px", fontSize: 11.5 }, md: { padding: "8px 18px", fontSize: 12.5 }, lg: { padding: "10px 22px", fontSize: 13.5 } };
  const vars = { default: { background: C.cardHover, color: C.text, border: `1px solid ${C.borderLight}` }, primary: { background: C.mint, color: "#06090D", border: "none", fontWeight: 800 }, danger: { background: C.redDim, color: C.red, border: `1px solid rgba(248,113,113,.15)` }, ghost: { background: "transparent", color: C.textSoft, border: "none" } };
  return <button style={{ display: "inline-flex", alignItems: "center", gap: 6, border: "none", cursor: disabled ? "default" : "pointer", fontWeight: 700, fontFamily: "inherit", borderRadius: 9, transition: "all .15s", opacity: disabled ? .45 : 1, ...sizes[sz], ...vars[v], ...style }} disabled={disabled} {...p}>{children}</button>;
};

const Inp = ({ label, style, ...p }) => (<div style={{ display: "flex", flexDirection: "column", gap: 5 }}>{label && <label style={{ fontSize: 10.5, fontWeight: 700, color: C.textDim, textTransform: "uppercase", letterSpacing: ".07em" }}>{label}</label>}<input style={{ padding: "8px 12px", background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 13, fontFamily: "inherit", outline: "none", ...style }} {...p} /></div>);

const Sel = ({ label, options = [], style, ...p }) => (<div style={{ display: "flex", flexDirection: "column", gap: 5 }}>{label && <label style={{ fontSize: 10.5, fontWeight: 700, color: C.textDim, textTransform: "uppercase", letterSpacing: ".07em" }}>{label}</label>}<select style={{ padding: "8px 12px", background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 13, fontFamily: "inherit", outline: "none", cursor: "pointer", ...style }} {...p}>{options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}</select></div>);

const Txa = ({ label, style, ...p }) => (<div style={{ display: "flex", flexDirection: "column", gap: 5 }}>{label && <label style={{ fontSize: 10.5, fontWeight: 700, color: C.textDim, textTransform: "uppercase", letterSpacing: ".07em" }}>{label}</label>}<textarea style={{ padding: "8px 12px", background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 12, fontFamily: "'JetBrains Mono', monospace", outline: "none", resize: "vertical", minHeight: 72, ...style }} {...p} /></div>);

const Modal = ({ open, onClose, title, children, w = 580 }) => { if (!open) return null; return (<div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClose}><div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.7)", backdropFilter: "blur(6px)" }} /><div onClick={e => e.stopPropagation()} style={{ position: "relative", width: w, maxWidth: "94vw", maxHeight: "88vh", overflow: "auto", background: C.card, border: `1px solid ${C.borderLight}`, borderRadius: 18, boxShadow: "0 32px 100px rgba(0,0,0,.6)" }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 22px", borderBottom: `1px solid ${C.border}`, position: "sticky", top: 0, background: C.card, zIndex: 1 }}><h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: C.text }}>{title}</h3><button onClick={onClose} style={{ background: "none", border: "none", color: C.textDim, cursor: "pointer", fontSize: 16, padding: 4 }}>✕</button></div><div style={{ padding: 22 }}>{children}</div></div></div>); };

const Stat = ({ label, value, sub, color = C.mint, icon, tip }) => (<Crd style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 8 }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><span title={tip} style={{ fontSize: 10.5, fontWeight: 700, color: C.textDim, textTransform: "uppercase", letterSpacing: ".08em", cursor: tip ? "help" : "default", borderBottom: tip ? `1px dashed ${C.textGhost}` : "none" }}>{label}</span>{icon && <span style={{ fontSize: 16, opacity: .4 }}>{icon}</span>}</div><div style={{ fontSize: 26, fontWeight: 900, color, letterSpacing: "-.02em", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{value}</div>{sub && <div style={{ fontSize: 11.5, color: C.textDim }}>{sub}</div>}</Crd>);

const ChartTip = ({ active, payload, label, fmtLabel, fmtValue }) => { if (!active || !payload?.length) return null; return (<div style={{ background: C.card, border: `1px solid ${C.borderLight}`, borderRadius: 10, padding: "10px 14px", fontSize: 12, boxShadow: "0 8px 30px rgba(0,0,0,.4)" }}><div style={{ color: C.textSoft, fontWeight: 600, marginBottom: 6 }}>{fmtLabel ? fmtLabel(label) : label}</div>{payload.map((p, i) => (<div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 3 }}><span style={{ width: 7, height: 7, borderRadius: "50%", background: p.color }} /><span style={{ color: C.textSoft }}>{p.name}:</span><span style={{ color: C.text, fontWeight: 700 }}>{fmtValue ? fmtValue(p.value, p.name) : p.value}</span></div>))}</div>); };

// ═══════════════════════════════════════════════════════════════════
// DATE RANGE PICKER
// ═══════════════════════════════════════════════════════════════════

function calcRange(preset) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);

  switch (preset) {
    case "today": return { from: today, to: tomorrow, label: "Today", days: 1 };
    case "yesterday": return { from: yesterday, to: today, label: "Yesterday", days: 1 };
    case "7d": { const f = new Date(today); f.setDate(today.getDate() - 7); return { from: f, to: tomorrow, label: "Last 7 Days", days: 7 }; }
    case "14d": { const f = new Date(today); f.setDate(today.getDate() - 14); return { from: f, to: tomorrow, label: "Last 14 Days", days: 14 }; }
    case "thisMonth": { const f = new Date(today.getFullYear(), today.getMonth(), 1); return { from: f, to: tomorrow, label: "This Month", days: Math.ceil((tomorrow - f) / 86400000) }; }
    case "30d": { const f = new Date(today); f.setDate(today.getDate() - 30); return { from: f, to: tomorrow, label: "Last 30 Days", days: 30 }; }
    case "lastMonth": { const f = new Date(today.getFullYear(), today.getMonth() - 1, 1); const t = new Date(today.getFullYear(), today.getMonth(), 1); return { from: f, to: t, label: "Last Month", days: Math.ceil((t - f) / 86400000) }; }
    case "all": default: return { from: null, to: null, label: "All Time", days: 0 };
  }
}

function fmtDate(d) { return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }); }

function MiniCalendar({ month, year, rangeStart, rangeEnd, onDayClick, onMonthChange }) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const shift = firstDay === 0 ? 6 : firstDay - 1; // Mon start
  const cells = [];
  for (let i = 0; i < shift; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const today = new Date(); today.setHours(0,0,0,0);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <button onClick={() => onMonthChange(-1)} style={{ background: "none", border: "none", color: C.textSoft, cursor: "pointer", fontSize: 14, padding: "2px 6px" }}>‹</button>
        <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{new Date(year, month).toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</span>
        <button onClick={() => onMonthChange(1)} style={{ background: "none", border: "none", color: C.textSoft, cursor: "pointer", fontSize: 14, padding: "2px 6px" }}>›</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 1 }}>
        {["M","T","W","T","F","S","S"].map((d, i) => (
          <div key={i} style={{ textAlign: "center", fontSize: 9, fontWeight: 700, color: C.textGhost, padding: "4px 0" }}>{d}</div>
        ))}
        {cells.map((d, i) => {
          if (!d) return <div key={`e${i}`} />;
          const date = new Date(year, month, d); date.setHours(0,0,0,0);
          const isToday = date.getTime() === today.getTime();
          const isStart = rangeStart && date.getTime() === rangeStart.getTime();
          const isEnd = rangeEnd && date.getTime() === rangeEnd.getTime();
          const inRange = rangeStart && rangeEnd && date >= rangeStart && date <= rangeEnd;
          const isFuture = date > today;

          return (
            <button key={d} onClick={() => !isFuture && onDayClick(date)} style={{
              width: 28, height: 28, borderRadius: isStart || isEnd ? 6 : 3, border: isToday ? `1px solid ${C.mint}` : "1px solid transparent",
              background: isStart || isEnd ? C.mint : inRange ? C.mintDim : "transparent",
              color: isStart || isEnd ? C.bg : isFuture ? C.textGhost : inRange ? C.mint : C.textSoft,
              fontSize: 11, fontWeight: isStart || isEnd ? 800 : 600, cursor: isFuture ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit",
            }}>{d}</button>
          );
        })}
      </div>
    </div>
  );
}

function DateRangePicker({ dateRange, onChange }) {
  const [open, setOpen] = useState(false);
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [pickStart, setPickStart] = useState(null);
  const [pickEnd, setPickEnd] = useState(null);
  const ref = useRef(null);

  useEffect(() => {
    const handleClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const presets = [
    { id: "today", label: "Today" },
    { id: "yesterday", label: "Yesterday" },
    { id: "7d", label: "Last 7 Days" },
    { id: "14d", label: "Last 14 Days" },
    { id: "30d", label: "Last 30 Days" },
    { id: "thisMonth", label: "This Month" },
    { id: "lastMonth", label: "Last Month" },
    { id: "all", label: "All Time" },
  ];

  const selectPreset = (id) => {
    const r = calcRange(id);
    onChange({ preset: id, from: r.from, to: r.to, label: r.label, days: r.days });
    setOpen(false);
  };

  const handleDayClick = (date) => {
    if (!pickStart || (pickStart && pickEnd)) {
      setPickStart(date); setPickEnd(null);
    } else {
      const start = date < pickStart ? date : pickStart;
      const end = date < pickStart ? pickStart : date;
      const days = Math.ceil((end - start) / 86400000) + 1;
      const endPlusOne = new Date(end); endPlusOne.setDate(end.getDate() + 1);
      setPickStart(start); setPickEnd(end);
      onChange({ preset: "custom", from: start, to: endPlusOne, label: `${fmtDate(start)} – ${fmtDate(end)}`, days });
      setOpen(false);
    }
  };

  const handleMonthChange = (dir) => {
    let m = calMonth + dir, y = calYear;
    if (m > 11) { m = 0; y++; } else if (m < 0) { m = 11; y--; }
    setCalMonth(m); setCalYear(y);
  };

  const navigate = (dir) => {
    if (!dateRange.from || dateRange.preset === "all") return;
    const shift = (dateRange.days || 1) * dir;
    const newFrom = new Date(dateRange.from); newFrom.setDate(newFrom.getDate() + shift);
    const newTo = new Date(dateRange.to); newTo.setDate(newTo.getDate() + shift);
    const now = new Date(); now.setHours(23,59,59,999);
    if (newFrom > now) return;
    if (newTo > new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)) {
      newTo.setTime(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime());
    }
    onChange({ ...dateRange, from: newFrom, to: newTo, preset: "custom", label: `${fmtDate(newFrom)} – ${fmtDate(new Date(newTo.getTime() - 86400000))}` });
  };

  return (
    <div ref={ref} style={{ position: "relative", display: "flex", alignItems: "center", gap: 4 }}>
      <button onClick={() => navigate(-1)} title="Previous period" style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 6, color: dateRange.preset === "all" ? C.textGhost : C.textSoft, cursor: dateRange.preset === "all" ? "not-allowed" : "pointer", padding: "5px 8px", fontSize: 12, fontFamily: "inherit", display: "flex", alignItems: "center" }}>‹</button>
      <button onClick={() => setOpen(!open)} style={{ background: open ? C.mintDim : C.card, border: `1px solid ${open ? C.mint : C.border}`, borderRadius: 8, color: open ? C.mint : C.text, cursor: "pointer", padding: "6px 14px", fontSize: 12, fontWeight: 700, fontFamily: "inherit", display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap" }}>
        <span style={{ fontSize: 13 }}>📅</span>
        {dateRange.label}
        <span style={{ fontSize: 9, opacity: .5 }}>{open ? "▲" : "▼"}</span>
      </button>
      <button onClick={() => navigate(1)} title="Next period" style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 6, color: dateRange.preset === "all" ? C.textGhost : C.textSoft, cursor: dateRange.preset === "all" ? "not-allowed" : "pointer", padding: "5px 8px", fontSize: 12, fontFamily: "inherit", display: "flex", alignItems: "center" }}>›</button>

      {open && (
        <div style={{ position: "absolute", top: "100%", right: 0, marginTop: 6, background: C.card, border: `1px solid ${C.borderLight}`, borderRadius: 14, boxShadow: "0 16px 50px rgba(0,0,0,.5)", zIndex: 999, display: "flex", overflow: "hidden", minWidth: 420 }}>
          {/* Presets */}
          <div style={{ padding: "12px 8px", borderRight: `1px solid ${C.border}`, minWidth: 140 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: C.textGhost, textTransform: "uppercase", letterSpacing: ".08em", padding: "6px 10px", marginBottom: 4 }}>Quick Select</div>
            {presets.map(p => (
              <button key={p.id} onClick={() => selectPreset(p.id)} style={{
                display: "block", width: "100%", textAlign: "left", padding: "7px 10px", borderRadius: 6, border: "none",
                background: dateRange.preset === p.id ? C.mintDim : "transparent", color: dateRange.preset === p.id ? C.mint : C.textSoft,
                fontSize: 12, fontWeight: dateRange.preset === p.id ? 700 : 500, cursor: "pointer", fontFamily: "inherit", marginBottom: 1,
              }}>{p.label}</button>
            ))}
          </div>
          {/* Calendar */}
          <div style={{ padding: 16, minWidth: 240 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: C.textGhost, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 10 }}>Custom Range</div>
            <MiniCalendar month={calMonth} year={calYear} rangeStart={pickStart || dateRange.from} rangeEnd={pickEnd || (dateRange.to ? new Date(dateRange.to.getTime() - 86400000) : null)} onDayClick={handleDayClick} onMonthChange={handleMonthChange} />
            {pickStart && !pickEnd && (
              <div style={{ fontSize: 10, color: C.gold, marginTop: 8, textAlign: "center" }}>Click end date to complete range</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function dateParams(dateRange) {
  const p = new URLSearchParams();
  if (dateRange.from) p.set("from", dateRange.from.toISOString());
  if (dateRange.to) p.set("to", dateRange.to.toISOString());
  return p.toString();
}

// ═══════════════════════════════════════════════════════════════════
// OVERVIEW PAGE
// ═══════════════════════════════════════════════════════════════════
function OverviewPage({ dateRange }) {
  const [summary, setSummary] = useState(null);
  const [daily, setDaily] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const intervalRef = useRef(null);

  const dp = dateParams(dateRange);
  const loadData = useCallback((silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    Promise.all([
      apiFetch(`/analytics/summary${dp ? `?${dp}` : ""}`).catch(() => null),
      apiFetch(`/analytics/daily?days=30${dp ? `&${dp}` : ""}`).catch(() => null),
    ]).then(([s, d]) => {
      setSummary(s?.stats || null);
      setDaily(d?.analytics || []);
      setErr(!s && !d ? "Cannot reach backend — check Railway deployment" : null);
      setLastRefresh(new Date());
    }).finally(() => { setLoading(false); setRefreshing(false); });
  }, [dp]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    intervalRef.current = setInterval(() => loadData(true), 30000);
    return () => clearInterval(intervalRef.current);
  }, [loadData]);

  if (loading) return <div style={{ display: "flex", justifyContent: "center", padding: 100 }}><Spin sz={30} /></div>;
  if (err) return <Empty icon="⚠️" title="Connection Error" sub={err} />;

  const s = summary || {};
  const conv = s.totalLeads > 0 ? s.soldLeads / s.totalLeads : 0;
  const avgRev = s.soldLeads > 0 ? s.totalRevenue / s.soldLeads : 0;
  const redirectRate = s.submittedToLender > 0 ? s.redirectedLeads / s.submittedToLender : 0;
  const PIE = [
    { name: "Sold", value: s.soldLeads || 0, color: C.mint },
    { name: "Unsold", value: Math.max(0, (s.totalLeads || 0) - (s.soldLeads || 0)), color: C.border },
  ].filter(d => d.value > 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8 }}>
        {lastRefresh && <span style={{ fontSize: 10, color: C.textGhost }}>Updated {lastRefresh.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>}
        <Btn sz="sm" onClick={() => loadData(true)} disabled={refreshing} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
          <RefreshIcon spinning={refreshing} />
          Refresh
        </Btn>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 14 }}>
        <Stat label="Total Leads" value={fm.num(s.totalLeads)} sub={`${fm.num(s.leadsToday)} today`} color={C.sky} icon="📋" tip="Total number of leads captured by the platform" />
        <Stat label="Sold" value={fm.num(s.soldLeads)} sub={`${fm.pct(conv)} conversion`} color={C.mint} icon="✓" tip="Leads confirmed sold via lender postback — revenue earned" />
        <Stat label="Revenue" value={fm.eur(s.totalRevenue)} sub={`${fm.eur(avgRev)} per sale`} color={C.gold} icon="€" tip="Total revenue from sold leads, confirmed via postback payouts" />
        <Stat label="Redirect Rate" value={s.submittedToLender > 0 ? fm.pct(redirectRate) : "—"} sub={`${fm.num(s.confirmedRedirects || 0)} confirmed · ${fm.num(s.redirectedLeads || 0)} of ${fm.num(s.submittedToLender || 0)} sent`} color={redirectRate >= 0.9 ? C.mint : redirectRate >= 0.7 ? C.gold : C.red} icon="↗" tip="% of leads sent to lender that were accepted. 'Confirmed' means the customer's browser was verified hitting the lender's page." />
        <Stat label="This Week" value={fm.num(s.leadsThisWeek)} sub={`${fm.num(s.leadsThisMonth)} this month`} color={C.violet} icon="📈" tip="Leads captured this calendar week and month" />
        <Stat label="Avg Response" value={s.avgResponseTimeMs ? fm.ms(s.avgResponseTimeMs) : "—"} sub={s.avgResponseTimeMs ? fm.msRaw(s.avgResponseTimeMs) : "no data"} color={C.cyan} icon="⚡" tip="Average time for the lender API to respond after we send a lead" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Crd style={{ padding: "18px 20px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.textDim, textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 14 }}>Revenue · 30 Days</div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={daily}>
              <defs><linearGradient id="rg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.mint} stopOpacity={.25} /><stop offset="100%" stopColor={C.mint} stopOpacity={0} /></linearGradient></defs>
              <CartesianGrid stroke={C.border} strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 9.5, fill: C.textGhost }} tickFormatter={fm.short} />
              <YAxis tick={{ fontSize: 9.5, fill: C.textGhost }} tickFormatter={v => `€${v}`} width={50} />
              <Tooltip content={<ChartTip fmtLabel={fm.short} fmtValue={v => `€${Number(v).toFixed(2)}`} />} />
              <Area type="monotone" dataKey="total_revenue" stroke={C.mint} fill="url(#rg)" strokeWidth={2} name="Revenue" />
            </AreaChart>
          </ResponsiveContainer>
        </Crd>
        <Crd style={{ padding: "18px 20px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.textDim, textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 14 }}>Leads · 30 Days</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={daily}>
              <CartesianGrid stroke={C.border} strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 9.5, fill: C.textGhost }} tickFormatter={v => v ? new Date(v + "T00:00").getDate() : ""} />
              <YAxis tick={{ fontSize: 9.5, fill: C.textGhost }} width={30} />
              <Tooltip content={<ChartTip fmtLabel={fm.short} />} />
              <Bar dataKey="total_leads" fill={C.sky} radius={[3, 3, 0, 0]} name="Total" />
              <Bar dataKey="sold_leads" fill={C.mint} radius={[3, 3, 0, 0]} name="Sold" />
            </BarChart>
          </ResponsiveContainer>
        </Crd>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 14 }}>
        <Crd style={{ padding: "18px 20px", display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.textDim, textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 8, alignSelf: "flex-start" }}>Conversion</div>
          {PIE.length > 0 ? (<ResponsiveContainer width="100%" height={180}><PieChart><Pie data={PIE} cx="50%" cy="50%" innerRadius={50} outerRadius={72} dataKey="value" paddingAngle={3} strokeWidth={0}>{PIE.map((d, i) => <Cell key={i} fill={d.color} />)}</Pie></PieChart></ResponsiveContainer>) : <Empty icon="📊" title="No data yet" />}
          <div style={{ fontSize: 28, fontWeight: 900, color: C.mint, marginTop: 4 }}>{fm.pct(conv)}</div>
          <div style={{ fontSize: 11, color: C.textDim }}>sale rate</div>
        </Crd>
        <Crd style={{ padding: "18px 20px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.textDim, textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 14 }}>Daily Breakdown</div>
          <div style={{ overflowX: "auto", maxHeight: 220 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead><tr>{["Date", "Leads", "Sold", "Rejected", "Dupes", "Revenue"].map(h => (<th key={h} style={{ padding: "8px 12px", textAlign: "left", fontSize: 9.5, fontWeight: 700, color: C.textGhost, textTransform: "uppercase", letterSpacing: ".07em", borderBottom: `1px solid ${C.border}`, position: "sticky", top: 0, background: C.card }}>{h}</th>))}</tr></thead>
              <tbody>{[...daily].reverse().slice(0, 14).map((d, i) => (<tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}><td style={{ padding: "7px 12px", color: C.textSoft, whiteSpace: "nowrap" }}>{fm.short(d.date)}</td><td style={{ padding: "7px 12px", fontWeight: 700, color: C.text }}>{d.total_leads}</td><td style={{ padding: "7px 12px", color: C.mint, fontWeight: 700 }}>{d.sold_leads}</td><td style={{ padding: "7px 12px", color: C.red }}>{d.rejected_leads}</td><td style={{ padding: "7px 12px", color: C.gold }}>{d.duplicate_leads}</td><td style={{ padding: "7px 12px", color: C.gold, fontWeight: 700 }}>{fm.eur(d.total_revenue)}</td></tr>))}</tbody>
            </table>
          </div>
        </Crd>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// LEADS PAGE
// ═══════════════════════════════════════════════════════════════════
function LeadsPage({ dateRange }) {
  const [leads, setLeads] = useState([]);
  const [pg, setPg] = useState({ page: 1, totalPages: 1, totalCount: 0 });
  const [filters, setFilters] = useState({ status: "", source: "", page: 1 });
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [collapsed, setCollapsed] = useState({ identity: true, system: true });
  const intervalRef = useRef(null);

  const load = useCallback((silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    const p = new URLSearchParams({ page: filters.page, limit: 30 });
    if (filters.status) p.set("status", filters.status);
    if (filters.source) p.set("source", filters.source);
    if (dateRange.from) p.set("from", dateRange.from.toISOString());
    if (dateRange.to) p.set("to", dateRange.to.toISOString());
    apiFetch(`/leads?${p}`).then(d => { setLeads(d.leads || []); setPg(d.pagination || { page: 1, totalPages: 1, totalCount: 0 }); setLastRefresh(new Date()); }).catch(() => setLeads([])).finally(() => { setLoading(false); setRefreshing(false); });
  }, [filters, dateRange]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    intervalRef.current = setInterval(() => load(true), 30000);
    return () => clearInterval(intervalRef.current);
  }, [load]);

  const openDetail = l => { setSelected(l); setDetailLoading(true); setCollapsed({ identity: true, system: true }); apiFetch(`/leads/${l.id}`).then(d => setDetail(d)).catch(() => setDetail(null)).finally(() => setDetailLoading(false)); };

  const exportCSV = () => {
    if (!leads.length) return;
    const hdr = ["ID", "First Name", "Last Name", "Email", "Phone", "Loan Amount", "Status", "Redirect", "Revenue", "Response Time", "Source", "Created"];
    const rows = leads.map(l => [l.id, l.first_name, l.last_name, l.email, l.phone, l.loan_amount, l.status, (l.status === 'redirected' || l.status === 'accepted' || l.status === 'sold' || l.status === 'converted' || l.status === 'completed') ? "Confirmed" : l.redirect_url ? "Accepted" : l.status === "rejected_by_lender" ? "Rejected" : "Pending", l.revenue || 0, l.response_time_ms || "", l.source, l.created_at]);
    const csv = [hdr, ...rows].map(r => r.map(c => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `leads_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
        <Sel label="Status" value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value, page: 1 }))} options={[{ v: "", l: "All" }, { v: "new", l: "New" }, { v: "pending", l: "Pending" }, { v: "distributed", l: "Distributed" }, { v: "redirected", l: "Redirected" }, { v: "accepted", l: "Accepted" }, { v: "sold", l: "Sold" }, { v: "converted", l: "Converted" }, { v: "completed", l: "Completed" }, { v: "rejected", l: "Rejected" }, { v: "rejected_by_lender", l: "Rejected by Lender" }]} />
        <Inp label="Source" placeholder="e.g. teprestamoshoy.es" value={filters.source} onChange={e => setFilters(f => ({ ...f, source: e.target.value, page: 1 }))} onKeyDown={e => e.key === "Enter" && load()} style={{ width: 180 }} />
        <Btn v="primary" sz="sm" onClick={() => load()}>Search</Btn>
        <Btn sz="sm" onClick={exportCSV}>↓ CSV</Btn>
        <Btn sz="sm" onClick={() => load(true)} disabled={refreshing} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
          <RefreshIcon spinning={refreshing} />
          Refresh
        </Btn>
        <div style={{ marginLeft: "auto", fontSize: 11.5, color: C.textDim, paddingBottom: 6, display: "flex", alignItems: "center", gap: 8 }}>
          {lastRefresh && <span style={{ fontSize: 10, color: C.textGhost }}>Updated {lastRefresh.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>}
          <span>{fm.num(pg.totalCount)} leads</span>
        </div>
      </div>
      <Crd>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead><tr style={{ borderBottom: `1px solid ${C.border}` }}>{[{h:"ID"}, {h:"Created"}, {h:"Name"}, {h:"Email"}, {h:"Phone"}, {h:"Amount", tip:"Requested loan amount"}, {h:"Purpose"}, {h:"Status", tip:"Current pipeline status — hover the badge for details"}, {h:"Redirect", tip:"✓✓ = browser confirmed redirect · ✓ = lender accepted, not yet confirmed · ✕ = rejected · — = pending"}, {h:"Commission", tip:"Revenue earned from this lead via lender postback"}, {h:"Response", tip:"Time taken for lender API to respond"}, {h:"Source"}].map(({h, tip}) => (<th key={h} title={tip} style={{ padding: "11px 14px", textAlign: "left", fontSize: 9.5, fontWeight: 700, color: C.textGhost, textTransform: "uppercase", letterSpacing: ".07em", whiteSpace: "nowrap", cursor: tip ? "help" : "default", borderBottom: tip ? `1px dashed ${C.textGhost}` : "none" }}>{h}</th>))}</tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={12} style={{ textAlign: "center", padding: 48 }}><Spin /></td></tr> :
               leads.length === 0 ? <tr><td colSpan={12}><Empty icon="📭" title="No leads found" sub="Adjust filters or wait for new leads" /></td></tr> :
               leads.map(l => (
                <tr key={l.id} onClick={() => openDetail(l)} style={{ borderBottom: `1px solid ${C.border}`, cursor: "pointer", transition: "background .1s" }} onMouseEnter={e => e.currentTarget.style.background = C.cardHover} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <td style={{ padding: "9px 14px", color: C.textDim, fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>#{l.id}</td>
                  <td style={{ padding: "9px 14px", color: C.textDim, fontSize: 11, whiteSpace: "nowrap" }}>{fm.dt(l.created_at)}</td>
                  <td style={{ padding: "9px 14px", fontWeight: 700, color: C.text, whiteSpace: "nowrap" }}>{l.first_name} {l.last_name}</td>
                  <td style={{ padding: "9px 14px", color: C.textSoft, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis" }}>{l.email}</td>
                  <td style={{ padding: "9px 14px", color: C.textSoft, fontVariantNumeric: "tabular-nums" }}>{l.phone}</td>
                  <td style={{ padding: "9px 14px", fontWeight: 700, color: C.gold, fontVariantNumeric: "tabular-nums" }}>{fm.eur(l.loan_amount)}</td>
                  <td style={{ padding: "9px 14px", color: C.textDim, fontSize: 11.5 }}>{l.loan_purpose || "—"}</td>
                  <td style={{ padding: "9px 14px" }}><Badge status={l.status} /></td>
                  <td style={{ padding: "9px 14px", textAlign: "center" }}>{l.status === 'redirected' || l.status === 'accepted' || l.status === 'sold' || l.status === 'converted' || l.status === 'completed' ? <span title="Confirmed redirected — browser verified hitting lender's page" style={{ color: C.mint, fontWeight: 800, fontSize: 13, cursor: "help" }}>✓✓</span> : l.redirect_url && l.status === 'distributed' ? <span title="Lender accepted — awaiting browser redirect confirmation" style={{ color: C.gold, fontWeight: 800, fontSize: 13, cursor: "help" }}>✓</span> : l.status === "rejected_by_lender" ? <span title="Rejected by lender — check lead detail for reason" style={{ color: C.red, fontWeight: 800, fontSize: 13, cursor: "help" }}>✕</span> : <span title="Not yet sent to lender" style={{ color: C.textGhost, cursor: "help" }}>—</span>}</td>
                  <td style={{ padding: "9px 14px", fontWeight: 800, color: parseFloat(l.revenue) > 0 ? C.mint : C.textGhost, fontVariantNumeric: "tabular-nums" }}>{parseFloat(l.revenue) > 0 ? fm.eur(l.revenue) : "—"}</td>
                  <td style={{ padding: "9px 14px", color: l.response_time_ms ? C.cyan : C.textGhost, fontWeight: 700, fontVariantNumeric: "tabular-nums", fontSize: 11.5 }}>{l.response_time_ms ? fm.ms(l.response_time_ms) : "—"}</td>
                  <td style={{ padding: "9px 14px", color: C.textDim, fontSize: 11 }}>{l.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {pg.totalPages > 1 && (<div style={{ display: "flex", justifyContent: "center", gap: 10, padding: 14, borderTop: `1px solid ${C.border}` }}><Btn sz="sm" v="ghost" disabled={filters.page <= 1} onClick={() => setFilters(f => ({ ...f, page: f.page - 1 }))}>← Prev</Btn><span style={{ fontSize: 11.5, color: C.textDim, alignSelf: "center" }}>{pg.page} / {pg.totalPages}</span><Btn sz="sm" v="ghost" disabled={filters.page >= pg.totalPages} onClick={() => setFilters(f => ({ ...f, page: f.page + 1 }))}>Next →</Btn></div>)}
      </Crd>

      <Modal open={!!selected} onClose={() => { setSelected(null); setDetail(null); setCollapsed({ identity: true, system: true }); }} title="" w={720}>
        {detailLoading ? <div style={{ textAlign: "center", padding: 44 }}><Spin sz={26} /></div> : detail?.lead ? (() => {
          const L = detail.lead;
          const purposeMap = {
            gasto_imprevisto: "Unexpected Expense", consolidacion_deudas: "Debt Consolidation",
            reforma_hogar: "Home Renovation", vehiculo: "Vehicle", vacaciones: "Holidays",
            salud: "Health", educacion: "Education", negocio: "Business", boda: "Wedding",
            negocio_propio: "Own Business", pago_servicios: "Service Payment",
            material_electronico: "Electronics", gasto_medico: "Medical Expense",
            reparaciones: "Repairs", otro: "Other", other: "Other",
          };
          // Humanize: "not_married" → "Not Married", "living_with_parents" → "Living With Parents"
          const humanize = (s) => {
            if (!s || typeof s !== "string") return s;
            return s.replace(/[_-]/g, " ").replace(/\b\w/g, c => c.toUpperCase());
          };
          const purposeEn = L.loan_purpose ? purposeMap[L.loan_purpose] || null : null;
          const purposeDisplay = L.loan_purpose ? (purposeEn ? `${humanize(L.loan_purpose)} / ${purposeEn}` : humanize(L.loan_purpose)) : null;

          const calcAge = (dob) => {
            if (!dob) return null;
            const birth = new Date(dob);
            if (isNaN(birth)) return null;
            const now = new Date();
            let age = now.getFullYear() - birth.getFullYear();
            if (now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())) age--;
            return age > 0 && age < 120 ? age : null;
          };
          const age = calcAge(L.date_of_birth);

          const fmtDOB = (dob) => {
            if (!dob) return null;
            const d = new Date(dob);
            if (isNaN(d)) return dob;
            return `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`;
          };

          const addressLine = [L.street, L.house_number, L.flat_number ? `Flat ${L.flat_number}` : null].filter(Boolean).join(", ") || null;
          const locationLine = [L.postal_code, L.city, L.province].filter(Boolean).join(", ") || null;

          const yrsLabel = (n) => n != null ? `${n} year${n === 1 ? "" : "s"}` : null;

          const F = ({ label, value }) => (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 9.5, fontWeight: 700, color: C.textGhost, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 2 }}>{label}</div>
              <div style={{ fontSize: 13, color: value ? C.text : C.textDim }}>{value || "—"}</div>
            </div>
          );

          const CardSection = ({ title, icon, children, collapsible, collapsed: isCollapsed, onToggle }) => (
            <div style={{ background: C.panel, borderRadius: 10, border: `1px solid ${C.border}`, overflow: "hidden" }}>
              <div onClick={collapsible ? onToggle : undefined} style={{ padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: collapsible ? "pointer" : "default", borderBottom: isCollapsed ? "none" : `1px solid ${C.border}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <span style={{ fontSize: 13, opacity: .5 }}>{icon}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: C.textDim, textTransform: "uppercase", letterSpacing: ".06em" }}>{title}</span>
                </div>
                {collapsible && <span style={{ fontSize: 10, color: C.textGhost, transition: "transform .2s", transform: isCollapsed ? "rotate(0deg)" : "rotate(180deg)" }}>▼</span>}
              </div>
              {!isCollapsed && <div style={{ padding: "12px 14px" }}>{children}</div>}
            </div>
          );

          return (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Header — badge right-aligned */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 16, fontWeight: 900, color: C.text }}>Lead #{L.id} — {L.first_name} {L.last_name}{L.second_last_name ? ` ${L.second_last_name}` : ""}</span>
                  {age && <span style={{ fontSize: 13, color: C.textSoft, fontWeight: 600 }}>· {age}yrs</span>}
                  {L.gender && <span style={{ fontSize: 13, color: C.textSoft, fontWeight: 600 }}>· {humanize(L.gender)}</span>}
                </div>
                <Badge status={L.status} />
              </div>

              {/* Cards grid */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {/* Contact */}
                <CardSection title="Contact" icon="📞">
                  <F label="Phone" value={L.phone} />
                  <F label="Email" value={L.email} />
                  <F label="Created" value={fm.dt(L.created_at)} />
                </CardSection>

                {/* Decision Snapshot — S.A.W. */}
                <CardSection title="Decision Snapshot (S.A.W.)" icon="⚡">
                  <div style={{ fontSize: 9, fontWeight: 700, color: C.textGhost, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6 }}>Stability</div>
                  <F label="Years at Address" value={yrsLabel(L.years_at_address)} />
                  <F label="Years at Job" value={yrsLabel(L.years_at_job)} />
                  <F label="Years at Bank" value={yrsLabel(L.years_at_bank)} />
                  <div style={{ fontSize: 9, fontWeight: 700, color: C.textGhost, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6, marginTop: 4 }}>Ability</div>
                  <F label="Monthly Income" value={L.monthly_income ? fm.eur(L.monthly_income) : null} />
                  <div style={{ fontSize: 9, fontWeight: 700, color: C.textGhost, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6, marginTop: 4 }}>Willingness</div>
                  <F label="Credit Score" value={L.credit_score ? String(L.credit_score) : null} />
                </CardSection>

                {/* Personal */}
                <CardSection title="Personal" icon="👤">
                  <F label="Marital Status" value={humanize(L.marital_status)} />
                  <F label="Housing" value={humanize(L.housing_tenure)} />
                  <F label="Dependents" value={L.dependents != null ? String(L.dependents) : null} />
                  <F label="Education" value={humanize(L.education)} />
                </CardSection>

                {/* Address */}
                <CardSection title="Address" icon="📍">
                  <F label="Street" value={addressLine} />
                  <F label="Location" value={locationLine} />
                  <F label="Country" value={L.country} />
                </CardSection>

                {/* Income & Employment */}
                <CardSection title="Income & Employment" icon="💼">
                  <F label="Employment" value={humanize(L.income_source)} />
                  <F label="Job Level" value={humanize(L.job_level)} />
                  <F label="Company" value={L.company_name} />
                  <F label="Monthly Income" value={L.monthly_income ? fm.eur(L.monthly_income) : null} />
                </CardSection>

                {/* Loan Request */}
                <CardSection title="Loan Request" icon="💰">
                  <F label="Amount" value={fm.eur(L.loan_amount)} />
                  <F label="Period" value={L.loan_period ? `${L.loan_period} days` : null} />
                  <F label="Purpose" value={purposeDisplay} />
                </CardSection>

                {/* Identity — collapsed by default */}
                <CardSection title="Identity" icon="🪪" collapsible collapsed={collapsed.identity} onToggle={() => setCollapsed(c => ({ ...c, identity: !c.identity }))}>
                  <F label="DNI" value={L.personal_code} />
                  <F label="Gender" value={humanize(L.gender)} />
                  <F label="Date of Birth" value={fmtDOB(L.date_of_birth)} />
                </CardSection>
              </div>

              {/* System card — full width, collapsed */}
              <CardSection title="System" icon="⚙" collapsible collapsed={collapsed.system} onToggle={() => setCollapsed(c => ({ ...c, system: !c.system }))}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0 }}>
                  <F label="Lead ID" value={String(L.id)} />
                  <F label="Source" value={L.source} />
                  <F label="Marketing" value={L.marketing_consent === true ? "✓ Accepted" : L.marketing_consent === false ? "✕ Declined" : null} />
                  <F label="IP" value={L.ip_address} />
                </div>
              </CardSection>

              {/* FiestaCredito Details */}
              {(L.fiesta_lead_id || L.redirect_url || L.response_time_ms || L.rejection_reason || parseFloat(L.revenue) > 0 || L.distributed_at || L.status === "rejected_by_lender" || L.status === "distributed") && (
                <div style={{ background: C.panel, borderRadius: 10, border: `1px solid ${C.border}`, padding: "14px 16px" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.textDim, marginBottom: 12, textTransform: "uppercase", letterSpacing: ".06em" }}>FiestaCredito Details</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div><div style={{ fontSize: 9, fontWeight: 700, color: C.textGhost, textTransform: "uppercase" }}>Redirect Status</div><div style={{ fontSize: 14, fontWeight: 800, marginTop: 2, color: L.status === 'redirected' || L.status === 'accepted' || L.status === 'sold' || L.status === 'converted' || L.status === 'completed' ? C.mint : L.redirect_url ? C.gold : L.status === "rejected_by_lender" ? C.red : C.gold }}>{L.status === 'redirected' || L.status === 'accepted' || L.status === 'sold' || L.status === 'converted' || L.status === 'completed' ? "✓✓ Confirmed Redirected" : L.redirect_url ? "✓ Accepted (not confirmed)" : L.status === "rejected_by_lender" ? "✕ Rejected" : "⏳ Pending"}</div></div>
                    {L.fiesta_lead_id && (<div><div style={{ fontSize: 9, fontWeight: 700, color: C.textGhost, textTransform: "uppercase" }}>Fiesta Lead ID</div><div style={{ fontSize: 12, color: C.text, marginTop: 2, fontFamily: "monospace" }}>{L.fiesta_lead_id}</div></div>)}
                    {L.response_time_ms != null && (<div><div style={{ fontSize: 9, fontWeight: 700, color: C.textGhost, textTransform: "uppercase" }}>Response Time</div><div style={{ fontSize: 14, color: C.cyan, fontWeight: 800, marginTop: 2 }}>{fm.ms(L.response_time_ms)} <span style={{ fontSize: 10, color: C.textDim, fontWeight: 600 }}>({fm.msRaw(L.response_time_ms)})</span></div></div>)}
                    {L.distributed_at && (<div><div style={{ fontSize: 9, fontWeight: 700, color: C.textGhost, textTransform: "uppercase" }}>Distributed At</div><div style={{ fontSize: 12, color: C.text, marginTop: 2 }}>{fm.dt(L.distributed_at)}</div></div>)}
                    {parseFloat(L.revenue) > 0 && (<div><div style={{ fontSize: 9, fontWeight: 700, color: C.textGhost, textTransform: "uppercase" }}>Revenue</div><div style={{ fontSize: 14, color: C.gold, fontWeight: 800, marginTop: 2 }}>{fm.eur(L.revenue)}</div></div>)}
                    {L.redirect_url && (<div style={{ gridColumn: "1 / -1" }}><div style={{ fontSize: 9, fontWeight: 700, color: C.textGhost, textTransform: "uppercase" }}>Redirect URL</div><div style={{ fontSize: 11, color: C.sky, marginTop: 2, wordBreak: "break-all", fontFamily: "monospace" }}>{L.redirect_url}</div></div>)}
                    {L.rejection_reason && (<div style={{ gridColumn: "1 / -1" }}><div style={{ fontSize: 9, fontWeight: 700, color: C.textGhost, textTransform: "uppercase" }}>Rejection Reason</div><div style={{ fontSize: 12, color: C.red, marginTop: 2 }}>{L.rejection_reason}</div></div>)}
                  </div>
                </div>
              )}

              {/* Postback Events */}
              {detail.postbacks?.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.textDim, marginBottom: 10, textTransform: "uppercase", letterSpacing: ".06em" }}>Postback Events</div>
                  {detail.postbacks.map((pb, i) => (
                    <div key={i} style={{ padding: "12px 14px", background: C.panel, borderRadius: 10, display: "flex", justifyContent: "space-between", alignItems: "center", border: `1px solid ${C.border}`, marginBottom: 8 }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13, color: C.text }}>{pb.event}</div>
                        <div style={{ fontSize: 10.5, color: C.textDim, marginTop: 2 }}>{fm.dt(pb.created_at)} · Event ID: {pb.event_id || "—"}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        {parseFloat(pb.payout) > 0 && <div style={{ fontSize: 14, fontWeight: 800, color: C.gold }}>{fm.eur(pb.payout)}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {detail.distributions?.length > 0 && (<div><div style={{ fontSize: 11, fontWeight: 700, color: C.textDim, marginBottom: 10, textTransform: "uppercase", letterSpacing: ".06em" }}>Distribution History</div>{detail.distributions.map((d, i) => (<div key={i} style={{ padding: "12px 14px", background: C.panel, borderRadius: 10, display: "flex", justifyContent: "space-between", alignItems: "center", border: `1px solid ${C.border}`, marginBottom: 8 }}><div><div style={{ fontWeight: 700, fontSize: 13, color: C.text }}>{d.lender_name}</div><div style={{ fontSize: 10.5, color: C.textDim, marginTop: 2 }}>Sent {fm.dt(d.sent_at)} · {fm.ms(d.response_time_ms)} response</div></div><div style={{ textAlign: "right" }}><Badge status={d.was_purchased ? "sold" : d.response_status === "rejected" ? "rejected" : "distributed"} />{d.sale_price != null && <div style={{ fontSize: 12, fontWeight: 800, color: C.mint, marginTop: 4 }}>{fm.eur(d.sale_price)}</div>}</div></div>))}</div>)}

              {/* Redirect Confirmation Log */}
              {detail.redirectLogs?.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.textDim, marginBottom: 10, textTransform: "uppercase", letterSpacing: ".06em" }}>Redirect Confirmation Log</div>
                  {detail.redirectLogs.map((rl, i) => (
                    <div key={i} style={{ padding: "12px 14px", background: C.panel, borderRadius: 10, border: `1px solid ${C.mint}30`, marginBottom: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 13, color: C.mint }}>✓✓ Browser confirmed redirect</div>
                          <div style={{ fontSize: 10.5, color: C.textDim, marginTop: 2 }}>{fm.dt(rl.created_at)}</div>
                        </div>
                        <div style={{ textAlign: "right", fontSize: 10.5, color: C.textDim }}>
                          IP: {rl.ip_address || "—"}
                        </div>
                      </div>
                      <div style={{ fontSize: 10.5, color: C.sky, marginTop: 6, wordBreak: "break-all", fontFamily: "monospace" }}>{rl.destination_url}</div>
                      {rl.user_agent && <div style={{ fontSize: 9.5, color: C.textGhost, marginTop: 4, wordBreak: "break-all" }}>{rl.user_agent}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })() : <Empty icon="⚠️" title="Could not load lead details" />}
      </Modal>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// LENDERS PAGE
// ═══════════════════════════════════════════════════════════════════
function LenderForm({ open, lender, onClose, onSaved }) {
  const isEdit = !!lender;
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open) {
      setForm(lender ? { ...lender, field_mapping: typeof lender.field_mapping === "object" ? JSON.stringify(lender.field_mapping, null, 2) : (lender.field_mapping || "{}"), custom_headers: typeof lender.custom_headers === "object" ? JSON.stringify(lender.custom_headers, null, 2) : (lender.custom_headers || "{}") } : { name: "", api_endpoint: "", api_key: "", auth_type: "bearer", min_credit_score: 600, price_per_lead: 15, is_active: true, priority: 10, min_loan_amount: "", max_loan_amount: "", field_mapping: "{\n  \n}", custom_headers: "{\n  \n}", accepted_loan_purposes: "" });
      setError(null);
    }
  }, [open, lender]);

  const up = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true); setError(null);
    try {
      const payload = { ...form };
      ["field_mapping", "custom_headers"].forEach(k => { if (typeof payload[k] === "string") try { payload[k] = JSON.parse(payload[k]); } catch { payload[k] = {}; } });
      ["min_credit_score", "price_per_lead", "priority", "min_loan_amount", "max_loan_amount"].forEach(k => { if (payload[k] === "" || payload[k] == null) delete payload[k]; else payload[k] = Number(payload[k]); });
      if (typeof payload.accepted_loan_purposes === "string") { payload.accepted_loan_purposes = payload.accepted_loan_purposes.split(",").map(s => s.trim()).filter(Boolean); if (!payload.accepted_loan_purposes.length) delete payload.accepted_loan_purposes; }
      if (isEdit) await apiFetch(`/lenders/${lender.id}`, { method: "PUT", body: JSON.stringify(payload) });
      else await apiFetch("/lenders", { method: "POST", body: JSON.stringify(payload) });
      onSaved(); onClose();
    } catch (e) { setError(e.message); }
    setSaving(false);
  };

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? `Edit ${lender?.name}` : "Add Lender"} w={620}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Inp label="Lender Name" value={form.name || ""} onChange={e => up("name", e.target.value)} placeholder="e.g. FiestaCredito" />
          <Sel label="Auth Type" value={form.auth_type || "bearer"} onChange={e => up("auth_type", e.target.value)} options={[{ v: "bearer", l: "Bearer Token" }, { v: "basic", l: "Basic Auth" }, { v: "header", l: "Custom Header" }, { v: "none", l: "None" }]} />
        </div>
        <Inp label="API Endpoint" value={form.api_endpoint || ""} onChange={e => up("api_endpoint", e.target.value)} placeholder="https://api.lender.com/leads" />
        <Inp label="API Key" value={form.api_key || ""} onChange={e => up("api_key", e.target.value)} placeholder="sk-..." type="password" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <Inp label="Price/Lead (€)" type="number" value={form.price_per_lead ?? ""} onChange={e => up("price_per_lead", e.target.value)} />
          <Inp label="Min Credit Score" type="number" value={form.min_credit_score ?? ""} onChange={e => up("min_credit_score", e.target.value)} />
          <Inp label="Priority" type="number" value={form.priority ?? ""} onChange={e => up("priority", e.target.value)} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Inp label="Min Loan (€)" type="number" value={form.min_loan_amount ?? ""} onChange={e => up("min_loan_amount", e.target.value)} />
          <Inp label="Max Loan (€)" type="number" value={form.max_loan_amount ?? ""} onChange={e => up("max_loan_amount", e.target.value)} />
        </div>
        <Inp label="Accepted Purposes (comma-separated)" value={form.accepted_loan_purposes || ""} onChange={e => up("accepted_loan_purposes", e.target.value)} placeholder="home_purchase, refinance, personal" />
        <Txa label="Field Mapping (JSON)" value={form.field_mapping || "{}"} onChange={e => up("field_mapping", e.target.value)} />
        <Txa label="Custom Headers (JSON)" value={form.custom_headers || "{}"} onChange={e => up("custom_headers", e.target.value)} style={{ minHeight: 56 }} />
        <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}><input type="checkbox" checked={!!form.is_active} onChange={e => up("is_active", e.target.checked)} style={{ accentColor: C.mint }} /><span style={{ fontSize: 13, color: C.text }}>Active — receives new leads</span></label>
        {error && <div style={{ padding: "10px 14px", borderRadius: 8, background: C.redDim, color: C.red, fontSize: 12, fontWeight: 600 }}>{error}</div>}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}><Btn onClick={onClose}>Cancel</Btn><Btn v="primary" onClick={save} disabled={saving || !form.name}>{saving ? <><Spin sz={13} /> Saving…</> : isEdit ? "Update" : "Create"}</Btn></div>
      </div>
    </Modal>
  );
}

function LendersPage() {
  const [lenders, setLenders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editLender, setEditLender] = useState(null);
  const [testResult, setTestResult] = useState({});
  const [testingId, setTestingId] = useState(null);

  const load = useCallback(() => { setLoading(true); apiFetch("/lenders").then(d => setLenders(d.lenders || [])).catch(() => setLenders([])).finally(() => setLoading(false)); }, []);
  useEffect(() => { load(); }, [load]);

  const test = async (id) => { setTestingId(id); try { await apiFetch(`/lenders/${id}/test`, { method: "POST" }); setTestResult(r => ({ ...r, [id]: { ok: true } })); } catch (e) { setTestResult(r => ({ ...r, [id]: { ok: false, msg: e.message } })); } setTestingId(null); };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 12, color: C.textDim }}>{lenders.length} lender{lenders.length !== 1 ? "s" : ""}</span>
        <Btn v="primary" sz="sm" onClick={() => { setEditLender(null); setShowForm(true); }}>+ Add Lender</Btn>
      </div>
      {loading ? <div style={{ textAlign: "center", padding: 60 }}><Spin sz={26} /></div> : lenders.length === 0 ? (
        <Crd><Empty icon="🏦" title="No lenders configured" sub="Add your first lender to start distributing leads" /></Crd>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 14 }}>
          {lenders.map(l => (
            <Crd key={l.id} style={{ padding: "18px 22px", display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div><div style={{ fontSize: 16, fontWeight: 800, color: C.text }}>{l.name}</div><div style={{ fontSize: 10.5, color: C.textDim, marginTop: 2, fontFamily: "monospace", wordBreak: "break-all", maxWidth: 240 }}>{l.api_endpoint || "No endpoint"}</div></div>
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: l.is_active ? C.mint : C.red, flexShrink: 0, marginTop: 6, boxShadow: l.is_active ? `0 0 10px ${C.mintGlow}` : "none" }} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                {[["Price", fm.eur(l.price_per_lead)], ["Min Score", l.min_credit_score || "—"], ["Priority", l.priority ?? "—"]].map(([k, v]) => (<div key={k} style={{ padding: "7px 8px", background: C.panel, borderRadius: 7, textAlign: "center" }}><div style={{ fontSize: 8.5, fontWeight: 700, color: C.textGhost, textTransform: "uppercase", letterSpacing: ".08em" }}>{k}</div><div style={{ fontSize: 13, fontWeight: 800, color: C.text, marginTop: 1 }}>{v}</div></div>))}
              </div>
              {l.stats && (<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                {[["Sent", l.stats.total_sent || 0, C.sky, C.skyDim], ["Bought", l.stats.total_purchased || 0, C.mint, C.mintDim], ["Rev", fm.eur(l.stats.total_revenue), C.gold, C.goldDim]].map(([k, v, fg, bg]) => (<div key={k} style={{ padding: "6px 8px", background: bg, borderRadius: 7, textAlign: "center" }}><div style={{ fontSize: 8, fontWeight: 700, color: fg, textTransform: "uppercase" }}>{k}</div><div style={{ fontSize: 15, fontWeight: 900, color: fg }}>{v}</div></div>))}
              </div>)}
              {testResult[l.id] && <div style={{ padding: "7px 12px", borderRadius: 7, fontSize: 11.5, fontWeight: 700, background: testResult[l.id].ok ? C.mintDim : C.redDim, color: testResult[l.id].ok ? C.mint : C.red }}>{testResult[l.id].ok ? "✓ Connection OK" : `✕ ${testResult[l.id].msg}`}</div>}
              <div style={{ display: "flex", gap: 8, marginTop: "auto" }}><Btn sz="sm" onClick={() => { setEditLender(l); setShowForm(true); }} style={{ flex: 1 }}>Edit</Btn><Btn sz="sm" onClick={() => test(l.id)} disabled={testingId === l.id} style={{ flex: 1 }}>{testingId === l.id ? <><Spin sz={11} /> Testing…</> : "Test"}</Btn></div>
            </Crd>
          ))}
        </div>
      )}
      <LenderForm open={showForm} lender={editLender} onClose={() => { setShowForm(false); setEditLender(null); }} onSaved={load} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// ANALYTICS PAGE
// ═══════════════════════════════════════════════════════════════════
function AnalyticsPage({ dateRange }) {
  const [daily, setDaily] = useState([]);
  const [loading, setLoading] = useState(true);

  const dp = dateParams(dateRange);
  useEffect(() => { setLoading(true); apiFetch(`/analytics/daily?days=90${dp ? `&${dp}` : ""}`).then(d => setDaily(d.analytics || [])).catch(() => setDaily([])).finally(() => setLoading(false)); }, [dp]);

  const t = daily.reduce((a, d) => ({ leads: a.leads + (d.total_leads || 0), sold: a.sold + (d.sold_leads || 0), rej: a.rej + (d.rejected_leads || 0), dupes: a.dupes + (d.duplicate_leads || 0), rev: a.rev + (Number(d.total_revenue) || 0) }), { leads: 0, sold: 0, rej: 0, dupes: 0, rev: 0 });
  const conv = t.leads > 0 ? t.sold / t.leads : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {loading ? <div style={{ textAlign: "center", padding: 80 }}><Spin sz={28} /></div> : (<>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(155px, 1fr))", gap: 12 }}>
          <Stat label="Leads" value={fm.num(t.leads)} color={C.sky} tip="Total leads in selected period" />
          <Stat label="Avg/Day" value={daily.length > 0 ? (t.leads / daily.length).toFixed(1) : "0"} color={C.violet} tip="Average leads per day in selected period" />
          <Stat label="Sold" value={fm.num(t.sold)} color={C.mint} tip="Leads confirmed sold via lender postback" />
          <Stat label="Conv Rate" value={fm.pct(conv)} color={C.mint} tip="% of total leads that resulted in a sale" />
          <Stat label="Revenue" value={fm.eur(t.rev)} color={C.gold} tip="Total revenue from sold leads in selected period" />
          <Stat label="Rejected" value={fm.num(t.rej)} color={C.red} tip="Leads rejected by lender (not meeting criteria)" />
        </div>
        <Crd style={{ padding: "18px 20px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.textDim, textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 14 }}>Trend — {dateRange.label}</div>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={daily}>
              <defs><linearGradient id="a1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.sky} stopOpacity={.2} /><stop offset="100%" stopColor={C.sky} stopOpacity={0} /></linearGradient><linearGradient id="a2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.mint} stopOpacity={.2} /><stop offset="100%" stopColor={C.mint} stopOpacity={0} /></linearGradient></defs>
              <CartesianGrid stroke={C.border} strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 9.5, fill: C.textGhost }} tickFormatter={fm.short} />
              <YAxis tick={{ fontSize: 9.5, fill: C.textGhost }} width={35} />
              <Tooltip content={<ChartTip fmtLabel={fm.short} />} />
              <Area type="monotone" dataKey="total_leads" stroke={C.sky} fill="url(#a1)" strokeWidth={2} name="Leads" />
              <Area type="monotone" dataKey="sold_leads" stroke={C.mint} fill="url(#a2)" strokeWidth={2} name="Sold" />
            </AreaChart>
          </ResponsiveContainer>
        </Crd>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <Crd style={{ padding: "18px 20px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.textDim, textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 14 }}>Revenue/Day</div>
            <ResponsiveContainer width="100%" height={200}><BarChart data={daily}><CartesianGrid stroke={C.border} strokeDasharray="3 3" /><XAxis dataKey="date" tick={{ fontSize: 9, fill: C.textGhost }} tickFormatter={v => v ? new Date(v + "T00:00").getDate() : ""} /><YAxis tick={{ fontSize: 9, fill: C.textGhost }} tickFormatter={v => `€${v}`} width={45} /><Tooltip content={<ChartTip fmtLabel={fm.short} fmtValue={v => fm.eur(v)} />} /><Bar dataKey="total_revenue" fill={C.gold} radius={[3, 3, 0, 0]} name="Revenue" /></BarChart></ResponsiveContainer>
          </Crd>
          <Crd style={{ padding: "18px 20px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.textDim, textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 14 }}>Rejections & Duplicates</div>
            <ResponsiveContainer width="100%" height={200}><BarChart data={daily}><CartesianGrid stroke={C.border} strokeDasharray="3 3" /><XAxis dataKey="date" tick={{ fontSize: 9, fill: C.textGhost }} tickFormatter={v => v ? new Date(v + "T00:00").getDate() : ""} /><YAxis tick={{ fontSize: 9, fill: C.textGhost }} width={30} /><Tooltip content={<ChartTip fmtLabel={fm.short} />} /><Bar dataKey="rejected_leads" fill={C.red} radius={[3, 3, 0, 0]} name="Rejected" opacity={.75} /><Bar dataKey="duplicate_leads" fill={C.gold} radius={[3, 3, 0, 0]} name="Duplicates" opacity={.75} /></BarChart></ResponsiveContainer>
          </Crd>
        </div>
      </>)}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// SETTINGS PAGE
// ═══════════════════════════════════════════════════════════════════
function SettingsPage() {
  const [health, setHealth] = useState(null);
  const [checking, setChecking] = useState(false);
  const check = async () => { setChecking(true); try { const r = await fetch(API.replace("/api", "/health")); setHealth({ ok: true, data: await r.json() }); } catch (e) { setHealth({ ok: false, msg: e.message }); } setChecking(false); };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 600 }}>
      <Crd style={{ padding: "22px 24px" }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: C.text, marginBottom: 14 }}>Backend Connection</div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}><span style={{ fontSize: 11, fontWeight: 700, color: C.textDim }}>API:</span><code style={{ fontSize: 12, color: C.sky, background: C.panel, padding: "4px 10px", borderRadius: 6 }}>{API}</code></div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}><Btn sz="sm" v="primary" onClick={check} disabled={checking}>{checking ? <><Spin sz={12} /> Checking…</> : "Test Connection"}</Btn>{health && <span style={{ fontSize: 12, fontWeight: 700, color: health.ok ? C.mint : C.red }}>{health.ok ? "✓ Online" : `✕ ${health.msg}`}</span>}</div>
      </Crd>
      <Crd style={{ padding: "22px 24px" }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: C.text, marginBottom: 10 }}>Webhook URL</div>
        <div style={{ fontSize: 12.5, color: C.textSoft, marginBottom: 10 }}>Send leads from your landing pages here:</div>
        <code style={{ display: "block", fontSize: 12, color: C.mint, background: C.panel, padding: "12px 14px", borderRadius: 8, border: `1px solid ${C.border}`, wordBreak: "break-all" }}>POST {API}/leads/webhook</code>
      </Crd>
      <Crd style={{ padding: "22px 24px" }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: C.text, marginBottom: 10 }}>Platform</div>
        <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "8px 16px", fontSize: 12.5 }}>
          <span style={{ color: C.textDim, fontWeight: 600 }}>Website</span><span style={{ color: C.sky }}>teprestamoshoy.es</span>
          <span style={{ color: C.textDim, fontWeight: 600 }}>Backend</span><span style={{ color: C.sky }}>Railway (Node.js + PostgreSQL)</span>
          <span style={{ color: C.textDim, fontWeight: 600 }}>Dashboard</span><span style={{ color: C.sky }}>Next.js on Vercel</span>
        </div>
      </Crd>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// FUNNEL PAGE
// ═══════════════════════════════════════════════════════════════════

const FUNNEL_STEPS = [
  { step: "simulator", num: 0, label: "Simulator", desc: "Landing page with calculator" },
  { step: "step_1", num: 1, label: "Step 1", desc: "Loan Purpose" },
  { step: "step_2", num: 2, label: "Step 2", desc: "Personal Info" },
  { step: "step_3", num: 3, label: "Step 3", desc: "Contact Details" },
  { step: "step_4", num: 4, label: "Step 4", desc: "Address" },
  { step: "step_5", num: 5, label: "Step 5", desc: "Employment & Finance" },
  { step: "step_6", num: 6, label: "Step 6", desc: "Banking" },
  { step: "step_7", num: 7, label: "Step 7", desc: "Consent & Submit" },
  { step: "submitted", num: 8, label: "Submitted", desc: "Redirected to lender" },
];

function FunnelPage({ dateRange }) {
  const [data, setData] = useState(null);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  const dp = dateParams(dateRange);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [d, s] = await Promise.all([
        apiFetch(`/analytics/funnel?days=90${dp ? `&${dp}` : ""}`),
        apiFetch(`/analytics/summary${dp ? `?${dp}` : ""}`).catch(() => null),
      ]);
      setData(d);
      setSummary(s?.stats || null);
    } catch (e) { console.error("Funnel load error:", e); }
    setLoading(false);
  }, [dp]);

  useEffect(() => { load(); }, [load]);

  if (loading && !data) return <div style={{ display: "flex", justifyContent: "center", padding: 60 }}><Spin sz={28} /></div>;

  const stepsMap = {};
  (data?.steps || []).forEach(s => { stepsMap[s.step] = parseInt(s.sessions); });

  const funnelData = FUNNEL_STEPS.map(fs => ({
    ...fs,
    sessions: stepsMap[fs.step] || 0,
  }));

  const maxSessions = Math.max(...funnelData.map(f => f.sessions), 1);
  const totalSessions = data?.totalSessions || 0;

  const completions = funnelData.find(f => f.step === "submitted")?.sessions || 0;
  const conversionRate = totalSessions > 0 ? ((completions / totalSessions) * 100).toFixed(1) : "0.0";

  const step1 = funnelData.find(f => f.step === "step_1")?.sessions || 0;
  const simulatorToForm = totalSessions > 0 ? ((step1 / totalSessions) * 100).toFixed(1) : "0.0";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Summary stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 14 }}>
        <Stat label="Unique Visitors" value={fm.num(totalSessions)} icon="👁" color={C.sky} tip="Unique browser sessions that loaded teprestamoshoy.es" />
        <Stat label="Form Started" value={fm.num(step1)} sub={`${simulatorToForm}% of visitors`} icon="✏️" color={C.gold} tip="Visitors who progressed past the loan simulator to Step 1 of the form" />
        <Stat label="Submissions" value={fm.num(completions)} icon="✓" color={C.mint} tip="Visitors who completed all 7 steps and submitted the form" />
        <Stat label="Funnel Rate" value={`${conversionRate}%`} sub="Visitor → Submit" icon="⚡" color={conversionRate >= 5 ? C.mint : conversionRate >= 2 ? C.gold : C.red} tip="% of all visitors who completed the full form. Green ≥5%, yellow ≥2%, red below." />
        <Stat label="Redirect Rate" value={summary?.submittedToLender > 0 ? fm.pct(summary.redirectedLeads / summary.submittedToLender) : "—"} sub={`${fm.num(summary?.confirmedRedirects || 0)} confirmed of ${fm.num(summary?.redirectedLeads || 0)} accepted`} icon="↗" color={summary?.submittedToLender > 0 ? (summary.redirectedLeads / summary.submittedToLender >= 0.9 ? C.mint : summary.redirectedLeads / summary.submittedToLender >= 0.7 ? C.gold : C.red) : C.textDim} tip="% of submitted leads that the lender accepted. 'Confirmed' = browser verified hitting lender's page." />
      </div>

      {/* Post-submission pipeline */}
      {summary?.submittedToLender > 0 && (
        <Crd style={{ padding: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: C.text, marginBottom: 4 }}>Post-Submission Pipeline</div>
          <div style={{ fontSize: 11, color: C.textDim, marginBottom: 18 }}>What happens after a lead is submitted to lender</div>
          <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
            {[
              { label: "Submitted", value: summary.submittedToLender, color: C.sky, pct: "100%", tip: "Total leads sent to lender API" },
              { label: "Accepted", value: summary.redirectedLeads, color: C.gold, pct: summary.submittedToLender > 0 ? fm.pct(summary.redirectedLeads / summary.submittedToLender) : "0%", tip: "Lender returned a redirect URL — lead was accepted" },
              { label: "Confirmed Redirect", value: summary.confirmedRedirects || 0, color: C.mint, pct: summary.redirectedLeads > 0 ? fm.pct((summary.confirmedRedirects || 0) / summary.redirectedLeads) : "0%", tip: "Customer's browser hit our redirect endpoint — server-side proof of delivery to lender" },
              { label: "Rejected", value: summary.submittedToLender - summary.redirectedLeads, color: C.red, pct: summary.submittedToLender > 0 ? fm.pct((summary.submittedToLender - summary.redirectedLeads) / summary.submittedToLender) : "0%", tip: "Lender API rejected these leads (check rejection reasons)" },
            ].map((stage, i, arr) => (
              <div key={stage.label} style={{ display: "flex", alignItems: "center", flex: i < arr.length - 1 ? 1 : 0 }}>
                <div title={stage.tip} style={{ textAlign: "center", minWidth: 100, cursor: "help" }}>
                  <div style={{ fontSize: 28, fontWeight: 900, color: stage.color, lineHeight: 1 }}>{stage.value}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.textSoft, marginTop: 4 }}>{stage.label}</div>
                  <div style={{ fontSize: 10, color: stage.color, marginTop: 2 }}>{stage.pct}</div>
                </div>
                {i < arr.length - 1 && (
                  <div style={{ flex: 1, height: 2, background: C.border, margin: "0 12px", position: "relative" }}>
                    <div style={{ position: "absolute", right: -4, top: -4, fontSize: 10, color: C.textGhost }}>→</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Crd>
      )}

      {/* Visual funnel */}
      <Crd style={{ padding: 24 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: C.text, marginBottom: 18 }}>Conversion Funnel</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {funnelData.map((f, i) => {
            const pct = maxSessions > 0 ? (f.sessions / maxSessions) * 100 : 0;
            const prev = i > 0 ? funnelData[i - 1].sessions : f.sessions;
            const dropPct = prev > 0 ? (((prev - f.sessions) / prev) * 100).toFixed(1) : "0.0";
            const isSubmitted = f.step === "submitted";

            return (
              <div key={f.step} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 100, flexShrink: 0, textAlign: "right" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: isSubmitted ? C.mint : C.text }}>{f.label}</div>
                  <div style={{ fontSize: 10, color: C.textDim }}>{f.desc}</div>
                </div>
                <div style={{ flex: 1, position: "relative", height: 32, background: C.panel, borderRadius: 6, overflow: "hidden" }}>
                  <div style={{
                    height: "100%",
                    width: `${Math.max(pct, 1)}%`,
                    background: isSubmitted
                      ? `linear-gradient(90deg, ${C.mint}, ${C.mintGlow})`
                      : `linear-gradient(90deg, ${C.sky}, ${C.skyDim})`,
                    borderRadius: 6,
                    transition: "width .5s ease",
                    opacity: f.sessions > 0 ? 1 : 0.2,
                  }} />
                  <div style={{ position: "absolute", top: 0, left: 10, height: "100%", display: "flex", alignItems: "center", fontSize: 12, fontWeight: 800, color: C.text }}>
                    {fm.num(f.sessions)}
                  </div>
                </div>
                <div style={{ width: 60, flexShrink: 0, textAlign: "right" }}>
                  {i > 0 && prev > 0 && f.sessions < prev ? (
                    <span style={{ fontSize: 11, fontWeight: 700, color: C.red }}>−{dropPct}%</span>
                  ) : i === 0 ? (
                    <span style={{ fontSize: 11, fontWeight: 600, color: C.textDim }}>entry</span>
                  ) : (
                    <span style={{ fontSize: 11, fontWeight: 600, color: C.mint }}>0%</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Crd>

      {/* Drop-off analysis */}
      {data?.dropoff && Object.keys(data.dropoff).length > 0 && (
        <Crd style={{ padding: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: C.text, marginBottom: 14 }}>Drop-off Analysis</div>
          <div style={{ fontSize: 11, color: C.textDim, marginBottom: 14 }}>Where visitors abandoned (furthest step reached)</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {FUNNEL_STEPS.map(fs => {
              const count = data.dropoff[fs.num] || 0;
              if (count === 0) return null;
              const pctOfTotal = totalSessions > 0 ? ((count / totalSessions) * 100).toFixed(1) : "0.0";
              const isLast = fs.step === "submitted";
              return (
                <div key={fs.step} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0" }}>
                  <div style={{ width: 100, fontSize: 12, fontWeight: 600, color: isLast ? C.mint : C.textSoft, textAlign: "right" }}>{fs.label}</div>
                  <div style={{ flex: 1, height: 8, background: C.panel, borderRadius: 4, overflow: "hidden" }}>
                    <div style={{
                      height: "100%",
                      width: `${pctOfTotal}%`,
                      background: isLast ? C.mint : C.red,
                      borderRadius: 4,
                      opacity: isLast ? 1 : 0.7,
                    }} />
                  </div>
                  <div style={{ width: 80, textAlign: "right", fontSize: 11.5 }}>
                    <span style={{ fontWeight: 800, color: isLast ? C.mint : C.red }}>{count}</span>
                    <span style={{ color: C.textDim, marginLeft: 4 }}>({pctOfTotal}%)</span>
                  </div>
                </div>
              );
            })}
          </div>
        </Crd>
      )}

      {/* Empty state */}
      {totalSessions === 0 && !loading && (
        <Crd style={{ padding: 40 }}>
          <Empty icon="📊" title="No funnel data yet" sub="Events will appear once the tracking snippet is installed on teprestamoshoy.es" />
        </Crd>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// MAIN APP SHELL
// ═══════════════════════════════════════════════════════════════════
const NAV = [
  { id: "overview", label: "Overview", icon: "◐" },
  { id: "leads", label: "Leads", icon: "☰" },
  { id: "funnel", label: "Funnel", icon: "▽" },
  { id: "lenders", label: "Lenders", icon: "⬡" },
  { id: "analytics", label: "Analytics", icon: "◧" },
  { id: "settings", label: "Settings", icon: "⚙" },
];

export default function DashboardPage() {
  const [page, setPage] = useState("overview");
  const [time, setTime] = useState(new Date());
  const [dateRange, setDateRange] = useState({ preset: "all", from: null, to: null, label: "All Time", days: 0 });
  const router = useRouter();

  useEffect(() => { const t = setInterval(() => setTime(new Date()), 60000); return () => clearInterval(t); }, []);

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'DM Sans', system-ui, sans-serif", display: "flex" }}>
      {/* Sidebar */}
      <aside style={{ width: 220, background: C.panel, borderRight: `1px solid ${C.border}`, display: "flex", flexDirection: "column", flexShrink: 0, position: "sticky", top: 0, height: "100vh" }}>
        <div style={{ padding: "22px 20px 18px", borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <svg width="32" height="32" viewBox="0 0 260 260" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}><circle cx="130" cy="130" r="90" fill="#FFFFFF"/><circle cx="130" cy="130" r="55" fill="#0C1017"/><path d="M130 130 L205 205 L170 230 L115 175 Z" fill="#00C853"/></svg>
            <div><div style={{ fontSize: 14, fontWeight: 800, color: C.text }}>RouteIQ</div><div style={{ fontSize: 10, color: C.textDim, fontWeight: 600 }}>Lead Management</div></div>
          </div>
        </div>
        <nav style={{ padding: "14px 10px", flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
          {NAV.map(n => (
            <button key={n.id} onClick={() => setPage(n.id)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 9, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 600, transition: "all .15s", width: "100%", textAlign: "left", background: page === n.id ? C.mintDim : "transparent", color: page === n.id ? C.mint : C.textSoft }}>
              <span style={{ fontSize: 15, width: 20, textAlign: "center", opacity: page === n.id ? 1 : .5 }}>{n.icon}</span>{n.label}
            </button>
          ))}
        </nav>
        <div style={{ padding: "10px 10px", borderTop: `1px solid ${C.border}` }}>
          <button onClick={logout} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 9, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 600, width: "100%", textAlign: "left", background: "transparent", color: C.textDim, transition: "all .15s" }}>
            ↩ Sign Out
          </button>
        </div>
        <div style={{ padding: "10px 18px 14px", fontSize: 10.5, color: C.textGhost }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: C.mint, boxShadow: `0 0 6px ${C.mintGlow}` }} /><span style={{ color: C.textDim }}>Online</span></div>
          <div style={{ marginTop: 4 }}>{time.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} · {time.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}</div>
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <header style={{ padding: "16px 28px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", background: C.panel, position: "sticky", top: 0, zIndex: 100 }}>
          <h1 style={{ fontSize: 18, fontWeight: 900, letterSpacing: "-.02em" }}>{NAV.find(n => n.id === page)?.label}</h1>
          <DateRangePicker dateRange={dateRange} onChange={setDateRange} />
        </header>
        <div style={{ padding: 24, flex: 1, animation: "fadeIn .3s ease-out" }} key={page}>
          {page === "overview" && <OverviewPage dateRange={dateRange} />}
          {page === "leads" && <LeadsPage dateRange={dateRange} />}
          {page === "funnel" && <FunnelPage dateRange={dateRange} />}
          {page === "lenders" && <LendersPage />}
          {page === "analytics" && <AnalyticsPage dateRange={dateRange} />}
          {page === "settings" && <SettingsPage />}
        </div>
      </main>
    </div>
  );
}
