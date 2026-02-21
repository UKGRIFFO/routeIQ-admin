"use client";
import { useState, useEffect, useRef } from "react";

const API_BASE = "https://loan-broker-backend-production.up.railway.app";

const C = {
  bg:"#06090D",surface:"#111821",surfaceHover:"#161E28",border:"#1A2332",borderLight:"#243044",
  text:"#E2E8F0",textDim:"#475569",textGhost:"#334155",textSoft:"#94A3B8",
  accent:"#f97316",accentDim:"rgba(249,115,22,0.12)",
  danger:"#ef4444",dangerDim:"rgba(239,68,68,0.12)",
  success:"#22c55e",successDim:"rgba(34,197,94,0.12)",
  warn:"#eab308",warnDim:"rgba(234,179,8,0.12)",
  blue:"#3b82f6",blueDim:"rgba(59,130,246,0.12)",
  purple:"#a855f7",purpleDim:"rgba(168,85,247,0.12)",
};

const DEFAULT_WHITELIST = ["73.138.132.140","72.14.201.235"];

// ── Shared UI ──

function SeverityBadge({level}){
  const m={critical:{bg:C.dangerDim,c:C.danger,b:"rgba(239,68,68,0.3)",l:"CRITICAL"},high:{bg:C.accentDim,c:C.accent,b:"rgba(249,115,22,0.3)",l:"HIGH"},medium:{bg:C.warnDim,c:C.warn,b:"rgba(234,179,8,0.3)",l:"MEDIUM"},low:{bg:C.blueDim,c:C.blue,b:"rgba(59,130,246,0.3)",l:"LOW"},info:{bg:C.purpleDim,c:C.purple,b:"rgba(168,85,247,0.3)",l:"INFO"}};
  const s=m[level]||m.low;
  return <span style={{display:"inline-flex",alignItems:"center",gap:4,padding:"2px 8px",borderRadius:4,fontSize:10,fontWeight:700,letterSpacing:".08em",background:s.bg,color:s.c,border:`1px solid ${s.b}`}}><span style={{width:5,height:5,borderRadius:"50%",background:s.c}}/>{s.l}</span>;
}

function StatCard({label,value,subtitle,color=C.text,icon}){
  return <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:14,padding:"18px 20px",flex:1,minWidth:160}}>
    <div style={{fontSize:10,fontWeight:700,color:C.textGhost,textTransform:"uppercase",letterSpacing:".08em",marginBottom:8,display:"flex",alignItems:"center",gap:6}}>{icon&&<span style={{fontSize:13}}>{icon}</span>}{label}</div>
    <div style={{fontSize:28,fontWeight:800,color,lineHeight:1,fontVariantNumeric:"tabular-nums"}}>{value}</div>
    {subtitle&&<div style={{fontSize:11,color:C.textDim,marginTop:6}}>{subtitle}</div>}
  </div>;
}

function Section({title,subtitle,count,children,severity,defaultOpen=true}){
  const[open,setOpen]=useState(defaultOpen);
  return <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:14,overflow:"hidden",marginBottom:16}}>
    <div onClick={()=>setOpen(!open)} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 20px",cursor:"pointer",borderBottom:open?`1px solid ${C.border}`:"none"}}>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <span style={{fontSize:14,fontWeight:700,color:C.text}}>{title}</span>
        {count>0&&<span style={{fontSize:11,fontWeight:700,padding:"1px 7px",borderRadius:10,background:severity==="critical"?C.dangerDim:severity==="high"?C.accentDim:C.warnDim,color:severity==="critical"?C.danger:severity==="high"?C.accent:C.warn}}>{count}</span>}
        {subtitle&&<span style={{fontSize:11,color:C.textGhost}}>{subtitle}</span>}
      </div>
      <span style={{color:C.textGhost,fontSize:16}}>{open?"▾":"▸"}</span>
    </div>
    {open&&children}
  </div>;
}

function TH({columns}){
  return <div style={{display:"grid",gridTemplateColumns:columns.map(c=>c.w||"1fr").join(" "),padding:"8px 16px",borderBottom:`1px solid ${C.border}`}}>
    {columns.map((col,i)=><div key={i} style={{fontSize:9,fontWeight:800,color:C.textGhost,textTransform:"uppercase",letterSpacing:".1em",textAlign:col.a||"left"}}>{col.l}</div>)}
  </div>;
}

function RiskGauge({score,level}){
  const cm={critical:C.danger,high:C.accent,medium:C.warn,low:C.success};const color=cm[level];
  return <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:14,padding:"18px 24px",display:"flex",alignItems:"center",gap:20,flex:"0 0 260px"}}>
    <div style={{position:"relative",width:72,height:72}}>
      <svg viewBox="0 0 72 72" style={{transform:"rotate(-90deg)"}}><circle cx="36" cy="36" r="30" fill="none" stroke={C.border} strokeWidth="6"/><circle cx="36" cy="36" r="30" fill="none" stroke={color} strokeWidth="6" strokeDasharray={`${(score/100)*188.5} 188.5`} strokeLinecap="round" style={{transition:"stroke-dasharray 1s ease"}}/></svg>
      <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,fontWeight:900,color}}>{score}</div>
    </div>
    <div>
      <div style={{fontSize:10,fontWeight:700,color:C.textGhost,textTransform:"uppercase",letterSpacing:".08em",marginBottom:4}}>Risk Score</div>
      <SeverityBadge level={level}/>
      <div style={{fontSize:10,color:C.textDim,marginTop:6}}>Based on {level==="low"?"normal":"anomalous"} patterns</div>
    </div>
  </div>;
}

// ── Charts ──

function HourlyChart({data}){
  if(!data||data.length===0)return null;
  const max=Math.max(...data.map(d=>parseInt(d.lead_count)||0),1);
  const hours=Array.from({length:24},(_,i)=>{const f=data.find(d=>parseInt(d.hour)===i);return{hour:i,count:f?parseInt(f.lead_count):0,ips:f?parseInt(f.unique_ips):0};});
  // CET = UTC+1: Spanish 2am-6am = UTC hours 1-5
  return <div style={{display:"flex",alignItems:"flex-end",gap:2,height:80,padding:"0 2px"}}>
    {hours.map(h=>{const ht=Math.max((h.count/max)*70,1);const anom=h.count>0&&h.hour>=1&&h.hour<=5;return <div key={h.hour} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2}} title={`${h.hour}:00 UTC (${(h.hour+1)%24}:00 CET) — ${h.count} leads, ${h.ips} IPs`}><div style={{width:"100%",maxWidth:18,height:ht,borderRadius:3,background:anom&&h.count>0?C.danger:h.count>0?C.accent:C.border,opacity:h.count>0?1:0.3,transition:"height 0.3s"}}/><span style={{fontSize:7,color:C.textGhost}}>{(h.hour+1)%24}</span></div>;})}
  </div>;
}

function SpeedDistChart({dist}){
  if(!dist||!dist.total_sessions)return null;
  const total=parseInt(dist.total_sessions)||1;
  const bars=[
    {label:"<30s",count:parseInt(dist.critical_count)||0,color:C.danger},
    {label:"30-60s",count:parseInt(dist.high_count)||0,color:C.accent},
    {label:"1-2m",count:parseInt(dist.amber_count)||0,color:C.warn},
    {label:"2m+",count:parseInt(dist.normal_count)||0,color:C.success},
  ];
  const maxC=Math.max(...bars.map(b=>b.count),1);
  return <div style={{display:"flex",gap:12,alignItems:"flex-end",height:60,padding:"0 20px"}}>
    {bars.map((b,i)=><div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
      <div style={{fontSize:10,fontWeight:700,color:b.color}}>{b.count}</div>
      <div style={{width:"100%",maxWidth:60,height:Math.max((b.count/maxC)*40,2),borderRadius:4,background:b.color,opacity:b.count>0?1:0.2,transition:"height 0.3s"}}/>
      <div style={{fontSize:9,color:C.textGhost}}>{b.label}</div>
    </div>)}
    <div style={{marginLeft:16,fontSize:11,color:C.textDim,textAlign:"right",minWidth:100}}>
      <div>Avg: {dist.avg_seconds}s</div>
      <div>Min: {dist.min_seconds}s</div>
      <div>Total: {total} sessions</div>
    </div>
  </div>;
}

// ── Row components ──

function IPClusterRow({cluster}){
  const[exp,setExp]=useState(false);const cnt=parseInt(cluster.lead_count);
  const sev=cnt>=5?"critical":cnt>=3?"high":"medium";
  const span=Math.round((new Date(cluster.last_seen)-new Date(cluster.first_seen))/60000);
  return <div style={{borderBottom:`1px solid ${C.border}`}}>
    <div onClick={()=>setExp(!exp)} style={{display:"grid",gridTemplateColumns:"1fr 80px 80px 60px 100px 40px",alignItems:"center",padding:"10px 16px",cursor:"pointer",background:exp?C.surfaceHover:"transparent"}} onMouseEnter={e=>{if(!exp)e.currentTarget.style.background=C.surfaceHover}} onMouseLeave={e=>{if(!exp)e.currentTarget.style.background="transparent"}}>
      <div style={{fontFamily:"monospace",fontSize:13,color:C.text}}>{cluster.ip_address}</div>
      <div style={{fontSize:13,color:C.text,textAlign:"center",fontWeight:700}}>{cnt}</div>
      <div style={{fontSize:13,color:C.textDim,textAlign:"center"}}>{cluster.unique_emails}</div>
      <div style={{fontSize:11,color:C.textDim,textAlign:"center"}}>{span<60?`${span}m`:`${Math.round(span/60)}h`}</div>
      <div style={{textAlign:"center"}}><SeverityBadge level={sev}/></div>
      <div style={{textAlign:"center",fontSize:14,color:C.textGhost}}>{exp?"▾":"▸"}</div>
    </div>
    {exp&&<div style={{padding:"8px 16px 14px",background:"rgba(249,115,22,0.03)"}}>
      <div style={{fontSize:10,fontWeight:700,color:C.textGhost,textTransform:"uppercase",letterSpacing:".06em",marginBottom:6}}>Associated identities</div>
      <div style={{display:"flex",flexWrap:"wrap",gap:6}}>{(cluster.emails||[]).map((email,i)=><span key={i} style={{display:"inline-flex",alignItems:"center",gap:6,padding:"4px 10px",borderRadius:6,background:C.surfaceHover,border:`1px solid ${C.border}`,fontSize:12,color:C.textDim}}><span style={{color:C.text}}>{(cluster.names||[])[i]||"—"}</span><span style={{color:C.textGhost}}>·</span>{email}</span>)}</div>
      <div style={{marginTop:10,fontSize:11,color:C.textGhost}}>Lead IDs: {(cluster.lead_ids||[]).slice(0,10).join(", ")}{cluster.lead_ids?.length>10?"…":""}</div>
    </div>}
  </div>;
}

function RapidRow({item}){
  const secs=Math.abs(parseFloat(item.seconds_apart));
  return <div style={{display:"grid",gridTemplateColumns:"60px 1fr 1fr 80px 80px",alignItems:"center",padding:"8px 16px",borderBottom:`1px solid ${C.border}`,fontSize:12}}>
    <div style={{fontWeight:700,color:C.accent}}>#{item.lead_id}</div>
    <div><span style={{color:C.text}}>{item.first_name} {item.last_name}</span><span style={{color:C.textGhost,marginLeft:6}}>{item.email}</span></div>
    <div style={{color:C.textDim}}>↔ #{item.related_lead_id} <span style={{color:C.textGhost}}>{item.related_first_name} {item.related_last_name}</span></div>
    <div style={{textAlign:"center",fontFamily:"monospace",color:secs<30?C.danger:C.warn}}>{secs<60?`${Math.round(secs)}s`:`${(secs/60).toFixed(1)}m`}</div>
    <div style={{textAlign:"center"}}><SeverityBadge level={secs<30?"critical":secs<120?"high":"medium"}/></div>
  </div>;
}

function EmailDomainRow({item}){
  const DISP=["guerrillamail.com","tempmail.com","throwaway.email","mailinator.com","yopmail.com","temp-mail.org","fakeinbox.com","sharklasers.com","10minutemail.com"];
  const isD=DISP.includes(item.domain);const cnt=parseInt(item.count);
  return <div style={{display:"grid",gridTemplateColumns:"1fr 60px 1fr 80px",alignItems:"center",padding:"8px 16px",borderBottom:`1px solid ${C.border}`,fontSize:12}}>
    <div style={{fontFamily:"monospace",color:isD?C.danger:C.text}}>{item.domain}</div>
    <div style={{textAlign:"center",fontWeight:700,color:C.text}}>{item.count}</div>
    <div style={{color:C.textGhost,fontSize:11}}>{(item.names||[]).slice(0,3).join(", ")}{item.names?.length>3?"…":""}</div>
    <div style={{textAlign:"center"}}>{isD?<SeverityBadge level="critical"/>:cnt>=5?<SeverityBadge level="high"/>:<SeverityBadge level="medium"/>}</div>
  </div>;
}

function PhoneRow({item}){
  const cnt=parseInt(item.use_count);
  return <div style={{display:"grid",gridTemplateColumns:"140px 60px 1fr 80px",alignItems:"center",padding:"8px 16px",borderBottom:`1px solid ${C.border}`,fontSize:12}}>
    <div style={{fontFamily:"monospace",color:C.text}}>{item.phone}</div>
    <div style={{textAlign:"center",fontWeight:700,color:cnt>=4?C.danger:C.accent}}>{cnt}×</div>
    <div style={{color:C.textGhost,fontSize:11}}>{(item.names||[]).slice(0,4).join(", ")}</div>
    <div style={{textAlign:"center"}}><SeverityBadge level={cnt>=4?"critical":cnt>=3?"high":"medium"}/></div>
  </div>;
}

function MultiIPRow({lead}){
  return <div style={{display:"grid",gridTemplateColumns:"60px 1fr 1fr 80px",alignItems:"center",padding:"8px 16px",borderBottom:`1px solid ${C.border}`,fontSize:12}}>
    <div style={{fontWeight:700,color:C.accent}}>#{lead.id}</div>
    <div><span style={{color:C.text}}>{lead.first_name} {lead.last_name}</span><span style={{color:C.textGhost,marginLeft:6}}>{lead.email}</span></div>
    <div style={{fontFamily:"monospace",fontSize:11,color:C.textDim}}>{lead.ip_address}</div>
    <div style={{textAlign:"center"}}><SeverityBadge level="low"/></div>
  </div>;
}

function SpeedRow({item}){
  const secs=parseFloat(item.completion_seconds)||0;
  const sev=secs<30?"critical":secs<60?"high":"medium";
  const name=[item.first_name,item.last_name].filter(Boolean).join(" ");
  const hasIdentity=name||item.email;
  return <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 100px 100px",alignItems:"center",padding:"8px 16px",borderBottom:`1px solid ${C.border}`,fontSize:12}}>
    <div style={{color:hasIdentity?C.text:C.textGhost,fontWeight:600}}>{name||item.ip_address||"Unknown"}</div>
    <div style={{color:hasIdentity?C.textDim:C.textGhost}}>{item.email||(hasIdentity?"—":"No lead submitted")}</div>
    <div style={{fontFamily:"monospace",fontWeight:700,color:sev==="critical"?C.danger:sev==="high"?C.accent:C.warn,textAlign:"center"}}>{secs<60?`${Math.round(secs)}s`:`${(secs/60).toFixed(1)}m`}</div>
    <div style={{textAlign:"center"}}><SeverityBadge level={sev}/></div>
  </div>;
}

function PasteRow({item}){
  const cnt=parseInt(item.paste_count)||0;
  const sev=cnt>=6?"critical":cnt>=4?"high":"medium";
  return <div style={{display:"grid",gridTemplateColumns:"120px 60px 1fr 100px",alignItems:"center",padding:"8px 16px",borderBottom:`1px solid ${C.border}`,fontSize:12}}>
    <div style={{fontFamily:"monospace",color:C.textDim,fontSize:11}}>{item.session_id?.substring(0,16)}…</div>
    <div style={{textAlign:"center",fontWeight:700,color:sev==="critical"?C.danger:sev==="high"?C.accent:C.warn}}>{cnt}×</div>
    <div style={{color:C.textGhost,fontSize:11}}>{(item.pasted_fields||[]).join(", ")}</div>
    <div style={{textAlign:"center"}}><SeverityBadge level={sev}/></div>
  </div>;
}

function RejectionBreakdown({reasons}){
  if(!reasons||reasons.length===0)return <div style={{padding:16,color:C.textGhost,fontSize:12,textAlign:"center"}}>No rejections in this period</div>;
  return <div style={{padding:"8px 0"}}>{reasons.map((r,i)=>{
    let p=r.rejection_reason;try{p=JSON.parse(r.rejection_reason)}catch(e){}
    const d=typeof p==="object"?Object.entries(p).map(([k,v])=>`${k}: ${v}`).join(", "):String(p);
    return <div key={i} style={{display:"grid",gridTemplateColumns:"1fr 60px",padding:"7px 16px",borderBottom:`1px solid ${C.border}`,fontSize:12}}>
      <div style={{color:C.textDim,fontFamily:"monospace",fontSize:11,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{d}</div>
      <div style={{textAlign:"right",fontWeight:700,color:C.accent}}>{r.count}</div>
    </div>;
  })}</div>;
}

// ── Risk calculator ──

function calcRisk(data){
  if(!data)return{score:0,level:"low"};let s=0;
  s+=Math.min((data.ipClusters?.length||0)*8,30);
  s+=Math.min((data.ipClusters||[]).filter(c=>parseInt(c.lead_count)>=5).length*15,30);
  s+=Math.min((data.rapidSubmissions?.length||0)*5,25);
  s+=Math.min((data.phoneReuse?.length||0)*4,15);
  s=Math.min(s,100);
  return{score:s,level:s>=70?"critical":s>=40?"high":s>=15?"medium":"low"};
}

// ── IP whitelist filtering ──

function filterWhitelist(data, whitelist){
  if(!data||!whitelist||whitelist.length===0)return data;
  const wl=new Set(whitelist.map(ip=>ip.trim()));
  return{
    ...data,
    ipClusters:(data.ipClusters||[]).filter(c=>!wl.has(c.ip_address)),
    rapidSubmissions:(data.rapidSubmissions||[]).filter(r=>!wl.has(r.ip_address)),
    nonStandardIps:(data.nonStandardIps||[]).filter(l=>!wl.has(l.ip_address)),
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  MAIN COMPONENT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default function FraudDashboard({dateRange, onDateChange}){
  const[rawData,setRawData]=useState(null);
  const[loading,setLoading]=useState(true);
  const[error,setError]=useState(null);
  const[days,setDays]=useState(30);
  const[lastRefresh,setLastRefresh]=useState(null);
  const[whitelistOn,setWhitelistOn]=useState(true);
  const[whitelistIPs,setWhitelistIPs]=useState(DEFAULT_WHITELIST);
  const[showWLPanel,setShowWLPanel]=useState(false);
  const[newIP,setNewIP]=useState("");
  const fetchRef=useRef(0);

  const data=whitelistOn?filterWhitelist(rawData,whitelistIPs):rawData;

  async function fetchData(daysOverride){
    const fid=++fetchRef.current;setLoading(true);setError(null);
    try{
      const d=daysOverride!==undefined?daysOverride:days;
      let url;
      if(!daysOverride&&dateRange?.from&&dateRange?.to){
        const from=typeof dateRange.from==="string"?dateRange.from:dateRange.from.toISOString();
        const to=typeof dateRange.to==="string"?dateRange.to:dateRange.to.toISOString();
        url=`${API_BASE}/api/fraud/summary?from=${from}&to=${to}`;
      }else{
        url=`${API_BASE}/api/fraud/summary?days=${d}`;
      }
      const res=await fetch(url);if(!res.ok)throw new Error(`HTTP ${res.status}`);
      const json=await res.json();if(!json.success)throw new Error(json.error||"Unknown error");
      if(fid===fetchRef.current){setRawData(json);setLastRefresh(new Date());}
    }catch(err){if(fid===fetchRef.current)setError(err.message);}
    finally{if(fid===fetchRef.current)setLoading(false);}
  }

  useEffect(()=>{fetchData();},[]);
  useEffect(()=>{if(dateRange?.from&&dateRange?.to)fetchData();},[dateRange?.from,dateRange?.to]);

  // Wire quick-pick buttons to main dateRange
  function handleDays(d){
    setDays(d);
    if(onDateChange){
      const now=new Date();const from=new Date(now);from.setDate(from.getDate()-d);
      onDateChange({preset:`${d}d`,from,to:now,label:`Last ${d} days`,days:d});
    }else{
      fetchData(d);
    }
  }

  const risk=calcRisk(data);
  const stats=data?.stats||{};
  const totalLeads=parseInt(stats.total_leads)||0;
  const rejLeads=parseInt(stats.rejected_leads)||0;
  const rejRate=totalLeads>0?((rejLeads/totalLeads)*100).toFixed(1):"0.0";
  const dupE=parseInt(stats.duplicate_emails)||0;
  const dupP=parseInt(stats.duplicate_phones)||0;
  const rangeText=dateRange?.label||`Last ${days} days`;

  // Speed data
  const speedAnalysis=data?.speedAnalysis||[];
  const speedDist=data?.speedDistribution||{};
  const fastCount=(parseInt(speedDist.critical_count)||0)+(parseInt(speedDist.high_count)||0);
  // Paste data
  const pasteAnalysis=data?.pasteAnalysis||[];

  const btnStyle=(active)=>({padding:"6px 14px",borderRadius:6,border:`1px solid ${active?C.accent:C.border}`,background:active?C.accentDim:"transparent",color:active?C.accent:C.textDim,fontSize:12,fontWeight:600,cursor:"pointer",transition:"all 0.15s"});

  return <div style={{display:"flex",flexDirection:"column",gap:20}}>

    {/* ── Header ── */}
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:12}}>
      <div>
        <h2 style={{fontSize:22,fontWeight:800,color:C.text,margin:0,display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:20}}>🛡️</span> Fraud Detection
        </h2>
        <p style={{fontSize:12,color:C.textGhost,margin:"4px 0 0"}}>
          Phase 1 — Pattern analysis on existing lead data
          {lastRefresh&&<span> · Last refresh: {lastRefresh.toLocaleTimeString()}</span>}
        </p>
      </div>
      <div style={{display:"flex",gap:8,alignItems:"center"}}>
        {[7,14,30,90].map(d=><button key={d} onClick={()=>handleDays(d)} style={btnStyle(days===d&&dateRange?.preset===`${d}d`)}>{d}d</button>)}
        <button onClick={()=>fetchData()} style={{...btnStyle(false),padding:"6px 10px"}} title="Refresh">↻</button>
        <div style={{width:1,height:24,background:C.border,margin:"0 4px"}}/>
        <button onClick={()=>setWhitelistOn(!whitelistOn)} style={{...btnStyle(whitelistOn),fontSize:11}} title="Filter out whitelisted IPs">
          {whitelistOn?"🔒 Whitelist ON":"🔓 Whitelist OFF"}
        </button>
        <button onClick={()=>setShowWLPanel(!showWLPanel)} style={{...btnStyle(false),padding:"6px 8px",fontSize:11}} title="Configure IP whitelist">⚙</button>
      </div>
    </div>

    {/* ── Whitelist config panel ── */}
    {showWLPanel&&<div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:16}}>
      <div style={{fontSize:12,fontWeight:700,color:C.text,marginBottom:8}}>IP Whitelist — Excluded from fraud analysis</div>
      <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:10}}>
        {whitelistIPs.map((ip,i)=><span key={i} style={{display:"inline-flex",alignItems:"center",gap:6,padding:"4px 10px",borderRadius:6,background:C.surfaceHover,border:`1px solid ${C.border}`,fontSize:12,color:C.text,fontFamily:"monospace"}}>
          {ip}
          <span onClick={()=>setWhitelistIPs(whitelistIPs.filter((_,j)=>j!==i))} style={{cursor:"pointer",color:C.danger,fontSize:14,lineHeight:1}}>×</span>
        </span>)}
      </div>
      <div style={{display:"flex",gap:8}}>
        <input value={newIP} onChange={e=>setNewIP(e.target.value)} placeholder="Add IP address..." onKeyDown={e=>{if(e.key==="Enter"&&newIP.trim()){setWhitelistIPs([...whitelistIPs,newIP.trim()]);setNewIP("");}}}
          style={{flex:1,padding:"6px 10px",borderRadius:6,border:`1px solid ${C.border}`,background:C.bg,color:C.text,fontSize:12,fontFamily:"monospace",outline:"none"}}/>
        <button onClick={()=>{if(newIP.trim()){setWhitelistIPs([...whitelistIPs,newIP.trim()]);setNewIP("");}}} style={btnStyle(false)}>Add</button>
      </div>
    </div>}

    {error&&<div style={{padding:"12px 16px",borderRadius:8,background:C.dangerDim,border:"1px solid rgba(239,68,68,0.3)",color:C.danger,fontSize:13}}>
      ⚠ Error loading fraud data: {error}<br/><span style={{fontSize:11,color:C.textDim}}>Make sure the fraud API endpoints are deployed.</span>
    </div>}

    {loading&&!rawData?<div style={{textAlign:"center",padding:60,color:C.textGhost}}><div style={{fontSize:24,marginBottom:8}}>⏳</div>Loading fraud analytics...</div>
    :data&&<>

      {/* ── Top row: Risk + Stats ── */}
      <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
        <RiskGauge score={risk.score} level={risk.level}/>
        <div style={{display:"flex",gap:12,flex:1,flexWrap:"wrap"}}>
          <StatCard label="Total Leads" value={totalLeads} icon="📊" subtitle={rangeText}/>
          <StatCard label="Rejection Rate" value={`${rejRate}%`} icon="❌" color={parseFloat(rejRate)>50?C.danger:parseFloat(rejRate)>25?C.accent:C.text} subtitle={`${rejLeads} rejected`}/>
          <StatCard label="IP Clusters" value={data.ipClusters?.length||0} icon="🔗" color={(data.ipClusters?.length||0)>5?C.danger:C.text} subtitle="2+ leads per IP"/>
          <StatCard label="Dup Contacts" value={dupE+dupP} icon="👥" color={(dupE+dupP)>10?C.accent:C.text} subtitle={`${dupE} email · ${dupP} phone`}/>
        </div>
      </div>

      {/* 1. Submission Patterns */}
      <Section title="Submission Patterns" subtitle="Hourly distribution (red = 2am-6am Spanish time)" severity="info" defaultOpen={true}>
        <div style={{padding:"16px 20px"}}>
          <HourlyChart data={data.hourlyPattern}/>
          <div style={{fontSize:10,color:C.textGhost,marginTop:8,textAlign:"center"}}>Hour of day (CET / Spanish time) — Red bars indicate unusual overnight activity that may suggest bot traffic</div>
        </div>
      </Section>

      {/* 2. IP Clusters */}
      <Section title="IP Address Clusters" subtitle={whitelistOn?"Multiple leads from same IP (whitelist applied)":"Multiple leads from same IP"} count={data.ipClusters?.length||0} severity={(data.ipClusters||[]).some(c=>parseInt(c.lead_count)>=5)?"critical":"high"}>
        <TH columns={[{l:"IP Address",w:"1fr"},{l:"Leads",w:"80px",a:"center"},{l:"Emails",w:"80px",a:"center"},{l:"Span",w:"60px",a:"center"},{l:"Severity",w:"100px",a:"center"},{l:"",w:"40px"}]}/>
        {(data.ipClusters||[]).length===0
          ?<div style={{padding:20,textAlign:"center",color:C.textGhost,fontSize:12}}>No IP clusters detected — looking good ✓</div>
          :data.ipClusters.map((c,i)=><IPClusterRow key={i} cluster={c}/>)}
      </Section>

      {/* 3. Rapid Submissions */}
      <Section title="Rapid Submissions" subtitle="Leads within 5 min of each other (same IP, email, or phone)" count={data.rapidSubmissions?.length||0} severity={(data.rapidSubmissions||[]).some(r=>Math.abs(parseFloat(r.seconds_apart))<30)?"critical":"high"}>
        <TH columns={[{l:"Lead",w:"60px"},{l:"Applicant",w:"1fr"},{l:"Related To",w:"1fr"},{l:"Gap",w:"80px",a:"center"},{l:"Severity",w:"80px",a:"center"}]}/>
        {(data.rapidSubmissions||[]).length===0
          ?<div style={{padding:20,textAlign:"center",color:C.textGhost,fontSize:12}}>No rapid submissions detected ✓</div>
          :data.rapidSubmissions.map((r,i)=><RapidRow key={i} item={r}/>)}
      </Section>

      {/* 4. Speed Analysis */}
      <Section title="Speed Analysis" subtitle="Suspiciously fast form completions" count={fastCount} severity={fastCount>0?(parseInt(speedDist.critical_count)||0)>0?"critical":"high":"info"}>
        <div style={{padding:"16px 20px"}}>
          <SpeedDistChart dist={speedDist}/>
          <div style={{fontSize:10,color:C.textGhost,marginTop:8,textAlign:"center"}}>Red: under 30s (bot) · Orange: 30-60s · Amber: 1-2min · Green: normal (2min+)</div>
        </div>
        {speedAnalysis.length>0&&<>
          <div style={{padding:"6px 16px",fontSize:11,color:C.textDim,borderBottom:`1px solid ${C.border}`}}>Top {speedAnalysis.length} fastest of {fastCount} suspicious sessions</div>
          <TH columns={[{l:"Name / IP",w:"1fr"},{l:"Email",w:"1fr"},{l:"Time",w:"100px",a:"center"},{l:"Severity",w:"100px",a:"center"}]}/>
          {speedAnalysis.map((s,i)=><SpeedRow key={i} item={s}/>)}
        </>}
        {speedAnalysis.length===0&&<div style={{padding:20,textAlign:"center",color:C.textGhost,fontSize:12}}>No suspiciously fast completions detected ✓</div>}
      </Section>

      {/* 5. Behavioral Signals: Paste Detection */}
      <Section title="Behavioral Signals — Paste Detection" subtitle="Sessions with high paste activity (3+ fields)" count={pasteAnalysis.length} severity={pasteAnalysis.some(p=>parseInt(p.paste_count)>=6)?"high":"medium"} defaultOpen={pasteAnalysis.length>0}>
        {pasteAnalysis.length>0?<>
          <TH columns={[{l:"Session",w:"120px"},{l:"Pastes",w:"60px",a:"center"},{l:"Fields",w:"1fr"},{l:"Severity",w:"100px",a:"center"}]}/>
          {pasteAnalysis.map((p,i)=><PasteRow key={i} item={p}/>)}
        </>:<div style={{padding:20,textAlign:"center",color:C.textGhost,fontSize:12}}>
          No high-paste sessions detected yet — paste tracking is active and will populate as data arrives.
        </div>}
      </Section>

      {/* 6. Phone Reuse */}
      <Section title="Phone Number Reuse" subtitle="Same phone across multiple applications" count={data.phoneReuse?.length||0} severity={(data.phoneReuse||[]).some(p=>parseInt(p.use_count)>=4)?"high":"medium"} defaultOpen={false}>
        <TH columns={[{l:"Phone",w:"140px"},{l:"Uses",w:"60px",a:"center"},{l:"Names",w:"1fr"},{l:"Severity",w:"80px",a:"center"}]}/>
        {(data.phoneReuse||[]).length===0
          ?<div style={{padding:20,textAlign:"center",color:C.textGhost,fontSize:12}}>No phone reuse detected ✓</div>
          :data.phoneReuse.map((p,i)=><PhoneRow key={i} item={p}/>)}
      </Section>

      {/* 7. Email Domain Concentration */}
      <Section title="Email Domain Concentration" subtitle="Domains with 3+ applications" count={data.suspiciousEmails?.length||0} severity="medium" defaultOpen={false}>
        <TH columns={[{l:"Domain",w:"1fr"},{l:"Count",w:"60px",a:"center"},{l:"Names",w:"1fr"},{l:"Severity",w:"80px",a:"center"}]}/>
        {(data.suspiciousEmails||[]).length===0
          ?<div style={{padding:20,textAlign:"center",color:C.textGhost,fontSize:12}}>No suspicious email patterns ✓</div>
          :data.suspiciousEmails.map((e,i)=><EmailDomainRow key={i} item={e}/>)}
      </Section>

      {/* 8. Multi-IP Submissions */}
      {(data.nonStandardIps||[]).length>0&&<Section title="Multi-IP Submissions" subtitle="Leads with comma-separated IPs (proxy/CDN detected)" count={data.nonStandardIps?.length||0} severity="low" defaultOpen={false}>
        <TH columns={[{l:"Lead",w:"60px"},{l:"Applicant",w:"1fr"},{l:"IP Address",w:"1fr"},{l:"Severity",w:"80px",a:"center"}]}/>
        {data.nonStandardIps.map((l,i)=><MultiIPRow key={i} lead={l}/>)}
      </Section>}

      {/* 9. Rejection Reasons (always last) */}
      <Section title="Rejection Reasons" subtitle="Why FiestaCredito rejected leads" count={data.rejectionReasons?.length||0} severity="info" defaultOpen={false}>
        <RejectionBreakdown reasons={data.rejectionReasons}/>
      </Section>

    </>}
  </div>;
}
