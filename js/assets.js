/**
 * Decorative Assets: Stickers and Palettes
 * All built as high-quality SVGs / Vector assets so they work 100% offline with zero dependencies!
 */

export const PALETTES = [
  { name: 'Pure White', bg: '#ffffff', textColor: '#111827' },
  { name: 'Warm Paper', bg: '#f5f0ea', textColor: '#292524' },
  { name: 'Cream Oat', bg: '#ede8df', textColor: '#3e362e' },
  { name: 'Vintage Sepia', bg: '#e8dcce', textColor: '#3c2a21' },
  { name: 'Soft Matcha', bg: '#e2ece4', textColor: '#1e3a2b' },
  { name: 'Blush Pink', bg: '#f9eae8', textColor: '#4a2528' },
  { name: 'Sky Lavender', bg: '#ebe8f9', textColor: '#2d2250' },
  { name: 'Slate Gray', bg: '#23272e', textColor: '#f8fafc' },
  { name: 'Midnight Pitch', bg: '#0b0d10', textColor: '#f1f5f9' },
  { name: 'Cyber Neon', bg: 'linear-gradient(135deg, #1f1c2c, #928dab)', textColor: '#ffffff' },
  { name: 'Sunset Glow', bg: 'linear-gradient(135deg, #ff9a9e, #fecfef)', textColor: '#2b1b17' },
  { name: 'Morning Mist', bg: 'linear-gradient(135deg, #e0c3fc, #8ec5fc)', textColor: '#1e293b' },
  { name: 'Golden Hour', bg: 'linear-gradient(135deg, #f6d365, #fda085)', textColor: '#3a1f04' },
  { name: 'Deep Forest', bg: 'linear-gradient(135deg, #134e5e, #71b280)', textColor: '#ffffff' }
];

export const FONTS = [
  { name: 'Editorial · Georgia', family: 'Georgia, "Times New Roman", serif' },
  { name: 'Moderna · Sistema', family: 'system-ui, -apple-system, "Segoe UI", sans-serif' },
  { name: 'Clásica · Times', family: "'Cinzel', 'Times New Roman', serif" },
  { name: 'Manuscrita', family: "'Caveat', 'Segoe Print', 'Brush Script MT', cursive" },
  { name: 'Máquina de escribir', family: "'Courier Prime', 'Courier New', monospace" },
  { name: 'Impacto', family: "'Oswald', Impact, sans-serif" },
  { name: 'Pixel · Minecraft', family: "'Press Start 2P', monospace" },
  { name: 'Bungee', family: "'Bungee', Impact, sans-serif" },
  { name: 'Espacial · Among Us', family: "'Russo One', 'Segoe UI', sans-serif" },
  { name: 'Cómic', family: "'Comic Sans MS', 'Comic Sans', 'Chalkboard SE', cursive" },
  { name: 'Manuscrita divertida', family: "'Ink Free', 'Segoe Print', 'Bradley Hand', cursive" }
];

// Helper to convert SVG string to safe Data URI
function svgToUri(svgString) {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svgString.trim())}`;
}

// Aesthetic stickers and decorative overlays
export const STICKERS = [
  {
    id: 'washi_tape_cream',
    title: 'Washi Tape (Crema)',
    category: 'Cinta',
    width: 220,
    height: 55,
    url: svgToUri(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 55" width="220" height="55">
        <polygon points="5,5 215,3 218,52 2,50" fill="#fdf6e2" opacity="0.88"/>
        <path d="M2,50 L5,5 L1,15 L6,25 L2,35 L5,45 Z" fill="#eae1c9"/>
        <path d="M215,3 L218,52 L214,40 L219,30 L213,20 L217,10 Z" fill="#eae1c9"/>
        <line x1="10" y1="28" x2="210" y2="28" stroke="#d5c8a5" stroke-dasharray="4,4" stroke-width="1.5" opacity="0.6"/>
      </svg>
    `)
  },
  {
    id: 'washi_tape_blush',
    title: 'Washi Tape (Rosa)',
    category: 'Cinta',
    width: 220,
    height: 55,
    url: svgToUri(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 55" width="220" height="55">
        <polygon points="4,4 216,6 214,50 3,48" fill="#fbcfe8" opacity="0.85"/>
        <path d="M3,48 L4,4 L1,14 L5,24 L1,34 L4,44 Z" fill="#f472b6" opacity="0.6"/>
        <path d="M216,6 L214,50 L217,40 L213,30 L218,20 L214,10 Z" fill="#f472b6" opacity="0.6"/>
      </svg>
    `)
  },
  {
    id: 'washi_tape_sage',
    title: 'Washi Tape (Salvia)',
    category: 'Cinta',
    width: 220,
    height: 55,
    url: svgToUri(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 55" width="220" height="55">
        <polygon points="5,4 215,6 217,51 3,49" fill="#d8e5d5" opacity="0.9"/>
        <path d="M3,49 L5,4 L1,16 L6,28 L1,40 L4,48 Z" fill="#a8c3a2" opacity="0.7"/>
        <path d="M215,6 L217,51 L213,39 L218,27 L212,15 L216,7 Z" fill="#a8c3a2" opacity="0.7"/>
        <g fill="#8fae89" opacity="0.55">
          <circle cx="40" cy="18" r="2.2"/><circle cx="80" cy="34" r="2.2"/>
          <circle cx="120" cy="16" r="2.2"/><circle cx="160" cy="36" r="2.2"/>
          <circle cx="196" cy="20" r="2.2"/>
        </g>
      </svg>
    `)
  },
  {
    id: 'washi_tape_terracotta',
    title: 'Washi Tape (Terracota)',
    category: 'Cinta',
    width: 220,
    height: 55,
    url: svgToUri(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 55" width="220" height="55">
        <polygon points="4,5 216,3 215,52 3,50" fill="#e8b79e" opacity="0.92"/>
        <path d="M3,50 L4,5 L1,17 L6,29 L1,41 L4,49 Z" fill="#c98060" opacity="0.65"/>
        <path d="M216,3 L215,52 L218,40 L213,28 L219,16 L215,6 Z" fill="#c98060" opacity="0.65"/>
        <path d="M30,28 H190" stroke="#f7e3d8" stroke-width="3" stroke-dasharray="10,7" opacity="0.8"/>
      </svg>
    `)
  },
  {
    id: 'corner_tape',
    title: 'Esquineros de Cinta',
    category: 'Cinta',
    width: 150,
    height: 150,
    url: svgToUri(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 150 150" width="150" height="150">
        <path d="M4,4 L56,4 L4,56 Z" fill="#f4ecd9" stroke="#e0d3b6" stroke-width="2"/>
        <path d="M146,146 L94,146 L146,94 Z" fill="#f4ecd9" stroke="#e0d3b6" stroke-width="2"/>
      </svg>
    `)
  },
  {
    id: 'stamp_scrl_aesthetic',
    title: 'Sello SCRL',
    category: 'Sello',
    width: 140,
    height: 140,
    url: svgToUri(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 140 140" width="140" height="140">
        <circle cx="70" cy="70" r="62" fill="none" stroke="#292524" stroke-width="3" stroke-dasharray="6,4"/>
        <circle cx="70" cy="70" r="52" fill="none" stroke="#292524" stroke-width="1.5"/>
        <text x="70" y="55" font-family="'Inter', sans-serif" font-size="12" font-weight="800" text-anchor="middle" fill="#292524" letter-spacing="2">CAROUSEL</text>
        <text x="70" y="76" font-family="'Playfair Display', serif" font-size="20" font-weight="700" text-anchor="middle" fill="#292524">N° 01</text>
        <text x="70" y="96" font-family="'Inter', sans-serif" font-size="10" font-weight="600" text-anchor="middle" fill="#292524" letter-spacing="3">AUTHENTIC</text>
      </svg>
    `)
  },
  {
    id: 'stamp_approved',
    title: 'Sello Aprobado',
    category: 'Sello',
    width: 140,
    height: 140,
    url: svgToUri(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 140 140" width="140" height="140">
        <circle cx="70" cy="70" r="60" fill="none" stroke="#b91c1c" stroke-width="4"/>
        <circle cx="70" cy="70" r="50" fill="none" stroke="#b91c1c" stroke-width="1.5" stroke-dasharray="3,3"/>
        <text x="70" y="64" font-family="'Oswald', Impact, sans-serif" font-size="21" font-weight="700" text-anchor="middle" fill="#b91c1c" letter-spacing="1">APPROVED</text>
        <text x="70" y="86" font-family="'Inter', sans-serif" font-size="11" font-weight="700" text-anchor="middle" fill="#b91c1c" letter-spacing="4">OK · SCRL</text>
      </svg>
    `)
  },
  {
    id: 'grid_note',
    title: 'Nota Cuadriculada',
    category: 'Papel',
    width: 200,
    height: 200,
    url: svgToUri(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
        <defs>
          <pattern id="paperGrid" width="16" height="16" patternUnits="userSpaceOnUse">
            <path d="M16 0 H0 V16" fill="none" stroke="#c8d3c6" stroke-width="1" opacity="0.8"/>
          </pattern>
        </defs>
        <rect x="6" y="10" width="188" height="184" rx="3" fill="#fbfaf6" stroke="#ddd8ca" stroke-width="2" transform="rotate(-2 100 100)"/>
        <rect x="6" y="10" width="188" height="184" rx="3" fill="url(#paperGrid)" transform="rotate(-2 100 100)"/>
        <rect x="66" y="4" width="70" height="18" fill="#f0e6cd" opacity="0.9" transform="rotate(3 100 12)"/>
      </svg>
    `)
  },
  {
    id: 'ticket_stub',
    title: 'Ticket',
    category: 'Etiqueta',
    width: 200,
    height: 90,
    url: svgToUri(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 90" width="200" height="90">
        <rect x="3" y="3" width="194" height="84" rx="8" fill="#1c1917"/>
        <circle cx="3" cy="45" r="7" fill="#fff" opacity="0.001"/>
        <path d="M120,3 V87" stroke="#57534e" stroke-width="2" stroke-dasharray="5,5"/>
        <text x="16" y="38" font-family="'Inter', sans-serif" font-size="11" font-weight="700" fill="#fafaf9" letter-spacing="3">ADMIT ONE</text>
        <text x="16" y="62" font-family="'Courier Prime', monospace" font-size="10" fill="#a8a29e">N° 00024</text>
        <text x="158" y="52" font-family="'Oswald', Impact, sans-serif" font-size="20" font-weight="700" fill="#fafaf9" text-anchor="middle">24A</text>
      </svg>
    `)
  },
  {
    id: 'label_price_tag',
    title: 'Etiqueta de Precio',
    category: 'Etiqueta',
    width: 150,
    height: 90,
    url: svgToUri(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 150 90" width="150" height="90">
        <path d="M18,16 L96,16 L132,45 L96,74 L18,74 Z" fill="#fef3c7" stroke="#d6bb7e" stroke-width="2" stroke-linejoin="round"/>
        <circle cx="34" cy="45" r="6" fill="none" stroke="#d6bb7e" stroke-width="2"/>
        <text x="52" y="40" font-family="'Courier Prime', monospace" font-size="12" fill="#78350f">handmade</text>
        <text x="52" y="62" font-family="'Oswald', Impact, sans-serif" font-size="18" font-weight="700" fill="#78350f">N° 08</text>
      </svg>
    `)
  },
  {
    id: 'label_no_filter',
    title: 'Etiqueta Sin Filtro',
    category: 'Etiqueta',
    width: 200,
    height: 50,
    url: svgToUri(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 50" width="200" height="50">
        <rect x="2" y="2" width="196" height="46" rx="23" fill="#111827"/>
        <text x="100" y="31" font-family="'Inter', sans-serif" font-size="15" font-weight="800" text-anchor="middle" fill="#f9fafb" letter-spacing="4">NO FILTER</text>
      </svg>
    `)
  },
  {
    id: 'label_issue',
    title: 'Etiqueta Issue',
    category: 'Etiqueta',
    width: 170,
    height: 60,
    url: svgToUri(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 170 60" width="170" height="60">
        <rect x="2" y="2" width="166" height="56" fill="none" stroke="#292524" stroke-width="2.5"/>
        <text x="12" y="27" font-family="'Inter', sans-serif" font-size="10" font-weight="700" fill="#292524" letter-spacing="3">SCR L</text>
        <text x="12" y="48" font-family="'Playfair Display', serif" font-size="18" font-weight="700" fill="#292524">ISSUE 08</text>
      </svg>
    `)
  },
  {
    id: 'star_five',
    title: 'Estrella',
    category: 'Dibujo',
    width: 110,
    height: 110,
    url: svgToUri(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 110 110" width="110" height="110">
        <path d="M55,8 L67,42 L103,42 L74,63 L85,97 L55,76 L25,97 L36,63 L7,42 L43,42 Z" fill="#f59e0b" stroke="#b45309" stroke-width="2" stroke-linejoin="round"/>
      </svg>
    `)
  },
  {
    id: 'doodle_heart',
    title: 'Corazón',
    category: 'Dibujo',
    width: 120,
    height: 110,
    url: svgToUri(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 110" width="120" height="110">
        <path d="M60,96 C30,74 8,56 8,36 C8,20 20,10 34,10 C46,10 55,18 60,28 C65,18 74,10 86,10 C100,10 112,20 112,36 C112,56 90,74 60,96 Z" fill="none" stroke="#e11d48" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `)
  },
  {
    id: 'doodle_arrow',
    title: 'Flecha',
    category: 'Dibujo',
    width: 170,
    height: 100,
    url: svgToUri(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 170 100" width="170" height="100">
        <path d="M12,84 C40,30 96,18 152,46" fill="none" stroke="#292524" stroke-width="4" stroke-linecap="round"/>
        <path d="M128,28 L154,46 L130,64" fill="none" stroke="#292524" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `)
  },
  {
    id: 'doodle_smiley',
    title: 'Carita',
    category: 'Dibujo',
    width: 120,
    height: 120,
    url: svgToUri(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">
        <circle cx="60" cy="60" r="50" fill="none" stroke="#292524" stroke-width="4"/>
        <circle cx="42" cy="50" r="4.5" fill="#292524"/>
        <circle cx="78" cy="50" r="4.5" fill="#292524"/>
        <path d="M38,70 C48,86 72,86 82,70" fill="none" stroke="#292524" stroke-width="4" stroke-linecap="round"/>
      </svg>
    `)
  },
  {
    id: 'quote_marks',
    title: 'Comillas',
    category: 'Dibujo',
    width: 120,
    height: 90,
    url: svgToUri(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 90" width="120" height="90">
        <path d="M14,72 C4,64 2,44 10,28 C18,12 32,4 44,6 L40,18 C30,20 22,28 20,38 C24,36 28,36 32,40 C38,46 38,58 32,66 C26,74 18,76 14,72 Z" fill="#292524"/>
        <path d="M74,72 C64,64 62,44 70,28 C78,12 92,4 104,6 L100,18 C90,20 82,28 80,38 C84,36 88,36 92,40 C98,46 98,58 92,66 C86,74 78,76 74,72 Z" fill="#292524"/>
      </svg>
    `)
  },
  {
    id: 'film_35mm_barcode',
    title: 'Código de Película 35mm',
    category: 'Vintage',
    width: 180,
    height: 60,
    url: svgToUri(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 60" width="180" height="60">
        <rect width="180" height="60" fill="#000000" rx="4"/>
        <text x="14" y="20" font-family="monospace" font-size="12" fill="#eab308" font-weight="bold">KODAK 400</text>
        <text x="135" y="20" font-family="monospace" font-size="14" fill="#eab308" font-weight="bold">24A</text>
        <g fill="#ffffff">
          <rect x="14" y="28" width="4" height="22"/>
          <rect x="22" y="28" width="2" height="22"/>
          <rect x="27" y="28" width="6" height="22"/>
          <rect x="36" y="28" width="3" height="22"/>
          <rect x="42" y="28" width="8" height="22"/>
          <rect x="53" y="28" width="2" height="22"/>
          <rect x="58" y="28" width="5" height="22"/>
          <rect x="66" y="28" width="7" height="22"/>
          <rect x="76" y="28" width="3" height="22"/>
          <rect x="82" y="28" width="5" height="22"/>
          <rect x="90" y="28" width="2" height="22"/>
          <rect x="95" y="28" width="6" height="22"/>
          <rect x="104" y="28" width="4" height="22"/>
          <rect x="111" y="28" width="8" height="22"/>
          <rect x="122" y="28" width="3" height="22"/>
        </g>
      </svg>
    `)
  },
  {
    id: 'polaroid_clip',
    title: 'Clip Plateado',
    category: 'Oficina',
    width: 50,
    height: 120,
    url: svgToUri(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 120" width="50" height="120">
        <path d="M15,35 L15,95 A12,12 0 0,0 39,95 L39,22 A18,18 0 0,0 3,22 L3,98 A24,24 0 0,0 51,98 L51,40" 
              fill="none" stroke="#71717a" stroke-width="5" stroke-linecap="round"/>
        <path d="M15,35 L15,95 A12,12 0 0,0 39,95 L39,22 A18,18 0 0,0 3,22 L3,98 A24,24 0 0,0 51,98 L51,40" 
              fill="none" stroke="#d4d4d8" stroke-width="2.5" stroke-linecap="round"/>
      </svg>
    `)
  }
];
