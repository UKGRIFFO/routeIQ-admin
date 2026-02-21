"use client";

import { useState, useEffect, useCallback } from "react";

const API_BASE = "https://loan-broker-backend-production.up.railway.app";

// ── Color system matching RouteIQ ──
const C = {
  bg: "#0a0a0f",
  surface: "#12121a",
  surfaceHover: "#1a1a25",
  border: "#1e1e2e",
  borderLight: "#2a2a3d",
  text: "#e4e4ed",
  textDim: "#8888a0",
  textGhost: "#55556a",
  accent: "#f97316",       // orange for warnings
  accentDim: "rgba(249,115,22,0.12)",
  danger: "#ef4444",
  dangerDim: "rgba(239,68,68,0.12)",
  success: "#22c55e",
  successDim: "rgba(34,197,94,0.12)",
  warn: "#eab308",
  warnDim: "rgba(234,179,8,0.12)",
  blue: "#3b82f6",
  blueDim: "rgba(59,130,246,0.12)",
  purple: "#a855f7",
  purpleDim: "rgba(168,85,247,0.12)",
};

// ── Severity badge ──
function SeverityBadge({ level }) {
  const config = {
    critical: { bg: C.dangerDim, color: C.danger, border: "rgba(239,68,68,0.3)", label: "CRITICAL" },
    high: { bg: C.accentDim, color: C.accent, border: "rgba(249,115,22,0.3)", label: "HIGH" },
    medium: { bg: C.warnDim, color: C.warn, border: "rgba(234,179,8,0.3)", label: "MEDIUM" },
    low: { bg: C.blueDim, color: C.blue, border: "rgba(59,130,246,0.3)", label: "LOW" },
    info: { bg: C.purpleDim, color: C.purple, border: "rgba(168,85,247,0.3)", label: "INFO" },
  };
  const c = config[level] || config.low;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 700,
      letterSpacing: ".08em", background: c.bg, color: c.color,
      border: `1px solid ${c.border}`,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: c.color }} />
      {c.label}
    </span>
  );
}

// ── Stat card ──
function StatCard({ label, value, subtitle, color = C.text, icon }) {
  return (
    <div style={{
      background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10,
      padding: "18px 20px", flex: 1, minWidth: 160,
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: C.textGhost, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
        {icon && <span style={{ fontSize: 13 }}>{icon}</span>}
        {label}
      </div>
      <div style={{ fontSize: 28, fontWeight: 800, color, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
        {value}
      </div>
      {subtitle && <div style={{ fontSize: 11, color: C.textDim, marginTop: 6 }}>{subtitle}</div>}
    </div>
  );
}

// ── Hour bar chart ──
function HourlyChart({ data }) {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data.map(d => parseInt(d.lead_count) || 0), 1);
  const hours = Array.from({ length: 24 }, (_, i) => {
    const found = data.find(d => parseInt(d.hour) === i);
    return { hour: i, count: found ? parseInt(found.lead_count) : 0, ips: found ? parseInt(found.unique_ips) : 0 };
  });

  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 80, padding: "0 2px" }}>
      {hours.map(h => {
        const height = Math.max((h.count / max) * 70, 1);
        const isAnomaly = h.count > 0 && h.hour >= 1 && h.hour <= 5;
        return (
          <div key={h.hour} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }} title={`${h.hour}:00 — ${h.count} leads, ${h.ips} IPs`}>
            <div style={{
              width: "100%", maxWidth: 18, height, borderRadius: 3,
              background: isAnomaly && h.count > 0 ? C.danger : h.count > 0 ? C.accent : C.border,
              opacity: h.count > 0 ? 1 : 0.3,
              transition: "height 0.3s",
            }} />
            <span style={{ fontSize: 7, color: C.textGhost }}>{h.hour}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── IP Cluster row ──
function IPClusterRow({ cluster, onFlag }) {
  const [expanded, setExpanded] = useState(false);
  const count = parseInt(cluster.lead_count);
  const severity = count >= 5 ? "critical" : count >= 3 ? "high" : "medium";
  const timeDiff = new Date(cluster.last_seen) - new Date(cluster.first_seen);
  const minutesSpan = Math.round(timeDiff / 60000);

  return (
    <div style={{ borderBottom: `1px solid ${C.border}` }}>
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          display: "grid", gridTemplateColumns: "1fr 80px 80px 60px 100px 80px",
          alignItems: "center", padding: "10px 16px", cursor: "pointer",
          transition: "background 0.15s",
          background: expanded ? C.surfaceHover : "transparent",
        }}
        onMouseEnter={e => { if (!expanded) e.currentTarget.style.background = C.surfaceHover; }}
        onMouseLeave={e => { if (!expanded) e.currentTarget.style.background = "transparent"; }}
      >
        <div style={{ fontFamily: "monospace", fontSize: 13, color: C.text }}>{cluster.ip_address}</div>
        <div style={{ fontSize: 13, color: C.text, textAlign: "center", fontWeight: 700 }}>{count}</div>
        <div style={{ fontSize: 13, color: C.textDim, textAlign: "center" }}>{cluster.unique_emails}</div>
        <div style={{ fontSize: 11, color: C.textDim, textAlign: "center" }}>
          {minutesSpan < 60 ? `${minutesSpan}m` : `${Math.round(minutesSpan / 60)}h`}
        </div>
        <div style={{ textAlign: "center" }}><SeverityBadge level={severity} /></div>
        <div style={{ textAlign: "center", fontSize: 18, color: C.textGhost }}>{expanded ? "▾" : "▸"}</div>
      </div>
      {expanded && (
        <div style={{ padding: "8px 16px 14px", background: "rgba(249,115,22,0.03)" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.textGhost, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6 }}>Associated identities</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {(cluster.emails || []).map((email, i) => (
              <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 6, background: C.surfaceHover, border: `1px solid ${C.border}`, fontSize: 12, color: C.textDim }}>
                <span style={{ color: C.text }}>{(cluster.names || [])[i] || "—"}</span>
                <span style={{ color: C.textGhost }}>·</span>
                {email}
              </span>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <span style={{ fontSize: 11, color: C.textGhost }}>
              Lead IDs: {(cluster.lead_ids || []).slice(0, 10).join(", ")}{cluster.lead_ids?.length > 10 ? "…" : ""}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Rapid submission row ──
function RapidRow({ item }) {
  const secs = Math.abs(parseFloat(item.seconds_apart));
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "60px 1fr 1fr 80px 80px",
      alignItems: "center", padding: "8px 16px", borderBottom: `1px solid ${C.border}`,
      fontSize: 12,
    }}>
      <div style={{ fontWeight: 700, color: C.accent }}>#{item.lead_id}</div>
      <div>
        <span style={{ color: C.text }}>{item.first_name} {item.last_name}</span>
        <span style={{ color: C.textGhost, marginLeft: 6 }}>{item.email}</span>
      </div>
      <div style={{ color: C.textDim }}>
        ↔ #{item.related_lead_id} <span style={{ color: C.textGhost }}>{item.related_first_name} {item.related_last_name}</span>
      </div>
      <div style={{ textAlign: "center", fontFamily: "monospace", color: secs < 30 ? C.danger : C.warn }}>
        {secs < 60 ? `${Math.round(secs)}s` : `${(secs / 60).toFixed(1)}m`}
      </div>
      <div style={{ textAlign: "center" }}>
        <SeverityBadge level={secs < 30 ? "critical" : secs < 120 ? "high" : "medium"} />
      </div>
    </div>
  );
}

// ── Email domain row ──
function EmailDomainRow({ item }) {
  const DISPOSABLE = ["guerrillamail.com", "tempmail.com", "throwaway.email", "mailinator.com", "yopmail.com", "temp-mail.org", "fakeinbox.com", "sharklasers.com", "guerrillamailblock.com", "grr.la", "dispostable.com", "10minutemail.com"];
  const isDisposable = DISPOSABLE.includes(item.domain);
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "1fr 60px 1fr 80px",
      alignItems: "center", padding: "8px 16px", borderBottom: `1px solid ${C.border}`,
      fontSize: 12,
    }}>
      <div style={{ fontFamily: "monospace", color: isDisposable ? C.danger : C.text }}>{item.domain}</div>
      <div style={{ textAlign: "center", fontWeight: 700, color: C.text }}>{item.count}</div>
      <div style={{ color: C.textGhost, fontSize: 11 }}>
        {(item.names || []).slice(0, 3).join(", ")}{item.names?.length > 3 ? "…" : ""}
      </div>
      <div style={{ textAlign: "center" }}>
        {isDisposable ? <SeverityBadge level="critical" /> : parseInt(item.count) >= 5 ? <SeverityBadge level="high" /> : <SeverityBadge level="medium" />}
      </div>
    </div>
  );
}

// ── Phone reuse row ──
function PhoneRow({ item }) {
  const count = parseInt(item.use_count);
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "140px 60px 1fr 80px",
      alignItems: "center", padding: "8px 16px", borderBottom: `1px solid ${C.border}`,
      fontSize: 12,
    }}>
      <div style={{ fontFamily: "monospace", color: C.text }}>{item.phone}</div>
      <div style={{ textAlign: "center", fontWeight: 700, color: count >= 4 ? C.danger : C.accent }}>{count}×</div>
      <div style={{ color: C.textGhost, fontSize: 11 }}>
        {(item.names || []).slice(0, 4).join(", ")}
      </div>
      <div style={{ textAlign: "center" }}>
        <SeverityBadge level={count >= 4 ? "critical" : count >= 3 ? "high" : "medium"} />
      </div>
    </div>
  );
}

// ── Section wrapper ──
function Section({ title, subtitle, count, children, severity, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{
      background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10,
      overflow: "hidden", marginBottom: 16,
    }}>
      <div
        onClick={() => setOpen(!open)}
        style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "14px 20px", cursor: "pointer", borderBottom: open ? `1px solid ${C.border}` : "none",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{title}</span>
          {count > 0 && (
            <span style={{
              fontSize: 11, fontWeight: 700, padding: "1px 7px", borderRadius: 10,
              background: severity === "critical" ? C.dangerDim : severity === "high" ? C.accentDim : C.warnDim,
              color: severity === "critical" ? C.danger : severity === "high" ? C.accent : C.warn,
            }}>{count}</span>
          )}
          {subtitle && <span style={{ fontSize: 11, color: C.textGhost }}>{subtitle}</span>}
        </div>
        <span style={{ color: C.textGhost, fontSize: 16 }}>{open ? "▾" : "▸"}</span>
      </div>
      {open && children}
    </div>
  );
}

// ── Table header ──
function TableHeader({ columns }) {
  return (
    <div style={{
      display: "grid", gridTemplateColumns: columns.map(c => c.width || "1fr").join(" "),
      padding: "8px 16px", borderBottom: `1px solid ${C.border}`,
    }}>
      {columns.map((col, i) => (
        <div key={i} style={{
          fontSize: 9, fontWeight: 800, color: C.textGhost, textTransform: "uppercase",
          letterSpacing: ".1em", textAlign: col.align || "left",
        }}>{col.label}</div>
      ))}
    </div>
  );
}

// ── Risk score calculator ──
function calculateRiskScore(data) {
  if (!data) return { score: 0, level: "low" };
  let score = 0;
  
  const ipClusters = data.ipClusters?.length || 0;
  const rapidSubs = data.rapidSubmissions?.length || 0;
  const bigClusters = (data.ipClusters || []).filter(c => parseInt(c.lead_count) >= 5).length;
  const phoneReuse = data.phoneReuse?.length || 0;

  score += Math.min(ipClusters * 8, 30);
  score += Math.min(bigClusters * 15, 30);
  score += Math.min(rapidSubs * 5, 25);
  score += Math.min(phoneReuse * 4, 15);

  const level = score >= 70 ? "critical" : score >= 40 ? "high" : score >= 15 ? "medium" : "low";
  return { score: Math.min(score, 100), level };
}

// ── Risk score gauge ──
function RiskGauge({ score, level }) {
  const colorMap = { critical: C.danger, high: C.accent, medium: C.warn, low: C.success };
  const color = colorMap[level];
  return (
    <div style={{
      background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10,
      padding: "18px 24px", display: "flex", alignItems: "center", gap: 20, flex: "0 0 260px",
    }}>
      <div style={{ position: "relative", width: 72, height: 72 }}>
        <svg viewBox="0 0 72 72" style={{ transform: "rotate(-90deg)" }}>
          <circle cx="36" cy="36" r="30" fill="none" stroke={C.border} strokeWidth="6" />
          <circle cx="36" cy="36" r="30" fill="none" stroke={color} strokeWidth="6"
            strokeDasharray={`${(score / 100) * 188.5} 188.5`}
            strokeLinecap="round" style={{ transition: "stroke-dasharray 1s ease" }}
          />
        </svg>
        <div style={{
          position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 20, fontWeight: 900, color,
        }}>{score}</div>
      </div>
      <div>
        <div style={{ fontSize: 10, fontWeight: 700, color: C.textGhost, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 4 }}>Risk Score</div>
        <SeverityBadge level={level} />
        <div style={{ fontSize: 10, color: C.textDim, marginTop: 6 }}>Based on {level === "low" ? "normal" : "anomalous"} patterns</div>
      </div>
    </div>
  );
}

// ── Rejection breakdown ──
function RejectionBreakdown({ reasons }) {
  if (!reasons || reasons.length === 0) return <div style={{ padding: 16, color: C.textGhost, fontSize: 12, textAlign: "center" }}>No rejections in this period</div>;
  
  return (
    <div style={{ padding: "8px 0" }}>
      {reasons.map((r, i) => {
        let parsed = r.rejection_reason;
        try { parsed = JSON.parse(r.rejection_reason); } catch (e) {}
        const display = typeof parsed === "object" ? Object.entries(parsed).map(([k, v]) => `${k}: ${v}`).join(", ") : String(parsed);
        return (
          <div key={i} style={{
            display: "grid", gridTemplateColumns: "1fr 60px",
            padding: "7px 16px", borderBottom: `1px solid ${C.border}`,
            fontSize: 12,
          }}>
            <div style={{ color: C.textDim, fontFamily: "monospace", fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{display}</div>
            <div style={{ textAlign: "right", fontWeight: 700, color: C.accent }}>{r.count}</div>
          </div>
        );
      })}
    </div>
  );
}


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  MAIN COMPONENT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default function FraudDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [days, setDays] = useState(30);
  const [lastRefresh, setLastRefresh] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/fraud/summary?days=${days}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Unknown error");
      setData(json);
      setLastRefresh(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const risk = calculateRiskScore(data);
  const stats = data?.stats || {};
  const totalLeads = parseInt(stats.total_leads) || 0;
  const rejectedLeads = parseInt(stats.rejected_leads) || 0;
  const rejRate = totalLeads > 0 ? ((rejectedLeads / totalLeads) * 100).toFixed(1) : "0.0";
  const dupEmails = parseInt(stats.duplicate_emails) || 0;
  const dupPhones = parseInt(stats.duplicate_phones) || 0;

  return (
    <div style={{
      fontFamily: "'Inter', -apple-system, system-ui, sans-serif",
      background: C.bg, color: C.text, minHeight: "100vh",
      padding: "24px 28px",
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: C.text, margin: 0, display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 20 }}>🛡️</span>
            Fraud Detection
          </h1>
          <p style={{ fontSize: 12, color: C.textGhost, margin: "4px 0 0" }}>
            Phase 1 — Pattern analysis on existing lead data
            {lastRefresh && <span> · Last refresh: {lastRefresh.toLocaleTimeString()}</span>}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {[7, 14, 30, 90].map(d => (
            <button key={d} onClick={() => setDays(d)} style={{
              padding: "6px 14px", borderRadius: 6, border: `1px solid ${days === d ? C.accent : C.border}`,
              background: days === d ? C.accentDim : "transparent",
              color: days === d ? C.accent : C.textDim,
              fontSize: 12, fontWeight: 600, cursor: "pointer",
              transition: "all 0.15s",
            }}>{d}d</button>
          ))}
          <button onClick={fetchData} style={{
            padding: "6px 14px", borderRadius: 6, border: `1px solid ${C.border}`,
            background: "transparent", color: C.textDim, fontSize: 12, cursor: "pointer",
          }}>↻ Refresh</button>
        </div>
      </div>

      {error && (
        <div style={{
          padding: "12px 16px", borderRadius: 8, background: C.dangerDim,
          border: `1px solid rgba(239,68,68,0.3)`, color: C.danger,
          fontSize: 13, marginBottom: 16,
        }}>
          ⚠ Error loading fraud data: {error}
          <br /><span style={{ fontSize: 11, color: C.textDim }}>Make sure the fraud API endpoints are deployed to your backend.</span>
        </div>
      )}

      {loading && !data ? (
        <div style={{ textAlign: "center", padding: 60, color: C.textGhost }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>⏳</div>
          Loading fraud analytics...
        </div>
      ) : data && (
        <>
          {/* Top row: Risk gauge + stat cards */}
          <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
            <RiskGauge score={risk.score} level={risk.level} />
            <div style={{ display: "flex", gap: 12, flex: 1, flexWrap: "wrap" }}>
              <StatCard label="Total Leads" value={totalLeads} icon="📊" subtitle={`Last ${days} days`} />
              <StatCard label="Rejection Rate" value={`${rejRate}%`} icon="❌"
                color={parseFloat(rejRate) > 50 ? C.danger : parseFloat(rejRate) > 25 ? C.accent : C.text}
                subtitle={`${rejectedLeads} rejected`}
              />
              <StatCard label="IP Clusters" value={data.ipClusters?.length || 0} icon="🔗"
                color={(data.ipClusters?.length || 0) > 5 ? C.danger : C.text}
                subtitle="2+ leads per IP"
              />
              <StatCard label="Dup Contacts" value={dupEmails + dupPhones} icon="👥"
                color={(dupEmails + dupPhones) > 10 ? C.accent : C.text}
                subtitle={`${dupEmails} email · ${dupPhones} phone`}
              />
            </div>
          </div>

          {/* Hourly pattern */}
          <Section title="Submission Patterns" subtitle="Hourly distribution (red = 1am-5am anomaly window)" severity="info" defaultOpen={true}>
            <div style={{ padding: "16px 20px" }}>
              <HourlyChart data={data.hourlyPattern} />
              <div style={{ fontSize: 10, color: C.textGhost, marginTop: 8, textAlign: "center" }}>
                Hour of day (UTC) — Red bars indicate unusual overnight activity that may suggest bot traffic
              </div>
            </div>
          </Section>

          {/* IP Clusters */}
          <Section
            title="IP Address Clusters"
            subtitle="Multiple leads from same IP"
            count={data.ipClusters?.length || 0}
            severity={(data.ipClusters || []).some(c => parseInt(c.lead_count) >= 5) ? "critical" : "high"}
          >
            <TableHeader columns={[
              { label: "IP Address", width: "1fr" },
              { label: "Leads", width: "80px", align: "center" },
              { label: "Emails", width: "80px", align: "center" },
              { label: "Span", width: "60px", align: "center" },
              { label: "Severity", width: "100px", align: "center" },
              { label: "", width: "80px" },
            ]} />
            {(data.ipClusters || []).length === 0 ? (
              <div style={{ padding: 20, textAlign: "center", color: C.textGhost, fontSize: 12 }}>No IP clusters detected — looking good ✓</div>
            ) : (
              data.ipClusters.map((c, i) => <IPClusterRow key={i} cluster={c} />)
            )}
          </Section>

          {/* Rapid Submissions */}
          <Section
            title="Rapid Submissions"
            subtitle="Leads within 5 min of each other (same IP, email, or phone)"
            count={data.rapidSubmissions?.length || 0}
            severity={(data.rapidSubmissions || []).some(r => Math.abs(parseFloat(r.seconds_apart)) < 30) ? "critical" : "high"}
          >
            <TableHeader columns={[
              { label: "Lead", width: "60px" },
              { label: "Applicant", width: "1fr" },
              { label: "Related To", width: "1fr" },
              { label: "Gap", width: "80px", align: "center" },
              { label: "Severity", width: "80px", align: "center" },
            ]} />
            {(data.rapidSubmissions || []).length === 0 ? (
              <div style={{ padding: 20, textAlign: "center", color: C.textGhost, fontSize: 12 }}>No rapid submissions detected ✓</div>
            ) : (
              data.rapidSubmissions.map((r, i) => <RapidRow key={i} item={r} />)
            )}
          </Section>

          {/* Phone Reuse */}
          <Section
            title="Phone Number Reuse"
            subtitle="Same phone across multiple applications"
            count={data.phoneReuse?.length || 0}
            severity={(data.phoneReuse || []).some(p => parseInt(p.use_count) >= 4) ? "high" : "medium"}
            defaultOpen={false}
          >
            <TableHeader columns={[
              { label: "Phone", width: "140px" },
              { label: "Uses", width: "60px", align: "center" },
              { label: "Names", width: "1fr" },
              { label: "Severity", width: "80px", align: "center" },
            ]} />
            {(data.phoneReuse || []).length === 0 ? (
              <div style={{ padding: 20, textAlign: "center", color: C.textGhost, fontSize: 12 }}>No phone reuse detected ✓</div>
            ) : (
              data.phoneReuse.map((p, i) => <PhoneRow key={i} item={p} />)
            )}
          </Section>

          {/* Email Domain Concentration */}
          <Section
            title="Email Domain Concentration"
            subtitle="Domains with 3+ applications"
            count={data.suspiciousEmails?.length || 0}
            severity="medium"
            defaultOpen={false}
          >
            <TableHeader columns={[
              { label: "Domain", width: "1fr" },
              { label: "Count", width: "60px", align: "center" },
              { label: "Names", width: "1fr" },
              { label: "Severity", width: "80px", align: "center" },
            ]} />
            {(data.suspiciousEmails || []).length === 0 ? (
              <div style={{ padding: 20, textAlign: "center", color: C.textGhost, fontSize: 12 }}>No suspicious email patterns ✓</div>
            ) : (
              data.suspiciousEmails.map((e, i) => <EmailDomainRow key={i} item={e} />)
            )}
          </Section>

          {/* Rejection Reasons */}
          <Section
            title="Rejection Reasons"
            subtitle="Why FiestaCredito rejected leads"
            count={data.rejectionReasons?.length || 0}
            severity="info"
            defaultOpen={false}
          >
            <RejectionBreakdown reasons={data.rejectionReasons} />
          </Section>

          {/* Multi-IP leads */}
          {(data.nonStandardIps || []).length > 0 && (
            <Section
              title="Multi-IP Submissions"
              subtitle="Leads with comma-separated IPs (proxy/CDN detected)"
              count={data.nonStandardIps?.length || 0}
              severity="low"
              defaultOpen={false}
            >
              <div style={{ padding: "8px 0" }}>
                {data.nonStandardIps.map((l, i) => (
                  <div key={i} style={{
                    display: "grid", gridTemplateColumns: "60px 1fr 1fr 80px",
                    padding: "7px 16px", borderBottom: `1px solid ${C.border}`,
                    fontSize: 12,
                  }}>
                    <div style={{ fontWeight: 700, color: C.blue }}>#{l.id}</div>
                    <div style={{ color: C.text }}>{l.first_name} {l.last_name}</div>
                    <div style={{ fontFamily: "monospace", color: C.textDim, fontSize: 11, overflow: "hidden", textOverflow: "ellipsis" }}>{l.ip_address}</div>
                    <div style={{ textAlign: "center" }}><SeverityBadge level="low" /></div>
                  </div>
                ))}
              </div>
            </Section>
          )}
        </>
      )}
    </div>
  );
}
