function _slicedToArray(r, e) { return _arrayWithHoles(r) || _iterableToArrayLimit(r, e) || _unsupportedIterableToArray(r, e) || _nonIterableRest(); }
function _nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function _unsupportedIterableToArray(r, a) { if (r) { if ("string" == typeof r) return _arrayLikeToArray(r, a); var t = {}.toString.call(r).slice(8, -1); return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? _arrayLikeToArray(r, a) : void 0; } }
function _arrayLikeToArray(r, a) { (null == a || a > r.length) && (a = r.length); for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e]; return n; }
function _iterableToArrayLimit(r, l) { var t = null == r ? null : "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"]; if (null != t) { var e, n, i, u, a = [], f = !0, o = !1; try { if (i = (t = t.call(r)).next, 0 === l) { if (Object(t) !== t) return; f = !1; } else for (; !(f = (e = i.call(t)).done) && (a.push(e.value), a.length !== l); f = !0); } catch (r) { o = !0, n = r; } finally { try { if (!f && null != t.return && (u = t.return(), Object(u) !== u)) return; } finally { if (o) throw n; } } return a; } }
function _arrayWithHoles(r) { if (Array.isArray(r)) return r; }
// Hero component with 3 variants
var _React = React,
  useState = _React.useState,
  useEffect = _React.useEffect;

// Conversation script for the live chat hero
var CHAT_SCRIPT = [{
  kind: 'day',
  text: 'Hoy · 10:32'
}, {
  kind: 'msg',
  side: 'bot',
  time: '10:32',
  typingMs: 1400,
  body: /*#__PURE__*/React.createElement(React.Fragment, null, "Hola Marisol, te recuerdo tu cita con el ", /*#__PURE__*/React.createElement("strong", null, "Dr. Ram\xEDrez"), " ma\xF1ana viernes 8 de mayo a las 11:00 am. \xBFConfirmas tu asistencia?")
}, {
  kind: 'msg',
  side: 'user',
  time: '10:34',
  typingMs: 1100,
  body: 'Sí, ahí estaré. Gracias 🙏'
}, {
  kind: 'msg',
  side: 'bot',
  time: '10:34',
  typingMs: 1300,
  body: /*#__PURE__*/React.createElement(React.Fragment, null, "Perfecto. Te env\xEDo la direcci\xF3n y un mapa dos horas antes. Si necesitas reagendar, responde ", /*#__PURE__*/React.createElement("strong", null, "REAGENDAR"), ".")
}, {
  kind: 'day',
  text: 'Viernes · 09:00'
}, {
  kind: 'msg',
  side: 'bot',
  time: '09:00',
  typingMs: 1500,
  body: /*#__PURE__*/React.createElement(React.Fragment, null, "Tu cita es en 2 horas. Av. Insurgentes Sur 1234, piso 4. ", /*#__PURE__*/React.createElement("em", null, "Ver mapa \u2192"))
}];
var READ_MS = 1500; // pause after a message before next typing starts
var RESET_MS = 4500; // pause at end before restart
var SCROLL_LAG = 80; // ms after render to scroll

function useChatScript(active) {
  var _React$useState = React.useState(0),
    _React$useState2 = _slicedToArray(_React$useState, 2),
    step = _React$useState2[0],
    setStep = _React$useState2[1];
  var _React$useState3 = React.useState(null),
    _React$useState4 = _slicedToArray(_React$useState3, 2),
    typingSide = _React$useState4[0],
    setTypingSide = _React$useState4[1];
  React.useEffect(function () {
    if (!active) return;
    var cancelled = false;
    var timeouts = [];
    var t = function t(fn, ms) {
      var id = setTimeout(function () {
        if (!cancelled) fn();
      }, ms);
      timeouts.push(id);
    };
    function runStep(i) {
      if (cancelled) return;
      if (i >= CHAT_SCRIPT.length) {
        t(function () {
          setStep(0);
          setTypingSide(null);
          runStep(0);
        }, RESET_MS);
        return;
      }
      var item = CHAT_SCRIPT[i];
      if (item.kind === 'day') {
        setTypingSide(null);
        setStep(i + 1);
        t(function () {
          return runStep(i + 1);
        }, 600);
      } else {
        setTypingSide(item.side);
        t(function () {
          if (cancelled) return;
          setTypingSide(null);
          setStep(i + 1);
          t(function () {
            return runStep(i + 1);
          }, READ_MS);
        }, item.typingMs);
      }
    }
    setStep(0);
    setTypingSide(null);
    t(function () {
      return runStep(0);
    }, 700);
    return function () {
      cancelled = true;
      timeouts.forEach(clearTimeout);
    };
  }, [active]);
  return {
    step: step,
    typingSide: typingSide
  };
}
function ChatPhone(_ref) {
  var _ref$active = _ref.active,
    active = _ref$active === void 0 ? true : _ref$active;
  var _useChatScript = useChatScript(active),
    step = _useChatScript.step,
    typingSide = _useChatScript.typingSide;
  var bodyRef = React.useRef(null);
  React.useEffect(function () {
    var id = setTimeout(function () {
      var el = bodyRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    }, SCROLL_LAG);
    return function () {
      return clearTimeout(id);
    };
  }, [step, typingSide]);
  var visible = CHAT_SCRIPT.slice(0, step);
  return /*#__PURE__*/React.createElement("div", {
    className: "phone-device"
  }, /*#__PURE__*/React.createElement("div", {
    className: "phone-screen"
  }, /*#__PURE__*/React.createElement("div", {
    className: "phone-statusbar"
  }, /*#__PURE__*/React.createElement("span", {
    className: "sb-time"
  }, "9:41"), /*#__PURE__*/React.createElement("span", {
    className: "sb-icons"
  }, /*#__PURE__*/React.createElement("span", {
    className: "sb-bars"
  }, /*#__PURE__*/React.createElement("span", null), /*#__PURE__*/React.createElement("span", null), /*#__PURE__*/React.createElement("span", null), /*#__PURE__*/React.createElement("span", null)), /*#__PURE__*/React.createElement("span", {
    className: "sb-batt"
  }, /*#__PURE__*/React.createElement("span", null)))), /*#__PURE__*/React.createElement("div", {
    className: "phone-frame"
  }, /*#__PURE__*/React.createElement("div", {
    className: "phone-head"
  }, /*#__PURE__*/React.createElement("div", {
    className: "phone-avatar"
  }, "f"), /*#__PURE__*/React.createElement("div", {
    className: "phone-head-text"
  }, /*#__PURE__*/React.createElement("div", {
    className: "phone-name"
  }, "Dr. Ram\xEDrez"), /*#__PURE__*/React.createElement("div", {
    className: "phone-status"
  }, /*#__PURE__*/React.createElement("span", {
    className: "dot"
  }), "En l\xEDnea")), /*#__PURE__*/React.createElement("span", {
    className: "phone-tag"
  }, "Auto")), /*#__PURE__*/React.createElement("div", {
    className: "phone-body",
    ref: bodyRef
  }, visible.map(function (item, i) {
    if (item.kind === 'day') {
      return /*#__PURE__*/React.createElement("div", {
        key: i,
        className: "msg-day chat-in"
      }, item.text);
    }
    return /*#__PURE__*/React.createElement("div", {
      key: i,
      className: "msg ".concat(item.side, " chat-in")
    }, item.side === 'bot' && /*#__PURE__*/React.createElement("span", {
      className: "bot-prefix"
    }, "\u2014 Follow \xB7 Auto"), item.body, /*#__PURE__*/React.createElement("span", {
      className: "meta"
    }, item.time, " \u2713\u2713"));
  }), typingSide && /*#__PURE__*/React.createElement("div", {
    className: "msg ".concat(typingSide, " typing-bubble chat-in")
  }, /*#__PURE__*/React.createElement("span", {
    className: "typing"
  }, /*#__PURE__*/React.createElement("span", null), /*#__PURE__*/React.createElement("span", null), /*#__PURE__*/React.createElement("span", null)))))));
}
function LiveChatModal() {
  var _React$useState5 = React.useState(false),
    _React$useState6 = _slicedToArray(_React$useState5, 2),
    open = _React$useState6[0],
    setOpen = _React$useState6[1];
  React.useEffect(function () {
    var onOpen = function onOpen() {
      return setOpen(true);
    };
    window.addEventListener('open-demo-modal', onOpen);
    return function () {
      return window.removeEventListener('open-demo-modal', onOpen);
    };
  }, []);
  React.useEffect(function () {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    var onKey = function onKey(e) {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return function () {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return /*#__PURE__*/React.createElement("div", {
    className: "demo-backdrop".concat(open ? ' open' : ''),
    onClick: function onClick(e) {
      if (e.currentTarget === e.target) setOpen(false);
    },
    "aria-hidden": !open
  }, open && /*#__PURE__*/React.createElement("button", {
    className: "demo-close",
    onClick: function onClick() {
      return setOpen(false);
    },
    "aria-label": "Cerrar demo"
  }, /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24",
    width: "18",
    height: "18",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.5",
    strokeLinecap: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M6 6l12 12M18 6L6 18"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "demo-modal"
  }, open && /*#__PURE__*/React.createElement(ChatPhone, {
    active: open
  })));
}
function HeroChat(_ref2) {
  var tweaks = _ref2.tweaks;
  return /*#__PURE__*/React.createElement("section", {
    className: "hero variant-a"
  }, /*#__PURE__*/React.createElement("div", {
    className: "hero-grid"
  }, /*#__PURE__*/React.createElement("div", {
    className: "hero-copy"
  }, /*#__PURE__*/React.createElement("p", {
    className: "eyebrow hero-eyebrow"
  }, "\u2014 Seguimiento autom\xE1tico \xB7 Sin c\xF3digo"), /*#__PURE__*/React.createElement("h1", {
    className: "hero-title"
  }, "Tus citas, confirmadas. Tus clientes, ", /*#__PURE__*/React.createElement("em", null, "de regreso"), "."), /*#__PURE__*/React.createElement("p", {
    className: "hero-sub"
  }, "Follow es el agente que confirma, recuerda y reagenda \u2014 por WhatsApp, SMS y email \u2014 para que ning\xFAn negocio o profesional pierda otra cita por falta de seguimiento."), /*#__PURE__*/React.createElement("div", {
    className: "hero-ctas"
  }, /*#__PURE__*/React.createElement("a", {
    href: "#empezar",
    className: "btn btn-primary"
  }, "Empezar prueba 14 d\xEDas ", /*#__PURE__*/React.createElement("span", {
    className: "arrow"
  }, "\u2192")), /*#__PURE__*/React.createElement("a", {
    href: "#calculadora",
    className: "btn btn-ghost"
  }, "Ver mis n\xFAmeros")), /*#__PURE__*/React.createElement("div", {
    className: "hero-trust"
  }, /*#__PURE__*/React.createElement("div", {
    className: "trust-item"
  }, /*#__PURE__*/React.createElement("span", {
    className: "trust-num"
  }, /*#__PURE__*/React.createElement("em", null, "\u221268%")), /*#__PURE__*/React.createElement("span", {
    className: "trust-label"
  }, "No-shows promedio")), /*#__PURE__*/React.createElement("div", {
    className: "trust-item"
  }, /*#__PURE__*/React.createElement("span", {
    className: "trust-num"
  }, "15 ", /*#__PURE__*/React.createElement("em", null, "min")), /*#__PURE__*/React.createElement("span", {
    className: "trust-label"
  }, "Setup completo")), /*#__PURE__*/React.createElement("div", {
    className: "trust-item"
  }, /*#__PURE__*/React.createElement("span", {
    className: "trust-num"
  }, "$0", /*#__PURE__*/React.createElement("em", null, ".")), /*#__PURE__*/React.createElement("span", {
    className: "trust-label"
  }, "Primeros 14 d\xEDas")))), /*#__PURE__*/React.createElement("div", {
    className: "hero-visual"
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "demo-cta",
    onClick: function onClick() {
      return window.dispatchEvent(new CustomEvent('open-demo-modal'));
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "demo-icon"
  }, /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24",
    fill: "currentColor"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M8 5v14l11-7z"
  }))), /*#__PURE__*/React.createElement("span", {
    className: "demo-text"
  }, /*#__PURE__*/React.createElement("span", {
    className: "demo-eyebrow"
  }, "\u2014 Demo en vivo"), /*#__PURE__*/React.createElement("span", {
    className: "demo-label"
  }, "Ver Follow ", /*#__PURE__*/React.createElement("em", null, "en acci\xF3n"))), /*#__PURE__*/React.createElement("span", {
    className: "demo-arrow"
  }, "\u2192")), tweaks.showAnnotations && /*#__PURE__*/React.createElement("div", {
    className: "hero-annotation top-left"
  }, "Env\xEDo autom\xE1tico", /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("strong", null, "\u221224 h")), tweaks.showAnnotations && /*#__PURE__*/React.createElement("div", {
    className: "hero-annotation bottom-right"
  }, "Cita confirmada", /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("strong", null, "sin intervenci\xF3n")), /*#__PURE__*/React.createElement(ChatPhone, null))));
}
function HeroStats(_ref3) {
  var tweaks = _ref3.tweaks;
  return /*#__PURE__*/React.createElement("section", {
    className: "hero variant-b"
  }, /*#__PURE__*/React.createElement("div", {
    className: "hero-grid"
  }, /*#__PURE__*/React.createElement("div", {
    className: "hero-copy"
  }, /*#__PURE__*/React.createElement("p", {
    className: "eyebrow hero-eyebrow"
  }, "\u2014 En vivo \xB7 Tablero Follow"), /*#__PURE__*/React.createElement("h1", {
    className: "hero-title"
  }, "Mide en pesos lo que tu agenda ", /*#__PURE__*/React.createElement("em", null, "recupera"), "."), /*#__PURE__*/React.createElement("p", {
    className: "hero-sub"
  }, "Follow no solo manda recordatorios \u2014 convierte cada cita salvada en una l\xEDnea de ingreso que puedes ver. WhatsApp, SMS y email automatizados, con tablero en tiempo real."), /*#__PURE__*/React.createElement("div", {
    className: "hero-ctas"
  }, /*#__PURE__*/React.createElement("a", {
    href: "#empezar",
    className: "btn btn-primary"
  }, "Empezar prueba 14 d\xEDas ", /*#__PURE__*/React.createElement("span", {
    className: "arrow"
  }, "\u2192")), /*#__PURE__*/React.createElement("a", {
    href: "#calculadora",
    className: "btn btn-ghost"
  }, "Calcular mi ROI")), /*#__PURE__*/React.createElement("div", {
    className: "hero-trust"
  }, /*#__PURE__*/React.createElement("div", {
    className: "trust-item"
  }, /*#__PURE__*/React.createElement("span", {
    className: "trust-num"
  }, "$", /*#__PURE__*/React.createElement("em", null, "9.4\xD7")), /*#__PURE__*/React.createElement("span", {
    className: "trust-label"
  }, "Retorno sobre el plan Pro")), /*#__PURE__*/React.createElement("div", {
    className: "trust-item"
  }, /*#__PURE__*/React.createElement("span", {
    className: "trust-num"
  }, /*#__PURE__*/React.createElement("em", null, "3"), " canales"), /*#__PURE__*/React.createElement("span", {
    className: "trust-label"
  }, "WhatsApp \xB7 SMS \xB7 Email")), /*#__PURE__*/React.createElement("div", {
    className: "trust-item"
  }, /*#__PURE__*/React.createElement("span", {
    className: "trust-num"
  }, "14 ", /*#__PURE__*/React.createElement("em", null, "d\xEDas")), /*#__PURE__*/React.createElement("span", {
    className: "trust-label"
  }, "Gratis \xB7 sin tarjeta")))), /*#__PURE__*/React.createElement("div", {
    className: "hero-visual"
  }, /*#__PURE__*/React.createElement("div", {
    className: "hero-stats-panel"
  }, /*#__PURE__*/React.createElement("div", {
    className: "hero-stats-head"
  }, /*#__PURE__*/React.createElement("h4", null, "Esta ", /*#__PURE__*/React.createElement("em", null, "semana")), /*#__PURE__*/React.createElement("span", {
    className: "live"
  }, /*#__PURE__*/React.createElement("span", {
    className: "dot"
  }), "En vivo")), /*#__PURE__*/React.createElement("div", {
    className: "stats-row"
  }, /*#__PURE__*/React.createElement("div", {
    className: "stat-block"
  }, /*#__PURE__*/React.createElement("span", {
    className: "v"
  }, /*#__PURE__*/React.createElement("em", null, "$23,520")), /*#__PURE__*/React.createElement("span", {
    className: "l"
  }, "Ingreso rescatado"), /*#__PURE__*/React.createElement("span", {
    className: "delta"
  }, "\u2191 18% vs semana pasada")), /*#__PURE__*/React.createElement("div", {
    className: "stat-block"
  }, /*#__PURE__*/React.createElement("span", {
    className: "v"
  }, /*#__PURE__*/React.createElement("em", null, "19")), /*#__PURE__*/React.createElement("span", {
    className: "l"
  }, "Citas salvadas"), /*#__PURE__*/React.createElement("span", {
    className: "delta"
  }, "\u2191 6 nuevas hoy")), /*#__PURE__*/React.createElement("div", {
    className: "stat-block"
  }, /*#__PURE__*/React.createElement("span", {
    className: "v"
  }, "142"), /*#__PURE__*/React.createElement("span", {
    className: "l"
  }, "Confirmaciones"), /*#__PURE__*/React.createElement("span", {
    className: "delta"
  }, "94% tasa de respuesta")), /*#__PURE__*/React.createElement("div", {
    className: "stat-block"
  }, /*#__PURE__*/React.createElement("span", {
    className: "v"
  }, "\u221268%"), /*#__PURE__*/React.createElement("span", {
    className: "l"
  }, "No-shows"), /*#__PURE__*/React.createElement("span", {
    className: "delta"
  }, "vs antes de Follow"))), /*#__PURE__*/React.createElement("div", {
    className: "stats-feed"
  }, /*#__PURE__*/React.createElement("div", {
    className: "stats-feed-row"
  }, /*#__PURE__*/React.createElement("span", {
    className: "ts"
  }, "10:42"), /*#__PURE__*/React.createElement("span", {
    className: "ic green"
  }, "\u2713"), /*#__PURE__*/React.createElement("span", null, "Marisol G. confirm\xF3 cita del viernes 11:00")), /*#__PURE__*/React.createElement("div", {
    className: "stats-feed-row"
  }, /*#__PURE__*/React.createElement("span", {
    className: "ts"
  }, "10:38"), /*#__PURE__*/React.createElement("span", {
    className: "ic"
  }, "\u21BA"), /*#__PURE__*/React.createElement("span", null, "Reagenda autom\xE1tica \xB7 Roberto M. \u2192 mar 13:30")), /*#__PURE__*/React.createElement("div", {
    className: "stats-feed-row"
  }, /*#__PURE__*/React.createElement("span", {
    className: "ts"
  }, "10:31"), /*#__PURE__*/React.createElement("span", {
    className: "ic green"
  }, "\u2713"), /*#__PURE__*/React.createElement("span", null, "Recordatorio enviado a 14 pacientes")))))));
}
function HeroType(_ref4) {
  var tweaks = _ref4.tweaks;
  return /*#__PURE__*/React.createElement("section", {
    className: "hero variant-c"
  }, /*#__PURE__*/React.createElement("div", {
    className: "hero-grid"
  }, /*#__PURE__*/React.createElement("div", {
    className: "hero-copy"
  }, /*#__PURE__*/React.createElement("p", {
    className: "eyebrow hero-eyebrow"
  }, "\u2014 Follow \xB7 v1 \xB7 2026"), /*#__PURE__*/React.createElement("h1", {
    className: "hero-title"
  }, "Nadie deber\xEDa perder una cita por falta de un ", /*#__PURE__*/React.createElement("em", null, "mensaje"), "."), /*#__PURE__*/React.createElement("p", {
    className: "hero-sub",
    style: {
      fontSize: '20px',
      maxWidth: '720px'
    }
  }, "Follow es el agente de seguimiento autom\xE1tico para m\xE9dicos, dentistas, abogados y profesionales independientes. Confirma, recuerda y reagenda \u2014 por WhatsApp, SMS y email \u2014 sin que muevas un dedo."), /*#__PURE__*/React.createElement("div", {
    className: "hero-ctas"
  }, /*#__PURE__*/React.createElement("a", {
    href: "#empezar",
    className: "btn btn-primary"
  }, "Empezar prueba 14 d\xEDas ", /*#__PURE__*/React.createElement("span", {
    className: "arrow"
  }, "\u2192")), /*#__PURE__*/React.createElement("a", {
    href: "#como-funciona",
    className: "btn btn-ghost"
  }, "Ver c\xF3mo funciona")), /*#__PURE__*/React.createElement("div", {
    className: "hero-c-meta"
  }, /*#__PURE__*/React.createElement("div", {
    className: "item"
  }, /*#__PURE__*/React.createElement("span", {
    className: "lbl"
  }, "Para"), /*#__PURE__*/React.createElement("span", {
    className: "val"
  }, "Profesionales ", /*#__PURE__*/React.createElement("em", null, "independientes")), /*#__PURE__*/React.createElement("p", null, "M\xE9dicos, dentistas, abogados, coaches, est\xE9tica.")), /*#__PURE__*/React.createElement("div", {
    className: "item"
  }, /*#__PURE__*/React.createElement("span", {
    className: "lbl"
  }, "Canales"), /*#__PURE__*/React.createElement("span", {
    className: "val"
  }, /*#__PURE__*/React.createElement("em", null, "WhatsApp"), ", SMS, Email"), /*#__PURE__*/React.createElement("p", null, "El cliente recibe el mensaje donde ya est\xE1.")), /*#__PURE__*/React.createElement("div", {
    className: "item"
  }, /*#__PURE__*/React.createElement("span", {
    className: "lbl"
  }, "Resultado"), /*#__PURE__*/React.createElement("span", {
    className: "val"
  }, /*#__PURE__*/React.createElement("em", null, "\u221268%"), " no-shows"), /*#__PURE__*/React.createElement("p", null, "Promedio en consultorios despu\xE9s de 90 d\xEDas.")), /*#__PURE__*/React.createElement("div", {
    className: "item"
  }, /*#__PURE__*/React.createElement("span", {
    className: "lbl"
  }, "Setup"), /*#__PURE__*/React.createElement("span", {
    className: "val"
  }, /*#__PURE__*/React.createElement("em", null, "15"), " minutos"), /*#__PURE__*/React.createElement("p", null, "Sin c\xF3digo, sin contratos. Cancelas cuando quieras."))))));
}
window.HeroChat = HeroChat;
window.HeroStats = HeroStats;
window.HeroType = HeroType;
window.LiveChatModal = LiveChatModal;
