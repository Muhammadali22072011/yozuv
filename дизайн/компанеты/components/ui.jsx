/* global React */
// Yozuv Business — icons + small UI pieces (all SVG, no libraries)

const Icon = {
  home: (c='#fff') => <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M3 11L12 4l9 7v8a2 2 0 01-2 2h-3v-6h-8v6H5a2 2 0 01-2-2v-8z" stroke={c} strokeWidth="2" strokeLinejoin="round"/></svg>,
  calendar: (c='#fff') => <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="16" rx="3" stroke={c} strokeWidth="2"/><path d="M3 9h18M8 3v4M16 3v4" stroke={c} strokeWidth="2" strokeLinecap="round"/></svg>,
  users: (c='#fff') => <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><circle cx="9" cy="8" r="3.5" stroke={c} strokeWidth="2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke={c} strokeWidth="2" strokeLinecap="round"/><circle cx="17" cy="7" r="2.5" stroke={c} strokeWidth="2"/><path d="M21 17c0-2.2-1.8-4-4-4" stroke={c} strokeWidth="2" strokeLinecap="round"/></svg>,
  chart: (c='#fff') => <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" stroke={c} strokeWidth="2" strokeLinecap="round"/></svg>,
  plus: (c='#fff') => <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke={c} strokeWidth="2.6" strokeLinecap="round"/></svg>,
  back: (c='#0B0F1F') => <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M15 5l-7 7 7 7" stroke={c} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  bell: (c='#0B0F1F') => <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M6 9a6 6 0 0112 0c0 6 2 7 2 7H4s2-1 2-7z" stroke={c} strokeWidth="2" strokeLinejoin="round"/><path d="M10 20a2 2 0 004 0" stroke={c} strokeWidth="2" strokeLinecap="round"/></svg>,
  search: (c='#0B0F1F') => <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="7" stroke={c} strokeWidth="2"/><path d="M20 20l-3.5-3.5" stroke={c} strokeWidth="2" strokeLinecap="round"/></svg>,
  phone: (c='#0B0F1F') => <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M5 4h3l2 5-2.5 1.5a11 11 0 006 6L15 14l5 2v3a2 2 0 01-2 2A15 15 0 013 6a2 2 0 012-2z" stroke={c} strokeWidth="2" strokeLinejoin="round"/></svg>,
  chat: (c='#0B0F1F') => <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M4 5h16v11H8l-4 4V5z" stroke={c} strokeWidth="2" strokeLinejoin="round"/></svg>,
  check: (c='#fff') => <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke={c} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  star: (c='#FFC94A', f='#FFC94A') => <svg width="18" height="18" viewBox="0 0 24 24"><path d="M12 2l3 7 7 .6-5.3 4.7L18.5 22 12 18l-6.5 4L7.3 14.3 2 9.6 9 9z" fill={f} stroke={c} strokeWidth="1.2" strokeLinejoin="round"/></svg>,
  starO: (c='#B9BECD') => <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 2l3 7 7 .6-5.3 4.7L18.5 22 12 18l-6.5 4L7.3 14.3 2 9.6 9 9z" stroke={c} strokeWidth="1.6" strokeLinejoin="round"/></svg>,
  qr: (c='#0B0F1F') => <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="7" height="7" stroke={c} strokeWidth="2"/><rect x="14" y="3" width="7" height="7" stroke={c} strokeWidth="2"/><rect x="3" y="14" width="7" height="7" stroke={c} strokeWidth="2"/><path d="M14 14h3v3M20 14h1M14 20h3M20 17v4" stroke={c} strokeWidth="2" strokeLinecap="round"/></svg>,
  tag: (c='#0B0F1F') => <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M3 12V3h9l9 9-9 9-9-9z" stroke={c} strokeWidth="2" strokeLinejoin="round"/><circle cx="8" cy="8" r="1.6" fill={c}/></svg>,
  scissors: (c='#0B0F1F') => <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="6" cy="7" r="3" stroke={c} strokeWidth="2"/><circle cx="6" cy="17" r="3" stroke={c} strokeWidth="2"/><path d="M8.5 9L20 17M8.5 15L20 7" stroke={c} strokeWidth="2" strokeLinecap="round"/></svg>,
  settings: (c='#0B0F1F') => <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3" stroke={c} strokeWidth="2"/><path d="M12 2v3M12 19v3M4 12H1M23 12h-3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2" stroke={c} strokeWidth="2" strokeLinecap="round"/></svg>,
  chevron: (c='#B9BECD') => <svg width="10" height="16" viewBox="0 0 10 16" fill="none"><path d="M2 2l6 6-6 6" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  close: (c='#0B0F1F') => <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke={c} strokeWidth="2.2" strokeLinecap="round"/></svg>,
  clock: (c='#5A6078') => <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke={c} strokeWidth="2"/><path d="M12 7v5l3 2" stroke={c} strokeWidth="2" strokeLinecap="round"/></svg>,
  money: (c='#5A6078') => <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="2" y="6" width="20" height="12" rx="2" stroke={c} strokeWidth="2"/><circle cx="12" cy="12" r="3" stroke={c} strokeWidth="2"/></svg>,
  pin: (c='#0B0F1F') => <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 22s7-7 7-13a7 7 0 10-14 0c0 6 7 13 7 13z" stroke={c} strokeWidth="2"/><circle cx="12" cy="9" r="2.4" stroke={c} strokeWidth="2"/></svg>,
  share: (c='#fff') => <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 3v12M8 7l4-4 4 4" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M5 13v6a2 2 0 002 2h10a2 2 0 002-2v-6" stroke={c} strokeWidth="2" strokeLinecap="round"/></svg>,
  mic: (c='#5A6078') => <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="9" y="3" width="6" height="12" rx="3" stroke={c} strokeWidth="2"/><path d="M5 11a7 7 0 0014 0M12 18v3" stroke={c} strokeWidth="2" strokeLinecap="round"/></svg>,
  send: (c='#fff') => <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M3 12L21 3l-7 18-3-7-8-2z" stroke={c} strokeWidth="2" strokeLinejoin="round" fill={c}/></svg>,
  trend: (c='#22C8A8') => <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M3 17l7-7 4 4 7-8" stroke={c} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M14 6h7v7" stroke={c} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  copy: (c='#4853F5') => <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="8" y="8" width="12" height="12" rx="2" stroke={c} strokeWidth="2"/><path d="M16 8V6a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2h2" stroke={c} strokeWidth="2"/></svg>,
  edit: (c='#4853F5') => <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M4 20h4L20 8l-4-4L4 16v4z" stroke={c} strokeWidth="2" strokeLinejoin="round"/></svg>,
  logo: (size=28) => (
    <div style={{width:size,height:size,borderRadius:size*0.28,background:'linear-gradient(135deg,#5B6BFF,#3640D4)',display:'grid',placeItems:'center',color:'#fff',fontFamily:'Plus Jakarta Sans',fontWeight:800,fontSize:size*0.5,boxShadow:'0 4px 12px rgba(72,83,245,0.4)'}}>Y</div>
  ),
};

// Avatar with deterministic color + initial
function Avatar({ name, size = 40, bg }) {
  const colors = ['#FF7A6B', '#22C8A8', '#FFC94A', '#B8A6FF', '#7BC6FF', '#FF9FB5', '#5B6BFF'];
  const initials = name.split(' ').map(s => s[0]).slice(0,2).join('').toUpperCase();
  const idx = name.charCodeAt(0) % colors.length;
  const color = bg || colors[idx];
  return (
    <div className="avatar" style={{
      width: size, height: size,
      borderRadius: size * 0.32,
      background: color,
      fontSize: size * 0.38,
    }}>{initials}</div>
  );
}

// Tab bar
function TabBar({ active, onChange }) {
  const tabs = [
    { id: 'home',     label: 'Asosiy',   icon: 'home' },
    { id: 'calendar', label: 'Yozilish', icon: 'calendar' },
    { id: 'add',      label: '',         icon: 'plus' },
    { id: 'clients',  label: 'Mijozlar', icon: 'users' },
    { id: 'stats',    label: 'Analitika',icon: 'chart' },
  ];
  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0,
      paddingBottom: 28, paddingTop: 10,
      background: 'rgba(255,255,255,0.88)',
      backdropFilter: 'blur(20px) saturate(180%)',
      WebkitBackdropFilter: 'blur(20px) saturate(180%)',
      borderTop: '0.5px solid rgba(11,15,31,0.08)',
      display: 'flex', justifyContent: 'space-around', alignItems: 'center',
      zIndex: 30,
    }}>
      {tabs.map(t => {
        const isAdd = t.id === 'add';
        const isActive = active === t.id;
        if (isAdd) {
          return (
            <div key={t.id} className="tap" onClick={() => onChange('add')} style={{
              width: 56, height: 56, borderRadius: 20,
              background: 'linear-gradient(135deg,#5B6BFF,#3640D4)',
              display: 'grid', placeItems: 'center',
              boxShadow: '0 10px 24px rgba(72,83,245,0.45), inset 0 1px 0 rgba(255,255,255,0.3)',
              marginTop: -22,
            }}>
              {Icon.plus('#fff')}
            </div>
          );
        }
        const color = isActive ? '#4853F5' : '#848AA2';
        return (
          <div key={t.id} className="tap" onClick={() => onChange(t.id)} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
            padding: '4px 8px', flex: 1,
          }}>
            {Icon[t.icon](color)}
            <span style={{ fontSize: 11, fontWeight: 600, color, fontFamily: 'Plus Jakarta Sans' }}>{t.label}</span>
          </div>
        );
      })}
    </div>
  );
}

// Screen header with back
function ScreenHeader({ title, onBack, right, subtitle }) {
  return (
    <div style={{ padding: '56px 20px 12px', display: 'flex', alignItems: 'flex-start', gap: 12, background: 'var(--ink-50)' }}>
      {onBack && (
        <div className="tap" onClick={onBack} style={{
          width: 40, height: 40, borderRadius: 14, background: 'white',
          display: 'grid', placeItems: 'center',
          boxShadow: '0 2px 8px rgba(11,15,31,0.06)', flexShrink: 0,
        }}>
          {Icon.back()}
        </div>
      )}
      <div style={{ flex: 1, paddingTop: 6 }}>
        <h1 style={{
          margin: 0, fontFamily: 'Plus Jakarta Sans', fontSize: 24, fontWeight: 800,
          letterSpacing: -0.6, color: '#0B0F1F',
        }}>{title}</h1>
        {subtitle && <div style={{ fontSize: 13, color: '#848AA2', marginTop: 2, fontWeight: 500 }}>{subtitle}</div>}
      </div>
      {right}
    </div>
  );
}

// Illustration for empty/hero states — abstract blob with emoji-free mark
function HeroBlob({ color1='#C7CCFF', color2='#E0E4FF', symbol, size=64 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.32,
      background: `linear-gradient(135deg, ${color1}, ${color2})`,
      display: 'grid', placeItems: 'center', flexShrink: 0,
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', width: size*0.8, height: size*0.8,
        borderRadius: '50%', background: 'rgba(255,255,255,0.35)',
        top: -size*0.3, right: -size*0.3,
      }} />
      <div style={{ position: 'relative', zIndex: 1 }}>{symbol}</div>
    </div>
  );
}

Object.assign(window, { Icon, Avatar, TabBar, ScreenHeader, HeroBlob });
