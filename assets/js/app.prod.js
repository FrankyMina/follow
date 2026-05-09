// App — production build (no TweaksPanel)
const DEFAULTS = {
  heroVariant: "chat",
  accent: "#b8923a",
  showAnnotations: true
};

function hexToRgba(hex, alpha) {
  const h = hex.replace('#', '');
  const bigint = parseInt(h.length === 3 ? h.split('').map(c => c+c).join('') : h, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8)  & 255;
  const b =  bigint        & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

function App() {
  React.useEffect(() => {
    document.documentElement.style.setProperty('--gold', DEFAULTS.accent);
    document.documentElement.style.setProperty('--gold-soft', hexToRgba(DEFAULTS.accent, 0.10));
  }, []);

  return React.createElement(
    React.Fragment,
    null,
    React.createElement(window.HeroChat, { tweaks: DEFAULTS }),
    React.createElement(window.LiveChatModal, null)
  );
}

ReactDOM.createRoot(document.getElementById('hero-root')).render(
  React.createElement(App, null)
);
