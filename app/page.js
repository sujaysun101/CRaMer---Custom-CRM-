'use client';
import {useEffect,useMemo,useState} from 'react';
const STAGES=['Lead','Contacted','Replied','Meeting','Negotiation','Won','Lost'];
const QORDER={Open:1,Drafted:2,Blocked:3,Waiting:4,Unknown:5,Closed:9};
const K='crm_overrides_v1';
const btn={padding:'6px 12px',border:'1px solid #ccc',background:'#fff',borderRadius:6,cursor:'pointer'};
export default function Home(){
  const[d,setD]=useState(null);const[tab,setTab]=useState('pipeline');const[sel,setSel]=useState(null);const[q,setQ]=useState('');
  const[ov,setOv]=useState({stage:{},dnc:{},qstatus:{}});
  useEffect(()=>{fetch('/api/data').then(r=>r.json()).then(setD);try{const o=JSON.parse(localStorage.getItem(K));if(o)setOv(o)}catch{}},[]);
  const save=o=>{setOv(o);localStorage.setItem(K,JSON.stringify(o))};
  const cmap=useMemo(()=>d?Object.fromEntries(d.contacts.map(c=>[c.id,{...c,dnc:ov.dnc[c.id]??c.dnc}])):{},[d,ov]);
  if(!d) return <p style={{padding:20}}>Loading…</p>;
  const match=c=>!q||JSON.stringify(c).toLowerCase().includes(q.toLowerCase());
  const deals=d.deals.map(x=>({...x,stage:ov.stage[x.id]||x.stage})).filter(x=>match(cmap[x.contact_id]));
  const queue=d.queue.map(i=>({...i,status:ov.qstatus[i.id]||i.status})).filter(i=>!cmap[i.contact_id].dnc&&match(cmap[i.contact_id]))
    .sort((a,b)=>(QORDER[a.status]-QORDER[b.status])||String(a.source_timestamp).localeCompare(String(b.source_timestamp)));
  const contacts=Object.values(cmap).filter(match);
  return <div>
    <header style={{display:'flex',gap:8,alignItems:'center',padding:12,background:'#1f2937',color:'#fff'}}>
      <b style={{marginRight:16}}>Sujay CRM</b>
      {['pipeline','queue','contacts'].map(t=><button key={t} style={{...btn,background:tab===t?'#3b82f6':'#fff',color:tab===t?'#fff':'#000'}} onClick={()=>setTab(t)}>{t==='queue'?`Needs reply (${queue.filter(i=>i.status!=='Closed').length})`:t[0].toUpperCase()+t.slice(1)}</button>)}
      <input placeholder="Search…" value={q} onChange={e=>setQ(e.target.value)} style={{marginLeft:'auto',padding:6,width:260}}/>
    </header>
    <div style={{display:'flex'}}>
    <main style={{flex:1,padding:12,overflow:'auto',height:'calc(100vh - 60px)'}}>
    {tab==='pipeline'&&<div style={{display:'flex',gap:10}}>{STAGES.map(s=>{const ds=deals.filter(x=>x.stage===s);return <div key={s} onDragOver={e=>e.preventDefault()} onDrop={e=>{const id=e.dataTransfer.getData('id');save({...ov,stage:{...ov.stage,[id]:s}})}} style={{minWidth:220,background:'#e5e7eb',borderRadius:8,padding:8}}>
      <b>{s}</b> <small>({ds.length})</small>
      {ds.slice(0,150).map(x=>{const c=cmap[x.contact_id];return <div key={x.id} draggable onDragStart={e=>e.dataTransfer.setData('id',x.id)} onClick={()=>setSel(c.id)} style={{background:'#fff',margin:'6px 0',padding:8,borderRadius:6,cursor:'pointer',fontSize:13,borderLeft:`4px solid ${c.dnc?'#ef4444':{bounced:'#f59e0b',rerouted:'#8b5cf6',sent:'#10b981'}[c.status]||'#9ca3af'}`}}>
        <div><b>{x.title}</b></div><div style={{color:'#666'}}>{c.email||c.linkedin||c.name}</div><small>{c.status}{c.dnc?' · DNC':''}</small></div>})}
      {ds.length>150&&<small>+{ds.length-150} more (search to narrow)</small>}</div>})}</div>}
    {tab==='queue'&&<table style={{width:'100%',background:'#fff',fontSize:13,borderCollapse:'collapse'}}><thead><tr>{['Status','Type','Contact','Summary','Source','Date','Action'].map(h=><th key={h} style={{textAlign:'left',padding:6,borderBottom:'1px solid #ddd'}}>{h}</th>)}</tr></thead>
      <tbody>{queue.map(i=>{const c=cmap[i.contact_id];return <tr key={i.id} style={{borderBottom:'1px solid #eee'}}>
      <td style={{padding:6}}><select value={i.status} onChange={e=>save({...ov,qstatus:{...ov.qstatus,[i.id]:e.target.value}})}>{Object.keys(QORDER).map(s=><option key={s}>{s}</option>)}</select></td>
      <td>{i.type}</td><td><a href="#" onClick={e=>{e.preventDefault();setSel(c.id)}}>{c.org||c.email}</a><br/><small>{c.email}</small></td><td>{i.summary}<br/><small style={{color:'#666'}}>{i.quote}</small></td><td>{i.source} <small>({i.sources.join(', ')})</small></td><td>{i.source_timestamp}</td><td>{i.closure_action}</td></tr>})}</tbody></table>}
    {tab==='contacts'&&<table style={{width:'100%',background:'#fff',fontSize:13}}><tbody>{contacts.slice(0,500).map(c=><tr key={c.id} onClick={()=>setSel(c.id)} style={{cursor:'pointer'}}><td>{c.name||c.org}</td><td>{c.email||c.linkedin}</td><td>{c.status}</td><td>{c.dnc&&<b style={{color:'#ef4444'}}>DO NOT CONTACT</b>}</td></tr>)}</tbody></table>}
    </main>
    {sel&&(()=>{const c=cmap[sel];const evs=d.events.filter(e=>e.contact_id===sel).sort((a,b)=>String(b.date).localeCompare(String(a.date)));return <aside style={{width:380,background:'#fff',padding:16,borderLeft:'1px solid #ddd',overflow:'auto',height:'calc(100vh - 92px)'}}>
      <button style={btn} onClick={()=>setSel(null)}>×</button><h3>{c.name||c.org||c.email}</h3>
      <div>{c.email}</div>{c.linkedin&&<div>{c.linkedin}</div>}<div>Status: <b>{c.status}</b></div>
      <label style={{display:'block',margin:'8px 0',color:c.dnc?'#ef4444':'#000'}}><input type="checkbox" checked={c.dnc} onChange={e=>save({...ov,dnc:{...ov.dnc,[c.id]:e.target.checked}})}/> Do not contact</label>
      <h4>Timeline</h4>{evs.map((e,i)=><div key={i} style={{borderLeft:'3px solid '+(e.channel==='linkedin'?'#0a66c2':e.channel==='meet'?'#16a34a':'#6b7280'),paddingLeft:8,margin:'8px 0',fontSize:13}}><b>{e.channel}</b> · {e.kind} · {e.date}<div>{e.summary}</div><small style={{color:'#999'}}>{e.source_file}</small></div>)}
      <p style={{fontSize:12,color:'#666'}}>Outbound is drafts-only; nothing is sent from this app.</p></aside>})()}
    </div></div>}
