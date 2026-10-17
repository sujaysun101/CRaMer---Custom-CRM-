import re,json,glob,os,hashlib
SENDER=os.environ.get('CRM_SENDER','outreach inbox')
D='/workspace/crm/import'; EM=re.compile(r'[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}')
contacts={}; ev=[]
def n(e): return e.strip().strip('`').lower()
def C(e,org=None):
  e=n(e); c=contacts.setdefault(e,{'id':'c_'+hashlib.md5(e.encode()).hexdigest()[:10],'email':e,'name':None,'org':None,'linkedin':None,'status':'pending','dnc':False})
  if org and not c['org']: c['org']=org
  return c
rank={'pending':0,'sent':1,'bounced':2,'rerouted':3}
def S(c,s):
  if rank[s]>=rank[c['status']]: c['status']=s
def E(c,kind,date,summary,src,ref=''):
  ev.append({'contact_id':c['id'],'channel':src,'kind':kind,'date':date,'summary':summary,'source_file':ref})
deny=set(n(l) for l in open(f'{D}/deny-emails.txt') if '@' in l)
ldeny=[l.strip() for l in open(f'{D}/linkedin-deny.txt') if l.strip() and not l.startswith('#')]
files=sorted(f for f in glob.glob(D+'/*') if not os.path.basename(f).startswith('_'))
for f in files:
  b=os.path.basename(f); dm=re.search(r'2026-\d\d-\d\d',b); date=dm.group(0) if dm else None
  if not b.startswith('gmail-') or not b.endswith('.md'): continue
  for line in open(f):
    if line.startswith('|'):
      cells=[x.strip() for x in line.strip().strip('|').split('|')]
      ems=[i for i,x in enumerate(cells) if EM.fullmatch(n(x))]
      if not ems: continue
      i=ems[0]; org=next((x for x in cells[:i] if x and not x.isdigit()),None)
      c=C(cells[i],org)
      if 'batch' in b: E(c,'draft_created',date,'Outreach draft created ('+SENDER+')','email',b)
      elif b.startswith('gmail-send-') and re.search(r'\b1a0[0-9a-f]{13}\b',line): S(c,'sent'); E(c,'sent',date,'Outreach email sent from '+SENDER,'email',b)
    elif line.startswith('- SENT') and (b.startswith('gmail-send-') or b.startswith('gmail-bounce-fix-') or b.startswith('gmail-ooo-')):
      m=EM.search(line.split('to=')[1]); c=C(m.group(0)); S(c,'sent'); E(c,'sent',date,'Outreach email sent from '+SENDER,'email',b)
j=json.load(open(f'{D}/gmail-bounce-fix-2026-09-09.json'))
bounced={}
def bounce(e,date,alt=None,ref=''):
  c=C(e); S(c,'rerouted' if alt else 'bounced'); E(c,'bounce',date,'Delivery failed'+(f'; rerouted to {alt}' if alt else '; no verified alternate'),'email',ref)
  bounced[c['email']]=(c,alt,date)
for s in j['sent']:
  bounce(s['bounced'],'2026-09-09',s['new'],'gmail-bounce-fix-2026-09-09.json'); c=C(s['new'],s.get('org')); S(c,'sent'); E(c,'sent','2026-09-09',f"Rerouted outreach sent (replacing {s['bounced']})",'email','gmail-bounce-fix-2026-09-09.json')
for e in j['skipped_no_alt']+j['skipped_freemail']:
  if EM.fullmatch(n(e)): bounce(e,'2026-09-09',None,'gmail-bounce-fix-2026-09-09.json')
txt=open(f'{D}/gmail-bounce-fix-2026-09-08.md').read()
in_sent=False
for line in txt.splitlines():
  if line.startswith('## '): in_sent='redrafted + sent' in line.lower()
  if line.startswith('|') and '@' in line:
    es=EM.findall(line)
    if len(es)>=2 and in_sent: bounce(es[0],'2026-09-08',es[1],'gmail-bounce-fix-2026-09-08.md'); c=C(es[1]); S(c,'sent'); E(c,'sent','2026-09-08',f'Rerouted outreach sent (replacing {es[0]})','email','gmail-bounce-fix-2026-09-08.md')
sec=txt.split('skipped-no-alt)')[1].split('###')[0] if 'skipped-no-alt)' in txt else ''
for e in EM.findall(sec): bounce(e,'2026-09-08',None,'gmail-bounce-fix-2026-09-08.md')
o=json.load(open(f'{D}/gmail-ooo-redraft-2026-09-08.json')); ooo=[]
for s in o['sent']:
  c=C(s['orig']); S(c,'rerouted'); E(c,'auto_reply','2026-09-08',f"Auto-reply ({s['kind']}); rerouted to {s['alt']}",'email','gmail-ooo-redraft-2026-09-08.json'); ooo.append((c,s))
  a=C(s['alt'],c['org']); S(a,'sent'); E(a,'sent','2026-09-08',f"Rerouted outreach sent (replacing {s['orig']})",'email','gmail-ooo-redraft-2026-09-08.json')
for s in o['skipped_details']:
  m=EM.search(s['orig']);
  if m: c=C(m.group(0)); E(c,'auto_reply','2026-09-08',f"Auto-reply; not rerouted: {s.get('reason','')}",'email','gmail-ooo-redraft-2026-09-08.json'); ooo.append((c,s))
# linkedin
for f in sorted(glob.glob(D+'/linkedin-batch-*.md')):
  b=os.path.basename(f); date=re.search(r'2026-\d\d-\d\d',b).group(0)
  for line in open(f):
    cells=[x.strip() for x in line.strip().strip('|').split('|')]
    if len(cells)<4 or not cells[0].strip().isdigit(): continue
    name,head,prof=cells[1],cells[2],cells[3]
    key='li:'+(prof if 'linkedin.com/in/' in prof and not prof.endswith('/in/') and '(' not in prof else name.lower())
    c=contacts.setdefault(key,{'id':'c_'+hashlib.md5(key.encode()).hexdigest()[:10],'email':None,'name':name,'org':head,'linkedin':prof if 'linkedin.com' in prof else None,'status':'pending','dnc':False})
    E(c,'linkedin_invite',date,'LinkedIn invite: '+(cells[4] if len(cells)>4 else ''),'linkedin',b)
# DNC
for c in contacts.values():
  if c['email'] in deny: c['dnc']=True
  t=((c['name'] or '')+' '+(c['org'] or '')).lower()
  if any(d.lower() in t for d in ldeny): c['dnc']=True
for e in deny:
  if e not in contacts: C(e)['dnc']=True
# deals
stage={'pending':'Lead','sent':'Contacted','bounced':'Lead','rerouted':'Contacted'}
deals=[{'id':'d_'+c['id'][2:],'contact_id':c['id'],'title':(c['org'] or c['name'] or c['email']),'stage':stage[c['status']],'value':0} for c in contacts.values()]
# queue per spec: bounce->Blocked, OOO->Waiting; DNC suppressed
q=[];seen={}
def Q(c,typ,summary,quote,status,action,ts,ref):
  if c['dnc']: return
  k=(c['email'] or c['linkedin'] or c['id'],re.sub(r'\W+',' ',summary.lower()).strip())
  if k in seen: seen[k]['sources'].append(ref); return
  it={'id':'q_'+hashlib.md5(repr(k).encode()).hexdigest()[:10],'contact_id':c['id'],'deal_id':'d_'+c['id'][2:],'type':typ,'summary':summary,'quote':quote,'source':'gmail','source_link':None,'source_timestamp':ts,'owner':None,'due_date':None,'status':status,'closure_action':action,'draft_id':None,'last_checked_at':ts,'sources':[ref]}
  seen[k]=it; q.append(it)
for e,(c,alt,d) in bounced.items():
  if not alt: Q(c,'record_fact','Bounce: reroute needed (no verified alternate found)',f'Delivery to {e} failed','Blocked','crm_update',d,'bounce log')
for c,s in ooo:
  if s.get('action')=='sent': continue
  Q(c,'record_fact','Auto-reply received; awaiting contact return',s.get('reason','')[:140],'Waiting','none','2026-09-08','ooo log')
out={'contacts':list(contacts.values()),'deals':deals,'events':ev,'queue':q,'stats':{}}
from collections import Counter
out['stats']={'contacts':len(contacts),'deals':len(deals),'events':len(ev),'queue':len(q),'status':Counter(c['status'] for c in contacts.values()),'dnc':sum(c['dnc'] for c in contacts.values()),'linkedin':sum(1 for c in contacts.values() if c['email'] is None),'queue_status':Counter(i['status'] for i in q)}
json.dump(out,open('/workspace/crm/app/data/seed.json','w'))
print(json.dumps(out['stats']))
