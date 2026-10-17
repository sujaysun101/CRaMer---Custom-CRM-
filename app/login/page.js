'use client';
import {useState} from 'react';
export default function Login(){const[p,s]=useState('');const[e,se]=useState('');
return <form style={{maxWidth:320,margin:'15vh auto',background:'#fff',padding:24,borderRadius:8}} onSubmit={async ev=>{ev.preventDefault();const r=await fetch('/api/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({password:p})});r.ok?location.href='/':se('Wrong password')}}>
<h2>Sujay CRM</h2><input type="password" value={p} onChange={x=>s(x.target.value)} placeholder="Password" style={{width:'100%',padding:8}}/><button style={{marginTop:12,padding:'8px 16px'}}>Enter</button><div style={{color:'red'}}>{e}</div></form>}
