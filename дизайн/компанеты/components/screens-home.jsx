/* global React, Icon, Avatar, ScreenHeader, HeroBlob */
// Yozuv — data + Home screen

const YZ_DATA = {
  biz: {
    name: "Stil Studio",
    slug: "stilstudio",
    owner: "Aziz Karimov",
    today: "22 Apr, chorshanba",
    plan: "PRO",
    botLink: "t.me/Yozuv_cl_bot?start=stilstudio",
  },
  stats: {
    todayBookings: 8,
    todayRevenue: 1_240_000,
    weekRevenue: 8_640_000,
    newClients: 3,
    weekGrowth: 18,
  },
  bookings: [
    { id: 1, time: "10:00", dur: 45, client: "Diyora Saidova",  service: "Soch turmagi",           price: 180_000, status: "confirmed", phone: "+998 90 123 45 67", note: "Iloji bo'lsa Olimjon ustada" },
    { id: 2, time: "11:00", dur: 60, client: "Sardor Ismoilov",  service: "Erkaklar soch olish",  price: 120_000, status: "confirmed", phone: "+998 93 221 00 14", note: "" },
    { id: 3, time: "12:30", dur: 90, client: "Nilufar Karimova", service: "Manikyur + pedikyur",  price: 280_000, status: "pending",   phone: "+998 99 812 44 01", note: "Yangi mijoz" },
    { id: 4, time: "14:00", dur: 45, client: "Bobur Rahimov",    service: "Soqol tarashlash",     price: 90_000,  status: "confirmed", phone: "+998 91 700 30 20", note: "" },
    { id: 5, time: "15:30", dur: 60, client: "Madina Yusupova",  service: "Soch bo'yash",         price: 420_000, status: "confirmed", phone: "+998 90 555 67 89", note: "Ombre, shokolad rang" },
    { id: 6, time: "17:00", dur: 30, client: "Javohir To'xtayev", service: "Soch yuvish + styling", price: 80_000, status: "confirmed", phone: "+998 94 120 11 22", note: "" },
  ],
  clients: [
    { id:1, name:"Diyora Saidova",   visits:12, spent:2_160_000, last:"22 Apr",  fav:"Soch turmagi",     phone:"+998 90 123 45 67", vip:true },
    { id:2, name:"Sardor Ismoilov",  visits:8,  spent:960_000,   last:"18 Apr",  fav:"Erkaklar soch olish", phone:"+998 93 221 00 14" },
    { id:3, name:"Madina Yusupova",  visits:15, spent:5_400_000, last:"22 Apr",  fav:"Soch bo'yash",     phone:"+998 90 555 67 89", vip:true },
    { id:4, name:"Bobur Rahimov",    visits:5,  spent:450_000,   last:"15 Apr",  fav:"Soqol tarashlash", phone:"+998 91 700 30 20" },
    { id:5, name:"Nilufar Karimova", visits:1,  spent:0,         last:"Yangi",   fav:"—",                phone:"+998 99 812 44 01", isNew:true },
    { id:6, name:"Javohir To'xtayev",visits:3,  spent:240_000,   last:"10 Apr",  fav:"Styling",          phone:"+998 94 120 11 22" },
    { id:7, name:"Zarina Alimova",   visits:9,  spent:3_060_000, last:"08 Apr",  fav:"Manikyur",         phone:"+998 97 441 22 33" },
    { id:8, name:"Oybek Nazarov",    visits:2,  spent:180_000,   last:"05 Apr",  fav:"Soch olish",       phone:"+998 99 100 20 30" },
  ],
  services: [
    { id:1, name:"Soch turmagi",          price:180_000, dur:45, color:"#C7CCFF", emoji:"💇🏻‍♀️", cat:"Soch" },
    { id:2, name:"Erkaklar soch olish",   price:120_000, dur:60, color:"#A3AAFF", emoji:"💇🏻‍♂️", cat:"Soch" },
    { id:3, name:"Soch bo'yash",          price:420_000, dur:120,color:"#FFC94A", emoji:"🎨",    cat:"Rang" },
    { id:4, name:"Manikyur",              price:150_000, dur:60, color:"#FF9FB5", emoji:"💅",    cat:"Tirnoq" },
    { id:5, name:"Pedikyur",              price:180_000, dur:75, color:"#FF7A6B", emoji:"🦶",    cat:"Tirnoq" },
    { id:6, name:"Soqol tarashlash",      price:90_000,  dur:30, color:"#22C8A8", emoji:"🧔🏻",   cat:"Soch" },
    { id:7, name:"Styling + yuvish",      price:80_000,  dur:30, color:"#7BC6FF", emoji:"✨",    cat:"Soch" },
    { id:8, name:"Yuz terapiyasi",        price:350_000, dur:60, color:"#B8A6FF", emoji:"🧖🏻‍♀️", cat:"Yuz" },
  ],
  promos: [
    { id:1, code:"YANGI20",  discount:20, type:"%",  used:34, limit:100, active:true,  desc:"Yangi mijozlar uchun" },
    { id:2, code:"DUSHANBA", discount:50_000, type:"soʻm", used:12, limit:50, active:true, desc:"Dushanba kunlari" },
    { id:3, code:"VIP15",    discount:15, type:"%",  used:89, limit:null, active:true, desc:"VIP mijozlar" },
    { id:4, code:"BAHOR",    discount:30, type:"%",  used:150, limit:150, active:false, desc:"Bahorgi aksiya (tugagan)" },
  ],
  reviews: [
    { id:1, name:"Diyora S.", rating:5, date:"21 Apr", text:"Juda zo'r! Olimjon aka mohir usta, doim shu yerga kelaman. Salonda atmosfera ham ajoyib." },
    { id:2, name:"Sardor I.", rating:5, date:"19 Apr", text:"Tez va sifatli. Narxlar ham mos." },
    { id:3, name:"Madina Y.", rating:4, date:"18 Apr", text:"Bo'yash natijasi yaxshi bo'ldi, lekin biroz kech boshlandi. Qolgani o'rinli." },
    { id:4, name:"Bobur R.",  rating:5, date:"15 Apr", text:"Eng yaxshi joy shaharda!" },
  ],
  chats: [
    { id:1, name:"Diyora Saidova",   last:"Rahmat! Ertaga ko'rishguncha", time:"14:22", unread:0, online:true },
    { id:2, name:"Nilufar Karimova", last:"Salom, 12:30 ga yozildim, manzil qayerda?", time:"13:45", unread:2, online:true },
    { id:3, name:"Sardor Ismoilov",  last:"Siz: Albatta, kutaman 👍", time:"12:10", unread:0 },
    { id:4, name:"Madina Yusupova",  last:"Bo'yash uchun qancha vaqt kerak?", time:"11:03", unread:1 },
    { id:5, name:"Bobur Rahimov",    last:"Ok, raxmat", time:"Kecha", unread:0 },
  ],
  notifications: [
    { id:1, type:"booking", title:"Yangi yozilish", text:"Nilufar Karimova — Manikyur, 12:30", time:"5 daq oldin", unread:true },
    { id:2, type:"review",  title:"5 ⭐️ baho qoldirildi", text:"Diyora Saidovadan yangi sharh", time:"1 soat oldin", unread:true },
    { id:3, type:"money",   title:"To'lov qabul qilindi", text:"180 000 soʻm — Diyora S.", time:"2 soat oldin", unread:false },
    { id:4, type:"promo",   title:"Promo kod ishlatildi", text:"YANGI20 — 20% chegirma", time:"3 soat oldin", unread:false },
  ],
};

function fmt(n) {
  return n.toLocaleString('ru-RU').replace(/,/g, ' ');
}

// ═══════════════════════════════════════════════════════════
// HOME SCREEN
// ═══════════════════════════════════════════════════════════
function HomeScreen({ go, openSheet }) {
  const { biz, stats, bookings, notifications } = YZ_DATA;
  const unreadNotif = notifications.filter(n => n.unread).length;
  const nextBooking = bookings[0];

  return (
    <div className="scroll" style={{
      position:'absolute', inset:0, overflowY:'auto', paddingBottom:120,
      background:'var(--ink-50)',
    }}>
      {/* Hero header — indigo gradient */}
      <div style={{
        background:'linear-gradient(160deg,#5B6BFF 0%,#4853F5 55%,#3640D4 100%)',
        padding:'56px 20px 88px',
        position:'relative',
        borderRadius:'0 0 32px 32px',
        overflow:'hidden',
      }}>
        {/* Decorative blobs */}
        <div style={{position:'absolute',top:-30,right:-40,width:200,height:200,borderRadius:'50%',background:'rgba(255,255,255,0.08)'}}/>
        <div style={{position:'absolute',top:80,right:80,width:90,height:90,borderRadius:'50%',background:'rgba(255,201,74,0.25)',filter:'blur(2px)'}}/>
        <div style={{position:'absolute',bottom:60,left:-20,width:120,height:120,borderRadius:'50%',background:'rgba(184,166,255,0.25)'}}/>

        <div style={{position:'relative', display:'flex', alignItems:'center', justifyContent:'space-between'}}>
          <div style={{display:'flex', alignItems:'center', gap:10}}>
            {Icon.logo(34)}
            <div>
              <div style={{color:'rgba(255,255,255,0.7)', fontSize:11, fontWeight:600, letterSpacing:0.5}}>YOZUV · {biz.plan}</div>
              <div style={{color:'#fff', fontSize:17, fontWeight:700, fontFamily:'Plus Jakarta Sans', letterSpacing:-0.3}}>{biz.name}</div>
            </div>
          </div>
          <div className="tap" onClick={() => go('notifications')} style={{
            width:44, height:44, borderRadius:14,
            background:'rgba(255,255,255,0.18)', backdropFilter:'blur(10px)',
            display:'grid', placeItems:'center', position:'relative',
          }}>
            {Icon.bell('#fff')}
            {unreadNotif > 0 && (
              <div style={{position:'absolute',top:8,right:8,width:10,height:10,borderRadius:'50%',background:'#FFC94A',border:'2px solid #4853F5'}}/>
            )}
          </div>
        </div>

        <div style={{position:'relative', marginTop:28}}>
          <div style={{color:'rgba(255,255,255,0.7)', fontSize:13, fontWeight:500}}>Assalomu alaykum,</div>
          <div style={{color:'#fff', fontSize:28, fontWeight:800, fontFamily:'Plus Jakarta Sans', letterSpacing:-0.8, marginTop:2}}>
            {biz.owner.split(' ')[0]} 👋
          </div>
          <div style={{color:'rgba(255,255,255,0.85)', fontSize:14, marginTop:6, fontWeight:500}}>{biz.today}</div>
        </div>
      </div>

      {/* Stats pulled up over hero */}
      <div style={{padding:'0 16px', marginTop:-64, position:'relative'}}>
        <div style={{
          background:'#fff', borderRadius:24, padding:'18px 18px',
          boxShadow:'0 20px 40px -20px rgba(11,15,31,0.25), 0 1px 0 rgba(11,15,31,0.04)',
          display:'flex', gap:14,
        }}>
          <StatBox
            label="Bugun"
            value={stats.todayBookings}
            sub="yozilish"
            accent="#4853F5"
          />
          <div style={{width:1, background:'var(--ink-200)'}}/>
          <StatBox
            label="Daromad"
            value={`${(stats.todayRevenue/1000).toFixed(0)}k`}
            sub="soʻm"
            accent="#22C8A8"
            trend={`+${stats.weekGrowth}%`}
          />
          <div style={{width:1, background:'var(--ink-200)'}}/>
          <StatBox
            label="Yangi"
            value={`+${stats.newClients}`}
            sub="mijoz"
            accent="#FFC94A"
          />
        </div>
      </div>

      {/* Next booking spotlight */}
      <div style={{padding:'24px 16px 0'}}>
        <SectionLabel title="Keyingi yozilish" action="Jadval" onAction={() => go('calendar')}/>
        <div className="tap card-soft" onClick={() => openSheet({ kind:'booking', data: nextBooking })} style={{
          padding:16, display:'flex', alignItems:'center', gap:14, marginTop:10,
          border:'1.5px solid #E0E4FF',
        }}>
          <div style={{
            background:'linear-gradient(135deg,#EEF0FF,#E0E4FF)',
            padding:'10px 12px', borderRadius:16, textAlign:'center', minWidth:64,
          }}>
            <div style={{fontFamily:'Plus Jakarta Sans', fontWeight:800, fontSize:22, color:'#3640D4', letterSpacing:-0.5}}>{nextBooking.time}</div>
            <div style={{fontSize:11, color:'#5A6078', fontWeight:600, marginTop:-2}}>{nextBooking.dur} daq</div>
          </div>
          <div style={{flex:1, minWidth:0}}>
            <div style={{fontFamily:'Plus Jakarta Sans', fontWeight:700, fontSize:15, color:'#0B0F1F', letterSpacing:-0.2}}>{nextBooking.client}</div>
            <div style={{fontSize:13, color:'#5A6078', marginTop:2, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{nextBooking.service}</div>
            <div style={{display:'flex', alignItems:'center', gap:6, marginTop:6}}>
              <span style={{background:'#E6FAF3', color:'#0E9577', fontSize:11, fontWeight:700, padding:'3px 8px', borderRadius:999}}>Tasdiqlangan</span>
              <span style={{fontSize:12, color:'#0B0F1F', fontWeight:700}}>{fmt(nextBooking.price)} soʻm</span>
            </div>
          </div>
          <div className="tap" onClick={(e) => { e.stopPropagation(); window.__yzToast('Qo\'ng\'iroq qilinmoqda...'); }} style={{
            width:40, height:40, borderRadius:14, background:'#EEF0FF',
            display:'grid', placeItems:'center', flexShrink:0,
          }}>
            {Icon.phone('#4853F5')}
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div style={{padding:'24px 16px 0'}}>
        <SectionLabel title="Tezkor amallar"/>
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginTop:10}}>
          <QuickTile label="QR kodim"      sub="Mijozlarga ulashing" bg="#FFF3DA" icon={Icon.qr('#D97706')} onClick={() => go('qr')}/>
          <QuickTile label="Promo-kodlar"  sub={`${YZ_DATA.promos.filter(p=>p.active).length} ta faol`} bg="#E6FAF3" icon={Icon.tag('#0E9577')} onClick={() => go('promo')}/>
          <QuickTile label="Xizmatlar"     sub={`${YZ_DATA.services.length} ta`} bg="#EEF0FF" icon={Icon.scissors('#4853F5')} onClick={() => go('services')}/>
          <QuickTile label="Baholar"       sub={`${YZ_DATA.reviews.length} ta sharh`} bg="#FFE7E3" icon={Icon.star('#FF7A6B','#FF7A6B')} onClick={() => go('reviews')}/>
        </div>
      </div>

      {/* Today's timeline */}
      <div style={{padding:'24px 16px 0'}}>
        <SectionLabel title="Bugungi kun" action="Barchasi" onAction={() => go('calendar')}/>
        <div style={{marginTop:10, display:'flex', flexDirection:'column', gap:8}}>
          {bookings.slice(0,3).map(b => (
            <BookingCard key={b.id} b={b} onClick={() => openSheet({kind:'booking', data:b})}/>
          ))}
        </div>
      </div>

      {/* Bot link card */}
      <div style={{padding:'24px 16px 0'}}>
        <div className="tap" onClick={() => { navigator.clipboard?.writeText(`https://${biz.botLink}`); window.__yzToast('Havola nusxalandi'); }} style={{
          background:'linear-gradient(135deg,#0B0F1F 0%,#1E2270 100%)',
          borderRadius:22, padding:18, display:'flex', alignItems:'center', gap:14,
          position:'relative', overflow:'hidden',
        }}>
          <div style={{position:'absolute',top:-20,right:-20,width:120,height:120,borderRadius:'50%',background:'rgba(91,107,255,0.3)',filter:'blur(20px)'}}/>
          <div style={{
            width:48, height:48, borderRadius:14,
            background:'rgba(255,255,255,0.14)', backdropFilter:'blur(10px)',
            display:'grid', placeItems:'center', position:'relative', flexShrink:0,
          }}>{Icon.share('#fff')}</div>
          <div style={{flex:1, minWidth:0, position:'relative'}}>
            <div style={{color:'#fff', fontFamily:'Plus Jakarta Sans', fontWeight:700, fontSize:15, letterSpacing:-0.2}}>Mijozlar havolangiz</div>
            <div style={{color:'rgba(255,255,255,0.7)', fontSize:12, marginTop:2, fontFamily:'SF Mono, monospace', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{biz.botLink}</div>
          </div>
          <div style={{position:'relative', display:'flex', alignItems:'center', gap:6, background:'rgba(255,255,255,0.14)', padding:'8px 12px', borderRadius:12, color:'#fff', fontSize:12, fontWeight:700}}>
            {Icon.copy('#fff')} Nusxa
          </div>
        </div>
      </div>
    </div>
  );
}

function StatBox({ label, value, sub, accent, trend }) {
  return (
    <div style={{flex:1, textAlign:'center'}}>
      <div style={{fontSize:11, color:'#848AA2', fontWeight:700, textTransform:'uppercase', letterSpacing:0.5}}>{label}</div>
      <div style={{marginTop:4, fontFamily:'Plus Jakarta Sans', fontWeight:800, fontSize:24, color:accent, letterSpacing:-0.6}}>{value}</div>
      <div style={{fontSize:11, color:'#5A6078', fontWeight:600, marginTop:-1}}>{sub}</div>
      {trend && (
        <div style={{marginTop:4, display:'inline-flex', alignItems:'center', gap:3, background:'#E6FAF3', color:'#0E9577', padding:'2px 8px', borderRadius:999, fontSize:10, fontWeight:700}}>
          {Icon.trend('#0E9577')} {trend}
        </div>
      )}
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

function QuickTile({ label, sub, bg, icon, onClick }) {
  return (
    <div className="tap card-soft" onClick={onClick} style={{padding:14, display:'flex', flexDirection:'column', gap:10}}>
      <div style={{width:40, height:40, borderRadius:12, background:bg, display:'grid', placeItems:'center'}}>{icon}</div>
      <div>
        <div style={{fontFamily:'Plus Jakarta Sans', fontWeight:700, fontSize:14, color:'#0B0F1F', letterSpacing:-0.2}}>{label}</div>
        <div style={{fontSize:12, color:'#848AA2', marginTop:1}}>{sub}</div>
      </div>
    </div>
  );
}

function BookingCard({ b, onClick }) {
  const statusMap = {
    confirmed: { bg:'#E6FAF3', fg:'#0E9577', label:'Tasdiq.' },
    pending:   { bg:'#FFF3DA', fg:'#A8751A', label:'Kutilmoqda' },
    cancelled: { bg:'#FFE7E3', fg:'#C93A2A', label:'Bekor' },
  };
  const s = statusMap[b.status];
  return (
    <div className="tap card-soft" onClick={onClick} style={{padding:12, display:'flex', alignItems:'center', gap:12}}>
      <div style={{minWidth:52}}>
        <div style={{fontFamily:'Plus Jakarta Sans', fontWeight:800, fontSize:16, color:'#0B0F1F', letterSpacing:-0.3}}>{b.time}</div>
        <div style={{fontSize:11, color:'#848AA2', fontWeight:600}}>{b.dur} daq</div>
      </div>
      <div style={{width:3, height:40, borderRadius:2, background: b.status==='pending' ? '#FFC94A' : '#5B6BFF'}}/>
      <Avatar name={b.client} size={36}/>
      <div style={{flex:1, minWidth:0}}>
        <div style={{fontFamily:'Plus Jakarta Sans', fontWeight:700, fontSize:14, color:'#0B0F1F', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{b.client}</div>
        <div style={{fontSize:12, color:'#5A6078', marginTop:1, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{b.service}</div>
      </div>
      <span style={{background:s.bg, color:s.fg, fontSize:10, fontWeight:800, padding:'3px 8px', borderRadius:999}}>{s.label}</span>
    </div>
  );
}

Object.assign(window, { YZ_DATA, fmt, HomeScreen, StatBox, SectionLabel, QuickTile, BookingCard });
