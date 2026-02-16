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
};

const STATUS = {
  new:                { bg: C.skyDim, fg: C.sky, label: "New" },
  pending:            { bg: C.goldDim, fg: C.gold, label: "Pending" },
  distributed:        { bg: C.violetDim, fg: C.violet, label: "Distributed" },
  redirected:         { bg: C.cyanDim, fg: C.cyan, label: "Redirected" },
  accepted:           { bg: C.mintDim, fg: C.mint, label: "Accepted" },
  sold:               { bg: C.mintDim, fg: C.mint, label: "Sold" },
  completed:          { bg: C.mintDim, fg: C.mint, label: "Completed" },
  rejected:           { bg: C.redDim, fg: C.red, label: "Rejected" },
  rejected_by_lender: { bg: C.redDim, fg: C.red, label: "Rejected by Lender" },
  duplicate:          { bg: C.goldDim, fg: C.gold, label: "Duplicate" },
  error:              { bg: C.roseDim, fg: C.rose, label: "Error" },
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

const Badge = ({ status }) => { const s = STATUS[status] || STATUS.new; return (<span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 99, fontSize: 10.5, fontWeight: 700, background: s.bg, color: s.fg, letterSpacing: ".04em", textTransform: "uppercase" }}><span style={{ width: 5, height: 5, borderRadius: "50%", background: s.fg }} />{s.label}</span>); };

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

const Stat = ({ label, value, sub, color = C.mint, icon }) => (<Crd style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 8 }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><span style={{ fontSize: 10.5, fontWeight: 700, color: C.textDim, textTransform: "uppercase", letterSpacing: ".08em" }}>{label}</span>{icon && <span style={{ fontSize: 16, opacity: .4 }}>{icon}</span>}</div><div style={{ fontSize: 26, fontWeight: 900, color, letterSpacing: "-.02em", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{value}</div>{sub && <div style={{ fontSize: 11.5, color: C.textDim }}>{sub}</div>}</Crd>);

const ChartTip = ({ active, payload, label, fmtLabel, fmtValue }) => { if (!active || !payload?.length) return null; return (<div style={{ background: C.card, border: `1px solid ${C.borderLight}`, borderRadius: 10, padding: "10px 14px", fontSize: 12, boxShadow: "0 8px 30px rgba(0,0,0,.4)" }}><div style={{ color: C.textSoft, fontWeight: 600, marginBottom: 6 }}>{fmtLabel ? fmtLabel(label) : label}</div>{payload.map((p, i) => (<div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 3 }}><span style={{ width: 7, height: 7, borderRadius: "50%", background: p.color }} /><span style={{ color: C.textSoft }}>{p.name}:</span><span style={{ color: C.text, fontWeight: 700 }}>{fmtValue ? fmtValue(p.value, p.name) : p.value}</span></div>))}</div>); };

// ═══════════════════════════════════════════════════════════════════
// OVERVIEW PAGE
// ═══════════════════════════════════════════════════════════════════
function OverviewPage() {
  const [summary, setSummary] = useState(null);
  const [daily, setDaily] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const intervalRef = useRef(null);

  const loadData = useCallback((silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    Promise.all([
      apiFetch("/analytics/summary").catch(() => null),
      apiFetch("/analytics/daily?days=30").catch(() => null),
    ]).then(([s, d]) => {
      setSummary(s?.stats || null);
      setDaily(d?.analytics || []);
      setErr(!s && !d ? "Cannot reach backend — check Railway deployment" : null);
      setLastRefresh(new Date());
    }).finally(() => { setLoading(false); setRefreshing(false); });
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    intervalRef.current = setInterval(() => loadData(true), 30000);
    return () => clearInterval(intervalRef.current);
  }, [loadData]);

  if (loading) return <div style={{ display: "flex", justifyContent: "center", padding: 100 }}><Spin sz={30} /></div>;
  if (err) return <Empty icon="⚠️" title="Connection Error" sub={err} />;

  const s = summary || {};
  const conv = s.totalLeads > 0 ? s.soldLeads / s.totalLeads : 0;
  const avgRev = s.soldLeads > 0 ? s.totalRevenue / s.soldLeads : 0;
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
        <Stat label="Total Leads" value={fm.num(s.totalLeads)} sub={`${fm.num(s.leadsToday)} today`} color={C.sky} icon="📋" />
        <Stat label="Sold" value={fm.num(s.soldLeads)} sub={`${fm.pct(conv)} conversion`} color={C.mint} icon="✓" />
        <Stat label="Revenue" value={fm.eur(s.totalRevenue)} sub={`${fm.eur(avgRev)} per sale`} color={C.gold} icon="€" />
        <Stat label="This Week" value={fm.num(s.leadsThisWeek)} sub={`${fm.num(s.leadsThisMonth)} this month`} color={C.violet} icon="📈" />
        <Stat label="Avg Response" value={s.avgResponseTimeMs ? fm.ms(s.avgResponseTimeMs) : "—"} sub={s.avgResponseTimeMs ? fm.msRaw(s.avgResponseTimeMs) : "No data yet"} color={C.cyan} icon="⚡" />
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
              <thead><tr>{["Date", "Leads", "Sold", "Rejected", "Dupes", "Revenue", "Avg Time"].map(h => (<th key={h} style={{ padding: "8px 12px", textAlign: "left", fontSize: 9.5, fontWeight: 700, color: C.textGhost, textTransform: "uppercase", letterSpacing: ".07em", borderBottom: `1px solid ${C.border}`, position: "sticky", top: 0, background: C.card }}>{h}</th>))}</tr></thead>
              <tbody>{[...daily].reverse().slice(0, 14).map((d, i) => (<tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}><td style={{ padding: "7px 12px", color: C.textSoft, whiteSpace: "nowrap" }}>{fm.short(d.date)}</td><td style={{ padding: "7px 12px", fontWeight: 700, color: C.text }}>{d.total_leads}</td><td style={{ padding: "7px 12px", color: C.mint, fontWeight: 700 }}>{d.sold_leads}</td><td style={{ padding: "7px 12px", color: C.red }}>{d.rejected_leads}</td><td style={{ padding: "7px 12px", color: C.gold }}>{d.duplicate_leads}</td><td style={{ padding: "7px 12px", color: C.gold, fontWeight: 700 }}>{fm.eur(d.total_revenue)}</td><td style={{ padding: "7px 12px", color: C.cyan, fontSize: 11 }}>{d.avg_response_time ? fm.ms(d.avg_response_time) : "—"}</td></tr>))}</tbody>
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
function LeadsPage() {
  const [leads, setLeads] = useState([]);
  const [pg, setPg] = useState({ page: 1, totalPages: 1, totalCount: 0 });
  const [filters, setFilters] = useState({ status: "", source: "", page: 1 });
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const intervalRef = useRef(null);

  const load = useCallback((silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    const p = new URLSearchParams({ page: filters.page, limit: 30 });
    if (filters.status) p.set("status", filters.status);
    if (filters.source) p.set("source", filters.source);
    apiFetch(`/leads?${p}`).then(d => { setLeads(d.leads || []); setPg(d.pagination || { page: 1, totalPages: 1, totalCount: 0 }); setLastRefresh(new Date()); }).catch(() => setLeads([])).finally(() => { setLoading(false); setRefreshing(false); });
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    intervalRef.current = setInterval(() => load(true), 30000);
    return () => clearInterval(intervalRef.current);
  }, [load]);

  const openDetail = l => { setSelected(l); setDetailLoading(true); apiFetch(`/leads/${l.id}`).then(d => setDetail(d)).catch(() => setDetail(null)).finally(() => setDetailLoading(false)); };

  const exportCSV = () => {
    if (!leads.length) return;
    const hdr = ["ID", "First Name", "Last Name", "Email", "Phone", "Loan Amount", "Status", "Source", "Response Time (ms)", "Created"];
    const rows = leads.map(l => [l.id, l.first_name, l.last_name, l.email, l.phone, l.loan_amount, l.status, l.source, l.response_time_ms || "", l.created_at]);
    const csv = [hdr, ...rows].map(r => r.map(c => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `leads_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
        <Sel label="Status" value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value, page: 1 }))} options={[{ v: "", l: "All" }, { v: "new", l: "New" }, { v: "pending", l: "Pending" }, { v: "distributed", l: "Distributed" }, { v: "redirected", l: "Redirected" }, { v: "accepted", l: "Accepted" }, { v: "sold", l: "Sold" }, { v: "completed", l: "Completed" }, { v: "rejected", l: "Rejected" }, { v: "rejected_by_lender", l: "Rejected by Lender" }]} />
        <Inp label="Source" placeholder="e.g. teprestamos.es" value={filters.source} onChange={e => setFilters(f => ({ ...f, source: e.target.value, page: 1 }))} onKeyDown={e => e.key === "Enter" && load()} style={{ width: 180 }} />
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
            <thead><tr style={{ borderBottom: `1px solid ${C.border}` }}>{["ID", "Name", "Email", "Phone", "Amount", "Status", "Response", "Source", "Created"].map(h => (<th key={h} style={{ padding: "11px 14px", textAlign: "left", fontSize: 9.5, fontWeight: 700, color: C.textGhost, textTransform: "uppercase", letterSpacing: ".07em", whiteSpace: "nowrap" }}>{h}</th>))}</tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={9} style={{ textAlign: "center", padding: 48 }}><Spin /></td></tr> :
               leads.length === 0 ? <tr><td colSpan={9}><Empty icon="📭" title="No leads found" sub="Adjust filters or wait for new leads" /></td></tr> :
               leads.map(l => (
                <tr key={l.id} onClick={() => openDetail(l)} style={{ borderBottom: `1px solid ${C.border}`, cursor: "pointer", transition: "background .1s" }} onMouseEnter={e => e.currentTarget.style.background = C.cardHover} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <td style={{ padding: "9px 14px", color: C.textDim, fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>#{l.id}</td>
                  <td style={{ padding: "9px 14px", fontWeight: 700, color: C.text, whiteSpace: "nowrap" }}>{l.first_name} {l.last_name}</td>
                  <td style={{ padding: "9px 14px", color: C.textSoft, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis" }}>{l.email}</td>
                  <td style={{ padding: "9px 14px", color: C.textSoft, fontVariantNumeric: "tabular-nums" }}>{l.phone}</td>
                  <td style={{ padding: "9px 14px", fontWeight: 700, color: C.gold, fontVariantNumeric: "tabular-nums" }}>{fm.eur(l.loan_amount)}</td>
                  <td style={{ padding: "9px 14px" }}><Badge status={l.status} /></td>
                  <td style={{ padding: "9px 14px", color: C.cyan, fontSize: 11, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{l.response_time_ms ? fm.ms(l.response_time_ms) : "—"}</td>
                  <td style={{ padding: "9px 14px", color: C.textDim, fontSize: 11 }}>{l.source}</td>
                  <td style={{ padding: "9px 14px", color: C.textDim, fontSize: 11, whiteSpace: "nowrap" }}>{fm.dt(l.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {pg.totalPages > 1 && (<div style={{ display: "flex", justifyContent: "center", gap: 10, padding: 14, borderTop: `1px solid ${C.border}` }}><Btn sz="sm" v="ghost" disabled={filters.page <= 1} onClick={() => setFilters(f => ({ ...f, page: f.page - 1 }))}>← Prev</Btn><span style={{ fontSize: 11.5, color: C.textDim, alignSelf: "center" }}>{pg.page} / {pg.totalPages}</span><Btn sz="sm" v="ghost" disabled={filters.page >= pg.totalPages} onClick={() => setFilters(f => ({ ...f, page: f.page + 1 }))}>Next →</Btn></div>)}
      </Crd>

      <Modal open={!!selected} onClose={() => { setSelected(null); setDetail(null); }} title={selected ? `Lead #${selected.id} — ${selected.first_name} ${selected.last_name}` : ""} w={700}>
        {detailLoading ? <div style={{ textAlign: "center", padding: 44 }}><Spin sz={26} /></div> : detail?.lead ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              {[
                ["Email", detail.lead.email],
                ["Phone", detail.lead.phone],
                ["Loan Amount", fm.eur(detail.lead.loan_amount)],
                ["Loan Purpose", detail.lead.loan_purpose],
                ["Loan Period", detail.lead.loan_period ? `${detail.lead.loan_period} days` : null],
                ["Status", null, <Badge key="b" status={detail.lead.status} />],
                ["Source", detail.lead.source],
                ["Country", detail.lead.country],
                ["Created", fm.dt(detail.lead.created_at)],
                ["IP", detail.lead.ip_address],
              ].map(([k, v, node]) => (
                <div key={k}><div style={{ fontSize: 9.5, fontWeight: 700, color: C.textGhost, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 3 }}>{k}</div>{node || <div style={{ fontSize: 13, color: v ? C.text : C.textDim }}>{v || "—"}</div>}</div>
              ))}
            </div>

            {/* FiestaCredito Details */}
            {(detail.lead.fiesta_lead_id || detail.lead.redirect_url || detail.lead.response_time_ms || detail.lead.rejection_reason) && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.textDim, marginBottom: 10, textTransform: "uppercase", letterSpacing: ".06em" }}>FiestaCredito Details</div>
                <div style={{ padding: "14px 16px", background: C.panel, borderRadius: 10, border: `1px solid ${C.border}`, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  {detail.lead.fiesta_lead_id && (<div><div style={{ fontSize: 9, fontWeight: 700, color: C.textGhost, textTransform: "uppercase" }}>Fiesta Lead ID</div><div style={{ fontSize: 12, color: C.text, marginTop: 2, fontFamily: "monospace" }}>{detail.lead.fiesta_lead_id}</div></div>)}
                  {detail.lead.response_time_ms && (<div><div style={{ fontSize: 9, fontWeight: 700, color: C.textGhost, textTransform: "uppercase" }}>Response Time</div><div style={{ fontSize: 14, color: C.cyan, fontWeight: 800, marginTop: 2 }}>{fm.ms(detail.lead.response_time_ms)} <span style={{ fontSize: 10, color: C.textDim, fontWeight: 600 }}>({fm.msRaw(detail.lead.response_time_ms)})</span></div></div>)}
                  {detail.lead.distributed_at && (<div><div style={{ fontSize: 9, fontWeight: 700, color: C.textGhost, textTransform: "uppercase" }}>Distributed At</div><div style={{ fontSize: 12, color: C.text, marginTop: 2 }}>{fm.dt(detail.lead.distributed_at)}</div></div>)}
                  {detail.lead.revenue > 0 && (<div><div style={{ fontSize: 9, fontWeight: 700, color: C.textGhost, textTransform: "uppercase" }}>Revenue</div><div style={{ fontSize: 14, color: C.gold, fontWeight: 800, marginTop: 2 }}>{fm.eur(detail.lead.revenue)}</div></div>)}
                  {detail.lead.redirect_url && (<div style={{ gridColumn: "1 / -1" }}><div style={{ fontSize: 9, fontWeight: 700, color: C.textGhost, textTransform: "uppercase" }}>Redirect URL</div><div style={{ fontSize: 11, color: C.sky, marginTop: 2, wordBreak: "break-all", fontFamily: "monospace" }}>{detail.lead.redirect_url}</div></div>)}
                  {detail.lead.rejection_reason && (<div style={{ gridColumn: "1 / -1" }}><div style={{ fontSize: 9, fontWeight: 700, color: C.textGhost, textTransform: "uppercase" }}>Rejection Reason</div><div style={{ fontSize: 12, color: C.red, marginTop: 2 }}>{detail.lead.rejection_reason}</div></div>)}
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
                      {pb.payout > 0 && <div style={{ fontSize: 14, fontWeight: 800, color: C.gold }}>{fm.eur(pb.payout)}</div>}
                      <Badge status={pb.event === "lead_sold" ? "sold" : pb.event === "lead_accepted" ? "accepted" : pb.event === "lead_completed" ? "completed" : "redirected"} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {detail.distributions?.length > 0 && (<div><div style={{ fontSize: 11, fontWeight: 700, color: C.textDim, marginBottom: 10, textTransform: "uppercase", letterSpacing: ".06em" }}>Distribution History</div>{detail.distributions.map((d, i) => (<div key={i} style={{ padding: "12px 14px", background: C.panel, borderRadius: 10, display: "flex", justifyContent: "space-between", alignItems: "center", border: `1px solid ${C.border}`, marginBottom: 8 }}><div><div style={{ fontWeight: 700, fontSize: 13, color: C.text }}>{d.lender_name}</div><div style={{ fontSize: 10.5, color: C.textDim, marginTop: 2 }}>Sent {fm.dt(d.sent_at)} · {fm.ms(d.response_time_ms)} response</div></div><div style={{ textAlign: "right" }}><Badge status={d.was_purchased ? "sold" : d.response_status === "rejected" ? "rejected" : "distributed"} />{d.sale_price != null && <div style={{ fontSize: 12, fontWeight: 800, color: C.mint, marginTop: 4 }}>{fm.eur(d.sale_price)}</div>}</div></div>))}</div>)}
          </div>
        ) : <Empty icon="⚠️" title="Could not load lead details" />}
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
function AnalyticsPage() {
  const [daily, setDaily] = useState([]);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);

  useEffect(() => { setLoading(true); apiFetch(`/analytics/daily?days=${days}`).then(d => setDaily(d.analytics || [])).catch(() => setDaily([])).finally(() => setLoading(false)); }, [days]);

  const t = daily.reduce((a, d) => ({ leads: a.leads + (d.total_leads || 0), sold: a.sold + (d.sold_leads || 0), rej: a.rej + (d.rejected_leads || 0), dupes: a.dupes + (d.duplicate_leads || 0), rev: a.rev + (Number(d.total_revenue) || 0), respTimes: d.avg_response_time ? [...a.respTimes, Number(d.avg_response_time)] : a.respTimes }), { leads: 0, sold: 0, rej: 0, dupes: 0, rev: 0, respTimes: [] });
  const conv = t.leads > 0 ? t.sold / t.leads : 0;
  const avgResp = t.respTimes.length > 0 ? t.respTimes.reduce((a, b) => a + b, 0) / t.respTimes.length : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <span style={{ fontSize: 12, color: C.textDim }}>Period:</span>
        {[7, 14, 30, 60, 90].map(d => <Btn key={d} sz="sm" v={days === d ? "primary" : "ghost"} onClick={() => setDays(d)}>{d}d</Btn>)}
      </div>
      {loading ? <div style={{ textAlign: "center", padding: 80 }}><Spin sz={28} /></div> : (<>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(145px, 1fr))", gap: 12 }}>
          <Stat label="Leads" value={fm.num(t.leads)} color={C.sky} />
          <Stat label="Avg/Day" value={daily.length > 0 ? (t.leads / daily.length).toFixed(1) : "0"} color={C.violet} />
          <Stat label="Sold" value={fm.num(t.sold)} color={C.mint} />
          <Stat label="Conv Rate" value={fm.pct(conv)} color={C.mint} />
          <Stat label="Revenue" value={fm.eur(t.rev)} color={C.gold} />
          <Stat label="Rejected" value={fm.num(t.rej)} color={C.red} />
          <Stat label="Avg Response" value={avgResp ? fm.ms(avgResp) : "—"} color={C.cyan} />
        </div>
        <Crd style={{ padding: "18px 20px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.textDim, textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 14 }}>Trend — {days} Days</div>
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
        <div style={{ fontSize: 15, fontWeight: 800, color: C.text, marginBottom: 10 }}>Webhook URLs</div>
        <div style={{ fontSize: 12.5, color: C.textSoft, marginBottom: 10 }}>Send leads from your landing pages:</div>
        <code style={{ display: "block", fontSize: 12, color: C.mint, background: C.panel, padding: "12px 14px", borderRadius: 8, border: `1px solid ${C.border}`, wordBreak: "break-all", marginBottom: 10 }}>POST {API}/leads/webhook</code>
        <div style={{ fontSize: 12.5, color: C.textSoft, marginBottom: 10 }}>Submit directly to FiestaCredito:</div>
        <code style={{ display: "block", fontSize: 12, color: C.cyan, background: C.panel, padding: "12px 14px", borderRadius: 8, border: `1px solid ${C.border}`, wordBreak: "break-all" }}>POST {API}/leads/submit-to-fiesta</code>
      </Crd>
      <Crd style={{ padding: "22px 24px" }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: C.text, marginBottom: 10 }}>Platform</div>
        <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "8px 16px", fontSize: 12.5 }}>
          <span style={{ color: C.textDim, fontWeight: 600 }}>Website</span><span style={{ color: C.sky }}>teprestamoshoy.es</span>
          <span style={{ color: C.textDim, fontWeight: 600 }}>Backend</span><span style={{ color: C.sky }}>Railway (Node.js + PostgreSQL)</span>
          <span style={{ color: C.textDim, fontWeight: 600 }}>Dashboard</span><span style={{ color: C.sky }}>Next.js on Vercel</span>
          <span style={{ color: C.textDim, fontWeight: 600 }}>Lender</span><span style={{ color: C.sky }}>FiestaCredito (Async)</span>
        </div>
      </Crd>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// MAIN APP SHELL
// ═══════════════════════════════════════════════════════════════════
const NAV = [
  { id: "overview", label: "Overview", icon: "◐" },
  { id: "leads", label: "Leads", icon: "☰" },
  { id: "lenders", label: "Lenders", icon: "⬡" },
  { id: "analytics", label: "Analytics", icon: "◧" },
  { id: "settings", label: "Settings", icon: "⚙" },
];

export default function DashboardPage() {
  const [page, setPage] = useState("overview");
  const [time, setTime] = useState(new Date());
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
            <img src="/RouteIQ_Icon.svg" alt="RouteIQ" style={{ width: 32, height: 32, marginRight: -11 }} />
            <div style={{ fontSize: 14, fontWeight: 800, color: C.text }}>RouteIQ</div><div style={{ fontSize: 10, color: C.textDim, fontWeight: 600 }}>Lead Management</div>
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
        </header>
        <div style={{ padding: 24, flex: 1, animation: "fadeIn .3s ease-out" }} key={page}>
          {page === "overview" && <OverviewPage />}
          {page === "leads" && <LeadsPage />}
          {page === "lenders" && <LendersPage />}
          {page === "analytics" && <AnalyticsPage />}
          {page === "settings" && <SettingsPage />}
        </div>
      </main>
    </div>
  );
}
