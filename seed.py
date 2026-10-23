import re,json,glob,os,hashlib
SENDER=os.environ.get('CRM_SENDER','outreach inbox')
D='/workspace/crm/import'; EM=re.compile(r'[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}')
contacts={}; ev=[]

EXCLUDE_DOMAINS = ['.edu', 'nyu.edu', 'columbia.edu']
EXCLUDE_TERMS = ['mentor', 'advisor', 'advising', 'professor', 'faculty', 'student', 'nyu', 'university', 'college', 'course', 'homework', 'syllabus', 'thesis']
def is_excluded(e, name=None, org=None):
  if not e: return False
  e = e.lower().strip()
  if any(e.endswith(d) or f'@{d}' in e for d in EXCLUDE_DOMAINS): return True
  t = f"{e} {name or ''} {org or ''}".lower()
  return any(term in t for term in EXCLUDE_TERMS)

def n(e): return e.strip().strip('`').lower()
def C(e,org=None):
  e=n(e)
  if is_excluded(e, None, org): return None
  c=contacts.setdefault(e,{'id':'c_'+hashlib.md5(e.encode()).hexdigest()[:10],'email':e,'name':None,'org':None,'linkedin':None,'status':'pending','dnc':False})
  if org and not c['org']: c['org']=org
  return c
rank={'pending':0,'sent':1,'bounced':2,'rerouted':3}
def S(c,s):
  if not c: return
  if rank[s]>=rank[c['status']]: c['status']=s
def E(c,kind,date,summary,src,ref=''):
  if not c: return
  ev.append({'contact_id':c['id'],'channel':src,'kind':kind,'date':date,'summary':summary,'source_file':ref})
deny=set(n(l) for l in open(f'{D}/deny-emails.txt') if '@' in l) if os.path.exists(f'{D}/deny-emails.txt') else set()
ldeny=[l.strip() for l in open(f'{D}/linkedin-deny.txt') if l.strip() and not l.startswith('#')] if os.path.exists(f'{D}/linkedin-deny.txt') else []
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
      if not c: continue
      if 'batch' in b: E(c,'draft_created',date,'Outreach draft created ('+SENDER+')','email',b)
      elif b.startswith('gmail-send-') and re.search(r'\b1a0[0-9a-f]{13}\b',line): S(c,'sent'); E(c,'sent',date,'Outreach email sent from '+SENDER,'email',b)
    elif line.startswith('- SENT') and (b.startswith('gmail-send-') or b.startswith('gmail-bounce-fix-') or b.startswith('gmail-ooo-')):
      m=EM.search(line.split('to=')[1]); c=C(m.group(0)); S(c,'sent'); E(c,'sent',date,'Outreach email sent from '+SENDER,'email',b)
bounced={}
def bounce(e,date,alt=None,ref=''):
  c=C(e)
  if not c: return
  S(c,'rerouted' if alt else 'bounced'); E(c,'bounce',date,'Delivery failed'+(f'; rerouted to {alt}' if alt else '; no verified alternate'),'email',ref)
  bounced[c['email']]=(c,alt,date)

if os.path.exists(f'{D}/gmail-bounce-fix-2026-09-09.json'):
  j=json.load(open(f'{D}/gmail-bounce-fix-2026-09-09.json'))
  for s in j.get('sent',[]):
    bounce(s['bounced'],'2026-09-09',s['new'],'gmail-bounce-fix-2026-09-09.json')
    c=C(s['new'],s.get('org'))
    if c: S(c,'sent'); E(c,'sent','2026-09-09',f"Rerouted outreach sent (replacing {s['bounced']})",'email','gmail-bounce-fix-2026-09-09.json')
  for e in j.get('skipped_no_alt',[])+j.get('skipped_freemail',[]):
    if EM.fullmatch(n(e)): bounce(e,'2026-09-09',None,'gmail-bounce-fix-2026-09-09.json')

if os.path.exists(f'{D}/gmail-bounce-fix-2026-09-08.md'):
  txt=open(f'{D}/gmail-bounce-fix-2026-09-08.md').read()
  in_sent=False
  for line in txt.splitlines():
    if line.startswith('## '): in_sent='redrafted + sent' in line.lower()
    if line.startswith('|') and '@' in line:
      es=EM.findall(line)
      if len(es)>=2 and in_sent: bounce(es[0],'2026-09-08',es[1],'gmail-bounce-fix-2026-09-08.md'); c=C(es[1]); S(c,'sent'); E(c,'sent','2026-09-08',f'Rerouted outreach sent (replacing {es[0]})','email','gmail-bounce-fix-2026-09-08.md')
  sec=txt.split('skipped-no-alt)')[1].split('###')[0] if 'skipped-no-alt)' in txt else ''
  for e in EM.findall(sec): bounce(e,'2026-09-08',None,'gmail-bounce-fix-2026-09-08.md')

if os.path.exists(f'{D}/gmail-ooo-redraft-2026-09-08.json'):
  o=json.load(open(f'{D}/gmail-ooo-redraft-2026-09-08.json')); ooo=[]
  for s in o.get('sent',[]):
    c=C(s['orig'])
    if c:
      S(c,'rerouted'); E(c,'auto_reply','2026-09-08',f"Auto-reply ({s['kind']}); rerouted to {s['alt']}",'email','gmail-ooo-redraft-2026-09-08.json'); ooo.append((c,s))
      a=C(s['alt'],c['org'])
      if a: S(a,'sent'); E(a,'sent','2026-09-08',f"Rerouted outreach sent (replacing {s['orig']})",'email','gmail-ooo-redraft-2026-09-08.json')
  for s in o.get('skipped_details',[]):
    m=EM.search(s['orig'])
    if m:
      c=C(m.group(0))
      if c: E(c,'auto_reply','2026-09-08',f"Auto-reply; not rerouted: {s.get('reason','')}",'email','gmail-ooo-redraft-2026-09-08.json'); ooo.append((c,s))

# linkedin
for f in sorted(glob.glob(D+'/linkedin-batch-*.md')):
  b=os.path.basename(f); dm=re.search(r'2026-\d\d-\d\d',b); date=dm.group(0) if dm else '2026-10-01'
  for line in open(f):
    cells=[x.strip() for x in line.strip().strip('|').split('|')]
    if len(cells)<4 or not cells[0].strip().isdigit(): continue
    name,head,prof=cells[1],cells[2],cells[3]
    if is_excluded(prof, name, head): continue
    key='li:'+(prof if 'linkedin.com/in/' in prof and not prof.endswith('/in/') and '(' not in prof else name.lower())
    c=contacts.setdefault(key,{'id':'c_'+hashlib.md5(key.encode()).hexdigest()[:10],'email':None,'name':name,'org':head,'linkedin':prof if 'linkedin.com' in prof else None,'status':'pending','dnc':False})
    E(c,'linkedin_invite',date,'LinkedIn invite: '+(cells[4] if len(cells)>4 else ''),'linkedin',b)

for c in contacts.values():
  if c.get('email') and c['email'] in deny: c['dnc']=True
  t=((c.get('name') or '')+' '+(c.get('org') or '')).lower()
  if any(d.lower() in t for d in ldeny): c['dnc']=True

stage={'pending':'Lead','sent':'Contacted','bounced':'Lead','rerouted':'Contacted'}
deals=[{'id':'d_'+c['id'][2:],'contact_id':c['id'],'title':(c['org'] or c['name'] or c['email']),'stage':stage[c['status']],'value':0} for c in contacts.values()]
q=[];seen={}
def Q(c,typ,summary,quote,status,action,ts,ref):
  if not c or c['dnc']: return
  k=(c.get('email') or c.get('linkedin') or c['id'],re.sub(r'\W+',' ',summary.lower()).strip())
  if k in seen: seen[k]['sources'].append(ref); return
  it={'id':'q_'+hashlib.md5(repr(k).encode()).hexdigest()[:10],'contact_id':c['id'],'deal_id':'d_'+c['id'][2:],'type':typ,'summary':summary,'quote':quote,'source':'gmail','source_link':None,'source_timestamp':ts,'owner':None,'due_date':None,'status':status,'closure_action':action,'draft_id':None,'last_checked_at':ts,'sources':[ref]}
  seen[k]=it; q.append(it)

out={'contacts':list(contacts.values()),'deals':deals,'events':ev,'queue':q,'stats':{}}
print(f"Loaded {len(contacts)} contacts, {len(deals)} deals, {len(ev)} events (personal/mentor excluded).")
