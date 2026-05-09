// Hero component with 3 variants
const { useState, useEffect } = React;

// Conversation script for the live chat hero
const CHAT_SCRIPT = [
  { kind: 'day', text: 'Hoy · 10:32' },
  { kind: 'msg', side: 'bot', time: '10:32', typingMs: 1400, body: (
    <>Hola Marisol, te recuerdo tu cita con el <strong>Dr. Ramírez</strong> mañana viernes 8 de mayo a las 11:00 am. ¿Confirmas tu asistencia?</>
  ) },
  { kind: 'msg', side: 'user', time: '10:34', typingMs: 1100, body: 'Sí, ahí estaré. Gracias 🙏' },
  { kind: 'msg', side: 'bot', time: '10:34', typingMs: 1300, body: (
    <>Perfecto. Te envío la dirección y un mapa dos horas antes. Si necesitas reagendar, responde <strong>REAGENDAR</strong>.</>
  ) },
  { kind: 'day', text: 'Viernes · 09:00' },
  { kind: 'msg', side: 'bot', time: '09:00', typingMs: 1500, body: (
    <>Tu cita es en 2 horas. Av. Insurgentes Sur 1234, piso 4. <em>Ver mapa →</em></>
  ) },
];

const READ_MS = 1500;       // pause after a message before next typing starts
const RESET_MS = 4500;      // pause at end before restart
const SCROLL_LAG = 80;       // ms after render to scroll

function useChatScript(active) {
  const [step, setStep] = React.useState(0);
  const [typingSide, setTypingSide] = React.useState(null);

  React.useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const timeouts = [];
    const t = (fn, ms) => { const id = setTimeout(() => { if (!cancelled) fn(); }, ms); timeouts.push(id); };

    function runStep(i) {
      if (cancelled) return;
      if (i >= CHAT_SCRIPT.length) {
        t(() => { setStep(0); setTypingSide(null); runStep(0); }, RESET_MS);
        return;
      }
      const item = CHAT_SCRIPT[i];
      if (item.kind === 'day') {
        setTypingSide(null);
        setStep(i + 1);
        t(() => runStep(i + 1), 600);
      } else {
        setTypingSide(item.side);
        t(() => {
          if (cancelled) return;
          setTypingSide(null);
          setStep(i + 1);
          t(() => runStep(i + 1), READ_MS);
        }, item.typingMs);
      }
    }
    setStep(0);
    setTypingSide(null);
    t(() => runStep(0), 700);
    return () => { cancelled = true; timeouts.forEach(clearTimeout); };
  }, [active]);

  return { step, typingSide };
}

function ChatPhone({ active = true }) {
  const { step, typingSide } = useChatScript(active);
  const bodyRef = React.useRef(null);

  React.useEffect(() => {
    const id = setTimeout(() => {
      const el = bodyRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    }, SCROLL_LAG);
    return () => clearTimeout(id);
  }, [step, typingSide]);

  const visible = CHAT_SCRIPT.slice(0, step);

  return (
    <div className="phone-device">
      <div className="phone-screen">
        <div className="phone-statusbar">
          <span className="sb-time">9:41</span>
          <span className="sb-icons">
            <span className="sb-bars"><span></span><span></span><span></span><span></span></span>
            <span className="sb-batt"><span></span></span>
          </span>
        </div>
        <div className="phone-frame">
          <div className="phone-head">
            <div className="phone-avatar">f</div>
            <div className="phone-head-text">
              <div className="phone-name">Dr. Ramírez</div>
              <div className="phone-status"><span className="dot"></span>En línea</div>
            </div>
            <span className="phone-tag">Auto</span>
          </div>
          <div className="phone-body" ref={bodyRef}>
            {visible.map((item, i) => {
              if (item.kind === 'day') {
                return <div key={i} className="msg-day chat-in">{item.text}</div>;
              }
              return (
                <div key={i} className={`msg ${item.side} chat-in`}>
                  {item.side === 'bot' && <span className="bot-prefix">— Follow · Auto</span>}
                  {item.body}
                  <span className="meta">{item.time} ✓✓</span>
                </div>
              );
            })}
            {typingSide && (
              <div className={`msg ${typingSide} typing-bubble chat-in`}>
                <span className="typing"><span></span><span></span><span></span></span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function LiveChatModal() {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener('open-demo-modal', onOpen);
    return () => window.removeEventListener('open-demo-modal', onOpen);
  }, []);

  React.useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className={`demo-backdrop${open ? ' open' : ''}`} onClick={(e) => { if (e.currentTarget === e.target) setOpen(false); }} aria-hidden={!open}>
      {open && (
        <button className="demo-close" onClick={() => setOpen(false)} aria-label="Cerrar demo">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
        </button>
      )}
      <div className="demo-modal">
        {open && <ChatPhone active={open} />}
      </div>
    </div>
  );
}

function HeroChat({ tweaks }) {
  return (
    <section className="hero variant-a">
      <div className="hero-grid">
        <div className="hero-copy">
          <p className="eyebrow hero-eyebrow">— Seguimiento automático · Sin código</p>
          <h1 className="hero-title">
            Tus citas, confirmadas. Tus clientes, <em>de regreso</em>.
          </h1>
          <p className="hero-sub">
            Follow es el agente que confirma, recuerda y reagenda — por WhatsApp, SMS y email — para que ningún negocio o profesional pierda otra cita por falta de seguimiento.
          </p>
          <div className="hero-ctas">
            <a href="#empezar" className="btn btn-primary">Empezar prueba 14 días <span className="arrow">→</span></a>
            <a href="#calculadora" className="btn btn-ghost">Ver mis números</a>
          </div>
          <div className="hero-trust">
            <div className="trust-item">
              <span className="trust-num"><em>−68%</em></span>
              <span className="trust-label">No-shows promedio</span>
            </div>
            <div className="trust-item">
              <span className="trust-num">15 <em>min</em></span>
              <span className="trust-label">Setup completo</span>
            </div>
            <div className="trust-item">
              <span className="trust-num">$0<em>.</em></span>
              <span className="trust-label">Primeros 14 días</span>
            </div>
          </div>
        </div>

        <div className="hero-visual">
          <button
            type="button"
            className="demo-cta"
            onClick={() => window.dispatchEvent(new CustomEvent('open-demo-modal'))}
          >
            <span className="demo-icon">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
            </span>
            <span className="demo-text">
              <span className="demo-eyebrow">— Demo en vivo</span>
              <span className="demo-label">Ver Follow <em>en acción</em></span>
            </span>
            <span className="demo-arrow">→</span>
          </button>

          {tweaks.showAnnotations && (
            <div className="hero-annotation top-left">
              Envío automático<br/><strong>−24 h</strong>
            </div>
          )}
          {tweaks.showAnnotations && (
            <div className="hero-annotation bottom-right">
              Cita confirmada<br/><strong>sin intervención</strong>
            </div>
          )}

          <ChatPhone />
        </div>
      </div>
    </section>
  );
}

function HeroStats({ tweaks }) {
  return (
    <section className="hero variant-b">
      <div className="hero-grid">
        <div className="hero-copy">
          <p className="eyebrow hero-eyebrow">— En vivo · Tablero Follow</p>
          <h1 className="hero-title">
            Mide en pesos lo que tu agenda <em>recupera</em>.
          </h1>
          <p className="hero-sub">
            Follow no solo manda recordatorios — convierte cada cita salvada en una línea de ingreso que puedes ver. WhatsApp, SMS y email automatizados, con tablero en tiempo real.
          </p>
          <div className="hero-ctas">
            <a href="#empezar" className="btn btn-primary">Empezar prueba 14 días <span className="arrow">→</span></a>
            <a href="#calculadora" className="btn btn-ghost">Calcular mi ROI</a>
          </div>
          <div className="hero-trust">
            <div className="trust-item">
              <span className="trust-num">$<em>9.4×</em></span>
              <span className="trust-label">Retorno sobre el plan Pro</span>
            </div>
            <div className="trust-item">
              <span className="trust-num"><em>3</em> canales</span>
              <span className="trust-label">WhatsApp · SMS · Email</span>
            </div>
            <div className="trust-item">
              <span className="trust-num">14 <em>días</em></span>
              <span className="trust-label">Gratis · sin tarjeta</span>
            </div>
          </div>
        </div>

        <div className="hero-visual">
          <div className="hero-stats-panel">
            <div className="hero-stats-head">
              <h4>Esta <em>semana</em></h4>
              <span className="live"><span className="dot"></span>En vivo</span>
            </div>

            <div className="stats-row">
              <div className="stat-block">
                <span className="v"><em>$23,520</em></span>
                <span className="l">Ingreso rescatado</span>
                <span className="delta">↑ 18% vs semana pasada</span>
              </div>
              <div className="stat-block">
                <span className="v"><em>19</em></span>
                <span className="l">Citas salvadas</span>
                <span className="delta">↑ 6 nuevas hoy</span>
              </div>
              <div className="stat-block">
                <span className="v">142</span>
                <span className="l">Confirmaciones</span>
                <span className="delta">94% tasa de respuesta</span>
              </div>
              <div className="stat-block">
                <span className="v">−68%</span>
                <span className="l">No-shows</span>
                <span className="delta">vs antes de Follow</span>
              </div>
            </div>

            <div className="stats-feed">
              <div className="stats-feed-row">
                <span className="ts">10:42</span>
                <span className="ic green">✓</span>
                <span>Marisol G. confirmó cita del viernes 11:00</span>
              </div>
              <div className="stats-feed-row">
                <span className="ts">10:38</span>
                <span className="ic">↺</span>
                <span>Reagenda automática · Roberto M. → mar 13:30</span>
              </div>
              <div className="stats-feed-row">
                <span className="ts">10:31</span>
                <span className="ic green">✓</span>
                <span>Recordatorio enviado a 14 pacientes</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function HeroType({ tweaks }) {
  return (
    <section className="hero variant-c">
      <div className="hero-grid">
        <div className="hero-copy">
          <p className="eyebrow hero-eyebrow">— Follow · v1 · 2026</p>
          <h1 className="hero-title">
            Nadie debería perder una cita por falta de un <em>mensaje</em>.
          </h1>
          <p className="hero-sub" style={{ fontSize: '20px', maxWidth: '720px' }}>
            Follow es el agente de seguimiento automático para médicos, dentistas, abogados y profesionales independientes. Confirma, recuerda y reagenda — por WhatsApp, SMS y email — sin que muevas un dedo.
          </p>
          <div className="hero-ctas">
            <a href="#empezar" className="btn btn-primary">Empezar prueba 14 días <span className="arrow">→</span></a>
            <a href="#como-funciona" className="btn btn-ghost">Ver cómo funciona</a>
          </div>

          <div className="hero-c-meta">
            <div className="item">
              <span className="lbl">Para</span>
              <span className="val">Profesionales <em>independientes</em></span>
              <p>Médicos, dentistas, abogados, coaches, estética.</p>
            </div>
            <div className="item">
              <span className="lbl">Canales</span>
              <span className="val"><em>WhatsApp</em>, SMS, Email</span>
              <p>El cliente recibe el mensaje donde ya está.</p>
            </div>
            <div className="item">
              <span className="lbl">Resultado</span>
              <span className="val"><em>−68%</em> no-shows</span>
              <p>Promedio en consultorios después de 90 días.</p>
            </div>
            <div className="item">
              <span className="lbl">Setup</span>
              <span className="val"><em>15</em> minutos</span>
              <p>Sin código, sin contratos. Cancelas cuando quieras.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

window.HeroChat = HeroChat;
window.HeroStats = HeroStats;
window.HeroType = HeroType;
window.LiveChatModal = LiveChatModal;
