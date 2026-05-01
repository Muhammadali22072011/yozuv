/* global React, Icon, Avatar, ScreenHeader, YZ_DATA, fmt, SectionLabel */

// ═══════════════════════════════════════════════════════════
// SERVICES SCREEN
// ═══════════════════════════════════════════════════════════
function ServicesScreen({ go, openSheet }) {
  const [cat, setCat] = React.useState('all');
  const cats = ['all','Soch','Tirnoq','Rang','Yuz'];
  let services = YZ_DATA.services;
  if (cat !== 'all') services = services.filter(s => s.cat === cat);

  return (
    <div style={{position:'absolute', inset:0, background:'var(--ink-50)', display:'flex', flexDirection:'column'}}>
      <ScreenHeader
        title="Xizmatlar"
        subtitle={`${YZ_DATA.services.length} ta xizmat`}
        onBack={() => go('home')}
        right={
          <div className="tap" style={{width:40,height:40,borderRadius:14,background:'#0B0F1F',display:'grid',placeItems:'center'}}>
            {Icon.plus('#fff')}
          </div>
        }
      />
      <div style={{padding:'4px 16px 12px', display:'flex', gap:8, overflowX:'auto'}} className="scroll">
        {cats.map(c => (
          <div key={c} className={`chip ${cat===c?'chip-active':''}`} onClick={() => setCat(c)}>
            {c==='all' ? 'Hammasi' : c}
          </div>
        ))}
      </div>

      <div className="scroll" style={{flex:1, overflowY:'auto', padding:'0 16px 120px', display:'flex', flexDirection:'column', gap:10}}>
        {services.map(s => (
          <div key={s.id} className="tap card-soft" onClick={() => openSheet({kind:'service', data:s})} style={{padding:14, display:'flex', alignItems:'center', gap:14}}>
            <div style={{width:56, height:56, borderRadius:16, background:s.color, display:'grid', placeItems:'center', fontSize:26}}>
              {s.emoji}
            </div>
            <div style={{flex:1, minWidth:0}}>
              <div style={{fontFamily:'Plus Jakarta Sans', fontWeight:700, fontSize:15, color:'#0B0F1F'}}>{s.name}</div>
              <div style={{display:'flex', gap:8, marginTop:4, fontSize:12, color:'#5A6078', fontWeight:600}}>
                <span style={{display:'inline-flex', alignItems:'center', gap:3}}>{Icon.clock('#848AA2')} {s.dur} daq</span>
                <span>·</span>
                <span>{s.cat}</span>
              </div>
            </div>
            <div style={{textAlign:'right'}}>
              <div style={{fontFamily:'Plus Jakarta Sans', fontWeight:800, fontSize:15, color:'#0B0F1F'}}>{fmt(s.price)}</div>
              <div style={{fontSize:10, color:'#848AA2', fontWeight:600}}>soʻm</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// PROMO SCREEN
// ═══════════════════════════════════════════════════════════
function PromoScreen({ go }) {
  return (
    <div style={{position:'absolute', inset:0, background:'var(--ink-50)', display:'flex', flexDirection:'column'}}>
      <ScreenHeader title="Promo-kodlar" subtitle="Chegirma va aksiyalar" onBack={() => go('home')}
        right={<div className="tap" style={{width:40,height:40,borderRadius:14,background:'#0B0F1F',display:'grid',placeItems:'center'}}>{Icon.plus('#fff')}</div>}
      />

      <div className="scroll" style={{flex:1, overflowY:'auto', padding:'0 16px 120px', display:'flex', flexDirection:'column', gap:12}}>
        {YZ_DATA.promos.map(p => {
          const pct = p.limit ? Math.round(p.used / p.limit * 100) : 0;
          return (
            <div key={p.id} className="card-soft" style={{padding:0, overflow:'hidden', opacity: p.active ? 1 : 0.55}}>
              <div style={{
                background: p.active ? 'linear-gradient(135deg,#5B6BFF,#3640D4)' : '#848AA2',
                padding:'16px 18px', color:'#fff', position:'relative', overflow:'hidden',
              }}>
                <div style={{position:'absolute',top:-20,right:-20,width:100,height:100,borderRadius:'50%',background:'rgba(255,255,255,0.12)'}}/>
                <div style={{position:'relative', display:'flex', alignItems:'flex-start', justifyContent:'space-between'}}>
                  <div>
                    <div style={{fontSize:11, fontWeight:700, opacity:0.8, letterSpacing:0.5, textTransform:'uppercase'}}>Promo kod</div>
                    <div style={{fontFamily:'Plus Jakarta Sans', fontWeight:800, fontSize:22, letterSpacing:1, marginTop:4}}>{p.code}</div>
                    <div style={{fontSize:13, opacity:0.9, marginTop:2}}>{p.desc}</div>
                  </div>
                  <div style={{textAlign:'right'}}>
                    <div style={{fontFamily:'Plus Jakarta Sans', fontWeight:800, fontSize:28, letterSpacing:-1}}>
                      {p.type === '%' ? `${p.discount}%` : `${(p.discount/1000).toFixed(0)}k`}
                    </div>
                    <div style={{fontSize:11, opacity:0.8, fontWeight:600}}>{p.type === '%' ? 'chegirma' : 'soʻm'}</div>
                  </div>
                </div>
              </div>
              <div style={{padding:'14px 18px'}}>
                <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6}}>
                  <div style={{fontSize:12, color:'#5A6078', fontWeight:600}}>
                    {p.used} / {p.limit || '∞'} marta ishlatilgan
                  </div>
                  {p.active ? (
                    <span style={{background:'#E6FAF3', color:'#0E9577', fontSize:10, fontWeight:800, padding:'3px 8px', borderRadius:999}}>FAOL</span>
                  ) : (
                    <span style={{background:'#F2F3F7', color:'#848AA2', fontSize:10, fontWeight:800, padding:'3px 8px', borderRadius:999}}>TUGAGAN</span>
                  )}
                </div>
                {p.limit && (
                  <div style={{height:6, background:'#F2F3F7', borderRadius:999, overflow:'hidden'}}>
                    <div style={{height:'100%', width:`${pct}%`, background:p.active?'#4853F5':'#B9BECD', borderRadius:999}}/>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// QR SCREEN
// ═══════════════════════════════════════════════════════════
function QrScreen({ go }) {
  // Decorative QR pattern (SVG grid)
  const cells = 25;
  const pattern = React.useMemo(() => {
    const g = [];
    for (let y=0;y<cells;y++) for (let x=0;x<cells;x++) {
      // finder patterns
      if ((x<7&&y<7) || (x>cells-8&&y<7) || (x<7&&y>cells-8)) continue;
      if (Math.random() > 0.55) g.push({x,y});
    }
    return g;
  }, []);

  return (
    <div style={{position:'absolute', inset:0, background:'var(--ink-50)', display:'flex', flexDirection:'column'}}>
      <ScreenHeader title="QR kod" subtitle="Mijozlar uchun havola" onBack={() => go('home')}/>

      <div className="scroll" style={{flex:1, overflowY:'auto', padding:'0 16px 120px'}}>
        {/* Main QR card */}
        <div style={{
          background:'linear-gradient(180deg,#fff,#F8F9FC)', borderRadius:28, padding:'28px 24px 24px',
          boxShadow:'0 20px 40px -20px rgba(11,15,31,0.15)', textAlign:'center',
          border:'1.5px solid var(--ink-100)',
        }}>
          <div style={{display:'flex', alignItems:'center', justifyContent:'center', gap:8, marginBottom:4}}>
            {Icon.logo(24)}
            <div style={{fontFamily:'Plus Jakarta Sans', fontWeight:800, fontSize:18, letterSpacing:-0.3}}>Stil Studio</div>
          </div>
          <div style={{fontSize:13, color:'#5A6078', fontWeight:500, marginBottom:18}}>Yozilish uchun QR skanerlang</div>

          {/* QR */}
          <div style={{
            width:240, height:240, margin:'0 auto',
            background:'#fff', borderRadius:20, padding:16,
            boxShadow:'0 10px 30px rgba(11,15,31,0.08), inset 0 0 0 1px rgba(11,15,31,0.06)',
            position:'relative',
          }}>
            <svg viewBox="0 0 25 25" width="100%" height="100%">
              {/* 3 finder patterns */}
              {[[0,0],[18,0],[0,18]].map(([fx,fy],i) => (
                <React.Fragment key={i}>
                  <rect x={fx} y={fy} width="7" height="7" fill="#0B0F1F" rx="1"/>
                  <rect x={fx+1} y={fy+1} width="5" height="5" fill="#fff"/>
                  <rect x={fx+2} y={fy+2} width="3" height="3" fill="#0B0F1F"/>
                </React.Fragment>
              ))}
              {pattern.map((c,i) => (
                <rect key={i} x={c.x} y={c.y} width="1" height="1" fill="#0B0F1F"/>
              ))}
              {/* Y logo in center */}
              <rect x="10" y="10" width="5" height="5" fill="#fff"/>
              <rect x="10.5" y="10.5" width="4" height="4" fill="#4853F5" rx="0.8"/>
              <text x="12.5" y="14" fontFamily="Plus Jakarta Sans" fontSize="4" fontWeight="800" fill="#fff" textAnchor="middle">Y</text>
            </svg>
          </div>

          <div style={{marginTop:18, fontFamily:'SF Mono, monospace', fontSize:12, color:'#5A6078'}}>
            t.me/Yozuv_cl_bot?start=stilstudio
          </div>
        </div>

        {/* Actions */}
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginTop:16}}>
          <button className="btn-primary" onClick={() => window.__yzToast('QR yuklab olindi')} style={{fontSize:14, padding:'14px'}}>Yuklab olish</button>
          <button className="tap card-soft" style={{padding:14, fontSize:14, fontWeight:700, color:'#0B0F1F', fontFamily:'Plus Jakarta Sans', border:'none', background:'#fff'}} onClick={() => window.__yzToast('Havola ulashildi')}>Ulashish</button>
        </div>

        {/* Stats */}
        <div className="card-soft" style={{padding:16, marginTop:16}}>
          <div style={{fontSize:13, fontWeight:700, color:'#848AA2', textTransform:'uppercase', letterSpacing:0.5}}>QR orqali</div>
          <div style={{display:'flex', gap:16, marginTop:10}}>
            <div style={{flex:1}}>
              <div style={{fontFamily:'Plus Jakarta Sans', fontWeight:800, fontSize:22, color:'#0B0F1F', letterSpacing:-0.5}}>142</div>
              <div style={{fontSize:12, color:'#5A6078', fontWeight:600}}>Skanerlash</div>
            </div>
            <div style={{width:1, background:'var(--ink-200)'}}/>
            <div style={{flex:1}}>
              <div style={{fontFamily:'Plus Jakarta Sans', fontWeight:800, fontSize:22, color:'#22C8A8', letterSpacing:-0.5}}>38</div>
              <div style={{fontSize:12, color:'#5A6078', fontWeight:600}}>Yozilish</div>
            </div>
            <div style={{width:1, background:'var(--ink-200)'}}/>
            <div style={{flex:1}}>
              <div style={{fontFamily:'Plus Jakarta Sans', fontWeight:800, fontSize:22, color:'#4853F5', letterSpacing:-0.5}}>27%</div>
              <div style={{fontSize:12, color:'#5A6078', fontWeight:600}}>Konversiya</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// REVIEWS SCREEN
// ═══════════════════════════════════════════════════════════
function ReviewsScreen({ go }) {
  const reviews = YZ_DATA.reviews;
  const avg = (reviews.reduce((s,r)=>s+r.rating,0) / reviews.length).toFixed(1);
  const dist = [5,4,3,2,1].map(n => ({n, count: reviews.filter(r => r.rating === n).length}));
  const total = reviews.length;

  return (
    <div style={{position:'absolute', inset:0, background:'var(--ink-50)', display:'flex', flexDirection:'column'}}>
      <ScreenHeader title="Baholar" subtitle={`${total} ta sharh`} onBack={() => go('home')}/>

      <div className="scroll" style={{flex:1, overflowY:'auto', padding:'0 16px 120px'}}>
        <div className="card-soft" style={{padding:20, display:'flex', alignItems:'center', gap:20}}>
          <div style={{textAlign:'center'}}>
            <div style={{fontFamily:'Plus Jakarta Sans', fontWeight:800, fontSize:48, color:'#0B0F1F', letterSpacing:-2, lineHeight:1}}>{avg}</div>
            <div style={{display:'flex', gap:2, justifyContent:'center', marginTop:6}}>
              {[1,2,3,4,5].map(i => i <= Math.round(avg) ? Icon.star() : Icon.starO())}
            </div>
            <div style={{fontSize:11, color:'#848AA2', fontWeight:600, marginTop:4}}>{total} ta baho</div>
          </div>
          <div style={{flex:1, display:'flex', flexDirection:'column', gap:6}}>
            {dist.map(d => (
              <div key={d.n} style={{display:'flex', alignItems:'center', gap:8}}>
                <div style={{fontSize:12, fontWeight:700, color:'#5A6078', width:12}}>{d.n}</div>
                <div style={{flex:1, height:6, background:'#F2F3F7', borderRadius:999, overflow:'hidden'}}>
                  <div style={{height:'100%', width:`${(d.count/total)*100}%`, background:'#FFC94A', borderRadius:999}}/>
                </div>
                <div style={{fontSize:12, fontWeight:700, color:'#848AA2', width:16, textAlign:'right'}}>{d.count}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{marginTop:16, display:'flex', flexDirection:'column', gap:10}}>
          {reviews.map(r => (
            <div key={r.id} className="card-soft" style={{padding:14}}>
              <div style={{display:'flex', alignItems:'center', gap:10}}>
                <Avatar name={r.name} size={36}/>
                <div style={{flex:1}}>
                  <div style={{fontFamily:'Plus Jakarta Sans', fontWeight:700, fontSize:14, color:'#0B0F1F'}}>{r.name}</div>
                  <div style={{fontSize:11, color:'#848AA2', fontWeight:600}}>{r.date}</div>
                </div>
                <div style={{display:'flex', gap:1}}>
                  {[1,2,3,4,5].map(i => i <= r.rating ? Icon.star() : Icon.starO())}
                </div>
              </div>
              <div style={{marginTop:10, fontSize:14, color:'#2A2F45', lineHeight:1.5, textWrap:'pretty'}}>{r.text}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// CHAT LIST + CONVERSATION
// ═══════════════════════════════════════════════════════════
function ChatListScreen({ go }) {
  return (
    <div style={{position:'absolute', inset:0, background:'var(--ink-50)', display:'flex', flexDirection:'column'}}>
      <ScreenHeader title="Xabarlar" subtitle="Mijozlar bilan chat" onBack={() => go('home')}/>

      <div className="scroll" style={{flex:1, overflowY:'auto', padding:'0 16px 120px', display:'flex', flexDirection:'column', gap:4}}>
        {YZ_DATA.chats.map(c => (
          <div key={c.id} className="tap" onClick={() => go('chatRoom', c)} style={{
            padding:'14px 10px', display:'flex', alignItems:'center', gap:12,
            borderRadius:16,
          }}>
            <div style={{position:'relative'}}>
              <Avatar name={c.name} size={48}/>
              {c.online && <div style={{position:'absolute', bottom:0, right:0, width:12, height:12, borderRadius:'50%', background:'#22C8A8', border:'2.5px solid var(--ink-50)'}}/>}
            </div>
            <div style={{flex:1, minWidth:0}}>
              <div style={{display:'flex', justifyContent:'space-between'}}>
                <div style={{fontFamily:'Plus Jakarta Sans', fontWeight:700, fontSize:15, color:'#0B0F1F'}}>{c.name}</div>
                <div style={{fontSize:11, color:c.unread ? '#4853F5' : '#848AA2', fontWeight:700}}>{c.time}</div>
              </div>
              <div style={{display:'flex', alignItems:'center', gap:8, marginTop:2}}>
                <div style={{flex:1, fontSize:13, color: c.unread ? '#0B0F1F' : '#5A6078', fontWeight: c.unread ? 600 : 500, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{c.last}</div>
                {c.unread > 0 && (
                  <div style={{background:'#4853F5', color:'#fff', fontSize:11, fontWeight:800, minWidth:20, height:20, borderRadius:999, display:'grid', placeItems:'center', padding:'0 6px'}}>{c.unread}</div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ChatRoomScreen({ go, chatData }) {
  const [msg, setMsg] = React.useState('');
  const [messages, setMessages] = React.useState([
    { id:1, from:'them', text:'Salom! 12:30 ga yozildim, manzil qayerda?', time:'13:40' },
    { id:2, from:'me',   text:"Assalomu alaykum Nilufar! Biz Shayxontohur, Navoiy ko'chasi 42 da joylashganmiz.", time:'13:42' },
    { id:3, from:'me',   text:'Yandex taxi orqali "Stil Studio" deb izlang.', time:'13:42' },
    { id:4, from:'them', text:'Rahmat! Topaman 🙂', time:'13:44' },
    { id:5, from:'them', text:"Bir savol — ilovada qandaydir chegirma bor ekan, uni qanday ishlataman?", time:'13:45' },
  ]);
  const c = chatData || YZ_DATA.chats[1];

  const send = () => {
    if (!msg.trim()) return;
    setMessages([...messages, { id:Date.now(), from:'me', text:msg, time:'14:28' }]);
    setMsg('');
  };

  return (
    <div style={{position:'absolute', inset:0, background:'#F8F9FC', display:'flex', flexDirection:'column'}}>
      {/* Header */}
      <div style={{padding:'56px 16px 12px', background:'white', display:'flex', alignItems:'center', gap:12, borderBottom:'1px solid var(--ink-100)'}}>
        <div className="tap" onClick={() => go('chat')} style={{width:40,height:40,borderRadius:14,background:'#F2F3F7',display:'grid',placeItems:'center'}}>
          {Icon.back()}
        </div>
        <Avatar name={c.name} size={40}/>
        <div style={{flex:1, minWidth:0}}>
          <div style={{fontFamily:'Plus Jakarta Sans', fontWeight:700, fontSize:15, color:'#0B0F1F'}}>{c.name}</div>
          <div style={{fontSize:12, color: c.online ? '#22C8A8' : '#848AA2', fontWeight:600}}>
            {c.online ? '● Onlayn' : 'Oflayn'}
          </div>
        </div>
        <div className="tap" style={{width:40,height:40,borderRadius:14,background:'#EEF0FF',display:'grid',placeItems:'center'}}>
          {Icon.phone('#4853F5')}
        </div>
      </div>

      {/* Messages */}
      <div className="scroll" style={{flex:1, overflowY:'auto', padding:'16px', display:'flex', flexDirection:'column', gap:8}}>
        <div style={{textAlign:'center', fontSize:11, color:'#848AA2', fontWeight:600, margin:'4px 0 8px'}}>Bugun</div>
        {messages.map(m => (
          <div key={m.id} style={{display:'flex', justifyContent: m.from==='me' ? 'flex-end' : 'flex-start'}}>
            <div style={{
              maxWidth:'76%',
              background: m.from==='me' ? 'linear-gradient(135deg,#5B6BFF,#4853F5)' : '#fff',
              color: m.from==='me' ? '#fff' : '#0B0F1F',
              padding:'10px 14px',
              borderRadius: m.from==='me' ? '20px 20px 6px 20px' : '20px 20px 20px 6px',
              fontSize:14, lineHeight:1.4,
              boxShadow: m.from==='me' ? '0 4px 12px rgba(72,83,245,0.25)' : '0 1px 0 rgba(11,15,31,0.04)',
              textWrap:'pretty',
            }}>
              {m.text}
              <div style={{fontSize:10, opacity:0.7, marginTop:3, textAlign:'right', fontWeight:500}}>{m.time}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <div style={{padding:'10px 12px 28px', background:'white', borderTop:'1px solid var(--ink-100)', display:'flex', alignItems:'center', gap:8}}>
        <div style={{flex:1, background:'#F2F3F7', borderRadius:22, padding:'10px 16px', display:'flex', alignItems:'center', gap:8}}>
          <input
            value={msg} onChange={e => setMsg(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && send()}
            placeholder="Xabar yozing..."
            style={{border:'none', outline:'none', background:'transparent', flex:1, fontSize:14, color:'#0B0F1F'}}
          />
          {Icon.mic('#848AA2')}
        </div>
        <div className="tap" onClick={send} style={{
          width:44, height:44, borderRadius:'50%',
          background: msg.trim() ? 'linear-gradient(135deg,#5B6BFF,#4853F5)' : '#E3E5EC',
          display:'grid', placeItems:'center',
          boxShadow: msg.trim() ? '0 6px 14px rgba(72,83,245,0.35)' : 'none',
          transition:'all .2s',
        }}>
          {Icon.send('#fff')}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// NOTIFICATIONS SCREEN
// ═══════════════════════════════════════════════════════════
function NotificationsScreen({ go }) {
  const typeMap = {
    booking: { bg:'#EEF0FF', icon: Icon.calendar('#4853F5') },
    review:  { bg:'#FFF3DA', icon: Icon.star('#FFC94A','#FFC94A') },
    money:   { bg:'#E6FAF3', icon: Icon.money('#0E9577') },
    promo:   { bg:'#FFE7E3', icon: Icon.tag('#FF7A6B') },
  };
  return (
    <div style={{position:'absolute', inset:0, background:'var(--ink-50)', display:'flex', flexDirection:'column'}}>
      <ScreenHeader title="Bildirishnomalar" subtitle="So'nggi yangiliklar" onBack={() => go('home')}/>

      <div className="scroll" style={{flex:1, overflowY:'auto', padding:'0 16px 120px', display:'flex', flexDirection:'column', gap:8}}>
        {YZ_DATA.notifications.map(n => {
          const t = typeMap[n.type];
          return (
            <div key={n.id} className="card-soft" style={{padding:14, display:'flex', gap:12, alignItems:'flex-start', position:'relative', border: n.unread ? '1.5px solid #E0E4FF' : '1.5px solid transparent'}}>
              <div style={{width:44, height:44, borderRadius:14, background:t.bg, display:'grid', placeItems:'center', flexShrink:0}}>{t.icon}</div>
              <div style={{flex:1, minWidth:0}}>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline', gap:8}}>
                  <div style={{fontFamily:'Plus Jakarta Sans', fontWeight:700, fontSize:14, color:'#0B0F1F'}}>{n.title}</div>
                  {n.unread && <div style={{width:8,height:8,borderRadius:'50%',background:'#4853F5',flexShrink:0}}/>}
                </div>
                <div style={{fontSize:13, color:'#5A6078', marginTop:2, lineHeight:1.35}}>{n.text}</div>
                <div style={{fontSize:11, color:'#848AA2', fontWeight:600, marginTop:6}}>{n.time}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// SETTINGS SCREEN
// ═══════════════════════════════════════════════════════════
function SettingsScreen({ go }) {
  const sections = [
    {
      header:'Biznes', items:[
        { label:'Profil', sub:'Logotip, matnlar, rejim', icon:Icon.settings('#4853F5'), bg:'#EEF0FF' },
        { label:'Ish jadvali', sub:'Du–Ya, 09:00–20:00', icon:Icon.clock('#D97706'), bg:'#FFF3DA' },
        { label:'Manzil', sub:"Navoiy ko'chasi 42", icon:Icon.pin('#4853F5'), bg:'#EEF0FF' },
      ]
    },
    {
      header:'Obuna', items:[
        { label:'Tarif: PRO', sub:'23 kun qoldi', icon:'💎', bg:'#E6FAF3', highlight:true },
        { label:'To\'lov tarixi', sub:'Oxirgi: 15 Apr', icon:Icon.money('#0E9577'), bg:'#E6FAF3' },
      ]
    },
    {
      header:'Boshqa', items:[
        { label:'Til', sub:'O\'zbekcha (Lotin)', icon:'🌐', bg:'#EEF0FF' },
        { label:'Bildirishnomalar', sub:'Yoqilgan', icon:Icon.bell('#FF7A6B'), bg:'#FFE7E3' },
        { label:'Yordam', sub:'Savollar va qo\'llab-quvvatlash', icon:'💬', bg:'#E6FAF3' },
        { label:'Chiqish', sub:'', icon:'👋', bg:'#FFE7E3', danger:true },
      ]
    },
  ];

  return (
    <div style={{position:'absolute', inset:0, background:'var(--ink-50)', display:'flex', flexDirection:'column'}}>
      <ScreenHeader title="Sozlamalar" onBack={() => go('home')}/>

      <div className="scroll" style={{flex:1, overflowY:'auto', padding:'0 16px 120px'}}>
        {/* Profile card */}
        <div className="card-soft" style={{padding:18, display:'flex', alignItems:'center', gap:14}}>
          <Avatar name={YZ_DATA.biz.owner} size={56}/>
          <div style={{flex:1}}>
            <div style={{fontFamily:'Plus Jakarta Sans', fontWeight:800, fontSize:17, color:'#0B0F1F', letterSpacing:-0.3}}>{YZ_DATA.biz.owner}</div>
            <div style={{fontSize:13, color:'#5A6078', fontWeight:500}}>{YZ_DATA.biz.name}</div>
            <div style={{display:'inline-flex', alignItems:'center', gap:4, background:'#EEF0FF', color:'#4853F5', padding:'2px 8px', borderRadius:999, fontSize:11, fontWeight:700, marginTop:4}}>
              💎 PRO · 23 kun
            </div>
          </div>
          <div className="tap" style={{width:36, height:36, borderRadius:12, background:'#F2F3F7', display:'grid', placeItems:'center'}}>
            {Icon.edit('#5A6078')}
          </div>
        </div>

        {sections.map((sec, i) => (
          <div key={i} style={{marginTop:20}}>
            <div style={{fontSize:12, fontWeight:700, color:'#848AA2', textTransform:'uppercase', letterSpacing:0.5, padding:'0 4px 8px'}}>{sec.header}</div>
            <div className="card-soft" style={{padding:6, overflow:'hidden'}}>
              {sec.items.map((it, j) => (
                <div key={j} className="tap" style={{
                  padding:'12px 10px', display:'flex', alignItems:'center', gap:12,
                  borderBottom: j<sec.items.length-1 ? '1px solid var(--ink-100)' : 'none',
                }}>
                  <div style={{width:40, height:40, borderRadius:12, background:it.bg, display:'grid', placeItems:'center', fontSize:18, flexShrink:0}}>
                    {typeof it.icon === 'string' ? it.icon : it.icon}
                  </div>
                  <div style={{flex:1, minWidth:0}}>
                    <div style={{fontFamily:'Plus Jakarta Sans', fontWeight:700, fontSize:14, color: it.danger ? '#C93A2A' : '#0B0F1F'}}>{it.label}</div>
                    {it.sub && <div style={{fontSize:12, color:'#848AA2', marginTop:1}}>{it.sub}</div>}
                  </div>
                  {Icon.chevron()}
                </div>
              ))}
            </div>
          </div>
        ))}

        <div style={{textAlign:'center', marginTop:24, fontSize:11, color:'#848AA2', fontWeight:500}}>Yozuv · 2.4.1</div>
      </div>
    </div>
  );
}

Object.assign(window, { ServicesScreen, PromoScreen, QrScreen, ReviewsScreen, ChatListScreen, ChatRoomScreen, NotificationsScreen, SettingsScreen });
