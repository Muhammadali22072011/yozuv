/* global React, Icon, Avatar, ScreenHeader, YZ_DATA, fmt */

// ═══════════════════════════════════════════════════════════
// SCHEDULE SCREEN — work hours per day
// ═══════════════════════════════════════════════════════════
function ScheduleScreen({ go }) {
  const [days, setDays] = React.useState([
    { d:'Dushanba',  open:'09:00', close:'20:00', on:true  },
    { d:'Seshanba',  open:'09:00', close:'20:00', on:true  },
    { d:'Chorshanba',open:'09:00', close:'20:00', on:true  },
    { d:'Payshanba', open:'09:00', close:'20:00', on:true  },
    { d:'Juma',      open:'09:00', close:'22:00', on:true  },
    { d:'Shanba',    open:'10:00', close:'22:00', on:true  },
    { d:'Yakshanba', open:'—',     close:'—',     on:false },
  ]);

  const toggle = (i) => {
    setDays(days.map((d,j) => j===i ? {...d, on: !d.on, open: !d.on ? '09:00' : '—', close: !d.on ? '20:00' : '—'} : d));
  };

  return (
    <div style={{position:'absolute', inset:0, background:'var(--ink-50)', display:'flex', flexDirection:'column'}}>
      <ScreenHeader title="Ish jadvali" subtitle="Haftalik ish kunlari" onBack={() => go('settings')}/>
      <div className="scroll" style={{flex:1, overflowY:'auto', padding:'0 16px 120px'}}>
        <div className="card-soft" style={{padding:6}}>
          {days.map((d,i) => (
            <div key={i} style={{
              padding:'14px 12px', display:'flex', alignItems:'center', gap:12,
              borderBottom: i<days.length-1 ? '1px solid var(--ink-100)' : 'none',
            }}>
              <div style={{flex:1}}>
                <div style={{fontFamily:'Plus Jakarta Sans', fontWeight:700, fontSize:15, color: d.on ? '#0B0F1F' : '#B9BECD'}}>{d.d}</div>
                <div style={{fontSize:12, color:'#848AA2', fontFamily:'SF Mono, monospace', marginTop:2}}>
                  {d.on ? `${d.open} – ${d.close}` : 'Dam olish kuni'}
                </div>
              </div>
              <div className="tap" onClick={() => toggle(i)} style={{
                width:44, height:26, borderRadius:999, padding:3,
                background: d.on ? '#4853F5' : '#E3E5EC',
                transition:'all .2s',
              }}>
                <div style={{
                  width:20, height:20, borderRadius:'50%', background:'#fff',
                  transform: d.on ? 'translateX(18px)' : 'translateX(0)',
                  transition:'transform .2s', boxShadow:'0 2px 4px rgba(0,0,0,0.15)',
                }}/>
              </div>
            </div>
          ))}
        </div>

        <div style={{marginTop:20}}>
          <div style={{fontSize:12, fontWeight:700, color:'#848AA2', textTransform:'uppercase', letterSpacing:0.5, padding:'0 4px 8px'}}>Tanaffus</div>
          <div className="card-soft" style={{padding:14, display:'flex', alignItems:'center', gap:12}}>
            <div style={{width:40, height:40, borderRadius:12, background:'#FFF3DA', display:'grid', placeItems:'center', fontSize:20}}>☕</div>
            <div style={{flex:1}}>
              <div style={{fontFamily:'Plus Jakarta Sans', fontWeight:700, fontSize:14}}>Tushlik</div>
              <div style={{fontSize:12, color:'#848AA2', fontFamily:'SF Mono, monospace', marginTop:1}}>13:00 – 14:00</div>
            </div>
            {Icon.chevron()}
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// PROFILE SCREEN — business info
// ═══════════════════════════════════════════════════════════
function ProfileScreen({ go }) {
  return (
    <div style={{position:'absolute', inset:0, background:'var(--ink-50)', display:'flex', flexDirection:'column'}}>
      <ScreenHeader title="Biznes profili" onBack={() => go('settings')}/>
      <div className="scroll" style={{flex:1, overflowY:'auto', padding:'0 16px 120px'}}>
        {/* Logo + name */}
        <div className="card-soft" style={{padding:20, textAlign:'center'}}>
          <div style={{width:80, height:80, borderRadius:24, margin:'0 auto', background:'linear-gradient(135deg,#5B6BFF,#3640D4)', display:'grid', placeItems:'center', color:'#fff', fontFamily:'Plus Jakarta Sans', fontWeight:800, fontSize:40, boxShadow:'0 12px 24px rgba(72,83,245,0.35)'}}>S</div>
          <div style={{fontFamily:'Plus Jakarta Sans', fontWeight:800, fontSize:22, marginTop:12, letterSpacing:-0.5}}>Stil Studio</div>
          <div style={{fontSize:13, color:'#5A6078', marginTop:2}}>Soch va go'zallik saloni</div>
          <div style={{display:'inline-flex', gap:6, marginTop:10}}>
            {[1,2,3,4,5].map(i => Icon.star())}
            <span style={{fontSize:12, color:'#5A6078', fontWeight:700, marginLeft:4}}>4.9 · 142</span>
          </div>
        </div>

        {[
          { label:'Nomi', val:'Stil Studio', icon:'🏪', bg:'#EEF0FF' },
          { label:'Yo\'nalish', val:'Soch, tirnoq, yuz', icon:'💇', bg:'#FFE7E3' },
          { label:'Manzil', val:'Navoiy ko\'chasi 42, Toshkent', icon:'📍', bg:'#E6FAF3' },
          { label:'Telefon', val:'+998 90 123 45 67', icon:'📞', bg:'#FFF3DA' },
          { label:'Instagram', val:'@stilstudio.uz', icon:'📸', bg:'#FFE7E3' },
        ].map((it,i) => (
          <div key={i} className="tap card-soft" style={{padding:14, marginTop:10, display:'flex', alignItems:'center', gap:12}}>
            <div style={{width:40, height:40, borderRadius:12, background:it.bg, display:'grid', placeItems:'center', fontSize:20}}>{it.icon}</div>
            <div style={{flex:1}}>
              <div style={{fontSize:12, color:'#848AA2', fontWeight:600}}>{it.label}</div>
              <div style={{fontFamily:'Plus Jakarta Sans', fontWeight:700, fontSize:14, color:'#0B0F1F', marginTop:1}}>{it.val}</div>
            </div>
            {Icon.edit()}
          </div>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { ScheduleScreen, ProfileScreen });
