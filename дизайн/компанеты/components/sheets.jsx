/* global React, Icon, Avatar, YZ_DATA, fmt */

// ═══════════════════════════════════════════════════════════
// NEW BOOKING SHEET (modal)
// ═══════════════════════════════════════════════════════════
function NewBookingSheet({ onClose, data }) {
  const [step, setStep] = React.useState(0);
  const [client, setClient] = React.useState(null);
  const [service, setService] = React.useState(null);
  const [time, setTime] = React.useState(data?.time || '14:00');

  const steps = ['Mijoz', 'Xizmat', 'Vaqt', 'Tasdiq'];

  const canNext = (step===0 && client) || (step===1 && service) || step===2 || step===3;

  const finish = () => {
    window.__yzToast('Yozilish qo\'shildi ✓');
    onClose();
  };

  return (
    <div className="sheet" style={{height:'88%'}}>
      <div style={{width:40, height:4, background:'#E3E5EC', borderRadius:999, margin:'10px auto 0'}}/>
      <div style={{padding:'16px 20px 0', display:'flex', alignItems:'center', justifyContent:'space-between'}}>
        <h2 style={{margin:0, fontFamily:'Plus Jakarta Sans', fontWeight:800, fontSize:22, color:'#0B0F1F', letterSpacing:-0.5}}>Yangi yozilish</h2>
        <div className="tap" onClick={onClose} style={{width:36,height:36,borderRadius:12,background:'#F2F3F7',display:'grid',placeItems:'center'}}>{Icon.close()}</div>
      </div>

      {/* Step indicator */}
      <div style={{display:'flex', gap:6, padding:'16px 20px 0'}}>
        {steps.map((s,i) => (
          <div key={s} style={{flex:1, height:4, borderRadius:999, background: i <= step ? 'linear-gradient(90deg,#5B6BFF,#4853F5)' : '#E3E5EC'}}/>
        ))}
      </div>
      <div style={{padding:'10px 20px 4px', fontSize:12, color:'#848AA2', fontWeight:700}}>{step+1}/{steps.length} · {steps[step]}</div>

      <div className="scroll" style={{flex:1, overflowY:'auto', padding:'10px 20px 0'}}>
        {step === 0 && (
          <div style={{display:'flex', flexDirection:'column', gap:8}}>
            <div style={{background:'#F2F3F7', borderRadius:14, padding:'12px 14px', display:'flex', alignItems:'center', gap:10, marginBottom:8}}>
              {Icon.search('#848AA2')}
              <input placeholder="Mijoz qidirish yoki yangi qo'shish" style={{border:'none', outline:'none', background:'transparent', flex:1, fontSize:14}}/>
            </div>
            {YZ_DATA.clients.slice(0,6).map(c => (
              <div key={c.id} className="tap" onClick={() => setClient(c)} style={{
                padding:12, borderRadius:14, display:'flex', alignItems:'center', gap:12,
                background: client?.id === c.id ? '#EEF0FF' : '#fff',
                border: `1.5px solid ${client?.id === c.id ? '#4853F5' : '#F2F3F7'}`,
              }}>
                <Avatar name={c.name} size={40}/>
                <div style={{flex:1}}>
                  <div style={{fontFamily:'Plus Jakarta Sans', fontWeight:700, fontSize:14, color:'#0B0F1F'}}>{c.name}</div>
                  <div style={{fontSize:12, color:'#848AA2'}}>{c.phone}</div>
                </div>
                {client?.id === c.id && (
                  <div style={{width:24, height:24, borderRadius:'50%', background:'#4853F5', display:'grid', placeItems:'center'}}>{Icon.check()}</div>
                )}
              </div>
            ))}
          </div>
        )}

        {step === 1 && (
          <div style={{display:'flex', flexDirection:'column', gap:8}}>
            {YZ_DATA.services.slice(0,6).map(s => (
              <div key={s.id} className="tap" onClick={() => setService(s)} style={{
                padding:12, borderRadius:14, display:'flex', alignItems:'center', gap:12,
                background: service?.id === s.id ? '#EEF0FF' : '#fff',
                border: `1.5px solid ${service?.id === s.id ? '#4853F5' : '#F2F3F7'}`,
              }}>
                <div style={{width:44, height:44, borderRadius:12, background:s.color, display:'grid', placeItems:'center', fontSize:22}}>{s.emoji}</div>
                <div style={{flex:1}}>
                  <div style={{fontFamily:'Plus Jakarta Sans', fontWeight:700, fontSize:14, color:'#0B0F1F'}}>{s.name}</div>
                  <div style={{fontSize:12, color:'#848AA2'}}>{s.dur} daq · {fmt(s.price)} soʻm</div>
                </div>
                {service?.id === s.id && (
                  <div style={{width:24, height:24, borderRadius:'50%', background:'#4853F5', display:'grid', placeItems:'center'}}>{Icon.check()}</div>
                )}
              </div>
            ))}
          </div>
        )}

        {step === 2 && (
          <div>
            <div style={{fontSize:13, color:'#5A6078', fontWeight:600, marginBottom:8}}>Sana — 22 Apr</div>
            <div style={{display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:8}}>
              {['09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00'].map(t => {
                const busy = ['10:00','11:00','15:00'].includes(t);
                const active = time === t;
                return (
                  <div key={t} className="tap" onClick={() => !busy && setTime(t)} style={{
                    padding:'14px 0', textAlign:'center', borderRadius:14,
                    background: active ? 'linear-gradient(135deg,#5B6BFF,#4853F5)' : busy ? '#F2F3F7' : '#fff',
                    color: active ? '#fff' : busy ? '#B9BECD' : '#0B0F1F',
                    border: `1.5px solid ${active ? '#4853F5' : busy ? '#F2F3F7' : '#E3E5EC'}`,
                    fontFamily:'Plus Jakarta Sans', fontWeight:700, fontSize:15,
                    textDecoration: busy ? 'line-through' : 'none',
                    boxShadow: active ? '0 8px 20px rgba(72,83,245,0.3)' : 'none',
                  }}>{t}</div>
                );
              })}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="card-soft" style={{padding:20, border:'1.5px solid #E0E4FF'}}>
            <Row label="Mijoz" value={client?.name || '—'}/>
            <Row label="Telefon" value={client?.phone || '—'}/>
            <Row label="Xizmat" value={service?.name || '—'}/>
            <Row label="Vaqt" value={`22 Apr, ${time}`}/>
            <Row label="Davomiyligi" value={`${service?.dur || 0} daqiqa`}/>
            <div style={{height:1, background:'var(--ink-200)', margin:'12px 0'}}/>
            <Row label="Jami" value={`${fmt(service?.price || 0)} soʻm`} bold/>
          </div>
        )}
      </div>

      <div style={{padding:'16px 20px 28px', display:'flex', gap:10}}>
        {step > 0 && (
          <button className="tap" onClick={() => setStep(step-1)} style={{
            flex:1, padding:16, borderRadius:16, background:'#F2F3F7', border:'none',
            fontFamily:'Plus Jakarta Sans', fontWeight:700, fontSize:15, color:'#0B0F1F', cursor:'pointer',
          }}>Orqaga</button>
        )}
        <button className="btn-primary" disabled={!canNext} onClick={() => step === 3 ? finish() : setStep(step+1)} style={{
          flex:2, opacity: canNext ? 1 : 0.4,
        }}>{step === 3 ? 'Tasdiqlash' : 'Davom etish'}</button>
      </div>
    </div>
  );
}

function Row({ label, value, bold }) {
  return (
    <div style={{display:'flex', justifyContent:'space-between', padding:'8px 0', fontSize:14}}>
      <div style={{color:'#848AA2', fontWeight:500}}>{label}</div>
      <div style={{fontFamily:'Plus Jakarta Sans', fontWeight: bold ? 800 : 700, color:'#0B0F1F', fontSize: bold ? 16 : 14}}>{value}</div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// BOOKING DETAIL SHEET
// ═══════════════════════════════════════════════════════════
function BookingSheet({ data, onClose }) {
  const b = data;
  return (
    <div className="sheet" style={{height:'auto', maxHeight:'82%'}}>
      <div style={{width:40, height:4, background:'#E3E5EC', borderRadius:999, margin:'10px auto 0'}}/>
      <div style={{padding:'16px 20px 0', display:'flex', justifyContent:'flex-end'}}>
        <div className="tap" onClick={onClose} style={{width:36,height:36,borderRadius:12,background:'#F2F3F7',display:'grid',placeItems:'center'}}>{Icon.close()}</div>
      </div>

      <div style={{padding:'0 20px 20px', flex:1, overflowY:'auto'}} className="scroll">
        <div style={{textAlign:'center'}}>
          <Avatar name={b.client} size={68}/>
          <div style={{fontFamily:'Plus Jakarta Sans', fontWeight:800, fontSize:22, color:'#0B0F1F', marginTop:12, letterSpacing:-0.5}}>{b.client}</div>
          <div style={{fontSize:14, color:'#5A6078', marginTop:2}}>{b.phone}</div>
          <div style={{display:'inline-flex', alignItems:'center', gap:6, background:'#E6FAF3', color:'#0E9577', padding:'6px 12px', borderRadius:999, marginTop:10, fontSize:12, fontWeight:700}}>
            <div style={{width:6,height:6,borderRadius:'50%',background:'#0E9577'}}/> Tasdiqlangan
          </div>
        </div>

        <div style={{display:'flex', gap:10, marginTop:20}}>
          <ActionBtn icon={Icon.phone('#4853F5')} label="Qo'ng'iroq" onClick={() => window.__yzToast('Qo\'ng\'iroq qilinmoqda...')}/>
          <ActionBtn icon={Icon.chat('#4853F5')} label="Xabar" onClick={() => window.__yzToast('Chat ochildi')}/>
          <ActionBtn icon={Icon.edit('#4853F5')} label="Tahrir" onClick={() => window.__yzToast('Tahrir rejimi')}/>
        </div>

        <div className="card-soft" style={{padding:16, marginTop:16, background:'linear-gradient(135deg,#EEF0FF,#F8F9FC)'}}>
          <Row label="Vaqt" value={`22 Apr · ${b.time}`}/>
          <Row label="Davomiyligi" value={`${b.dur} daqiqa`}/>
          <Row label="Xizmat" value={b.service}/>
          {b.note && <Row label="Izoh" value={b.note}/>}
          <div style={{height:1, background:'rgba(11,15,31,0.08)', margin:'12px 0'}}/>
          <Row label="Narx" value={`${fmt(b.price)} soʻm`} bold/>
        </div>

        <div style={{display:'flex', gap:10, marginTop:16, marginBottom:8}}>
          <button className="tap" style={{flex:1, padding:14, borderRadius:14, background:'#FFE7E3', color:'#C93A2A', border:'none', fontFamily:'Plus Jakarta Sans', fontWeight:700, fontSize:14, cursor:'pointer'}} onClick={onClose}>Bekor qilish</button>
          <button className="btn-primary" style={{flex:2, padding:14, fontSize:14}} onClick={() => { window.__yzToast('Bajarildi deb belgilandi'); onClose(); }}>Bajarildi ✓</button>
        </div>
      </div>
    </div>
  );
}

function ActionBtn({ icon, label, onClick }) {
  return (
    <div className="tap" onClick={onClick} style={{flex:1, padding:'12px 0', borderRadius:14, background:'#EEF0FF', display:'flex', flexDirection:'column', alignItems:'center', gap:4}}>
      {icon}
      <div style={{fontSize:12, fontWeight:700, color:'#4853F5', fontFamily:'Plus Jakarta Sans'}}>{label}</div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// CLIENT SHEET
// ═══════════════════════════════════════════════════════════
function ClientSheet({ data, onClose }) {
  const c = data;
  return (
    <div className="sheet" style={{height:'82%'}}>
      <div style={{width:40, height:4, background:'#E3E5EC', borderRadius:999, margin:'10px auto 0'}}/>
      <div style={{padding:'16px 20px 0', display:'flex', justifyContent:'flex-end'}}>
        <div className="tap" onClick={onClose} style={{width:36,height:36,borderRadius:12,background:'#F2F3F7',display:'grid',placeItems:'center'}}>{Icon.close()}</div>
      </div>

      <div className="scroll" style={{flex:1, overflowY:'auto', padding:'0 20px 20px'}}>
        <div style={{textAlign:'center'}}>
          <div style={{position:'relative', display:'inline-block'}}>
            <Avatar name={c.name} size={72}/>
            {c.vip && <div style={{position:'absolute', bottom:-4, right:-4, width:24, height:24, borderRadius:'50%', background:'#FFC94A', border:'3px solid white', display:'grid', placeItems:'center', fontSize:12}}>★</div>}
          </div>
          <div style={{fontFamily:'Plus Jakarta Sans', fontWeight:800, fontSize:22, color:'#0B0F1F', marginTop:12, letterSpacing:-0.5}}>{c.name}</div>
          <div style={{fontSize:14, color:'#5A6078', marginTop:2}}>{c.phone}</div>
        </div>

        <div style={{display:'flex', gap:10, marginTop:20}}>
          <ActionBtn icon={Icon.phone('#4853F5')} label="Qo'ng'iroq" onClick={() => window.__yzToast('Qo\'ng\'iroq')}/>
          <ActionBtn icon={Icon.chat('#4853F5')} label="Xabar" onClick={() => window.__yzToast('Chat')}/>
          <ActionBtn icon={Icon.plus('#4853F5')} label="Yozilish" onClick={() => window.__yzToast('Yangi yozilish')}/>
        </div>

        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginTop:16}}>
          <div className="card-soft" style={{padding:14, textAlign:'center'}}>
            <div style={{fontFamily:'Plus Jakarta Sans', fontWeight:800, fontSize:20, color:'#4853F5'}}>{c.visits}</div>
            <div style={{fontSize:11, color:'#5A6078', fontWeight:600}}>Tashrif</div>
          </div>
          <div className="card-soft" style={{padding:14, textAlign:'center'}}>
            <div style={{fontFamily:'Plus Jakarta Sans', fontWeight:800, fontSize:20, color:'#22C8A8'}}>{fmt(c.spent/1000)}k</div>
            <div style={{fontSize:11, color:'#5A6078', fontWeight:600}}>Jami soʻm</div>
          </div>
          <div className="card-soft" style={{padding:14, textAlign:'center'}}>
            <div style={{fontFamily:'Plus Jakarta Sans', fontWeight:800, fontSize:14, color:'#0B0F1F', marginTop:3, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{c.fav}</div>
            <div style={{fontSize:11, color:'#5A6078', fontWeight:600, marginTop:3}}>Sevimli</div>
          </div>
        </div>

        <div style={{marginTop:20}}>
          <div style={{fontFamily:'Plus Jakarta Sans', fontSize:15, fontWeight:800, color:'#0B0F1F', marginBottom:10, letterSpacing:-0.3}}>Oxirgi tashriflar</div>
          {[
            { date:'22 Apr', service:'Soch turmagi', price:180_000 },
            { date:'05 Apr', service:'Soch turmagi', price:180_000 },
            { date:'15 Mar', service:'Soch bo\'yash', price:420_000 },
          ].map((h,i) => (
            <div key={i} className="card-soft" style={{padding:12, display:'flex', alignItems:'center', gap:12, marginBottom:8}}>
              <div style={{width:44, height:44, borderRadius:12, background:'#EEF0FF', display:'grid', placeItems:'center', fontSize:20}}>✂️</div>
              <div style={{flex:1}}>
                <div style={{fontFamily:'Plus Jakarta Sans', fontWeight:700, fontSize:14, color:'#0B0F1F'}}>{h.service}</div>
                <div style={{fontSize:12, color:'#848AA2'}}>{h.date}</div>
              </div>
              <div style={{fontFamily:'Plus Jakarta Sans', fontWeight:800, fontSize:14}}>{fmt(h.price)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// SERVICE SHEET
// ═══════════════════════════════════════════════════════════
function ServiceSheet({ data, onClose }) {
  const s = data;
  return (
    <div className="sheet" style={{height:'auto'}}>
      <div style={{width:40, height:4, background:'#E3E5EC', borderRadius:999, margin:'10px auto 0'}}/>
      <div style={{padding:'16px 20px 0', display:'flex', justifyContent:'flex-end'}}>
        <div className="tap" onClick={onClose} style={{width:36,height:36,borderRadius:12,background:'#F2F3F7',display:'grid',placeItems:'center'}}>{Icon.close()}</div>
      </div>

      <div style={{padding:'0 20px 28px'}}>
        <div style={{width:88, height:88, borderRadius:22, background:s.color, display:'grid', placeItems:'center', fontSize:44, margin:'0 auto'}}>{s.emoji}</div>
        <div style={{fontFamily:'Plus Jakarta Sans', fontWeight:800, fontSize:24, color:'#0B0F1F', textAlign:'center', marginTop:16, letterSpacing:-0.5}}>{s.name}</div>
        <div style={{fontSize:14, color:'#5A6078', textAlign:'center', marginTop:4}}>{s.cat} · {s.dur} daqiqa</div>

        <div className="card-soft" style={{padding:16, marginTop:20, background:'linear-gradient(135deg,#EEF0FF,#F8F9FC)'}}>
          <Row label="Narx" value={`${fmt(s.price)} soʻm`} bold/>
          <Row label="Davomiyligi" value={`${s.dur} daqiqa`}/>
          <Row label="Kategoriya" value={s.cat}/>
          <Row label="Bu oyda" value="11 ta yozilish"/>
        </div>

        <div style={{display:'flex', gap:10, marginTop:16}}>
          <button className="tap" style={{flex:1, padding:14, borderRadius:14, background:'#F2F3F7', border:'none', fontFamily:'Plus Jakarta Sans', fontWeight:700, fontSize:14, cursor:'pointer'}} onClick={onClose}>Tahrirlash</button>
          <button className="btn-primary" style={{flex:2, padding:14, fontSize:14}} onClick={onClose}>Yopish</button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { NewBookingSheet, BookingSheet, ClientSheet, ServiceSheet, Row, ActionBtn });
