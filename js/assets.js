/**
 * Sample Assets: Stickers, Frames, Sample Photos, and Palettes
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
  { name: 'Editorial · Georgia', family: "'Playfair Display', Georgia, serif" },
  { name: 'Moderna · Sistema', family: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" },
  { name: 'Clásica · Times', family: "'Cinzel', 'Times New Roman', serif" },
  { name: 'Manuscrita', family: "'Caveat', 'Segoe Print', 'Brush Script MT', cursive" },
  { name: 'Máquina de escribir', family: "'Courier Prime', 'Courier New', monospace" },
  { name: 'Impacto', family: "'Oswald', Impact, sans-serif" }
];

// Helper to convert SVG string to safe Data URI
function svgToUri(svgString) {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svgString.trim())}`;
}

// Procedural sample photography-style illustrations (High-resolution 1600x1200 SVGs with lush gradients)
export const SAMPLE_PHOTOS = [
  {
    id: 'photo_mountain',
    title: 'Alpine Panorama',
    category: 'Landscape',
    aspect: 16 / 9,
    url: svgToUri(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" width="1600" height="900">
        <defs>
          <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#fd746c"/>
            <stop offset="35%" stop-color="#ff9068"/>
            <stop offset="70%" stop-color="#ffb199"/>
            <stop offset="100%" stop-color="#ffe6d9"/>
          </linearGradient>
          <linearGradient id="sun" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#fff5c0"/>
            <stop offset="100%" stop-color="#ff9a44"/>
          </linearGradient>
          <linearGradient id="mtn1" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#3b3b58"/>
            <stop offset="100%" stop-color="#1e1e30"/>
          </linearGradient>
          <linearGradient id="mtn2" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#6c5b7b"/>
            <stop offset="100%" stop-color="#355c7d"/>
          </linearGradient>
          <linearGradient id="lake" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#c06c84"/>
            <stop offset="100%" stop-color="#355c7d"/>
          </linearGradient>
        </defs>
        <rect width="1600" height="900" fill="url(#sky)"/>
        <circle cx="800" cy="460" r="160" fill="url(#sun)" opacity="0.85"/>
        <polygon points="-50,650 300,320 650,650" fill="url(#mtn2)" opacity="0.8"/>
        <polygon points="500,680 950,260 1400,680" fill="url(#mtn2)" opacity="0.9"/>
        <polygon points="1100,680 1450,380 1800,680" fill="url(#mtn2)" opacity="0.7"/>
        <polygon points="150,750 550,390 950,750" fill="url(#mtn1)"/>
        <polygon points="800,750 1200,430 1650,750" fill="url(#mtn1)"/>
        <!-- Snow caps -->
        <polygon points="950,260 900,310 930,340 960,320 980,350 1020,310" fill="#ffffff" opacity="0.95"/>
        <polygon points="550,390 510,440 540,460 560,440 580,470 600,430" fill="#ffffff" opacity="0.9"/>
        <rect y="680" width="1600" height="220" fill="url(#lake)"/>
        <!-- Reflections -->
        <ellipse cx="800" cy="740" rx="140" ry="25" fill="#ffe6d9" opacity="0.35"/>
        <!-- Pine silhouettes -->
        <path d="M50 780 L70 700 L90 780 Z M120 800 L145 690 L170 800 Z M220 820 L240 730 L260 820 Z M1400 810 L1420 720 L1440 810 Z M1500 790 L1525 680 L1550 790 Z" fill="#141420"/>
      </svg>
    `)
  },
  {
    id: 'photo_ocean',
    title: 'Pacific Coastline',
    category: 'Nature',
    aspect: 16 / 9,
    url: svgToUri(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" width="1600" height="900">
        <defs>
          <linearGradient id="sky2" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#0f2027"/>
            <stop offset="50%" stop-color="#203a43"/>
            <stop offset="100%" stop-color="#2c5364"/>
          </linearGradient>
          <linearGradient id="sea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#1cb5e0"/>
            <stop offset="100%" stop-color="#000046"/>
          </linearGradient>
          <linearGradient id="sand" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stop-color="#eacda3"/>
            <stop offset="100%" stop-color="#d6ae7b"/>
          </linearGradient>
        </defs>
        <rect width="1600" height="900" fill="url(#sky2)"/>
        <circle cx="1200" cy="280" r="80" fill="#fff" opacity="0.9"/>
        <rect y="480" width="1600" height="420" fill="url(#sea)"/>
        <path d="M0 650 Q 400 580 800 680 T 1600 620 L 1600 900 L 0 900 Z" fill="url(#sand)"/>
        <path d="M0 635 Q 400 565 800 665 T 1600 605" stroke="#ffffff" stroke-width="8" fill="none" opacity="0.7"/>
        <path d="M0 610 Q 380 545 820 645 T 1600 585" stroke="#ffffff" stroke-width="4" fill="none" opacity="0.4"/>
      </svg>
    `)
  },
  {
    id: 'photo_minimal_arch',
    title: 'Minimalist Architecture',
    category: 'Architecture',
    aspect: 4 / 5,
    url: svgToUri(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1350" width="1080" height="1350">
        <defs>
          <linearGradient id="archSky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#6190e8"/>
            <stop offset="100%" stop-color="#a7bfe8"/>
          </linearGradient>
          <linearGradient id="wall1" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#fafafa"/>
            <stop offset="100%" stop-color="#e5e5e5"/>
          </linearGradient>
          <linearGradient id="wall2" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stop-color="#d4d4d4"/>
            <stop offset="100%" stop-color="#a3a3a3"/>
          </linearGradient>
          <linearGradient id="terracotta" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#d97736"/>
            <stop offset="100%" stop-color="#a84e1b"/>
          </linearGradient>
        </defs>
        <rect width="1080" height="1350" fill="url(#archSky)"/>
        <polygon points="0,500 580,200 580,1350 0,1350" fill="url(#wall1)"/>
        <polygon points="580,200 1080,480 1080,1350 580,1350" fill="url(#wall2)"/>
        <!-- Arch doorway -->
        <path d="M220,1350 L220,850 A120,120 0 0,1 460,850 L460,1350 Z" fill="#18181b"/>
        <!-- Terracotta plant pot -->
        <path d="M720,1200 L760,1350 L880,1350 L920,1200 Z" fill="url(#terracotta)"/>
        <!-- Palm leaf shadow -->
        <path d="M600,100 Q 800,400 950,900" stroke="#333333" stroke-width="28" stroke-linecap="round" opacity="0.25"/>
        <path d="M700,250 Q 850,550 1020,950" stroke="#333333" stroke-width="22" stroke-linecap="round" opacity="0.2"/>
      </svg>
    `)
  },
  {
    id: 'photo_editorial_portrait',
    title: 'Editorial Muse',
    category: 'Portrait',
    aspect: 4 / 5,
    url: svgToUri(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1350" width="1080" height="1350">
        <defs>
          <linearGradient id="bgPort" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#e0d7c7"/>
            <stop offset="100%" stop-color="#c8bca9"/>
          </linearGradient>
        </defs>
        <rect width="1080" height="1350" fill="url(#bgPort)"/>
        <!-- Abstract fashion silhouette -->
        <circle cx="540" cy="460" r="180" fill="#2d2926"/>
        <path d="M420,400 C430,300 650,300 660,400 C670,480 620,560 540,560 C460,560 410,480 420,400 Z" fill="#d4a373"/>
        <path d="M300,1350 L340,800 C360,700 720,700 740,800 L780,1350 Z" fill="#1c1917"/>
        <!-- Gold necklace / luxury accent -->
        <ellipse cx="540" cy="720" rx="90" ry="40" fill="none" stroke="#d4af37" stroke-width="12"/>
        <circle cx="540" cy="760" r="16" fill="#d4af37"/>
        <!-- Oversized sunglasses -->
        <rect x="440" y="440" width="90" height="50" rx="14" fill="#09090b"/>
        <rect x="550" y="440" width="90" height="50" rx="14" fill="#09090b"/>
        <line x1="530" y1="460" x2="550" y2="460" stroke="#09090b" stroke-width="8"/>
      </svg>
    `)
  },
  {
    id: 'photo_analog_grain',
    title: 'Golden Dunes',
    category: 'Landscape',
    aspect: 16 / 9,
    url: svgToUri(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" width="1600" height="900">
        <defs>
          <linearGradient id="desertSky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#4a5568"/>
            <stop offset="60%" stop-color="#ed8936"/>
            <stop offset="100%" stop-color="#fbd38d"/>
          </linearGradient>
          <linearGradient id="dune1" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stop-color="#dd6b20"/>
            <stop offset="100%" stop-color="#7b341e"/>
          </linearGradient>
          <linearGradient id="dune2" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stop-color="#c05621"/>
            <stop offset="100%" stop-color="#9c4221"/>
          </linearGradient>
        </defs>
        <rect width="1600" height="900" fill="url(#desertSky)"/>
        <circle cx="450" cy="400" r="120" fill="#feebc8" opacity="0.9"/>
        <path d="M0,600 Q 400,450 900,680 T 1600,520 L 1600,900 L 0,900 Z" fill="url(#dune2)"/>
        <path d="M0,720 Q 600,560 1200,750 T 1600,680 L 1600,900 L 0,900 Z" fill="url(#dune1)"/>
      </svg>
    `)
  }
];

// Aesthetic stickers and decorative overlays
export const STICKERS = [
  {
    id: 'washi_tape_cream',
    title: 'Washi Tape (Cream)',
    category: 'Tape',
    width: 220,
    height: 55,
    url: svgToUri(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 55" width="220" height="55">
        <polygon points="5,5 215,3 218,52 2,50" fill="#fdf6e2" opacity="0.88"/>
        <!-- Torn edges -->
        <path d="M2,50 L5,5 L1,15 L6,25 L2,35 L5,45 Z" fill="#eae1c9"/>
        <path d="M215,3 L218,52 L214,40 L219,30 L213,20 L217,10 Z" fill="#eae1c9"/>
        <!-- Texture grid -->
        <line x1="10" y1="28" x2="210" y2="28" stroke="#d5c8a5" stroke-dasharray="4,4" stroke-width="1.5" opacity="0.6"/>
      </svg>
    `)
  },
  {
    id: 'washi_tape_blush',
    title: 'Washi Tape (Blush)',
    category: 'Tape',
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
    id: 'stamp_scrl_aesthetic',
    title: 'SCRL Issue Stamp',
    category: 'Stamp',
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
    id: 'starburst_retro',
    title: 'Retro Sparkle',
    category: 'Symbol',
    width: 100,
    height: 100,
    url: svgToUri(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
        <path d="M50,0 Q50,50 100,50 Q50,50 50,100 Q50,50 0,50 Q50,50 50,0 Z" fill="#18181b"/>
        <circle cx="85" cy="15" r="5" fill="#18181b"/>
        <circle cx="15" cy="85" r="5" fill="#18181b"/>
      </svg>
    `)
  },
  {
    id: 'film_35mm_barcode',
    title: '35mm Film Barcode',
    category: 'Vintage',
    width: 180,
    height: 60,
    url: svgToUri(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 60" width="180" height="60">
        <rect width="180" height="60" fill="#000000" rx="4"/>
        <text x="14" y="20" font-family="monospace" font-size="12" fill="#eab308" font-weight="bold">KODAK 400</text>
        <text x="135" y="20" font-family="monospace" font-size="14" fill="#eab308" font-weight="bold">24A</text>
        <!-- Barcode lines -->
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
    title: 'Paperclip (Silver)',
    category: 'Office',
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
