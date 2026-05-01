/* global React, Icon, Avatar, ScreenHeader, YZ_DATA, fmt, BookingCard */

// ═══════════════════════════════════════════════════════════
// CALENDAR SCREEN — day view timeline
// ═══════════════════════════════════════════════════════════
function CalendarScreen({ go, openSheet }) {
  const [view, setView] = React.useState('day'); // day | week
  const [selectedDay, setSelectedDay] = React.useState(22);
  const days = [
    {d:20,w:'Du'}, {d:21,w:'Se'}, {d:22,w:'Cho',today:true}, {d:23,w:'Pa'}, {d:24,w:'Ju'}, {d:25,w:'Sh'}, {d:26,w:'Ya'},
  ];
  const hours = [9,10,11,12,13,14,15,16,17,18];
  const bookings = YZ_DATA.bookings;

  return (
    <div style={{position:'absolute', inset:0, background:'var(--ink-50)', display:'flex', flexDirection:'column'}}>
      <ScreenHeader
        title="Yozilishlar"
        subtitle="Aprel 2026"
        onBack={() => go('home')}
        right={
          <div className="tap" style={{width:40,height:40,borderRadius:14,background:'white',display:'grid',placeItems:'center',boxShadow:'0 2px 8px rgba(11,15,31,0.06)'}}>
            {Icon.search()}
          </div>
        }
      />

      {/* Week strip */}
      <div style={{padding:'4px 16px 0', display:'flex', gap:8}}>
        {days.map(d => {
          const active = d.d === selectedDay;
          return (
            <div key={d.d} className="tap" onClick={() => setSelectedDay(d.d)} style={{
              flex:1, padding:'10px 4px', borderRadius:16, textAlign:'center',
              background: active ? 'linear-gradient(180deg,#5B6BFF,#4853F5)' : 'white',
              boxShadow: active ? '0 8px 20px rgba(72,83,245,0.35)' : '0 1px 0 rgba(11,15,31,0.04)',
              transition:'all .2s',
            }}>
              <div style={{fontSize:11, fontWeight:700, color: active ? 'rgba(255,255,255,0.75)' : '#848AA2'}}>{d.w}</div>
              <div style={{fontFamily:'Plus Jakarta Sans', fontWeight:800, fontSize:18, color: active ? '#fff' : '#0B0F1F', marginTop:2}}>{d.d}</div>
              {d.today && <div style={{width:4,height:4,borderRadius:'50%',background: active ? '#FFC94A' : '#4853F5', margin:'3px auto 0'}}/>}
            </div>
          );
        })}
      </div>

      {/* View toggle */}
      <div style={{padding:'16px 16px 4px', display:'flex', gap:8, alignItems:'center', justifyContent:'space-between'}}>
        <div style={{display:'inline-flex', background:'#E3E5EC', borderRadius:12, padding:3}}>
          {['day','week'].map(v => (
            <div key={v} className="tap" onClick={() => setView(v)} style={{
              padding:'6px 14px', borderRadius:10, fontSize:13, fontWeight:700,
              background: view===v ? '#fff' : 'transparent',
              color: view===v ? '#0B0F1F' : '#5A6078',
              boxShadow: view===v ? '0 1px 2px rgba(11,15,31,0.08)' : 'none',
              fontFamily:'Plus Jakarta Sans',
            }}>{v==='day'?'Kun':'Hafta'}</div>
          ))}
        </div>
        <div style={{fontSize:13, color:'#5A6078', fontWeight:600}}>{bookings.length} ta yozilish</div>
      </div>

      {/* Timeline */}
      <div className="scroll" style={{flex:1, overflowY:'auto', padding:'8px 16px 120px'}}>
        {hours.map(h => {
          const hStr = `${h.toString().padStart(2,'0')}:00`;
          const matching = bookings.filter(b => parseInt(b.time) === h);
          return (
            <div key={h} style={{display:'flex', gap:12, alignItems:'flex-start', minHeight:68}}>
              <div style={{width:42, flexShrink:0, paddingTop:2}}>
                <div style={{fontSize:12, fontWeight:700, color:'#848AA2', fontFamily:'SF Mono, monospace'}}>{hStr}</div>
              </div>
              <div style={{flex:1, borderTop:'1px solid var(--ink-200)', paddingTop:8, paddingBottom:8, minHeight:60}}>
                {matching.length === 0 && (
                  <div className="tap" onClick={() => openSheet({kind:'newBooking', data:{time:hStr}})} style={{
                    height:44, borderRadius:14, border:'1.5px dashed var(--ink-200)',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontSize:12, color:'#B9BECD', fontWeight:600,
                  }}>+ Bo'sh slot</div>
                )}
                {matching.map(b => (
                  <TimelineBlock key={b.id} b={b} onClick={() => openSheet({kind:'booking', data:b})}/>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TimelineBlock({ b, onClick }) {
  const colors = {
    confirmed: { bg:'linear-gradient(135deg,#EEF0FF,#E0E4FF)', br:'#4853F5', fg:'#0B0F1F' },
    pending:   { bg:'linear-gradient(135deg,#FFF3DA,#FFE5B0)', br:'#D97706', fg:'#0B0F1F' },
  };
  const c = colors[b.status] || colors.confirmed;
  return (
    <div className="tap" onClick={onClick} style={{
      background:c.bg, borderLeft:`3px solid ${c.br}`, borderRadius:14,
      padding:'12px 14px', marginBottom:8,
      display:'flex', alignItems:'center', gap:12,
    }}>
      <Avatar name={b.client} size={32}/>
      <div style={{flex:1, minWidth:0}}>
        <div style={{fontFamily:'Plus Jakarta Sans', fontWeight:700, fontSize:14, color:c.fg, letterSpacing:-0.2}}>{b.client}</div>
        <div style={{fontSize:12, color:'#5A6078', marginTop:1, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{b.service} · {b.dur} daq</div>
      </div>
      <div style={{fontSize:13, fontWeight:800, color:c.fg, fontFamily:'Plus Jakarta Sans'}}>{fmt(b.price)}</div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// CLIENTS SCREEN
// ═══════════════════════════════════════════════════════════
function ClientsScreen({ go, openSheet }) {
  const [filter, setFilter] = React.useState('all');
  const [q, setQ] = React.useState('');
  const filters = [
    {id:'all', label:'Hammasi', count:YZ_DATA.clients.length},
    {id:'vip', label:'VIP', count:YZ_DATA.clients.filter(c=>c.vip).length},
    {id:'new', label:'Yangi', count:YZ_DATA.clients.filter(c=>c.isNew).length},
  ];
  let clients = YZ_DATA.clients;
  if (filter === 'vip') clients = clients.filter(c => c.vip);
  if (filter === 'new') clients = clients.filter(c => c.isNew);
  if (q) clients = clients.filter(c => c.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div style={{position:'absolute', inset:0, background:'var(--ink-50)', display:'flex', flexDirection:'column'}}>
      <ScreenHeader
        title="Mijozlar"
        subtitle={`${YZ_DATA.clients.length} ta faol mijoz`}
        onBack={() => go('home')}
      />

      {/* Search */}
      <div style={{padding:'4px 16px 12px'}}>
        <div style={{
          background:'white', borderRadius:14, padding:'12px 14px',
          display:'flex', alignItems:'center', gap:10,
          boxShadow:'0 1px 0 rgba(11,15,31,0.04)',
        }}>
          {Icon.search('#848AA2')}
          <input
            value={q} onChange={e => setQ(e.target.value)}
            placeholder="Ism yoki telefon bo'yicha qidirish"
            style={{border:'none', outline:'none', flex:1, fontSize:14, background:'transparent', color:'#0B0F1F'}}
          />
        </div>
      </div>

      {/* Filter chips */}
      <div style={{padding:'0 16px 12px', display:'flex', gap:8}}>
        {filters.map(f => (
          <div key={f.id} className={`chip ${filter===f.id?'chip-active':''}`} onClick={() => setFilter(f.id)} style={{cursor:'pointer'}}>
            {f.label} <span style={{opacity:0.6, fontWeight:700}}>{f.count}</span>
          </div>
        ))}
      </div>

      <div className="scroll" style={{flex:1, overflowY:'auto', padding:'0 16px 120px', display:'flex', flexDirection:'column', gap:8}}>
        {clients.map(c => (
          <div key={c.id} className="tap card-soft" onClick={() => openSheet({kind:'client', data:c})} style={{
            padding:14, display:'flex', alignItems:'center', gap:12,
          }}>
            <div style={{position:'relative'}}>
              <Avatar name={c.name} size={46}/>
              {c.vip && (
                <div style={{position:'absolute', bottom:-2, right:-2, width:18, height:18, borderRadius:'50%', background:'#FFC94A', border:'2px solid white', display:'grid', placeItems:'center', fontSize:9}}>
                  ★
                </div>
              )}
            </div>
            <div style={{flex:1, minWidth:0}}>
              <div style={{display:'flex', alignItems:'center', gap:6}}>
                <div style={{fontFamily:'Plus Jakarta Sans', fontWeight:700, fontSize:15, color:'#0B0F1F'}}>{c.name}</div>
                {c.isNew && <span style={{background:'#FFE7E3', color:'#C93A2A', fontSize:10, fontWeight:800, padding:'2px 6px', borderRadius:999}}>YANGI</span>}
              </div>
              <div style={{fontSize:12, color:'#5A6078', marginTop:2}}>
                {c.visits} ta tashrif · {c.last}
              </div>
            </div>
            <div style={{textAlign:'right'}}>
              <div style={{fontFamily:'Plus Jakarta Sans', fontWeight:800, fontSize:14, color:'#0B0F1F'}}>{fmt(c.spent)}</div>
              <div style={{fontSize:10, color:'#848AA2', fontWeight:600}}>soʻm</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// ANALYTICS SCREEN
// ═══════════════════════════════════════════════════════════
function AnalyticsScreen({ go }) {
  const [period, setPeriod] = React.useState('week');
  const weekData = [
    {d:'Du', v:720}, {d:'Se', v:980}, {d:'Cho', v:1240}, {d:'Pa', v:1060}, {d:'Ju', v:1450}, {d:'Sh', v:1820}, {d:'Ya', v:1370},
  ];
  const max = Math.max(...weekData.map(w => w.v));

  const topServices = [
    {name:'Soch bo\'yash',      revenue:2_520_000, count:6, color:'#FFC94A'},
    {name:'Soch turmagi',       revenue:1_980_000, count:11, color:'#4853F5'},
    {name:'Manikyur',           revenue:1_350_000, count:9,  color:'#FF9FB5'},
    {name:'Erkaklar soch',      revenue:960_000,   count:8,  color:'#22C8A8'},
  ];
  const totalRev = topServices.reduce((s,x)=>s+x.revenue,0);

  return (
    <div style={{position:'absolute', inset:0, background:'var(--ink-50)', display:'flex', flexDirection:'column'}}>
      <ScreenHeader title="Analitika" subtitle="Biznesingiz natijalari" onBack={() => go('home')}/>

      {/* Period toggle */}
      <div style={{padding:'4px 16px 16px', display:'flex', gap:8}}>
        {[{id:'day',l:'Bugun'},{id:'week',l:'Hafta'},{id:'month',l:'Oy'},{id:'year',l:'Yil'}].map(p => (
          <div key={p.id} className="tap" onClick={() => setPeriod(p.id)} style={{
            flex:1, padding:'10px 0', borderRadius:12, textAlign:'center', fontSize:13, fontWeight:700,
            background: period===p.id ? '#0B0F1F' : 'white',
            color: period===p.id ? '#fff' : '#5A6078',
            boxShadow: period===p.id ? '0 4px 12px rgba(11,15,31,0.2)' : '0 1px 0 rgba(11,15,31,0.04)',
            fontFamily:'Plus Jakarta Sans',
          }}>{p.l}</div>
        ))}
      </div>

      <div className="scroll" style={{flex:1, overflowY:'auto', padding:'0 16px 120px'}}>
        {/* Hero stat */}
        <div className="card-soft" style={{padding:20, background:'linear-gradient(135deg,#0B0F1F 0%,#1E2270 100%)', color:'#fff', position:'relative', overflow:'hidden'}}>
          <div style={{position:'absolute',top:-30,right:-30,width:140,height:140,borderRadius:'50%',background:'rgba(91,107,255,0.3)',filter:'blur(20px)'}}/>
          <div style={{position:'relative'}}>
            <div style={{fontSize:12, color:'rgba(255,255,255,0.7)', fontWeight:700, textTransform:'uppercase', letterSpacing:0.5}}>Shu hafta daromad</div>
            <div style={{display:'flex', alignItems:'baseline', gap:8, marginTop:6}}>
              <div style={{fontFamily:'Plus Jakarta Sans', fontWeight:800, fontSize:34, letterSpacing:-1}}>8 640 000</div>
              <div style={{fontSize:14, color:'rgba(255,255,255,0.7)', fontWeight:600}}>soʻm</div>
            </div>
            <div style={{display:'inline-flex', alignItems:'center', gap:4, background:'rgba(34,200,168,0.2)', padding:'4px 10px', borderRadius:999, marginTop:10, fontSize:12, fontWeight:700, color:'#22C8A8'}}>
              {Icon.trend('#22C8A8')} +18% o'tgan haftaga nisbatan
            </div>
          </div>

          {/* Chart */}
          <div style={{display:'flex', alignItems:'flex-end', gap:6, marginTop:22, height:100, position:'relative'}}>
            {weekData.map((d,i) => (
              <div key={i} style={{flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:6}}>
                <div style={{
                  width:'100%', height: `${(d.v/max)*80}px`,
                  background: i===5 ? 'linear-gradient(180deg,#FFC94A,#FF7A6B)' : 'rgba(255,255,255,0.25)',
                  borderRadius:8,
                  boxShadow: i===5 ? '0 4px 12px rgba(255,201,74,0.4)' : 'none',
                }}/>
                <div style={{fontSize:10, fontWeight:700, color:'rgba(255,255,255,0.7)'}}>{d.d}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Grid stats */}
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginTop:12}}>
          <MiniStat label="Yozilishlar" value="47" trend="+12" color="#4853F5"/>
          <MiniStat label="Yangi mijoz" value="9" trend="+3" color="#22C8A8"/>
          <MiniStat label="O'rtacha chek" value="184k" trend="+8%" color="#FFC94A"/>
          <MiniStat label="Bekor qilingan" value="2" trend="−1" color="#FF7A6B" neg/>
        </div>

        {/* Top services */}
        <div style={{marginTop:20}}>
          <SectionLabel title="Eng mashhur xizmatlar"/>
          <div className="card-soft" style={{padding:16, marginTop:10}}>
            {topServices.map((s,i) => (
              <div key={i} style={{marginBottom: i<topServices.length-1 ? 14 : 0}}>
                <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6}}>
                  <div style={{display:'flex', alignItems:'center', gap:8}}>
                    <div style={{width:8, height:8, borderRadius:2, background:s.color}}/>
                    <div style={{fontFamily:'Plus Jakarta Sans', fontWeight:700, fontSize:14, color:'#0B0F1F'}}>{s.name}</div>
                  </div>
                  <div style={{fontFamily:'Plus Jakarta Sans', fontWeight:800, fontSize:13, color:'#0B0F1F'}}>{fmt(s.revenue)}</div>
                </div>
                <div style={{height:6, background:'#F2F3F7', borderRadius:999, overflow:'hidden'}}>
                  <div style={{height:'100%', width:`${(s.revenue/totalRev)*100}%`, background:s.color, borderRadius:999}}/>
                </div>
                <div style={{fontSize:11, color:'#848AA2', fontWeight:600, marginTop:3}}>{s.count} ta yozilish</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value, trend, color, neg }) {
  return (
    <div className="card-soft" style={{padding:14}}>
      <div style={{fontSize:11, color:'#848AA2', fontWeight:700, textTransform:'uppercase', letterSpacing:0.4}}>{label}</div>
      <div style={{fontFamily:'Plus Jakarta Sans', fontWeight:800, fontSize:22, color, marginTop:4, letterSpacing:-0.5}}>{value}</div>
      <div style={{display:'inline-flex', alignItems:'center', gap:3, background: neg ? '#FFE7E3' : '#E6FAF3', color: neg ? '#C93A2A' : '#0E9577', padding:'2px 8px', borderRadius:999, marginTop:4, fontSize:10, fontWeight:700}}>
        {trend}
      </div>
    </div>
  );
}

function SectionLabel({ title, action, onAction }) {
  return (
    <div style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
      <h3 style={{margin:0, fontFamily:'Plus Jakarta Sans', fontSize:17, fontWeight:800, letterSpacing:-0.4, color:'#0B0F1F'}}>{title}</h3>
      {action && <div className="tap" onClick={onAction} style={{fontSize:13, color:'#4853F5', fontWeight:700}}>{action}</div>}
    </div>
  );
}

Object.assign(window, { CalendarScreen, ClientsScreen, AnalyticsScreen, MiniStat, TimelineBlock });
