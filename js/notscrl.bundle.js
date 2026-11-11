/**
 * NotSCRL Studio - Standalone Client Bundle
 * 100% Offline & Compatible with both file:/// and http://
 */
(function() {
'use strict';

// ---- BEGIN js/zip.js ----
/**
 * Lightweight Zero-Dependency Client-Side ZIP File Generator
 * Implements the standard ZIP format (PK\x03\x04 and PK\x01\x02)
 * Supports browser CompressionStream ('deflate-raw') with fallback to STORE (uncompressed)
 */
class SimpleZip {
  constructor() {
    this.files = [];
  }

  /**
   * Add a file to the ZIP
   * @param {string} name - File name (e.g. 'slide_01.png')
   * @param {Uint8Array|ArrayBuffer|Blob} data - File binary data
   */
  async addFile(name, data) {
    let uint8;
    if (data instanceof Blob) {
      const buffer = await data.arrayBuffer();
      uint8 = new Uint8Array(buffer);
    } else if (data instanceof ArrayBuffer) {
      uint8 = new Uint8Array(data);
    } else if (data instanceof Uint8Array) {
      uint8 = data;
    } else {
      throw new Error('Unsupported data type for addFile');
    }

    this.files.push({
      name,
      data: uint8,
      date: new Date()
    });
  }

  // Calculate standard CRC32
  static crc32(data) {
    if (!SimpleZip._crcTable) {
      const table = new Uint32Array(256);
      for (let i = 0; i < 256; i++) {
        let c = i;
        for (let j = 0; j < 8; j++) {
          c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
        }
        table[i] = c >>> 0;
      }
      SimpleZip._crcTable = table;
    }

    let crc = 0xffffffff;
    const table = SimpleZip._crcTable;
    for (let i = 0; i < data.length; i++) {
      crc = table[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  /**
   * Generates the complete ZIP Blob
   * Uses STORE (method 0) which is universally compatible and blazing fast for PNG images
   * (PNG files are already compressed, so DEFLATE achieves negligible gain)
   * @returns {Blob}
   */
  generate() {
    const encoder = new TextEncoder();
    const parts = [];
    const centralDirectoryHeaders = [];
    let offset = 0;

    for (const file of this.files) {
      const nameBytes = encoder.encode(file.name);
      const data = file.data;
      const crc = SimpleZip.crc32(data);
      const size = data.length;

      // Dos Time & Date
      const d = file.date;
      const dosTime = ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)) & 0xffff;
      const dosDate = (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xffff;

      // Local File Header (30 bytes + name length)
      const localHeader = new Uint8Array(30 + nameBytes.length);
      const lhView = new DataView(localHeader.buffer);

      lhView.setUint32(0, 0x04034b50, true); // signature PK\x03\x04
      lhView.setUint16(4, 20, true);         // version needed (2.0)
      lhView.setUint16(6, 0x0800, true);     // flags: UTF-8 filename
      lhView.setUint16(8, 0, true);          // compression method: 0 (STORE)
      lhView.setUint16(10, dosTime, true);   // mod time
      lhView.setUint16(12, dosDate, true);   // mod date
      lhView.setUint32(14, crc, true);       // crc-32
      lhView.setUint32(18, size, true);      // compressed size
      lhView.setUint32(22, size, true);      // uncompressed size
      lhView.setUint16(26, nameBytes.length, true); // file name length
      lhView.setUint16(28, 0, true);         // extra field length
      localHeader.set(nameBytes, 30);

      parts.push(localHeader);
      parts.push(data);

      // Central Directory Header (46 bytes + name length)
      const cdHeader = new Uint8Array(46 + nameBytes.length);
      const cdView = new DataView(cdHeader.buffer);

      cdView.setUint32(0, 0x02014b50, true); // signature PK\x01\x02
      cdView.setUint16(4, 20, true);         // version made by
      cdView.setUint16(6, 20, true);         // version needed
      cdView.setUint16(8, 0x0800, true);     // flags: UTF-8
      cdView.setUint16(10, 0, true);         // method: STORE
      cdView.setUint16(12, dosTime, true);
      cdView.setUint16(14, dosDate, true);
      cdView.setUint32(16, crc, true);
      cdView.setUint32(20, size, true);
      cdView.setUint32(24, size, true);
      cdView.setUint16(28, nameBytes.length, true);
      cdView.setUint16(30, 0, true);         // extra field length
      cdView.setUint16(32, 0, true);         // file comment length
      cdView.setUint16(34, 0, true);         // disk number start
      cdView.setUint16(36, 0, true);         // internal file attributes
      cdView.setUint32(38, 0, true);         // external file attributes
      cdView.setUint32(42, offset, true);    // relative offset of local header
      cdHeader.set(nameBytes, 46);

      centralDirectoryHeaders.push(cdHeader);
      offset += localHeader.length + data.length;
    }

    const cdOffset = offset;
    let cdSize = 0;
    for (const cdh of centralDirectoryHeaders) {
      parts.push(cdh);
      cdSize += cdh.length;
    }

    // End of Central Directory Record (22 bytes)
    const eocd = new Uint8Array(22);
    const eocdView = new DataView(eocd.buffer);
    eocdView.setUint32(0, 0x06054b50, true); // signature PK\x05\x06
    eocdView.setUint16(4, 0, true);          // disk number
    eocdView.setUint16(6, 0, true);          // disk with central directory
    eocdView.setUint16(8, this.files.length, true);  // number of records on this disk
    eocdView.setUint16(10, this.files.length, true); // total number of records
    eocdView.setUint32(12, cdSize, true);    // size of central directory
    eocdView.setUint32(16, cdOffset, true);  // offset of central directory
    eocdView.setUint16(20, 0, true);         // comment length

    parts.push(eocd);

    return new Blob(parts, { type: 'application/zip' });
  }
}

// ---- END js/zip.js ----

// ---- BEGIN js/assets.js ----
/**
 * Decorative Assets: Stickers and Palettes
 * All built as high-quality SVGs / Vector assets so they work 100% offline with zero dependencies!
 */

const PALETTES = [
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

const FONTS = [
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

// Aesthetic stickers and decorative overlays
const STICKERS = [
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

// ---- END js/assets.js ----

// ---- BEGIN js/objects.js ----
/**
 * Canvas Object Layer System
 * Supports Images with Custom Shape Clipping (Circle, Star, Heart, Arch, Flower),
 * Frames (Polaroid, Film 35mm), Typography, and Stickers.
 */

let nextId = 1;

class CanvasItem {
  constructor(type, x, y, width, height) {
    this.id = 'item_' + (nextId++);
    this.type = type; // 'image', 'text', 'sticker'
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.rotation = 0; // degrees
    this.opacity = 1.0;
    this.zIndex = 0;
    this.isLocked = false;
    this.shadow = {
      enabled: false,
      color: 'rgba(0, 0, 0, 0.35)',
      blur: 24,
      offsetX: 0,
      offsetY: 10
    };
  }

  get centerX() {
    return this.x + this.width / 2;
  }
  get centerY() {
    return this.y + this.height / 2;
  }

  globalToLocal(gx, gy) {
    const cx = this.centerX;
    const cy = this.centerY;
    const rad = (-this.rotation * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    const dx = gx - cx;
    const dy = gy - cy;

    const lx = dx * cos - dy * sin;
    const ly = dx * sin + dy * cos;

    return {
      x: lx + this.width / 2,
      y: ly + this.height / 2
    };
  }

  localToGlobal(lx, ly) {
    const cx = this.centerX;
    const cy = this.centerY;
    const rad = (this.rotation * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    const dx = lx - this.width / 2;
    const dy = ly - this.height / 2;

    const gx = dx * cos - dy * sin + cx;
    const gy = dx * sin + dy * cos + cy;

    return { x: gx, y: gy };
  }

  containsPoint(gx, gy) {
    const local = this.globalToLocal(gx, gy);
    return local.x >= 0 && local.x <= this.width && local.y >= 0 && local.y <= this.height;
  }

  getHandles(zoom = 1) {
    const w = this.width;
    const h = this.height;
    const rotDistance = 38 / zoom;

    const localHandles = {
      nw: { x: 0, y: 0 },
      ne: { x: w, y: 0 },
      se: { x: w, y: h },
      sw: { x: 0, y: h },
      rot: { x: w / 2, y: -rotDistance }
    };

    const globalHandles = {};
    for (const [key, pt] of Object.entries(localHandles)) {
      globalHandles[key] = this.localToGlobal(pt.x, pt.y);
    }
    return globalHandles;
  }

  render(ctx) {
    ctx.save();
    ctx.globalAlpha = this.opacity;

    const cx = this.centerX;
    const cy = this.centerY;
    ctx.translate(cx, cy);
    ctx.rotate((this.rotation * Math.PI) / 180);
    ctx.translate(-this.width / 2, -this.height / 2);

    if (this.shadow.enabled) {
      ctx.shadowColor = this.shadow.color;
      ctx.shadowBlur = this.shadow.blur;
      ctx.shadowOffsetX = this.shadow.offsetX;
      ctx.shadowOffsetY = this.shadow.offsetY;
    }

    this.draw(ctx);

    ctx.restore();
  }

  draw(ctx) {}
}

class ImageItem extends CanvasItem {
  constructor(image, x, y, width, height) {
    super('image', x, y, width, height);
    this.image = image;
    this.mediaType = 'image'; // 'image', 'gif' or 'video'
    this.naturalWidth = image.naturalWidth || image.videoWidth || width;
    this.naturalHeight = image.naturalHeight || image.videoHeight || height;
    this.aspectRatio = this.naturalWidth / this.naturalHeight;

    // Styling, Clipping & Frames
    this.clipShape = 'rect'; // 'rect', 'circle', 'star', 'heart', 'arch', 'flower'
    this.frameStyle = 'none'; // 'none', 'polaroid', 'film'
    this.borderRadius = 0;
    this.borderWidth = 0;
    this.borderColor = '#ffffff';
    this.caption = '';

    // Non-destructive Internal Cropping ({ x, y, width, height } normalized 0..1)
    this.crop = { x: 0, y: 0, width: 1, height: 1 };

    // Manual Pan & Zoom Framing Offset inside shapes/frames ({ x: -1..1, y: -1..1, zoom: 1..3 })
    this.fitOffset = { x: 0, y: 0, zoom: 1.0 };
  }

  /**
   * Draws the image into destination rectangle (dx, dy, dw, dh) preserving aspect ratio (object-fit: cover).
   * ZERO distortion, zero squishing, with optional manual pan and zoom framing.
   */
  drawImageCover(ctx, dx, dy, dw, dh) {
    if (!this.isReady()) return;

    const natW = this.mediaWidth() || this.naturalWidth || dw;
    const natH = this.mediaHeight() || this.naturalHeight || dh;
    const crop = this.cropReference || this.crop || { x: 0, y: 0, width: 1, height: 1 };
    const fit = this.fitOffset || { x: 0, y: 0, zoom: 1.0 };

    // Base cropped source region in natural image coordinates
    const sxBase = Math.max(0, Math.min(natW, crop.x * natW));
    const syBase = Math.max(0, Math.min(natH, crop.y * natH));
    const swBase = Math.max(1, Math.min(natW - sxBase, crop.width * natW));
    const shBase = Math.max(1, Math.min(natH - syBase, crop.height * natH));

    const srcAspect = swBase / shBase;
    const destAspect = dw / dh;

    let swUsed = swBase;
    let shUsed = shBase;

    // Cover math: match aspect ratio precisely so scaleX === scaleY (no distortion)
    if (destAspect > srcAspect) {
      // Destination is wider: use full width of crop, reduce height
      shUsed = swBase / destAspect;
    } else {
      // Destination is taller: use full height of crop, reduce width
      swUsed = shBase * destAspect;
    }

    // Apply manual framing zoom (>= 1.0)
    const zoom = Math.max(1.0, Math.min(4.0, fit.zoom || 1.0));
    swUsed = Math.max(10, swUsed / zoom);
    shUsed = Math.max(10, shUsed / zoom);

    // Margins available for user panning
    const maxShiftX = (swBase - swUsed) / 2;
    const maxShiftY = (shBase - shUsed) / 2;

    const shiftX = Math.max(-maxShiftX, Math.min(maxShiftX, (fit.x || 0) * maxShiftX));
    const shiftY = Math.max(-maxShiftY, Math.min(maxShiftY, (fit.y || 0) * maxShiftY));

    const centerX = sxBase + swBase / 2 + shiftX;
    const centerY = syBase + shBase / 2 + shiftY;

    const sx = Math.max(0, Math.min(natW - swUsed, centerX - swUsed / 2));
    const sy = Math.max(0, Math.min(natH - shUsed, centerY - shUsed / 2));

    if (this.cropReference) {
      const trim = this.crop;
      const left = Math.max(sx, trim.x * natW);
      const top = Math.max(sy, trim.y * natH);
      const right = Math.min(sx + swUsed, (trim.x + trim.width) * natW);
      const bottom = Math.min(sy + shUsed, (trim.y + trim.height) * natH);
      if (right <= left || bottom <= top) return;
      ctx.drawImage(this.image, left, top, right - left, bottom - top,
        dx + (left - sx) * dw / swUsed, dy + (top - sy) * dh / shUsed,
        (right - left) * dw / swUsed, (bottom - top) * dh / shUsed);
    } else {
      ctx.drawImage(this.image, sx, sy, swUsed, shUsed, dx, dy, dw, dh);
    }
  }

  mediaWidth() {
    const media = this.image;
    return media ? media.videoWidth || media.naturalWidth || 0 : 0;
  }

  mediaHeight() {
    const media = this.image;
    return media ? media.videoHeight || media.naturalHeight || 0 : 0;
  }

  isReady() {
    const media = this.image;
    if (!media) return false;
    if (media.tagName === 'VIDEO') return media.readyState >= 2 && media.videoWidth > 0;
    return Boolean(media.complete && media.naturalWidth > 0);
  }

  hasImage() {
    return this.isReady();
  }

  drawPlaceholder(ctx, dx, dy, dw, dh) {
    if (dw <= 0 || dh <= 0) return;
    ctx.save();
    ctx.fillStyle = '#ece7de';
    ctx.fillRect(dx, dy, dw, dh);
    const inset = Math.max(6, Math.min(dw, dh) * 0.04);
    ctx.strokeStyle = '#c9c2b6';
    ctx.lineWidth = Math.max(2, Math.min(dw, dh) * 0.008);
    ctx.setLineDash([Math.max(8, dw * 0.03), Math.max(8, dw * 0.02)]);
    ctx.strokeRect(dx + inset, dy + inset, dw - inset * 2, dh - inset * 2);
    ctx.setLineDash([]);
    const size = Math.max(14, Math.min(dw, dh) * 0.15);
    ctx.fillStyle = '#a8a29e';
    ctx.font = `600 ${Math.round(size)}px 'Inter', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Tu foto', dx + dw / 2, dy + dh / 2);
    ctx.restore();
  }

  draw(ctx) {
    const w = this.width;
    const h = this.height;

    // 1. Polaroid Frame Mode
    if (this.frameStyle === 'polaroid') {
      const padSide = Math.max(12, w * 0.06);
      const padTop = Math.max(12, h * 0.06);
      const padBottom = Math.max(36, h * 0.22);

      ctx.fillStyle = '#faf8f5';
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = '#e7e2d7';
      ctx.lineWidth = 1;
      ctx.strokeRect(0, 0, w, h);

      const imgW = w - padSide * 2;
      const imgH = h - padTop - padBottom;

      if (imgW > 0 && imgH > 0) {
        if (this.hasImage()) this.drawImageCover(ctx, padSide, padTop, imgW, imgH);
        else this.drawPlaceholder(ctx, padSide, padTop, imgW, imgH);
      }

      if (this.caption) {
        ctx.fillStyle = '#262626';
        ctx.font = `italic ${Math.max(16, h * 0.06)}px 'Caveat', cursive, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.caption, w / 2, h - padBottom / 2);
      }
      return;
    }

    // 2. 35mm Analog Film Frame Mode
    if (this.frameStyle === 'film') {
      const borderH = Math.max(18, h * 0.12);
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(0, 0, w, h);

      ctx.fillStyle = '#262626';
      const holeW = Math.max(8, w * 0.04);
      const holeH = Math.max(10, borderH * 0.55);
      const holeSpacing = Math.max(16, w * 0.08);

      for (let x = holeSpacing / 2; x < w - holeW; x += holeSpacing) {
        ctx.fillRect(x, (borderH - holeH) / 2, holeW, holeH);
        ctx.fillRect(x, h - borderH + (borderH - holeH) / 2, holeW, holeH);
      }

      const imgH = h - borderH * 2;
      if (w > 0 && imgH > 0) {
        if (this.hasImage()) this.drawImageCover(ctx, 0, borderH, w, imgH);
        else this.drawPlaceholder(ctx, 0, borderH, w, imgH);
      }
      return;
    }

    // 3. Shape Mask Clipping (Circle, Star, Heart, Arch, Flower, or Rounded Rect)
    ctx.save();
    this.createShapePath(ctx, w, h);
    ctx.clip();

    if (this.hasImage()) {
      this.drawImageCover(ctx, 0, 0, w, h);
    } else {
      this.drawPlaceholder(ctx, 0, 0, w, h);
    }
    ctx.restore();

    // Optional Stroke around the Shape
    if (this.borderWidth > 0) {
      ctx.save();
      this.createShapePath(ctx, w, h);
      ctx.strokeStyle = this.borderColor;
      ctx.lineWidth = this.borderWidth;
      ctx.stroke();
      ctx.restore();
    }
  }

  createShapePath(ctx, w, h) {
    ctx.beginPath();

    if (this.clipShape === 'circle') {
      const r = Math.min(w, h) / 2;
      ctx.arc(w / 2, h / 2, r, 0, Math.PI * 2);
    } else if (this.clipShape === 'star') {
      const r = Math.min(w, h) / 2;
      this.drawStarPath(ctx, w / 2, h / 2, 5, r, r * 0.44);
    } else if (this.clipShape === 'heart') {
      this.drawHeartPath(ctx, w, h);
    } else if (this.clipShape === 'arch') {
      // Architectural Arch (Dome top, flat bottom)
      const r = w / 2;
      ctx.moveTo(0, h);
      ctx.lineTo(0, r);
      ctx.arc(r, r, r, Math.PI, 0, false);
      ctx.lineTo(w, h);
      ctx.closePath();
    } else if (this.clipShape === 'flower') {
      this.drawFlowerPath(ctx, w, h);
    } else {
      // Standard Rectangle with optional border radius
      if (this.borderRadius > 0) {
        if (ctx.roundRect) {
          ctx.roundRect(0, 0, w, h, this.borderRadius);
        } else {
          ctx.rect(0, 0, w, h);
        }
      } else {
        ctx.rect(0, 0, w, h);
      }
    }
  }

  drawStarPath(ctx, cx, cy, spikes, outerRadius, innerRadius) {
    let rot = (Math.PI / 2) * 3;
    let x = cx;
    let y = cy;
    const step = Math.PI / spikes;

    ctx.moveTo(cx, cy - outerRadius);
    for (let i = 0; i < spikes; i++) {
      x = cx + Math.cos(rot) * outerRadius;
      y = cy + Math.sin(rot) * outerRadius;
      ctx.lineTo(x, y);
      rot += step;

      x = cx + Math.cos(rot) * innerRadius;
      y = cy + Math.sin(rot) * innerRadius;
      ctx.lineTo(x, y);
      rot += step;
    }
    ctx.lineTo(cx, cy - outerRadius);
    ctx.closePath();
  }

  drawHeartPath(ctx, w, h) {
    // Proportional heart curve strictly centered inside min(w, h)
    const s = Math.min(w, h);
    const ox = (w - s) / 2;
    const oy = (h - s) / 2;
    const topCurveHeight = s * 0.3;

    ctx.moveTo(ox + s / 2, oy + s);
    // Left curve
    ctx.bezierCurveTo(ox, oy + s * 0.65, ox, oy + topCurveHeight, ox + s / 2, oy + topCurveHeight);
    // Right curve
    ctx.bezierCurveTo(ox + s, oy + topCurveHeight, ox + s, oy + s * 0.65, ox + s / 2, oy + s);
    ctx.closePath();
  }

  drawFlowerPath(ctx, w, h) {
    // 8-petal daisy / scalloped floral silhouette centered inside min(w, h)
    const cx = w / 2;
    const cy = h / 2;
    const s = Math.min(w, h);
    const R = s * 0.44;
    const r = R * 0.22;
    const petals = 8;

    for (let i = 0; i < petals; i++) {
      const angle = (i * 2 * Math.PI) / petals;
      const px = cx + Math.cos(angle) * (R - r);
      const py = cy + Math.sin(angle) * (R - r);
      ctx.arc(px, py, r * 1.5, angle - Math.PI / 2, angle + Math.PI / 2);
    }
    ctx.closePath();
  }
}

class TextItem extends CanvasItem {
  constructor(text, x, y, width = 360, height = 120) {
    super('text', x, y, width, height);
    this.text = text || 'EDITORIAL TITLE';
    this.fontFamily = "'Playfair Display', Georgia, serif";
    this.fontSize = 48;
    this.fontWeight = '700';
    this.fontStyle = 'normal';
    this.color = '#111827';
    this.textAlign = 'center';
    this.letterSpacing = 2;
    this.lineHeight = 1.25;
    this.backgroundColor = 'transparent';
    this.padding = 12;
  }

  draw(ctx) {
    const w = this.width;
    const h = this.height;

    if (this.backgroundColor && this.backgroundColor !== 'transparent') {
      ctx.fillStyle = this.backgroundColor;
      ctx.fillRect(0, 0, w, h);
    }

    ctx.font = `${this.fontStyle} ${this.fontWeight} ${this.fontSize}px ${this.fontFamily}`;
    ctx.fillStyle = this.color;
    ctx.textBaseline = 'middle';

    const lines = this.text.split('\n');
    const totalLineHeight = this.fontSize * this.lineHeight;
    const startY = (h - (lines.length - 1) * totalLineHeight) / 2;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const ly = startY + i * totalLineHeight;

      let lx = this.padding;
      if (this.textAlign === 'center') {
        lx = w / 2;
        ctx.textAlign = 'center';
      } else if (this.textAlign === 'right') {
        lx = w - this.padding;
        ctx.textAlign = 'right';
      } else {
        ctx.textAlign = 'left';
      }

      if (this.letterSpacing > 0 && ctx.letterSpacing !== undefined) {
        ctx.letterSpacing = `${this.letterSpacing}px`;
      }
      ctx.fillText(line, lx, ly);
    }
  }
}

class StickerItem extends CanvasItem {
  constructor(image, x, y, width = 160, height = 60, title = 'Sticker') {
    super('sticker', x, y, width, height);
    this.image = image;
    this.title = title;
  }

  draw(ctx) {
    if (this.image && this.image.complete) {
      ctx.drawImage(this.image, 0, 0, this.width, this.height);
    }
  }
}

// ---- END js/objects.js ----

// ---- BEGIN js/canvas.js ----
/**
 * Panoramic Multi-Slide Canvas Engine (Mobile-First Optimized)
 * Enhanced with Smart Magnetic Alignment Guides (Slide centers, borders, other items),
 * Slide Centering, Auto-Fit, and Blank Canvas Reset.
 */

class CanvasEngine {
  constructor(canvasElement, containerElement) {
    this.enabled = false;
    this.canvas = canvasElement;
    this.container = containerElement;
    this.ctx = canvasElement.getContext('2d');

    // Slide configuration
    this.slideCount = 3;
    this.slideWidth = 1080;
    this.slideHeight = 1350; // 4:5 Portrait default
    this.aspectRatioName = '4:5';

    // Canvas background
    this.background = '#f5f0ea';

    // Items list & selection
    this.items = [];
    this.selectedItem = null;

    // Viewport transform (Pan & Zoom)
    this.zoom = 0.28;
    this.panX = 20;
    this.panY = 40;
    this.isPanning = false;
    this.startPanPoint = { x: 0, y: 0 };
    this.isSpacePressed = false;

    // Transform interaction state
    this.activeHandle = null;
    this.dragStart = { x: 0, y: 0 };
    this.itemInitialState = null;

    // Smart Snapping & Dynamic Alignment Guides
    this.showGuides = true;
    this.snapThreshold = 22; // Generous threshold for easy snapping on small items
    this.activeSnapLines = [];

    // History for Undo / Redo
    this.history = [];
    this.historyIndex = -1;
    this.isRestoringHistory = false;

    // Touch interaction helpers
    this.lastTapTime = 0;
    this.touchStartDist = 0;
    this.touchStartZoom = 1;

    // Change listeners
    this.onSelectionChange = null;
    this.onCanvasChange = null;

    this.init();
  }

  get totalWidth() {
    return this.slideWidth * this.slideCount;
  }

  get totalHeight() {
    return this.slideHeight;
  }

  init() {
    this.resizeCanvas();
    window.addEventListener('resize', () => {
      if (this.enabled) this.fitToScreen(this.viewMode === 'slide');
    });

    this.bindEvents();
    this.fitToScreen();
    this.saveHistory('Initial state');
  }

  resizeCanvas() {
    const rect = this.container.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.canvas.style.width = `${rect.width}px`;
    this.canvas.style.height = `${rect.height}px`;
    this.ctx.resetTransform?.();
    this.ctx.scale(dpr, dpr);
    this.viewportWidth = rect.width;
    this.viewportHeight = rect.height;
  }

  setAspectRatio(ratio) {
    if (ratio === '4:5') {
      this.slideWidth = 1080;
      this.slideHeight = 1350;
      this.aspectRatioName = '4:5';
    } else if (ratio === '1:1') {
      this.slideWidth = 1080;
      this.slideHeight = 1080;
      this.aspectRatioName = '1:1';
    } else if (ratio === '9:16') {
      this.slideWidth = 1080;
      this.slideHeight = 1920;
      this.aspectRatioName = '9:16';
    }
    this.fitToScreen();
    this.triggerChange();
  }

  setSlideCount(count) {
    const newCount = Math.max(1, Math.min(10, count));
    if (newCount !== this.slideCount) {
      this.slideCount = newCount;
      this.fitToScreen();
      this.triggerChange();
      this.saveHistory(`Change slides to ${newCount}`);
    }
  }

  removeSlide(index = this.getActiveSlideIndex()) {
    if (this.slideCount <= 1 || !Number.isInteger(index) || index < 0 || index >= this.slideCount) return false;
    this.selectItem(null);
    this.items = this.items.filter(item => {
      const page = this.getItemSlideIndex(item);
      if (page === index) return false;
      if (page > index) item.x -= this.slideWidth;
      return true;
    });
    this.items.forEach((item, i) => { item.zIndex = i; });
    this.slideCount--;
    this.focusSlide(Math.min(index, this.slideCount - 1));
    this.triggerChange();
    this.saveHistory(`Eliminar página ${index + 1}`);
    return true;
  }

  // Clear everything to a clean white canvas
  clearToBlankCanvas() {
    this.items = [];
    this.selectItem(null);
    this.background = '#ffffff';
    this.fitToScreen();
    this.saveHistory('Lienzo en blanco');
    this.triggerChange();
  }

  getActiveSlideIndex() {
    const center = (this.viewportWidth / 2 - this.panX) / this.zoom;
    return Math.max(0, Math.min(this.slideCount - 1, Math.floor(center / this.slideWidth) || 0));
  }

  focusSlide(index) {
    this.fitToScreen(true, Math.max(0, Math.min(this.slideCount - 1, index)));
  }

  fitToScreen(forceSlideFit = null, slideIndex = null) {
    const previousSlide = slideIndex ?? this.getActiveSlideIndex();
    this.resizeCanvas();
    const isMobile = this.viewportWidth <= 640 || this.viewportWidth < this.viewportHeight;
    const paddingX = Math.max(12, Math.min(32, this.viewportWidth * 0.05));
    const paddingY = Math.max(16, Math.min(48, this.viewportHeight * 0.06));
    // The canvas toolbar floats over the workspace, so the artwork starts below it.
    const topInset = isMobile ? 68 : 0;
    const availW = Math.max(40, this.viewportWidth - paddingX * 2);
    const availH = Math.max(40, this.viewportHeight - paddingY * 2 - topInset);

    // On mobile or portrait orientation, fit to slide height so slides fill the vertical screen natively!
    const shouldFitSlideHeight = forceSlideFit !== null ? forceSlideFit : isMobile;

    if (shouldFitSlideHeight) {
      // Scale slide height to comfortably fill vertical workspace (~90%)
      this.zoom = Math.min(availW / this.slideWidth, availH / this.slideHeight);
      const activeSlide = Math.min(this.slideCount - 1, previousSlide);
      const targetCenterX = activeSlide * this.slideWidth + this.slideWidth / 2;
      this.panX = this.viewportWidth / 2 - targetCenterX * this.zoom;
      this.panY = topInset + paddingY + (availH - this.slideHeight * this.zoom) / 2;
      this.viewMode = 'slide';
    } else {
      // Full panoramic ribbon overview (all slides in view)
      const scaleW = availW / this.totalWidth;
      const scaleH = availH / this.totalHeight;
      this.zoom = Math.min(scaleW, scaleH);
      this.panX = (this.viewportWidth - this.totalWidth * this.zoom) / 2;
      this.panY = topInset + paddingY + (availH - this.totalHeight * this.zoom) / 2;
      this.viewMode = 'panorama';
    }

    this.render();
  }

  screenToCanvas(screenX, screenY) {
    return {
      x: (screenX - this.panX) / this.zoom,
      y: (screenY - this.panY) / this.zoom
    };
  }

  canvasToScreen(canvasX, canvasY) {
    return {
      x: canvasX * this.zoom + this.panX,
      y: canvasY * this.zoom + this.panY
    };
  }

  addItem(item) {
    item.zIndex = this.items.length;
    this.items.push(item);
    this.selectItem(item);
    this.saveHistory(`Add ${item.type}`);
    this.triggerChange();
  }

  removeItem(item) {
    const index = this.items.indexOf(item);
    if (index > -1) {
      this.items.splice(index, 1);
      if (this.selectedItem === item) {
        this.selectItem(null);
      }
      this.saveHistory(`Delete item`);
      this.triggerChange();
    }
  }

  selectItem(item) {
    if (this.selectedItem !== item) {
      this.selectedItem = item;
      this.render();
      if (this.onSelectionChange) {
        this.onSelectionChange(item);
      }
    }
  }

  // Determine which slide an item is centered in (0 to slideCount - 1)
  getItemSlideIndex(item) {
    const cx = item.x + item.width / 2;
    return Math.max(0, Math.min(this.slideCount - 1, Math.floor(cx / this.slideWidth)));
  }

  // Quick Action: Center item horizontally and vertically in its slide
  centerItemInSlide(item) {
    if (!item) return;
    const s = this.getItemSlideIndex(item);
    const slideCenterX = s * this.slideWidth + this.slideWidth / 2;
    const slideCenterY = this.slideHeight / 2;

    item.x = Math.round(slideCenterX - item.width / 2);
    item.y = Math.round(slideCenterY - item.height / 2);
    this.triggerChange();
    this.saveHistory(`Center item in slide ${s + 1}`);
  }

  fillImageToSlide(item) {
    if (!item || item.type !== 'image') return;
    const slide = this.getActiveSlideIndex();
    Object.assign(item, {
      x: slide * this.slideWidth, y: 0,
      width: this.slideWidth, height: this.slideHeight, rotation: 0,
      crop: { x: 0, y: 0, width: 1, height: 1 },
      cropReference: null,
      fitOffset: { x: 0, y: 0, zoom: 1 },
      clipShape: 'rect', frameStyle: 'none', borderRadius: 0, borderWidth: 0
    });
    this.triggerChange();
    this.saveHistory(`Photo fills slide ${slide + 1}`);
  }

  // Quick Action: Fit item inside current slide
  fitItemToSlide(item) {
    if (!item) return;
    const s = this.getItemSlideIndex(item);
    const targetW = Math.round(this.slideWidth * 0.85);
    const aspect = item.width / item.height;

    item.width = targetW;
    item.height = Math.round(targetW / aspect);

    const slideCenterX = s * this.slideWidth + this.slideWidth / 2;
    const slideCenterY = this.slideHeight / 2;

    item.x = Math.round(slideCenterX - item.width / 2);
    item.y = Math.round(slideCenterY - item.height / 2);

    this.triggerChange();
    this.saveHistory(`Fit item to slide ${s + 1}`);
  }

  // Quick Action: Snap item directly centered across nearest slide fold / seam
  snapToNearestSeam(item) {
    if (!item) return;
    const centerX = item.x + item.width / 2;
    let closestSeamX = this.slideWidth;
    let minDiff = Infinity;
    for (let s = 1; s < this.slideCount; s++) {
      const sx = s * this.slideWidth;
      const diff = Math.abs(centerX - sx);
      if (diff < minDiff) {
        minDiff = diff;
        closestSeamX = sx;
      }
    }
    item.x = Math.round(closestSeamX - item.width / 2);
    this.triggerChange();
    this.saveHistory('Snap to nearest fold');
  }

  bringForward(item) {
    const idx = this.items.indexOf(item);
    if (idx < this.items.length - 1) {
      const temp = this.items[idx];
      this.items[idx] = this.items[idx + 1];
      this.items[idx + 1] = temp;
      this.reindexLayers();
      this.triggerChange();
    }
  }

  sendBackward(item) {
    const idx = this.items.indexOf(item);
    if (idx > 0) {
      const temp = this.items[idx];
      this.items[idx] = this.items[idx - 1];
      this.items[idx - 1] = temp;
      this.reindexLayers();
      this.triggerChange();
    }
  }

  bringToFront(item) {
    const idx = this.items.indexOf(item);
    if (idx > -1 && idx < this.items.length - 1) {
      this.items.splice(idx, 1);
      this.items.push(item);
      this.reindexLayers();
      this.triggerChange();
    }
  }

  sendToBack(item) {
    const idx = this.items.indexOf(item);
    if (idx > 0) {
      this.items.splice(idx, 1);
      this.items.unshift(item);
      this.reindexLayers();
      this.triggerChange();
    }
  }

  reindexLayers() {
    this.items.forEach((it, i) => { it.zIndex = i; });
    this.saveHistory('Reorder layers');
  }

  duplicateItem(item) {
    if (!item) return;
    const offset = 40;
    const copy = Object.assign(Object.create(Object.getPrototypeOf(item)), item);
    Object.assign(copy, this.serializeItem(item));
    delete copy.imageSrc;
    copy.id = 'item_' + Date.now();
    copy.x += offset;
    copy.y += offset;
    this.addItem(copy);
  }

  saveHistory(label = '') {
    if (this.isRestoringHistory) return;
    if (this.historyIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.historyIndex + 1);
    }
    const snapshot = {
      label,
      slideCount: this.slideCount,
      slideWidth: this.slideWidth,
      slideHeight: this.slideHeight,
      aspectRatioName: this.aspectRatioName,
      background: this.background,
      items: this.items.map(it => this.serializeItem(it))
    };
    this.history.push(snapshot);
    if (this.history.length > 25) this.history.shift();
    this.historyIndex = this.history.length - 1;
    this.onHistoryChange?.();
  }

  undo() {
    if (this.historyIndex > 0) {
      this.historyIndex--;
      this.restoreHistory(this.history[this.historyIndex]);
    }
  }

  redo() {
    if (this.historyIndex < this.history.length - 1) {
      this.historyIndex++;
      this.restoreHistory(this.history[this.historyIndex]);
    }
  }

  serializeItem(item) {
    const data = { ...item };
    delete data.image;
    const snapshot = structuredClone(data);
    snapshot.imageSrc =
      item.mediaType === 'video' || !item.image ? '' : item.image.src;
    return snapshot;
  }

  async restoreHistory(snapshot, resetHistory = false) {
    const revision = this.restoreRevision = (this.restoreRevision || 0) + 1;
    this.isRestoringHistory = true;
    this.slideCount = snapshot.slideCount;
    this.slideWidth = snapshot.slideWidth;
    this.slideHeight = snapshot.slideHeight;
    this.aspectRatioName = snapshot.aspectRatioName;
    this.background = snapshot.background;
    this.selectItem(null);
    const { ImageItem, TextItem, StickerItem } = window.__notScrlObjects;
    const restored = await Promise.all(snapshot.items.map(async data => {
      let item;
      if (data.type === 'image' || data.type === 'sticker') {
        if (data.mediaType === 'video') {
          item = await this.restoreVideoItem(data);
        } else {
          const image = new Image();
          image.src = data.imageSrc;
          try { await image.decode(); } catch { /* Keep the layer available if its source is missing. */ }
          item = data.type === 'sticker'
            ? new StickerItem(image, data.x, data.y, data.width, data.height, data.title)
            : new ImageItem(image, data.x, data.y, data.width, data.height);
        }
      } else {
        item = new TextItem(data.text, data.x, data.y, data.width, data.height);
      }
      const { image, imageSrc, id, ...properties } = data;
      Object.assign(item, properties);
      item.shadow = { ...data.shadow };
      return item;
    }));
    if (revision !== this.restoreRevision) return;
    this.items = restored;
    this.isRestoringHistory = false;
    if (resetHistory) {
      this.history = [];
      this.historyIndex = -1;
      this.saveHistory('Abrir proyecto');
    }
    this.fitToScreen();
    this.triggerChange();
  }

  async restoreVideoItem(data) {
    const { ImageItem } = window.__notScrlObjects;
    const video = document.createElement('video');
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.autoplay = true;

    if (data.originalKey && this.loadMediaBlob) {
      try {
        const blob = await this.loadMediaBlob(data.originalKey);
        video.src = URL.createObjectURL(blob);
        await new Promise((resolve) => {
          video.onloadeddata = resolve;
          video.onerror = resolve;
        });
        video.play?.().catch(() => {});
      } catch {
        /* Keep the frame as an empty slot if the video is unavailable. */
      }
    }

    const item = new ImageItem(video, data.x, data.y, data.width, data.height);
    item.mediaType = 'video';
    return item;
  }

  async restoreProject(snapshot) {
    if (snapshot) await this.restoreHistory(snapshot, true);
  }

  triggerChange() {
    if (this.isRestoringHistory) return;
    this.render();
    if (this.onCanvasChange) {
      this.onCanvasChange();
    }
  }

  hasAnimatedMedia() {
    return this.items.some(
      (item) => item.mediaType === 'video' || item.mediaType === 'gif'
    );
  }

  ensureAnimationLoop() {
    if (typeof requestAnimationFrame !== 'function' || this.animationFrame) return;
    this.animationFrame = requestAnimationFrame(() => {
      this.animationFrame = null;
      if (!this.hasAnimatedMedia()) return;
      this.render();
    });
  }

  bindEvents() {
    const canvas = this.canvas;

    canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
    window.addEventListener('mousemove', (e) => this.onMouseMove(e));
    window.addEventListener('mouseup', (e) => this.onMouseUp(e));

    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        const zoomDelta = -e.deltaY * 0.002;
        const newZoom = Math.min(Math.max(0.02, this.zoom + zoomDelta), 2.5);
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        this.panX = mouseX - (mouseX - this.panX) * (newZoom / this.zoom);
        this.panY = mouseY - (mouseY - this.panY) * (newZoom / this.zoom);
        this.zoom = newZoom;
      } else {
        this.panX -= e.deltaX;
        this.panY -= e.deltaY;
      }
      this.render();
    }, { passive: false });

    window.addEventListener('keydown', (e) => {
      if (!this.enabled || e.target.closest('input,textarea,select,dialog,[role=dialog]') || document.querySelector('.mobile-modal-overlay:not(.hidden)')) return;

      if (e.code === 'Space' && !this.isSpacePressed) {
        e.preventDefault();
        this.isSpacePressed = true;
        this.canvas.style.cursor = 'grab';
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) this.redo();
        else this.undo();
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        this.redo();
      }

      if ((e.key === 'Delete' || e.key === 'Backspace') && this.selectedItem) {
        e.preventDefault();
        this.removeItem(this.selectedItem);
      }

      if (this.selectedItem && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 2;
        if (e.key === 'ArrowLeft') this.selectedItem.x -= step;
        if (e.key === 'ArrowRight') this.selectedItem.x += step;
        if (e.key === 'ArrowUp') this.selectedItem.y -= step;
        if (e.key === 'ArrowDown') this.selectedItem.y += step;
        this.triggerChange();
        this.saveHistory('Mover elemento');
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space') {
        this.isSpacePressed = false;
        this.canvas.style.cursor = 'default';
      }
    });

    this.bindTouchEvents();
  }

  bindTouchEvents() {
    const canvas = this.canvas;
    let initialTouchDist = 0;
    let initialZoom = 1;
    let touchPanStart = { x: 0, y: 0 };
    let isTouchPanning = false;

    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (!this.enabled || this.isRestoringHistory) return;
      const now = Date.now();
      if (e.touches.length === 1 && (now - this.lastTapTime < 300)) {
        if (this.selectedItem && this.selectedItem.type === 'image' && this.onDoubleTapItem) {
          this.onDoubleTapItem(this.selectedItem);
          this.lastTapTime = 0;
          return;
        }
        const nextMode = this.viewMode === 'slide' ? false : true;
        this.fitToScreen(nextMode);
        this.lastTapTime = 0;
        return;
      }
      this.lastTapTime = now;

      if (e.touches.length === 2) {
        e.preventDefault();
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        initialTouchDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        initialZoom = this.zoom;
        this.activeHandle = null;
        isTouchPanning = false;
        const rect = canvas.getBoundingClientRect();
        this.pinchAnchor = this.screenToCanvas((t1.clientX + t2.clientX) / 2 - rect.left, (t1.clientY + t2.clientY) / 2 - rect.top);
      } else if (e.touches.length === 1) {
        const touch = e.touches[0];
        const rect = canvas.getBoundingClientRect();
        const canvasPoint = this.screenToCanvas(touch.clientX - rect.left, touch.clientY - rect.top);

        let handleHit = null;
        if (this.selectedItem) {
          handleHit = this.hitTestHandles(this.selectedItem, canvasPoint, true);
        }

        if (handleHit) {
          this.activeHandle = handleHit;
          this.dragStart = { ...canvasPoint };
          this.itemInitialState = {
            x: this.selectedItem.x,
            y: this.selectedItem.y,
            width: this.selectedItem.width,
            height: this.selectedItem.height,
            rotation: this.selectedItem.rotation,
            aspectRatio: this.selectedItem.width / this.selectedItem.height,
            corners: {
              nw: this.selectedItem.localToGlobal(0, 0),
              ne: this.selectedItem.localToGlobal(this.selectedItem.width, 0),
              se: this.selectedItem.localToGlobal(this.selectedItem.width, this.selectedItem.height),
              sw: this.selectedItem.localToGlobal(0, this.selectedItem.height)
            }
          };
          return;
        }

        let hitItem = null;
        for (let i = this.items.length - 1; i >= 0; i--) {
          if (this.items[i].containsPoint(canvasPoint.x, canvasPoint.y)) {
            hitItem = this.items[i];
            break;
          }
        }

        if (hitItem) {
          this.selectItem(hitItem);
          this.activeHandle = 'body';
          this.dragStart = { ...canvasPoint };
          this.itemInitialState = {
            x: hitItem.x,
            y: hitItem.y,
            width: hitItem.width,
            height: hitItem.height,
            rotation: hitItem.rotation
          };
        } else {
          isTouchPanning = true;
          touchPanStart = { x: touch.clientX - this.panX, y: touch.clientY - this.panY };
          this.selectItem(null);
        }
      }
    }, { passive: false });

    canvas.addEventListener('touchmove', (e) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        if (initialTouchDist > 0) {
          this.zoom = Math.min(Math.max(0.02, initialZoom * (dist / initialTouchDist)), 2.5);
          const rect = canvas.getBoundingClientRect();
          this.panX = (t1.clientX + t2.clientX) / 2 - rect.left - this.pinchAnchor.x * this.zoom;
          this.panY = (t1.clientY + t2.clientY) / 2 - rect.top - this.pinchAnchor.y * this.zoom;
          this.render();
        }
      } else if (e.touches.length === 1) {
        const touch = e.touches[0];
        if (isTouchPanning) {
          this.panX = touch.clientX - touchPanStart.x;
          this.panY = touch.clientY - touchPanStart.y;
          this.render();
        } else if (this.activeHandle && this.selectedItem) {
          e.preventDefault();
          const rect = canvas.getBoundingClientRect();
          const canvasPoint = this.screenToCanvas(touch.clientX - rect.left, touch.clientY - rect.top);
          this.handleDragMove(canvasPoint);
        }
      }
    }, { passive: false });

    const endTouch = () => {
      isTouchPanning = false;
      initialTouchDist = 0;
      if (this.activeHandle) {
        this.activeHandle = null;
        this.activeSnapLines = [];
        this.saveHistory('Transform item');
        this.render();
      }
    };
    canvas.addEventListener('touchend', endTouch);
    canvas.addEventListener('touchcancel', endTouch);
  }

  onMouseDown(e) {
    if (!this.enabled || this.isRestoringHistory) return;
    const rect = this.canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const canvasPoint = this.screenToCanvas(screenX, screenY);

    if (this.isSpacePressed || e.button === 1) {
      this.isPanning = true;
      this.startPanPoint = { x: e.clientX - this.panX, y: e.clientY - this.panY };
      this.canvas.style.cursor = 'grabbing';
      return;
    }

    if (e.button !== 0) return;

    if (this.selectedItem) {
      const handleHit = this.hitTestHandles(this.selectedItem, canvasPoint, false);
      if (handleHit) {
        this.activeHandle = handleHit;
        this.dragStart = { ...canvasPoint };
        this.itemInitialState = {
          x: this.selectedItem.x,
          y: this.selectedItem.y,
          width: this.selectedItem.width,
          height: this.selectedItem.height,
          rotation: this.selectedItem.rotation,
          aspectRatio: this.selectedItem.width / this.selectedItem.height,
          corners: {
            nw: this.selectedItem.localToGlobal(0, 0),
            ne: this.selectedItem.localToGlobal(this.selectedItem.width, 0),
            se: this.selectedItem.localToGlobal(this.selectedItem.width, this.selectedItem.height),
            sw: this.selectedItem.localToGlobal(0, this.selectedItem.height)
          }
        };
        return;
      }
    }

    let hitItem = null;
    for (let i = this.items.length - 1; i >= 0; i--) {
      if (this.items[i].containsPoint(canvasPoint.x, canvasPoint.y)) {
        hitItem = this.items[i];
        break;
      }
    }

    if (hitItem) {
      this.selectItem(hitItem);
      this.activeHandle = 'body';
      this.dragStart = { ...canvasPoint };
      this.itemInitialState = {
        x: hitItem.x,
        y: hitItem.y,
        width: hitItem.width,
        height: hitItem.height,
        rotation: hitItem.rotation
      };
    } else {
      this.selectItem(null);
    }
  }

  onMouseMove(e) {
    if (!this.enabled || this.isRestoringHistory) return;
    const rect = this.canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const canvasPoint = this.screenToCanvas(screenX, screenY);

    if (this.isPanning) {
      this.panX = e.clientX - this.startPanPoint.x;
      this.panY = e.clientY - this.startPanPoint.y;
      this.render();
      return;
    }

    if (!this.activeHandle || !this.selectedItem) {
      this.updateCursor(canvasPoint);
      return;
    }

    this.handleDragMove(canvasPoint);
  }

  // Enhanced Magnetic Snapping: checks slide centers, seams, slide vertical thirds, and OTHER items!
  handleDragMove(canvasPoint) {
    const item = this.selectedItem;
    const init = this.itemInitialState;
    const dx = canvasPoint.x - this.dragStart.x;
    const dy = canvasPoint.y - this.dragStart.y;

    this.activeSnapLines = [];

    if (this.activeHandle === 'body') {
      let newX = init.x + dx;
      let newY = init.y + dy;

      const itemW = item.width;
      const itemH = item.height;
      const leftX = newX;
      const centerX = newX + itemW / 2;
      const rightX = newX + itemW;
      const topY = newY;
      const centerY = newY + itemH / 2;
      const bottomY = newY + itemH;

      // 1. Slide X Targets (Borders & Centers of all slides)
      const xTargets = [];
      for (let s = 0; s <= this.slideCount; s++) {
        xTargets.push({ x: s * this.slideWidth, type: 'border' });
        if (s < this.slideCount) {
          xTargets.push({ x: s * this.slideWidth + this.slideWidth / 2, type: 'center' });
        }
      }

      // 2. Other items' X & Y targets
      const yTargets = [
        { y: this.slideHeight / 2, type: 'center' },
        { y: this.slideHeight * 0.25, type: 'third' },
        { y: this.slideHeight * 0.75, type: 'third' }
      ];

      for (const other of this.items) {
        if (other === item) continue;
        xTargets.push({ x: other.centerX, type: 'item' });
        xTargets.push({ x: other.x, type: 'item' });
        xTargets.push({ x: other.x + other.width, type: 'item' });

        yTargets.push({ y: other.centerY, type: 'item' });
        yTargets.push({ y: other.y, type: 'item' });
        yTargets.push({ y: other.y + other.height, type: 'item' });
      }

      // Test magnetic snap X
      for (const tgt of xTargets) {
        if (Math.abs(centerX - tgt.x) < this.snapThreshold) {
          newX = tgt.x - itemW / 2;
          this.activeSnapLines.push({ type: 'v', x: tgt.x, color: tgt.type === 'item' ? '#ec4899' : '#06b6d4' });
          break;
        }
        if (Math.abs(leftX - tgt.x) < this.snapThreshold) {
          newX = tgt.x;
          this.activeSnapLines.push({ type: 'v', x: tgt.x, color: tgt.type === 'item' ? '#ec4899' : '#06b6d4' });
          break;
        }
        if (Math.abs(rightX - tgt.x) < this.snapThreshold) {
          newX = tgt.x - itemW;
          this.activeSnapLines.push({ type: 'v', x: tgt.x, color: tgt.type === 'item' ? '#ec4899' : '#06b6d4' });
          break;
        }
      }

      // Test magnetic snap Y
      for (const tgt of yTargets) {
        if (Math.abs(centerY - tgt.y) < this.snapThreshold) {
          newY = tgt.y - itemH / 2;
          this.activeSnapLines.push({ type: 'h', y: tgt.y, color: tgt.type === 'item' ? '#ec4899' : '#06b6d4' });
          break;
        }
        if (Math.abs(topY - tgt.y) < this.snapThreshold) {
          newY = tgt.y;
          this.activeSnapLines.push({ type: 'h', y: tgt.y, color: tgt.type === 'item' ? '#ec4899' : '#06b6d4' });
          break;
        }
        if (Math.abs(bottomY - tgt.y) < this.snapThreshold) {
          newY = tgt.y - itemH;
          this.activeSnapLines.push({ type: 'h', y: tgt.y, color: tgt.type === 'item' ? '#ec4899' : '#06b6d4' });
          break;
        }
      }

      item.x = Math.round(newX);
      item.y = Math.round(newY);
      this.triggerChange();
      return;
    }

    if (this.activeHandle === 'rot') {
      const cx = init.x + init.width / 2;
      const cy = init.y + init.height / 2;
      const rad = Math.atan2(canvasPoint.y - cy, canvasPoint.x - cx);
      let deg = (rad * 180) / Math.PI + 90;
      if (deg < 0) deg += 360;

      const snapAngles = [0, 45, 90, 135, 180, 225, 270, 315, 360];
      for (const sa of snapAngles) {
        if (Math.abs(deg - sa) < 5) {
          deg = sa % 360;
          break;
        }
      }
      item.rotation = Math.round(deg);
      this.triggerChange();
      return;
    }

    // Resize Handles with Stationary Opposite Anchor Corner
    const rad = (init.rotation * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    // Identify stationary opposite anchor corner in canvas coordinates
    let anchor;
    if (init.corners) {
      if (this.activeHandle === 'se') anchor = init.corners.nw;
      else if (this.activeHandle === 'sw') anchor = init.corners.ne;
      else if (this.activeHandle === 'ne') anchor = init.corners.sw;
      else if (this.activeHandle === 'nw') anchor = init.corners.se;
    }

    if (!anchor) {
      anchor = { x: init.x, y: init.y };
    }

    // Vector from anchor to current canvas pointer
    const dxA = canvasPoint.x - anchor.x;
    const dyA = canvasPoint.y - anchor.y;

    // Project onto item's local orientation
    const projX = dxA * cos + dyA * sin;
    const projY = -dxA * sin + dyA * cos;

    let wRaw = init.width;
    let hRaw = init.height;

    if (this.activeHandle === 'se') {
      wRaw = projX;
      hRaw = projY;
    } else if (this.activeHandle === 'sw') {
      wRaw = -projX;
      hRaw = projY;
    } else if (this.activeHandle === 'ne') {
      wRaw = projX;
      hRaw = -projY;
    } else if (this.activeHandle === 'nw') {
      wRaw = -projX;
      hRaw = -projY;
    }

    const keepAspect = item.type === 'image' || item.type === 'sticker';
    const ar = init.aspectRatio || (init.width / init.height);

    let newW, newH;
    if (keepAspect) {
      // Smooth responsive diagonal tracking cursor along aspect ratio
      const rawDiag = (wRaw + hRaw * ar) / 2;
      newW = Math.max(40, rawDiag);
      newH = newW / ar;
    } else {
      newW = Math.max(40, wRaw);
      newH = Math.max(30, hRaw);
    }

    // Determine new center point so the opposite anchor remains strictly locked in world space
    let newCx, newCy;
    if (this.activeHandle === 'se') {
      // Anchor is nw. Center is (+newW/2, +newH/2) from anchor in local frame.
      newCx = anchor.x + (newW / 2) * cos - (newH / 2) * sin;
      newCy = anchor.y + (newW / 2) * sin + (newH / 2) * cos;
    } else if (this.activeHandle === 'sw') {
      // Anchor is ne. Center is (-newW/2, +newH/2) from anchor in local frame.
      newCx = anchor.x + (-newW / 2) * cos - (newH / 2) * sin;
      newCy = anchor.y + (-newW / 2) * sin + (newH / 2) * cos;
    } else if (this.activeHandle === 'ne') {
      // Anchor is sw. Center is (+newW/2, -newH/2) from anchor in local frame.
      newCx = anchor.x + (newW / 2) * cos - (-newH / 2) * sin;
      newCy = anchor.y + (newW / 2) * sin + (-newH / 2) * cos;
    } else if (this.activeHandle === 'nw') {
      // Anchor is se. Center is (-newW/2, -newH/2) from anchor in local frame.
      newCx = anchor.x + (-newW / 2) * cos - (-newH / 2) * sin;
      newCy = anchor.y + (-newW / 2) * sin + (-newH / 2) * cos;
    }

    item.width = Math.round(newW);
    item.height = Math.round(newH);
    item.x = Math.round(newCx - item.width / 2);
    item.y = Math.round(newCy - item.height / 2);

    this.triggerChange();
  }

  onMouseUp() {
    if (this.isPanning) {
      this.isPanning = false;
      this.canvas.style.cursor = this.isSpacePressed ? 'grab' : 'default';
    }

    if (this.activeHandle) {
      this.activeHandle = null;
      this.activeSnapLines = [];
      this.saveHistory('Transform item');
      this.render();
    }
  }

  hitTestHandles(item, canvasPoint, isTouch = false) {
    const handles = item.getHandles(this.zoom);
    const radius = (isTouch ? 32 : 14) / this.zoom;

    for (const [key, pos] of Object.entries(handles)) {
      const dist = Math.hypot(canvasPoint.x - pos.x, canvasPoint.y - pos.y);
      if (dist <= radius) {
        return key;
      }
    }
    return null;
  }

  updateCursor(canvasPoint) {
    if (this.isSpacePressed) {
      this.canvas.style.cursor = 'grab';
      return;
    }

    if (this.selectedItem) {
      const handle = this.hitTestHandles(this.selectedItem, canvasPoint, false);
      if (handle) {
        if (handle === 'rot') {
          this.canvas.style.cursor = 'crosshair';
          return;
        }
        this.canvas.style.cursor = 'nwse-resize';
        return;
      }
    }

    for (let i = this.items.length - 1; i >= 0; i--) {
      if (this.items[i].containsPoint(canvasPoint.x, canvasPoint.y)) {
        this.canvas.style.cursor = 'move';
        return;
      }
    }

    this.canvas.style.cursor = 'default';
  }

  render() {
    const ctx = this.ctx;
    ctx.save();

    ctx.fillStyle = '#111310';
    ctx.fillRect(0, 0, this.viewportWidth, this.viewportHeight);

    ctx.translate(this.panX, this.panY);
    ctx.scale(this.zoom, this.zoom);

    this.renderCanvasBackground(ctx);

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, this.totalWidth, this.totalHeight);
    ctx.clip();
    for (const item of this.items) item.render(ctx);
    ctx.restore();

    if (this.showGuides) {
      this.renderSlideGuides(ctx);
    }

    this.renderSnapLines(ctx);

    if (this.selectedItem) {
      this.renderSelectionHandles(ctx, this.selectedItem);
    }

    ctx.restore();
    this.ensureAnimationLoop();
    this.onViewChange?.();
  }

  renderCanvasBackground(ctx) {
    const w = this.totalWidth;
    const h = this.totalHeight;

    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
    ctx.shadowBlur = 36 / this.zoom;
    ctx.shadowOffsetY = 16 / this.zoom;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.restore();

    if (this.background.startsWith('linear-gradient')) {
      const grad = ctx.createLinearGradient(0, 0, w, h);
      const matches = this.background.match(/#(?:[0-9a-fA-F]{3}){1,2}|rgba?\([^)]+\)/g);
      if (matches && matches.length >= 2) {
        grad.addColorStop(0, matches[0]);
        grad.addColorStop(1, matches[1]);
        ctx.fillStyle = grad;
      } else {
        ctx.fillStyle = '#ffffff';
      }
      ctx.fillRect(0, 0, w, h);
    } else {
      ctx.fillStyle = this.background;
      ctx.fillRect(0, 0, w, h);
    }
  }

  renderSlideGuides(ctx) {
    const h = this.totalHeight;

    // Clean subtle vertical dashed dividers (No text "SEAM")
    for (let s = 1; s < this.slideCount; s++) {
      const x = s * this.slideWidth;

      ctx.save();
      ctx.strokeStyle = 'rgba(80, 84, 70, 0.45)';
      ctx.lineWidth = 2 / this.zoom;
      ctx.setLineDash([8 / this.zoom, 8 / this.zoom]);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
      ctx.restore();
    }

  }

  // Visual Dynamic Smart Snap Alignment Lines with crosshairs
  renderSnapLines(ctx) {
    if (!this.activeSnapLines || this.activeSnapLines.length === 0) return;

    ctx.save();
    ctx.lineWidth = 2.5 / this.zoom;
    ctx.setLineDash([6 / this.zoom, 6 / this.zoom]);

    for (const line of this.activeSnapLines) {
      ctx.strokeStyle = line.color || '#06b6d4';
      ctx.beginPath();
      if (line.type === 'v') {
        ctx.moveTo(line.x, 0);
        ctx.lineTo(line.x, this.totalHeight);
      } else if (line.type === 'h') {
        ctx.moveTo(0, line.y);
        ctx.lineTo(this.totalWidth, line.y);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  renderSelectionHandles(ctx, item) {
    ctx.save();

    const cx = item.centerX;
    const cy = item.centerY;
    ctx.translate(cx, cy);
    ctx.rotate((item.rotation * Math.PI) / 180);
    ctx.translate(-item.width / 2, -item.height / 2);

    ctx.strokeStyle = '#ed7952';
    ctx.lineWidth = 2.5 / this.zoom;
    ctx.strokeRect(0, 0, item.width, item.height);

    const rotDist = 38 / this.zoom;
    ctx.beginPath();
    ctx.moveTo(item.width / 2, 0);
    ctx.lineTo(item.width / 2, -rotDist);
    ctx.strokeStyle = '#ed7952';
    ctx.stroke();

    const handleRadius = 9 / this.zoom;
    const drawPoint = (hx, hy, isRot = false) => {
      ctx.beginPath();
      ctx.arc(hx, hy, isRot ? handleRadius + 3 / this.zoom : handleRadius, 0, Math.PI * 2);
      ctx.fillStyle = isRot ? '#ed7952' : '#ffffff';
      ctx.fill();
      ctx.strokeStyle = '#ed7952';
      ctx.lineWidth = 2.5 / this.zoom;
      ctx.stroke();
    };

    const w = item.width;
    const h = item.height;

    drawPoint(0, 0);
    drawPoint(w, 0);
    drawPoint(w, h);
    drawPoint(0, h);

    drawPoint(w / 2, -rotDist, true);

    ctx.restore();
  }
}

// ---- END js/canvas.js ----

// ---- BEGIN js/storage.js ----
/**
 * NotSCRL Project Persistent Cache & Storage Engine
 * Auto-persists full projects into browser storage (IndexedDB with localStorage fallback).
 * Reports committed saves and keeps a local fallback when browser quotas allow it.
 */

class StorageManager {
  constructor(engine) {
    this.engine = engine;
    this.dbName = "NotScrlStorageDB";
    this.storeName = "projects";
    this.projectKey = "active_project";
    this.localKey = "notscrl_active_project_backup";
    this.saveTimeout = null;
    this.projectId = null;
    this.projectName = "Mi carrusel";
    this.db = null;
    this.changeRevision = 0;
    this.lastTimestamp = 0;

    this.dbPromise = this.initDB();
  }

  initDB() {
    return new Promise((resolve) => {
      if (!window.indexedDB) {
        resolve(null);
        return;
      }
      try {
        const req = window.indexedDB.open(this.dbName, 2);
        req.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains(this.storeName)) {
            db.createObjectStore(this.storeName);
          }
          if (!db.objectStoreNames.contains('originals')) db.createObjectStore('originals');
        };
        req.onsuccess = (e) => {
          this.db = e.target.result;
          resolve(this.db);
        };
        req.onerror = () => resolve(null);
      } catch (err) {
        resolve(null);
      }
    });
  }

  async saveOriginal(file) {
    const db = await this.dbPromise;
    if (!db) throw new Error('No se puede conservar la foto original en este navegador.');
    const key = crypto.randomUUID();
    await new Promise((resolve, reject) => {
      const tx = db.transaction('originals', 'readwrite');
      tx.objectStore('originals').put(file, key);
      tx.oncomplete = resolve;
      tx.onerror = tx.onabort = () => reject(new Error('No hay espacio para conservar la foto original.'));
    });
    return key;
  }

  async loadOriginal(key) {
    const db = await this.dbPromise;
    if (!db) throw new Error('No se pudo recuperar la foto original.');
    return new Promise((resolve, reject) => {
      const req = db.transaction('originals').objectStore('originals').get(key);
      req.onsuccess = () => req.result ? resolve(req.result) : reject(new Error('Falta la foto original.'));
      req.onerror = () => reject(new Error('No se pudo recuperar la foto original.'));
    });
  }

  scheduleAutoSave() {
    if (!this.projectId || this.engine.isRestoringHistory) return;
    this.changeRevision++;
    this.onStatus?.("saving");
    clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(() => {
      this.saveTimeout = null;
      this.saveProject();
    }, 350);
  }

  captureProject() {
    this.lastTimestamp = Math.max(Date.now(), this.lastTimestamp + 1);
    return {
      version: 1,
      id:
        this.projectId ||
        (this.projectId = crypto.randomUUID?.() || String(Date.now())),
      name: this.projectName,
      status: "draft",
      thumbnail: this.thumbnail || null,
      timestamp: this.lastTimestamp,
      slideCount: this.engine.slideCount,
      slideWidth: this.engine.slideWidth,
      slideHeight: this.engine.slideHeight,
      aspectRatioName: this.engine.aspectRatioName,
      background: this.engine.background,
      items: this.engine.items.map((it) => this.engine.serializeItem(it)),
    };
  }

  async saveProject() {
    const revision = this.changeRevision;
    try {
      if (this.engine.isRestoringHistory) return null;
      const data = this.captureProject();

      // Write the recovery copy before yielding; pagehide cannot wait for a promise.
      let fallbackSaved = false;
      try {
        localStorage.setItem(this.localKey, JSON.stringify(data));
        fallbackSaved = true;
      } catch {
        /* Large photos can exceed the localStorage quota. */
      }

      // IndexedDB commits the active draft and library entry atomically.
      const db = this.db || (await this.dbPromise);
      let databaseSaved = false;
      if (db) {
        try {
          await new Promise((resolve, reject) => {
            const tx = db.transaction(this.storeName, "readwrite");
            tx.objectStore(this.storeName).put(data, this.projectKey);
            tx.objectStore(this.storeName).put(data, `project_${data.id}`);
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error);
            tx.onabort = () => reject(tx.error);
          });
          databaseSaved = true;
        } catch {
          /* Try the local backup if the database is full or unavailable. */
        }
      }

      if (!databaseSaved && !fallbackSaved)
        throw new Error("No hay espacio de almacenamiento");
      this.lastSaveInLibrary = databaseSaved;
      if (revision === this.changeRevision)
        this.onStatus?.(databaseSaved ? "saved" : "fallback");
      return data;
    } catch (err) {
      console.warn("Error saving project to cache:", err);
      if (revision === this.changeRevision) this.onStatus?.("error");
      return null;
    }
  }

  async flush() {
    clearTimeout(this.saveTimeout);
    this.saveTimeout = null;
    return this.saveProject();
  }

  saveOnExit() {
    if (!this.projectId || this.engine.isRestoringHistory) return;
    clearTimeout(this.saveTimeout);
    this.saveTimeout = null;
    return this.saveProject();
  }

  async listProjects() {
    const db = await this.dbPromise;
    if (!db) {
      const current = await this.loadProject();
      return current ? [current] : [];
    }
    const projects = await new Promise((resolve) => {
      const req = db
        .transaction(this.storeName)
        .objectStore(this.storeName)
        .getAll();
      req.onsuccess = () => {
        const unique = new Map();
        req.result.filter((p) => p.id).forEach((p) => unique.set(p.id, p));
        resolve([...unique.values()].sort((a, b) => b.timestamp - a.timestamp));
      };
      req.onerror = () => resolve([]);
    }).catch(() => []);
    const active = await this.loadProject();
    if (active?.id) {
      const previous = projects.findIndex((p) => p.id === active.id);
      if (previous < 0) projects.push(active);
      else if (active.timestamp > projects[previous].timestamp)
        projects[previous] = active;
    }
    return projects.sort((a, b) => b.timestamp - a.timestamp);
  }

  async loadProject() {
    let databaseProject = null;
    // 1. Try IndexedDB
    try {
      const db = await this.dbPromise;
      if (db) {
        const data = await new Promise((resolve) => {
          const tx = db.transaction(this.storeName, "readonly");
          const req = tx.objectStore(this.storeName).get(this.projectKey);
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => resolve(null);
        });
        if (data && Array.isArray(data.items)) {
          databaseProject = data;
        }
      }
    } catch (e) {}

    // 2. Fallback to localStorage
    try {
      const raw = localStorage.getItem(this.localKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.items)) {
          databaseProject =
            !databaseProject || parsed.timestamp > databaseProject.timestamp
              ? parsed
              : databaseProject;
        }
      }
    } catch (e) {}

    this.lastTimestamp = Math.max(
      this.lastTimestamp,
      databaseProject?.timestamp || 0,
    );
    return databaseProject;
  }

  async clearCache() {
    try {
      const db = await this.dbPromise;
      if (db) {
        const tx = db.transaction(this.storeName, "readwrite");
        tx.objectStore(this.storeName).delete(this.projectKey);
      }
      localStorage.removeItem(this.localKey);
    } catch (e) {}
  }
}

// ---- END js/storage.js ----

// ---- BEGIN js/exporter.js ----
/**
 * High-Resolution Slicing and Export Engine
 * Generates pixel-perfect 1080p Instagram slides without guides or handles.
 * Slices the panoramic ribbon into individual slide PNGs and creates a instant ZIP package.
 */

class CanvasExporter {
  constructor(engine, storage = null) {
    this.engine = engine;
    this.storage = storage;
  }

  renderThumbnail(index, width = 180) {
    const engine = this.engine;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = Math.round(width * engine.slideHeight / engine.slideWidth);
    const ctx = canvas.getContext('2d');
    ctx.scale(width / engine.slideWidth, width / engine.slideWidth);
    ctx.translate(-index * engine.slideWidth, 0);
    this.renderContent(ctx, engine.totalWidth, engine.totalHeight);
    return canvas;
  }

  renderContent(ctx, width, height) {
    this.renderBackground(ctx, width, height);
    for (const item of this.engine.items) item.render(ctx);
  }

  renderBackground(ctx, width, height) {
    const engine = this.engine;
    if (engine.background.startsWith('linear-gradient')) {
      const colors = engine.background.match(/#(?:[0-9a-fA-F]{3}){1,2}|rgba?\([^)]+\)/g);
      const gradient = ctx.createLinearGradient(0, 0, width, height);
      gradient.addColorStop(0, colors?.[0] || '#ffffff');
      gradient.addColorStop(1, colors?.[1] || '#ffffff');
      ctx.fillStyle = gradient;
    } else ctx.fillStyle = engine.background;
    ctx.fillRect(0, 0, width, height);
  }

  async renderOriginals(index = null) {
    const engine = this.engine;
    const canvas = document.createElement('canvas');
    canvas.width = index === null ? engine.totalWidth : engine.slideWidth;
    canvas.height = engine.totalHeight;
    const ctx = canvas.getContext('2d');
    if (index !== null) ctx.translate(-index * engine.slideWidth, 0);
    this.renderBackground(ctx, engine.totalWidth, engine.totalHeight);
    const items = engine.items.map(item => Object.assign(Object.create(Object.getPrototypeOf(item)), item));
    try {
      for (const item of items) {
        if (!item.originalKey || item.mediaType === 'video') {
          item.render(ctx);
          continue;
        }
        const file = await this.storage.loadOriginal(item.originalKey);
        const url = URL.createObjectURL(file);
        const image = new Image();
        try {
          image.src = url;
          await image.decode();
          item.image = image;
          item.render(ctx);
        } finally {
          image.src = '';
          URL.revokeObjectURL(url);
        }
        await new Promise(resolve => setTimeout(resolve, 0));
      }
      return canvas;
    } catch (error) {
      canvas.width = canvas.height = 0;
      throw error;
    }
  }

  renderSlide(index) {
    return this.renderThumbnail(index, this.engine.slideWidth);
  }

  toBlob(canvas) {
    return new Promise((resolve, reject) => canvas.toBlob(blob => {
      if (blob) resolve(blob);
      else reject(new Error('No se pudo generar la imagen'));
    }, 'image/png'));
  }

  /**
   * Renders the complete panoramic canvas offscreen at full 1:1 native resolution
   * @returns {HTMLCanvasElement}
   */
  renderFullMasterCanvas() {
    const engine = this.engine;
    const master = document.createElement('canvas');
    master.width = engine.totalWidth;
    master.height = engine.totalHeight;
    const ctx = master.getContext('2d');

    this.renderContent(ctx, master.width, master.height);
    return master;
  }

  /**
   * Downloads a single slide as PNG
   */
  async downloadSlide(slideNumber) {
    if (slideNumber < 1 || slideNumber > this.engine.slideCount) return;
    const canvas = await this.renderOriginals(slideNumber - 1);
    let blob;
    try { blob = await this.toBlob(canvas); }
    finally { canvas.width = canvas.height = 0; }
    this.triggerDownload(blob, `notscrl-slide-${String(slideNumber).padStart(2, '0')}.png`);
  }

  /**
   * Downloads the complete un-sliced panoramic banner
   */
  async downloadFullPanorama() {
    const master = await this.renderOriginals();
    let blob;
    try { blob = await this.toBlob(master); }
    finally { master.width = master.height = 0; }
    this.triggerDownload(blob, `notscrl-full-panorama-${this.engine.slideCount}-slides.png`);
  }

  /**
   * Slices all slides and packs them into a single ZIP file for 1-click download
   */
  async downloadAllAsZip(onProgress = null) {
    const zip = new SimpleZip();

    for (let i = 0; i < this.engine.slideCount; i++) {
      if (onProgress) {
        onProgress(`Preparando página ${i + 1} de ${this.engine.slideCount}…`, (i + 1) / (this.engine.slideCount + 1));
      }
      const canvas = await this.renderOriginals(i);
      let blob;
      try { blob = await this.toBlob(canvas); }
      finally { canvas.width = canvas.height = 0; }
      const filename = `slide_${String(i + 1).padStart(2, '0')}.png`;
      await zip.addFile(filename, blob);
    }

    if (onProgress) {
      onProgress('Preparando tu descarga…', 0.95);
    }

    const zipBlob = zip.generate();
    this.triggerDownload(zipBlob, `notscrl-instagram-carousel.zip`);

    if (onProgress) {
      onProgress('Tu carrusel está listo. Descarga iniciada.', 1.0);
    }
  }

  triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 200);
  }
}

// ---- END js/exporter.js ----

// ---- BEGIN js/preview.js ----
/**
 * Realistic Instagram Carousel Mobile Simulator (Mobile-First Touch Gestures)
 * Supports natural swipe inertia, slide counter, and dynamic pagination dots.
 */

class PreviewSimulator {
  constructor(exporter, containerModal) {
    this.exporter = exporter;
    this.modal = containerModal;
    this.currentSlideIndex = 0;
    this.slideCanvases = [];
    this.isDragging = false;

    this.bindDom();
  }

  bindDom() {
    this.track = this.modal.querySelector('.ig-carousel-track');
    this.dotsContainer = this.modal.querySelector('#ig-dots-wrap') || this.modal.querySelector('.ig-carousel-dots');
    this.counter = this.modal.querySelector('#ig-slide-counter') || this.modal.querySelector('.ig-slide-counter');
    this.closeBtn = this.modal.querySelector('#btn-close-ig-preview') || this.modal.querySelector('.ig-close-btn');

    if (this.closeBtn) {
      this.closeBtn.addEventListener('click', () => this.close());
    }

    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) this.close();
    });

    this.bindSwipeGestures();
  }

  bindSwipeGestures() {
    const track = this.track;
    if (!track) return;

    let startX = 0;
    let deltaX = 0;
    let isSwiping = false;

    const onStart = (clientX) => {
      isSwiping = true;
      startX = clientX;
      deltaX = 0;
      track.style.transition = 'none';
    };

    const onMove = (clientX) => {
      if (!isSwiping) return;
      deltaX = clientX - startX;
      const baseOffset = -this.currentSlideIndex * 100;
      const percentOffset = (deltaX / (track.clientWidth || 360)) * 100;
      track.style.transform = `translateX(${baseOffset + percentOffset}%)`;
    };

    const onEnd = () => {
      if (!isSwiping) return;
      isSwiping = false;
      track.style.transition = 'transform 0.32s cubic-bezier(0.2, 0.8, 0.2, 1)';

      const threshold = (track.clientWidth || 360) * 0.16;
      if (deltaX < -threshold && this.currentSlideIndex < this.slideCanvases.length - 1) {
        this.goToSlide(this.currentSlideIndex + 1);
      } else if (deltaX > threshold && this.currentSlideIndex > 0) {
        this.goToSlide(this.currentSlideIndex - 1);
      } else {
        this.goToSlide(this.currentSlideIndex); // Snap back
      }
    };

    // Mouse drag
    track.addEventListener('mousedown', (e) => onStart(e.clientX));
    window.addEventListener('mousemove', (e) => onMove(e.clientX));
    window.addEventListener('mouseup', () => onEnd());

    // Touch swipe (Mobile native feel)
    track.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) onStart(e.touches[0].clientX);
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
      if (e.touches.length === 1) onMove(e.touches[0].clientX);
    }, { passive: true });

    window.addEventListener('touchend', () => onEnd());
  }

  open() {
    this.modal.classList.remove('hidden');
    this.refresh();
  }

  close() {
    this.modal.classList.add('hidden');
  }

  refresh() {
    const slides = Array.from({ length: this.exporter.engine.slideCount }, (_, index) => ({
      index: index + 1, canvas: this.exporter.renderThumbnail(index, 480)
    }));
    this.slideCanvases = slides;
    this.currentSlideIndex = 0;
    this.track.style.transform = 'translateX(0)';
    this.modal.style.setProperty('--preview-ratio', this.exporter.engine.slideWidth / this.exporter.engine.slideHeight);

    this.track.innerHTML = '';
    if (this.dotsContainer) this.dotsContainer.innerHTML = '';

    const viewport = this.modal.querySelector('.ig-mobile-viewport');
    if (viewport) {
      viewport.style.aspectRatio = `${this.exporter.engine.slideWidth} / ${this.exporter.engine.slideHeight}`;
    }

    slides.forEach((slide, idx) => {
      const slideDiv = document.createElement('div');
      slideDiv.className = 'ig-carousel-slide';
      slide.canvas.className = 'ig-slide-img';
      slideDiv.appendChild(slide.canvas);
      this.track.appendChild(slideDiv);

      if (this.dotsContainer) {
        const dot = document.createElement('button');
        dot.setAttribute('aria-label', `Ver página ${idx + 1}`);
        dot.className = `ig-dot ${idx === 0 ? 'active' : ''}`;
        dot.addEventListener('click', () => this.goToSlide(idx));
        this.dotsContainer.appendChild(dot);
      }
    });

    this.updateControls();
  }

  goToSlide(index) {
    const total = this.slideCanvases.length;
    this.currentSlideIndex = Math.max(0, Math.min(total - 1, index));

    this.track.style.transition = 'transform 0.32s cubic-bezier(0.2, 0.8, 0.2, 1)';
    this.track.style.transform = `translateX(-${this.currentSlideIndex * 100}%)`;

    if (this.dotsContainer) {
      const dots = this.dotsContainer.querySelectorAll('.ig-dot');
      dots.forEach((d, i) => {
        d.classList.toggle('active', i === this.currentSlideIndex);
        d.setAttribute('aria-pressed', i === this.currentSlideIndex);
      });
    }

    this.updateControls();
  }

  updateControls() {
    const total = this.slideCanvases.length;
    if (this.counter) {
      this.counter.textContent = `${this.currentSlideIndex + 1}/${total}`;
    }
  }
}

// ---- END js/preview.js ----

// ---- BEGIN js/cropper.js ----
/**
 * NotSCRL Interactive Mobile Image Cropper
 * Allows non-destructive cropping, custom framing, and instant aspect ratio presets
 * (1:1, 4:5 Instagram, 9:16 Stories, 16:9 Cinema, 3:4 Classic, and Freeform).
 */

class ImageCropper {
  constructor(engine) {
    this.engine = engine;
    this.targetItem = null;

    this.modal = document.getElementById('crop-modal');
    this.viewport = document.getElementById('crop-viewport');
    this.imgEl = document.getElementById('crop-source-img');
    this.cropBox = document.getElementById('crop-box');

    // Drag interaction state
    this.isDragging = false;
    this.dragMode = null; // 'body', 'nw', 'ne', 'se', 'sw'
    this.startPointer = { x: 0, y: 0 };
    this.initialBox = { x: 0, y: 0, width: 100, height: 100 };

    // Aspect ratio: null for free, or numeric (width / height)
    this.aspectRatio = null;

    // Displayed image geometry relative to viewport
    this.imgRect = { left: 0, top: 0, width: 0, height: 0 };

    this.bindEvents();
  }

  bindEvents() {
    if (!this.modal) return;

    // Close button
    const closeBtn = document.getElementById('btn-close-crop');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.close());
    }

    // Backdrop click
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) this.close();
    });

    // Reset button
    const resetBtn = document.getElementById('btn-crop-reset');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => this.resetCrop());
    }

    // Apply button
    const applyBtn = document.getElementById('btn-crop-apply');
    if (applyBtn) {
      applyBtn.addEventListener('click', () => this.applyCrop());
    }

    // Aspect ratio pills
    const aspectBtns = this.modal.querySelectorAll('.crop-aspect-btn');
    aspectBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        aspectBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        this.setAspectRatio(btn.dataset.ratio);
      });
    });

    // Interaction with the Crop Box (Mouse & Touch)
    this.bindCropBoxInteractions();
  }

  bindCropBoxInteractions() {
    const box = this.cropBox;
    if (!box) return;

    // Pointer start (Mouse & Touch)
    const onStart = (clientX, clientY, target) => {
      const handle = target.dataset?.handle;
      this.dragMode = handle || 'body';
      this.isDragging = true;
      this.startPointer = { x: clientX, y: clientY };

      this.initialBox = {
        left: parseFloat(box.style.left) || 0,
        top: parseFloat(box.style.top) || 0,
        width: parseFloat(box.style.width) || box.offsetWidth,
        height: parseFloat(box.style.height) || box.offsetHeight
      };
    };

    const onMove = (clientX, clientY) => {
      if (!this.isDragging) return;
      const dx = clientX - this.startPointer.x;
      const dy = clientY - this.startPointer.y;

      const imgW = this.imgRect.width;
      const imgH = this.imgRect.height;
      if (imgW <= 0 || imgH <= 0) return;

      const init = this.initialBox;

      if (this.dragMode === 'body') {
        // Move crop box inside image bounds
        let newLeft = Math.max(0, Math.min(imgW - init.width, init.left + dx));
        let newTop = Math.max(0, Math.min(imgH - init.height, init.top + dy));
        box.style.left = `${Math.round(newLeft)}px`;
        box.style.top = `${Math.round(newTop)}px`;
        return;
      }

      // Handle corner resizing
      let newLeft = init.left;
      let newTop = init.top;
      let newW = init.width;
      let newH = init.height;

      const minSize = 40;

      if (this.dragMode === 'se') {
        newW = Math.max(minSize, Math.min(imgW - init.left, init.width + dx));
        newH = this.aspectRatio ? newW / this.aspectRatio : Math.max(minSize, Math.min(imgH - init.top, init.height + dy));
        if (init.top + newH > imgH && this.aspectRatio) {
          newH = imgH - init.top;
          newW = newH * this.aspectRatio;
        }
      } else if (this.dragMode === 'sw') {
        newW = Math.max(minSize, Math.min(init.left + init.width, init.width - dx));
        newH = this.aspectRatio ? newW / this.aspectRatio : Math.max(minSize, Math.min(imgH - init.top, init.height + dy));
        if (init.top + newH > imgH && this.aspectRatio) {
          newH = imgH - init.top;
          newW = newH * this.aspectRatio;
        }
        newLeft = init.left + (init.width - newW);
      } else if (this.dragMode === 'ne') {
        newW = Math.max(minSize, Math.min(imgW - init.left, init.width + dx));
        newH = this.aspectRatio ? newW / this.aspectRatio : Math.max(minSize, Math.min(init.top + init.height, init.height - dy));
        if (init.top + init.height - newH < 0 && this.aspectRatio) {
          newH = init.top + init.height;
          newW = newH * this.aspectRatio;
        }
        newTop = init.top + (init.height - newH);
      } else if (this.dragMode === 'nw') {
        newW = Math.max(minSize, Math.min(init.left + init.width, init.width - dx));
        newH = this.aspectRatio ? newW / this.aspectRatio : Math.max(minSize, Math.min(init.top + init.height, init.height - dy));
        if (init.top + init.height - newH < 0 && this.aspectRatio) {
          newH = init.top + init.height;
          newW = newH * this.aspectRatio;
        }
        newLeft = init.left + (init.width - newW);
        newTop = init.top + (init.height - newH);
      }

      box.style.left = `${Math.round(newLeft)}px`;
      box.style.top = `${Math.round(newTop)}px`;
      box.style.width = `${Math.round(newW)}px`;
      box.style.height = `${Math.round(newH)}px`;
    };

    const onEnd = () => {
      this.isDragging = false;
      this.dragMode = null;
    };

    // Mouse handlers
    box.addEventListener('mousedown', (e) => {
      e.preventDefault();
      onStart(e.clientX, e.clientY, e.target);
    });

    window.addEventListener('mousemove', (e) => {
      if (this.isDragging) onMove(e.clientX, e.clientY);
    });

    window.addEventListener('mouseup', () => {
      if (this.isDragging) onEnd();
    });

    // Touch handlers
    box.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        e.preventDefault();
        onStart(e.touches[0].clientX, e.touches[0].clientY, e.target);
      }
    }, { passive: false });

    window.addEventListener('touchmove', (e) => {
      if (this.isDragging && e.touches.length === 1) {
        onMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: false });

    window.addEventListener('touchend', () => {
      if (this.isDragging) onEnd();
    });
  }

  open(imageItem) {
    if (!imageItem || imageItem.type !== 'image') return;
    this.targetItem = imageItem;

    this.modal.classList.remove('hidden');

    // Load image into cropper preview
    this.imgEl.src = imageItem.image.src;

    // Reset aspect ratio pill to Libre
    const aspectBtns = this.modal.querySelectorAll('.crop-aspect-btn');
    aspectBtns.forEach((b) => b.classList.toggle('active', b.dataset.ratio === 'free'));
    this.aspectRatio = null;

    this.imgEl.onload = () => {
      this.layoutCropBox();
    };

    // If already loaded / cached
    if (this.imgEl.complete && this.imgEl.naturalWidth > 0) {
      setTimeout(() => this.layoutCropBox(), 30);
    }
  }

  layoutCropBox() {
    // Measure rendered image within the viewport
    const vpRect = this.viewport.parentElement.getBoundingClientRect();
    const natW = this.imgEl.naturalWidth || 800;
    const natH = this.imgEl.naturalHeight || 600;

    // Scale to fit viewport with padding
    const maxW = Math.max(100, vpRect.width - 24);
    const maxH = Math.max(100, vpRect.height - 24);

    const scale = Math.min(maxW / natW, maxH / natH, 1.0);
    const dispW = Math.round(natW * scale);
    const dispH = Math.round(natH * scale);

    this.viewport.style.width = `${dispW}px`;
    this.viewport.style.height = `${dispH}px`;

    this.imgEl.style.width = `${dispW}px`;
    this.imgEl.style.height = `${dispH}px`;

    this.imgRect = {
      width: dispW,
      height: dispH
    };

    // Position crop box based on item's existing crop or full
    const existingCrop = this.targetItem?.crop || { x: 0, y: 0, width: 1, height: 1 };
    const boxLeft = Math.round(existingCrop.x * dispW);
    const boxTop = Math.round(existingCrop.y * dispH);
    const boxW = Math.round(existingCrop.width * dispW);
    const boxH = Math.round(existingCrop.height * dispH);

    this.cropBox.style.left = `${boxLeft}px`;
    this.cropBox.style.top = `${boxTop}px`;
    this.cropBox.style.width = `${boxW}px`;
    this.cropBox.style.height = `${boxH}px`;
  }

  setAspectRatio(ratioKey) {
    const natW = this.imgEl.naturalWidth || 1;
    const natH = this.imgEl.naturalHeight || 1;

    if (ratioKey === 'free') {
      this.aspectRatio = null;
      return;
    } else if (ratioKey === 'original') {
      this.aspectRatio = natW / natH;
    } else if (ratioKey === '1:1') {
      this.aspectRatio = 1.0;
    } else if (ratioKey === '4:5') {
      this.aspectRatio = 4 / 5;
    } else if (ratioKey === '9:16') {
      this.aspectRatio = 9 / 16;
    } else if (ratioKey === '16:9') {
      this.aspectRatio = 16 / 9;
    } else if (ratioKey === '3:4') {
      this.aspectRatio = 3 / 4;
    }

    if (!this.aspectRatio) return;

    // Adjust current crop box to match the ratio centered within image
    const imgW = this.imgRect.width;
    const imgH = this.imgRect.height;
    if (imgW <= 0 || imgH <= 0) return;

    let targetW = imgW * 0.9;
    let targetH = targetW / this.aspectRatio;

    if (targetH > imgH * 0.9) {
      targetH = imgH * 0.9;
      targetW = targetH * this.aspectRatio;
    }

    const newLeft = Math.round((imgW - targetW) / 2);
    const newTop = Math.round((imgH - targetH) / 2);

    this.cropBox.style.left = `${newLeft}px`;
    this.cropBox.style.top = `${newTop}px`;
    this.cropBox.style.width = `${Math.round(targetW)}px`;
    this.cropBox.style.height = `${Math.round(targetH)}px`;
  }

  resetCrop() {
    const imgW = this.imgRect.width;
    const imgH = this.imgRect.height;
    this.cropBox.style.left = '0px';
    this.cropBox.style.top = '0px';
    this.cropBox.style.width = `${imgW}px`;
    this.cropBox.style.height = `${imgH}px`;
    this.aspectRatio = null;

    const aspectBtns = this.modal.querySelectorAll('.crop-aspect-btn');
    aspectBtns.forEach((b) => b.classList.toggle('active', b.dataset.ratio === 'free'));
  }

  applyCrop() {
    if (!this.targetItem) return;

    const imgW = this.imgRect.width;
    const imgH = this.imgRect.height;
    if (imgW <= 0 || imgH <= 0) {
      this.close();
      return;
    }

    const boxLeft = parseFloat(this.cropBox.style.left) || 0;
    const boxTop = parseFloat(this.cropBox.style.top) || 0;
    const boxW = parseFloat(this.cropBox.style.width) || imgW;
    const boxH = parseFloat(this.cropBox.style.height) || imgH;

    // Normalized coordinates (0..1)
    const x = Math.max(0, Math.min(0.95, boxLeft / imgW));
    const y = Math.max(0, Math.min(0.95, boxTop / imgH));
    // Keep the existing source-to-canvas mapping; cropping only hides pixels.
    this.targetItem.cropReference ||= { ...(this.targetItem.crop || { x: 0, y: 0, width: 1, height: 1 }) };
    this.targetItem.crop = {
      x, y,
      width: Math.max(0.05, Math.min(1 - x, boxW / imgW)),
      height: Math.max(0.05, Math.min(1 - y, boxH / imgH))
    };

    this.engine.triggerChange();
    this.engine.saveHistory('Recortar imagen');
    this.close();
  }

  close() {
    this.modal.classList.add('hidden');
    this.targetItem = null;
  }
}

// ---- END js/cropper.js ----

// ---- BEGIN js/frame-adjuster.js ----
/**
 * NotSCRL Manual Frame & Shape Adjuster Tool
 * Allows the user to manually reposition (pan) and zoom photos inside any shape mask
 * (Circle, Star, Heart, Arch, Flower, Polaroid, Film 35mm, or Rounded Rect).
 */

class FrameAdjuster {
  constructor(engine) {
    this.engine = engine;
    this.targetItem = null;

    this.modal = document.getElementById('frame-modal');
    this.canvas = document.getElementById('frame-canvas');
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
    this.zoomSlider = document.getElementById('frame-zoom-slider');
    this.zoomLabel = document.getElementById('frame-zoom-val');

    // Pan offset normalized (-1 to 1) and Zoom factor (1.0 to 3.5)
    this.panX = 0;
    this.panY = 0;
    this.zoom = 1.0;

    // Interaction dragging state
    this.isDragging = false;
    this.dragStart = { x: 0, y: 0 };
    this.initialPan = { x: 0, y: 0 };

    this.bindEvents();
  }

  bindEvents() {
    if (!this.modal) return;

    // Close button
    const closeBtn = document.getElementById('btn-close-frame-adjust');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.close());
    }

    // Backdrop click
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) this.close();
    });

    // Reset / Center button
    const resetBtn = document.getElementById('btn-frame-reset');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        this.panX = 0;
        this.panY = 0;
        this.zoom = 1.0;
        if (this.zoomSlider) this.zoomSlider.value = 1.0;
        if (this.zoomLabel) this.zoomLabel.textContent = '1.0x';
        this.renderPreview();
      });
    }

    // Apply button
    const applyBtn = document.getElementById('btn-frame-apply');
    if (applyBtn) {
      applyBtn.addEventListener('click', () => this.applyAdjustment());
    }

    // Zoom slider
    if (this.zoomSlider) {
      this.zoomSlider.addEventListener('input', (e) => {
        this.zoom = parseFloat(e.target.value) || 1.0;
        if (this.zoomLabel) this.zoomLabel.textContent = `${this.zoom.toFixed(1)}x`;
        this.renderPreview();
      });
    }

    // Canvas Mouse & Touch Dragging
    this.bindCanvasInteractions();
  }

  bindCanvasInteractions() {
    const canvas = this.canvas;
    if (!canvas) return;

    const onStart = (clientX, clientY) => {
      this.isDragging = true;
      this.dragStart = { x: clientX, y: clientY };
      this.initialPan = { x: this.panX, y: this.panY };
    };

    const onMove = (clientX, clientY) => {
      if (!this.isDragging) return;
      const dx = clientX - this.dragStart.x;
      const dy = clientY - this.dragStart.y;

      // Sensitivity factor relative to canvas size and zoom
      const sensitivity = 0.008 / Math.max(0.5, this.zoom * 0.8);
      this.panX = Math.max(-1.0, Math.min(1.0, this.initialPan.x - dx * sensitivity));
      this.panY = Math.max(-1.0, Math.min(1.0, this.initialPan.y - dy * sensitivity));

      this.renderPreview();
    };

    const onEnd = () => {
      this.isDragging = false;
    };

    // Mouse
    canvas.addEventListener('mousedown', (e) => {
      e.preventDefault();
      onStart(e.clientX, e.clientY);
    });

    window.addEventListener('mousemove', (e) => {
      if (this.isDragging) onMove(e.clientX, e.clientY);
    });

    window.addEventListener('mouseup', () => {
      if (this.isDragging) onEnd();
    });

    // Touch
    canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        e.preventDefault();
        onStart(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: false });

    window.addEventListener('touchmove', (e) => {
      if (this.isDragging && e.touches.length === 1) {
        onMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: false });

    window.addEventListener('touchend', () => {
      if (this.isDragging) onEnd();
    });
  }

  open(imageItem) {
    if (!imageItem || imageItem.type !== 'image') return;
    this.targetItem = imageItem;

    const fit = imageItem.fitOffset || { x: 0, y: 0, zoom: 1.0 };
    this.panX = fit.x || 0;
    this.panY = fit.y || 0;
    this.zoom = fit.zoom || 1.0;

    if (this.zoomSlider) this.zoomSlider.value = this.zoom;
    if (this.zoomLabel) this.zoomLabel.textContent = `${this.zoom.toFixed(1)}x`;

    this.modal.classList.remove('hidden');

    // Layout canvas dimensions
    setTimeout(() => {
      this.resizeCanvas();
      this.renderPreview();
    }, 40);
  }

  resizeCanvas() {
    const wrap = document.getElementById('frame-canvas-wrap');
    if (!wrap) return;

    const rect = wrap.getBoundingClientRect();
    const size = Math.min(380, Math.max(260, Math.min(rect.width - 24, rect.height - 24)));

    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    this.canvas.width = size * dpr;
    this.canvas.height = size * dpr;
    this.canvas.style.width = `${size}px`;
    this.canvas.style.height = `${size}px`;

    this.ctx.resetTransform?.();
    this.ctx.scale(dpr, dpr);
    this.stageSize = size;
  }

  renderPreview() {
    if (!this.ctx || !this.targetItem || !this.stageSize) return;

    const ctx = this.ctx;
    const S = this.stageSize;
    ctx.clearRect(0, 0, S, S);

    // Dark backdrop
    ctx.fillStyle = '#06070a';
    ctx.fillRect(0, 0, S, S);

    const pad = 24;
    const destW = S - pad * 2;
    const destH = S - pad * 2;
    const destX = pad;
    const destY = pad;

    // Mock item geometry on preview stage
    const item = this.targetItem;
    const originalFit = item.fitOffset;
    item.fitOffset = { x: this.panX, y: this.panY, zoom: this.zoom };

    ctx.save();
    ctx.translate(destX, destY);

    // 1. Draw shape clipping mask with image inside
    ctx.save();
    item.createShapePath(ctx, destW, destH);
    ctx.clip();
    item.drawImageCover(ctx, 0, 0, destW, destH);
    ctx.restore();

    // 2. Draw subtle shape outline
    ctx.save();
    item.createShapePath(ctx, destW, destH);
    ctx.strokeStyle = '#ed7952';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();

    // 3. Draw alignment crosshair inside shape
    ctx.save();
    item.createShapePath(ctx, destW, destH);
    ctx.clip();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);

    ctx.beginPath();
    ctx.moveTo(destW / 2, 0);
    ctx.lineTo(destW / 2, destH);
    ctx.moveTo(0, destH / 2);
    ctx.lineTo(destW, destH / 2);
    ctx.stroke();
    ctx.restore();

    ctx.restore();

    // Revert temporary item preview
    item.fitOffset = originalFit;
  }

  applyAdjustment() {
    if (!this.targetItem) return;

    this.targetItem.fitOffset = {
      x: this.panX,
      y: this.panY,
      zoom: this.zoom
    };

    this.engine.triggerChange();
    this.engine.saveHistory('Ajustar encuadre de forma');
    this.close();
  }

  close() {
    this.modal.classList.add('hidden');
    this.targetItem = null;
  }
}

// ---- END js/frame-adjuster.js ----

// ---- BEGIN js/templates.js ----
/**
 * Curated SCRL-Style Templates
 * Pre-configured panoramic collages with seamless seam crossings,
 * elegant editorial typography, polaroids, and stickers.
 */

function getSticker(id) {
  return STICKERS.find(s => s.id === id) || STICKERS[0];
}

function loadImage(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.src = url;
  });
}

async function applyTemplate(engine, templateName) {
  engine.items = [];
  engine.selectedItem = null;

  if (templateName === 'panorama') {
    // 3 Slides: Panorama Hero
    engine.slideCount = 3;
    engine.setAspectRatio('4:5');
    engine.background = '#f5f0ea';

    // 1. Wide landscape spanning across slide 1, 2 and 3 seamlessly!
    const mtnItem = new ImageItem(new Image(), 180, 260, 2400, 750);
    mtnItem.borderRadius = 8;
    mtnItem.shadow.enabled = true;
    mtnItem.shadow.blur = 28;
    engine.addItem(mtnItem);

    // 2. Large Editorial Headline
    const title = new TextItem('CHASING HORIZONS', 220, 120, 900, 100);
    title.fontFamily = "'Playfair Display', Georgia, serif";
    title.fontSize = 58;
    title.fontWeight = '700';
    title.color = '#1c1917';
    title.textAlign = 'left';
    engine.addItem(title);

    // 3. Subtitle spanning slide 2
    const subtitle = new TextItem('A CONTINUOUS VISUAL STORY • ISSUE 08', 1240, 140, 680, 50);
    subtitle.fontFamily = "'Inter', sans-serif";
    subtitle.fontSize = 18;
    subtitle.fontWeight = '600';
    subtitle.letterSpacing = 4;
    subtitle.color = '#78716c';
    subtitle.textAlign = 'left';
    engine.addItem(subtitle);

    // 4. Polaroid portrait photo on slide 3
    const archItem = new ImageItem(new Image(), 2380, 620, 540, 620);
    archItem.frameStyle = 'polaroid';
    archItem.caption = 'altitude 3,200m';
    archItem.rotation = -3;
    archItem.shadow.enabled = true;
    archItem.shadow.blur = 24;
    engine.addItem(archItem);

    // 5. Aesthetic Stamp Sticker on Slide 1
    const stampData = getSticker('stamp_scrl_aesthetic');
    const stampImg = await loadImage(stampData.url);
    const stampItem = new StickerItem(stampImg, 180, 1080, 140, 140, 'Issue Stamp');
    stampItem.rotation = 6;
    engine.addItem(stampItem);

    // 6. Washi tape on slide 3 polaroid
    const tapeData = getSticker('washi_tape_cream');
    const tapeImg = await loadImage(tapeData.url);
    const tapeItem = new StickerItem(tapeImg, 2540, 595, 200, 48, 'Washi Tape');
    tapeItem.rotation = -4;
    engine.addItem(tapeItem);

  } else if (templateName === 'editorial') {
    // 3 Slides: Vogue Editorial High Fashion
    engine.slideCount = 3;
    engine.setAspectRatio('4:5');
    engine.background = '#ffffff';

    // Slide 1 Headline
    const t1 = new TextItem('MODERN\nFORMS', 160, 280, 600, 180);
    t1.fontFamily = "'Cinzel', serif";
    t1.fontSize = 68;
    t1.fontWeight = '700';
    t1.textAlign = 'left';
    t1.color = '#0f172a';
    engine.addItem(t1);

    // Arch photo bridging slide 1 and slide 2 across seam 1!
    const archItem = new ImageItem(new Image(), 720, 200, 720, 900);
    archItem.borderRadius = 4;
    archItem.shadow.enabled = true;
    archItem.shadow.blur = 36;
    engine.addItem(archItem);

    // Muse photo bridging slide 2 and slide 3 across seam 2!
    const museItem = new ImageItem(new Image(), 1780, 280, 680, 850);
    museItem.borderRadius = 4;
    museItem.shadow.enabled = true;
    museItem.shadow.blur = 36;
    engine.addItem(museItem);

    // Elegant quote on slide 3
    const quote = new TextItem('"Simplicity is the keynote of all true elegance."', 2460, 340, 580, 120);
    quote.fontFamily = "'Playfair Display', serif";
    quote.fontStyle = 'italic';
    quote.fontSize = 26;
    quote.color = '#475569';
    quote.textAlign = 'left';
    engine.addItem(quote);

    // Star accent
    const starData = getSticker('star_five');
    const starImg = await loadImage(starData.url);
    const starItem = new StickerItem(starImg, 860, 130, 80, 80, 'Estrella');
    engine.addItem(starItem);

  } else if (templateName === 'scrapbook') {
    // 3 Slides: Nostalgic Photo Dump & Polaroid Collage
    engine.slideCount = 3;
    engine.setAspectRatio('4:5');
    engine.background = '#ede8df';

    // Polaroid 1 on Slide 1
    const p1 = new ImageItem(new Image(), 140, 240, 620, 720);
    p1.frameStyle = 'polaroid';
    p1.caption = 'ocean breeze';
    p1.rotation = -5;
    p1.shadow.enabled = true;
    engine.addItem(p1);

    // Polaroid 2 crossing Seam 1 (between Slide 1 and Slide 2!)
    const p2 = new ImageItem(new Image(), 820, 360, 640, 740);
    p2.frameStyle = 'polaroid';
    p2.caption = 'golden dunes';
    p2.rotation = 4;
    p2.shadow.enabled = true;
    engine.addItem(p2);

    // Polaroid 3 crossing Seam 2 (between Slide 2 and Slide 3!)
    const p3 = new ImageItem(new Image(), 1680, 220, 680, 760);
    p3.frameStyle = 'polaroid';
    p3.caption = 'take me back';
    p3.rotation = -3;
    p3.shadow.enabled = true;
    engine.addItem(p3);

    // Handwritten Title
    const dumpTitle = new TextItem('the scrapbook collection', 900, 140, 700, 80);
    dumpTitle.fontFamily = "'Caveat', cursive";
    dumpTitle.fontSize = 54;
    dumpTitle.fontWeight = '700';
    dumpTitle.color = '#3e362e';
    engine.addItem(dumpTitle);

    // Tapes and Paperclip
    const tapeData = getSticker('washi_tape_blush');
    const tapeImg = await loadImage(tapeData.url);
    const tape1 = new StickerItem(tapeImg, 340, 210, 200, 48, 'Washi Tape Blush');
    tape1.rotation = -8;
    engine.addItem(tape1);

    const tape2 = new StickerItem(tapeImg, 1020, 330, 210, 50, 'Washi Tape Blush');
    tape2.rotation = 6;
    engine.addItem(tape2);

    const clipData = getSticker('polaroid_clip');
    const clipImg = await loadImage(clipData.url);
    const clipItem = new StickerItem(clipImg, 1780, 170, 40, 95, 'Paperclip');
    engine.addItem(clipItem);

  } else if (templateName === 'filmstrip') {
    // 3 Slides: 35mm Analog Film Roll
    engine.slideCount = 3;
    engine.setAspectRatio('4:5');
    engine.background = '#0d0d11';

    // 3 Film strip images
    for (let i = 0; i < 3; i++) {
      const filmItem = new ImageItem(new Image(), 120 + i * 1040, 360, 920, 640);
      filmItem.frameStyle = 'film';
      engine.addItem(filmItem);
    }

    // Monospace header
    const filmTitle = new TextItem('KODACHROME 400 • FRAME 24A-26A', 500, 180, 1000, 60);
    filmTitle.fontFamily = "'Courier Prime', monospace";
    filmTitle.fontSize = 28;
    filmTitle.fontWeight = '700';
    filmTitle.letterSpacing = 4;
    filmTitle.color = '#f59e0b'; // Amber film label
    engine.addItem(filmTitle);

    // Barcode on slide 3
    const barcodeData = getSticker('film_35mm_barcode');
    const barcodeImg = await loadImage(barcodeData.url);
    const barcodeItem = new StickerItem(barcodeImg, 2750, 1080, 220, 75, 'Film Barcode');
    engine.addItem(barcodeItem);

  } else {
    // Blank Canvas
    engine.slideCount = 3;
    engine.setAspectRatio('4:5');
    engine.background = '#f5f0ea';
  }

  engine.fitToScreen();
  engine.saveHistory(`Apply ${templateName} template`);
}

// ---- END js/templates.js ----

// ---- BEGIN js/studio.js ----
const TEMPLATE_INFO = [
  ["panorama", "Horizontes", "Paisajes que siguen contigo", "01"],
  ["editorial", "Formas de ver", "Tu propia edición de revista", "02"],
  ["scrapbook", "Pequeños recuerdos", "Un diario de tus días favoritos", "03"],
  ["filmstrip", "En analógico", "Historias con alma de 35 mm", "04"],
];

class Studio {
  constructor(app) {
    this.app = app;
    this.engine = app.engine;
    this.storage = app.storage;
    this.view = "home";
    this.templatePreviews = new Map();
    this.bind();
    this.renderProjects();
    this.renderTemplates();
    this.update();
  }

  toast(message) {
    const el = document.getElementById("studio-toast");
    el.textContent = message;
    el.classList.remove("hidden");
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => el.classList.add("hidden"), 4000);
  }

  bind() {
    document.querySelectorAll("[data-home-tab]").forEach((btn) => {
      btn.addEventListener("click", () => this.showHome(btn.dataset.homeTab));
    });
    document.querySelector(".wordmark").addEventListener("click", (e) => {
      e.preventDefault();
      this.showHome("home");
    });
    document.querySelectorAll("[data-new-project]").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.getElementById("new-project-dialog").showModal();
      });
    });
    document.querySelectorAll("[data-close-dialog]").forEach((btn) => {
      btn.addEventListener("click", () => btn.closest("dialog").close());
    });
    document.getElementById("btn-help").addEventListener("click", () => {
      document.getElementById("help-dialog").showModal();
    });
    document
      .getElementById("new-project-form")
      .addEventListener("submit", async (e) => {
        e.preventDefault();
        if (!e.target.reportValidity()) return;
        const btn = e.target.querySelector("[type=submit]");
        btn.disabled = true;
        try {
          const created = await this.newProject(null, {
            name:
              document.getElementById("new-project-name").value.trim() ||
              "Mi próxima historia",
            ratio: document.getElementById("new-project-ratio").value,
            count: Number(document.getElementById("new-project-count").value),
          });
          if (created) {
            document.getElementById("new-project-dialog").close();
            e.target.reset();
          }
        } finally {
          btn.disabled = false;
        }
      });
    document
      .getElementById("btn-back-home")
      .addEventListener("click", async () => {
        if (this.busy) return;
        this.busy = true;
        try {
          this.renderPages();
          if (await this.storage.flush()) {
            this.toast("Borrador guardado.");
            await this.showHome("projects");
          } else
            this.toast(
              "No se pudo guardar el borrador. Tu edición sigue abierta.",
            );
        } finally {
          this.busy = false;
        }
      });
    document
      .getElementById("btn-save-draft")
      .addEventListener("click", async (e) => {
        const button = e.currentTarget;
        button.disabled = true;
        try {
          this.renderPages();
          const saved = await this.storage.flush();
          this.toast(
            saved
              ? "Borrador guardado. Puedes retomarlo desde Borradores."
              : "No se pudo guardar. Tu edición sigue abierta.",
          );
        } finally {
          button.disabled = false;
        }
      });
    document
      .getElementById("empty-canvas-action")
      .addEventListener("click", () => {
        this.app.openDrawer("photos", "Añadir fotos");
      });
    const name = document.getElementById("project-name");
    name.value = this.storage.projectName;
    name.addEventListener("input", () => {
      this.storage.projectName = name.value.trim() || "Sin título";
      this.storage.scheduleAutoSave();
      this.storage.flush();
    });
    name.addEventListener("blur", () => {
      name.value = this.storage.projectName;
    });
    document.getElementById("btn-layers").addEventListener("click", () => {
      this.app.openDrawer("adjust", "Capas del proyecto");
      document.getElementById("object-adjustments").classList.add("hidden");
      document.getElementById("layers-list").classList.remove("hidden");
      this.renderLayers();
    });
    document
      .getElementById("drawer-backdrop")
      .addEventListener("click", () => this.app.closeDrawer());
    let dragY = null;
    const handle = document.querySelector(".drawer-pill-handle");
    handle.addEventListener("pointerdown", (e) => {
      dragY = e.clientY;
      handle.setPointerCapture(e.pointerId);
    });
    handle.addEventListener("pointerup", (e) => {
      if (dragY !== null && e.clientY - dragY > 45) this.app.closeDrawer();
      dragY = null;
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        if (!this.app.frameAdjuster.modal.classList.contains("hidden"))
          this.app.frameAdjuster.close();
        else if (!this.app.cropper.modal.classList.contains("hidden"))
          this.app.cropper.close();
        else if (!this.app.exportModal.classList.contains("hidden"))
          this.app.exportModal.classList.add("hidden");
        else if (!this.app.preview.modal.classList.contains("hidden"))
          this.app.preview.close();
        else this.app.closeDrawer();
      }
    });
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden" && !this.app.loadingProject)
        this.storage.saveOnExit();
    });
    window.addEventListener("pagehide", () => {
      if (!this.app.loadingProject) this.storage.saveOnExit();
    });
    window.addEventListener("pageshow", (event) => {
      if (event.persisted && this.view !== "editor") this.renderProjects();
    });
    this.engine.onViewChange = () => this.updateActivePage();
    new ResizeObserver(() => {
      if (this.view === "editor")
        this.engine.fitToScreen(this.engine.viewMode === "slide");
    }).observe(this.app.workspaceEl);
  }

  setSavingStatus(state) {
    const el = document.getElementById("save-status");
    el.dataset.state = state;
    const back = document.getElementById("btn-back-home");
    if (back) back.dataset.state = state;
    el.textContent = {
      saving: "Guardando…",
      saved: "Borrador guardado",
      fallback: "Guardado · solo proyecto actual",
      error: "No se pudo guardar · revisa el espacio",
    }[state];
    const status = document.getElementById("drafts-storage-status");
    status.dataset.state = state;
    status.textContent = {
      saving: "Guardando los últimos cambios…",
      saved: "Tus borradores están guardados en este dispositivo.",
      fallback:
        "El respaldo actual está guardado. La biblioteca no está disponible.",
      error:
        "No se pudo guardar. Vuelve al editor y revisa el espacio disponible.",
    }[state];
  }

  async showHome(section = "home") {
    this.view = section;
    document.getElementById("home-view").dataset.section = section;
    this.engine.enabled = false;
    document.querySelector('meta[name="theme-color"]').content = "#f5f3ee";
    document.getElementById("editor-view").classList.add("hidden");
    document.getElementById("home-view").classList.remove("hidden");
    document
      .getElementById("home-intro")
      .classList.toggle("hidden", section !== "home");
    document
      .getElementById("projects-section")
      .classList.toggle("hidden", section === "templates");
    document
      .getElementById("templates-section")
      .classList.toggle("hidden", section === "projects");
    document
      .getElementById("projects-section")
      .classList.toggle("only-section", section === "projects");
    document
      .getElementById("templates-section")
      .classList.toggle("only-section", section === "templates");
    document.getElementById("projects-heading").textContent =
      section === "projects" ? "Tus borradores" : "Borradores recientes";
    document
      .getElementById("drafts-info")
      .classList.toggle("hidden", section !== "projects");
    document.getElementById("templates-heading").textContent =
      section === "templates"
        ? "Todas las plantillas"
        : "Para tu próxima historia";
    document.querySelectorAll(".home-nav button").forEach((btn) => {
      const active = btn.dataset.homeTab === section;
      btn.classList.toggle("active", active);
      if (active) btn.setAttribute("aria-current", "page");
      else btn.removeAttribute("aria-current");
    });
    this.app.closeDrawer();
    document.querySelector(".home-scroll").scrollTop = 0;
    await this.renderProjects();
  }

  showEditor() {
    this.view = "editor";
    this.engine.enabled = true;
    document.querySelector('meta[name="theme-color"]').content = "#181917";
    document.getElementById("home-view").classList.add("hidden");
    document.getElementById("editor-view").classList.remove("hidden");
    document.getElementById("project-name").value = this.storage.projectName;
    this.engine.selectItem(null);
    if (this.app.workspaceEl.getBoundingClientRect().width <= 900)
      this.engine.focusSlide(0);
    else this.engine.fitToScreen(false);
    this.renderPages();
    this.update();
  }

  async newProject(template, settings = {}) {
    if (this.busy) return false;
    this.busy = true;
    try {
      // Preserve the current draft before changing the active project.
      if (
        this.storage.projectId &&
        (!(await this.storage.flush()) || !this.storage.lastSaveInLibrary)
      ) {
        this.toast(
          "No se pudo conservar el proyecto actual. Revisa el almacenamiento del navegador.",
        );
        return false;
      }
      this.storage.projectId = crypto.randomUUID?.() || String(Date.now());
      this.storage.projectName =
        settings.name ||
        TEMPLATE_INFO.find((t) => t[0] === template)?.[1] ||
        "Mi carrusel";
      this.app.loadingProject = true;
      if (template) await applyTemplate(this.engine, template);
      else {
        this.engine.clearToBlankCanvas();
        this.engine.slideCount = settings.count || 3;
        this.engine.setAspectRatio(settings.ratio || "4:5");
      }
      this.engine.selectItem(null);
      this.engine.history = [];
      this.engine.historyIndex = -1;
      this.engine.saveHistory("Nuevo proyecto");
      this.app.loadingProject = false;
      this.showEditor();
      await this.storage.flush();
      this.toast(
        template
          ? "La plantilla es tuya. Dale tu toque."
          : "Tu lienzo está listo. Empieza con una foto.",
      );
      return true;
    } catch (error) {
      this.toast("No se pudo abrir el proyecto. Inténtalo otra vez.");
      console.error(error);
      return false;
    } finally {
      this.busy = false;
      this.app.loadingProject = false;
    }
  }

  async renderProjects() {
    const projects = await this.storage.listProjects();
    if (this.view === "editor") return;
    const container = document.getElementById("project-list");
    container.replaceChildren();
    document.getElementById("draft-count").textContent = projects.length;
    document
      .getElementById("draft-count")
      .classList.toggle("hidden", projects.length === 0);
    const shown = this.view === "home" ? projects.slice(0, 2) : projects;
    if (!shown.length) {
      const empty = document.createElement("div");
      empty.className = "empty-drafts";
      empty.innerHTML =
        '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="3" width="14" height="18" rx="3"/><path d="M9 8h6m-6 4h6m-6 4h3"/></svg><strong>Aquí siguen tus ideas.</strong><p>Crea tu primer carrusel. Lo guardaremos como borrador mientras editas.</p><button class="text-link">Crear un carrusel <span aria-hidden="true">↗</span></button>';
      empty
        .querySelector("button")
        .addEventListener("click", () =>
          document.getElementById("new-project-dialog").showModal(),
        );
      container.appendChild(empty);
    }
    for (const project of shown) {
      const card = document.createElement("button");
      card.className = "project-card";
      const thumb = document.createElement("div");
      thumb.className = "project-thumb";
      if (project.thumbnail) {
        const img = document.createElement("img");
        img.src = project.thumbnail;
        img.alt = "";
        img.style.cssText = "width:100%;height:100%;object-fit:cover";
        thumb.appendChild(img);
      }
      const info = document.createElement("div");
      info.className = "project-card-info";
      const title = document.createElement("strong");
      title.textContent = project.name || "Mi primer carrusel";
      const meta = document.createElement("small");
      const date = new Date(project.timestamp || Date.now()).toLocaleDateString(
        "es-CL",
        { day: "numeric", month: "short" },
      );
      meta.textContent = `${project.slideCount} páginas · ${project.aspectRatioName}`;
      const saved = document.createElement("small");
      saved.className = "draft-saved-date";
      saved.textContent = `Guardado ${date}`;
      const badge = document.createElement("span");
      badge.className = "draft-badge";
      badge.textContent = "Borrador";
      thumb.appendChild(badge);
      info.append(title, meta, saved);
      card.setAttribute("aria-label", `Editar borrador: ${title.textContent}`);
      const arrow = document.createElement("span");
      arrow.className = "project-arrow";
      arrow.innerHTML =
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 5 4 4M5 19l4-1L20 7l-4-4L5 14z"/></svg>';
      card.append(thumb, info, arrow);
      card.addEventListener("click", async () => {
        if (this.busy) return;
        this.busy = true;
        card.disabled = true;
        try {
          const current = await this.storage.flush();
          if (
            !current ||
            (project.id !== this.storage.projectId &&
              !this.storage.lastSaveInLibrary)
          ) {
            this.toast("No se pudo guardar el proyecto actual.");
            return;
          }
          this.app.loadingProject = true;
          this.storage.projectId = project.id;
          this.storage.projectName = project.name || "Mi carrusel";
          await this.engine.restoreProject(
            project.id === current.id ? current : project,
          );
          this.app.loadingProject = false;
          this.showEditor();
          await this.storage.flush();
        } finally {
          this.app.loadingProject = false;
          this.busy = false;
          card.disabled = false;
        }
      });
      container.appendChild(card);
    }
  }

  async renderTemplates() {
    const container = document.getElementById("home-template-list");
    for (const [id, name, description, number] of TEMPLATE_INFO) {
      const tile = document.createElement("button");
      tile.className = "template-tile";
      tile.innerHTML = `<div class="template-cover"><span class="template-number">${number} / COLLECTION</span></div><strong>${name}</strong><small>${description}</small>`;
      tile.addEventListener("click", () => this.newProject(id));
      container.appendChild(tile);
      // Render the actual template with the existing engine's object models.
      const model = {
        items: [],
        slideWidth: 1080,
        slideHeight: 1350,
        slideCount: 3,
        background: "#fff",
        get totalWidth() {
          return this.slideCount * this.slideWidth;
        },
        get totalHeight() {
          return this.slideHeight;
        },
        setAspectRatio() {},
        fitToScreen() {},
        saveHistory() {},
        addItem(item) {
          this.items.push(item);
        },
      };
      try {
        await applyTemplate(model, id);
        const preview = new CanvasExporter(model).renderThumbnail(0, 280);
        tile.querySelector(".template-cover").prepend(preview);
        this.templatePreviews.set(id, preview);
        const drawerCard = document.querySelector(
          `.mobile-template-card[data-template="${id}"]`,
        );
        if (drawerCard) {
          const copy = document.createElement("canvas");
          copy.width = preview.width;
          copy.height = preview.height;
          copy.getContext("2d").drawImage(preview, 0, 0);
          copy.className = "drawer-template-preview";
          drawerCard.prepend(copy);
        }
      } catch (error) {
        console.warn("No se pudo preparar la plantilla", error);
      }
    }
  }

  update() {
    document
      .getElementById("empty-canvas-action")
      .classList.toggle("hidden", this.engine.items.length > 0);
    clearTimeout(this.thumbnailTimer);
    this.thumbnailTimer = setTimeout(() => this.renderPages(), 160);
    this.updateActivePage();
  }

  renderPages() {
    const strip = document.getElementById("page-strip");
    strip.replaceChildren();
    for (let i = 0; i < this.engine.slideCount; i++) {
      const btn = document.createElement("button");
      btn.className = "page-thumb";
      btn.setAttribute("aria-label", `Ir a página ${i + 1}`);
      btn.dataset.page = i;
      btn.appendChild(this.app.exporter.renderThumbnail(i, 64));
      const number = document.createElement("span");
      number.textContent = String(i + 1).padStart(2, "0");
      btn.appendChild(number);
      btn.addEventListener("click", () => {
        this.engine.selectItem(null);
        this.engine.focusSlide(i);
      });
      strip.appendChild(btn);
    }
    this.storage.thumbnail = this.app.exporter
      .renderThumbnail(0, 240)
      .toDataURL("image/jpeg", 0.65);
    this.updateActivePage();
  }

  updateActivePage() {
    const index = this.engine.getActiveSlideIndex();
    const deletePage = document.getElementById('btn-delete-page');
    deletePage.disabled = this.engine.slideCount <= 1;
    deletePage.setAttribute('aria-label', `Eliminar página ${index + 1}`);
    deletePage.title = `Eliminar página ${index + 1} y sus elementos (se puede deshacer)`;
    document.getElementById("active-page-label").textContent =
      this.engine.viewMode === "panorama"
        ? `PANORAMA · ${this.engine.slideCount} PÁGINAS`
        : `PÁGINA ${String(index + 1).padStart(2, "0")} / ${String(this.engine.slideCount).padStart(2, "0")}`;
    document.getElementById("canvas-zoom-label").textContent =
      `${Math.round(this.engine.zoom * 100)}%`;
    document.querySelectorAll(".page-thumb").forEach((btn) => {
      const active = Number(btn.dataset.page) === index;
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-pressed", active);
    });
  }

  renderLayers() {
    const list = document.getElementById("layers-list");
    list.replaceChildren();
    if (!this.engine.items.length) {
      list.innerHTML =
        '<p class="template-desc">Tu lienzo está en blanco. Añade una foto, un texto o un sticker para empezar.</p>';
    }
    [...this.engine.items].reverse().forEach((item, i) => {
      const btn = document.createElement("button");
      btn.className = "layer-row";
      btn.classList.toggle("active", item === this.engine.selectedItem);
      const label = document.createElement("span");
      label.textContent =
        item.text ||
        item.title ||
        (item.type === "image" ? "Fotografía" : "Sticker");
      if (item.image) {
        const img = document.createElement("img");
        img.src = item.image.src;
        img.alt = "";
        img.className = "layer-preview";
        btn.appendChild(img);
      }
      const order = document.createElement("small");
      order.textContent = `Capa ${this.engine.items.length - i}`;
      btn.append(label, order);
      btn.addEventListener("click", () => {
        this.engine.selectItem(item);
        this.engine.focusSlide(this.engine.getItemSlideIndex(item));
        this.app.openDrawer(
          "adjust",
          item.type === "text" ? "Editar texto" : "Editar elemento",
        );
      });
      list.appendChild(btn);
    });
  }
}

// ---- END js/studio.js ----

// ---- BEGIN js/app.js ----
/**
 * NotSCRL Application Controller (Mobile-First Architecture)
 * Follows mobile UI design rules: thumb-zone action bars, sliding drawers,
 * tactile touch targets, and peak-end export delight.
 */

// Expose object types globally for history deserialization
window.__notScrlObjects = { ImageItem, TextItem, StickerItem };

class NotScrlMobileApp {
  constructor() {
    this.canvasEl = document.getElementById('main-canvas');
    this.workspaceEl = document.getElementById('canvas-workspace');

    this.engine = new CanvasEngine(this.canvasEl, this.workspaceEl);
    this.storage = new StorageManager(this.engine);
    this.engine.loadMediaBlob = (key) => this.storage.loadOriginal(key);
    this.loadingProject = true;
    this.exporter = new CanvasExporter(this.engine, this.storage);
    this.preview = new PreviewSimulator(this.exporter, document.getElementById('preview-modal'));
    this.cropper = new ImageCropper(this.engine);
    this.frameAdjuster = new FrameAdjuster(this.engine);

    this.engine.onDoubleTapItem = (it) => {
      if (it.clipShape && it.clipShape !== 'rect') {
        this.frameAdjuster.open(it);
      } else {
        this.cropper.open(it);
      }
    };

    this.init();
  }

  async init() {
    this.bindHeader();
    this.bindCanvasControls();
    this.bindContextActionBar();
    this.bindBottomNavAndDrawer();
    this.bindExportSheet();
    this.bindFileUpload();
    this.bindGiphy();

    // Populate drawer content
    this.populateStickers();
    this.populatePalettes();

    // Engine change callbacks
    this.engine.onSelectionChange = (item) => this.onSelectionChanged(item);
    this.engine.onCanvasChange = () => this.onCanvasChanged();
    this.engine.onHistoryChange = () => {
      this.updateHeaderUI();
      if (!this.loadingProject && this.storage.saveTimeout) this.storage.flush();
    };
    this.storage.onStatus = state => this.studio?.setSavingStatus(state);

    // Check for saved project in cache (IndexedDB / localStorage)
    const savedProject = await this.storage.loadProject();
    if (savedProject && Array.isArray(savedProject.items)) {
      this.storage.projectId = savedProject.id || null;
      this.storage.projectName = savedProject.name || 'Mi primer carrusel';
      await this.engine.restoreProject(savedProject);
    } else {
      this.engine.clearToBlankCanvas();
    }

    this.engine.selectItem(null);
    this.loadingProject = false;
    this.studio = new Studio(this);
    this.studio.renderPages();
    this.bindTextStyles();
    this.bindDialogAccessibility();
    if (savedProject) await this.storage.flush();
    this.studio.showHome();
    this.updateHeaderUI();
  }

  // 1. MOBILE TOP HEADER
  bindHeader() {
    // Aspect Ratio
    const ratioSelect = document.getElementById('aspect-ratio-select');
    if (ratioSelect) {
      ratioSelect.addEventListener('change', (e) => {
        this.engine.setAspectRatio(e.target.value);
        this.engine.saveHistory('Cambiar formato');
        this.updateHeaderUI();
      });
    }

    // Slide Count Stepper
    const btnMinus = document.getElementById('btn-minus-slide');
    const btnPlus = document.getElementById('btn-plus-slide');

    for (const button of [btnMinus, document.getElementById('btn-delete-page')]) {
      button?.addEventListener('click', () => {
        const index = this.engine.getActiveSlideIndex();
        if (this.engine.removeSlide(index)) {
          this.updateHeaderUI();
          this.studio.toast(`Página ${index + 1} eliminada. Puedes deshacer.`);
        }
      });
    }

    if (btnPlus) {
      btnPlus.addEventListener('click', () => {
        if (this.engine.slideCount < 10) {
          this.engine.setSlideCount(this.engine.slideCount + 1);
          this.updateHeaderUI();
        }
      });
    }

    // Primary Export CTA
    const btnExport = document.getElementById('btn-open-export');
    if (btnExport) {
      btnExport.addEventListener('click', () => this.openExportSheet());
    }

    // Clean / Blank Canvas Button
    const btnClear = document.getElementById('btn-clear-canvas');
    if (btnClear) {
      btnClear.addEventListener('click', () => {
        this.engine.clearToBlankCanvas();
        this.storage.scheduleAutoSave();
      });
    }
  }

  updateHeaderUI() {
    document.getElementById('aspect-ratio-select').value = this.engine.aspectRatioName;
    document.getElementById('btn-minus-slide').disabled = this.engine.slideCount <= 1;
    document.getElementById('btn-delete-page').disabled = this.engine.slideCount <= 1;
    document.getElementById('btn-plus-slide').disabled = this.engine.slideCount >= 10;
    document.getElementById('btn-undo').disabled = this.engine.historyIndex <= 0 || this.engine.isRestoringHistory;
    document.getElementById('btn-redo').disabled = this.engine.historyIndex >= this.engine.history.length - 1 || this.engine.isRestoringHistory;
    const slideCountEl = document.getElementById('slide-count-display');
    if (slideCountEl) {
      slideCountEl.textContent = this.engine.slideCount;
    }
  }

  // 2. CANVAS FLOATING CONTROLS
  bindCanvasControls() {
    document.getElementById('btn-canvas-controls')?.addEventListener('click', (event) => {
      const expanded = document.getElementById('editor-view').classList.toggle('canvas-controls-open');
      event.currentTarget.setAttribute('aria-expanded', String(expanded));
      event.currentTarget.title = expanded ? 'Ocultar controles del lienzo' : 'Mostrar controles del lienzo';
    });
    // Toggle Guides
    const btnGuides = document.getElementById('btn-toggle-guides');
    if (btnGuides) {
      btnGuides.addEventListener('click', () => {
        this.engine.showGuides = !this.engine.showGuides;
        btnGuides.classList.toggle('active', this.engine.showGuides);
        this.engine.render();
      });
    }

    // Fit / View Toggle
    const btnFit = document.getElementById('btn-zoom-fit');
    if (btnFit) {
      btnFit.addEventListener('click', () => {
        const nextMode = this.engine.viewMode === 'slide' ? false : true;
        this.engine.fitToScreen(nextMode);
      });
    }

    // Double-click canvas to crop or toggle view
    this.canvasEl.addEventListener('dblclick', () => {
      if (this.engine.selectedItem && this.engine.selectedItem.type === 'image') {
        this.cropper.open(this.engine.selectedItem);
      } else {
        const nextMode = this.engine.viewMode === 'slide' ? false : true;
        this.engine.fitToScreen(nextMode);
      }
    });

    // Undo / Redo
    document.getElementById('btn-undo')?.addEventListener('click', () => this.engine.undo());
    document.getElementById('btn-redo')?.addEventListener('click', () => this.engine.redo());

    // Preview
    document.getElementById('btn-preview-ig')?.addEventListener('click', () => this.preview.open());
  }

  // 3. CONTEXT ACTION BAR (FLOATING AT TOP UNDER HEADER)
  bindContextActionBar() {
    this.contextBar = document.getElementById('context-action-bar');
    for (const id of ['btn-ctx-fill-slide', 'btn-align-fill-slide']) {
      document.getElementById(id)?.addEventListener('click', () => {
        const item = this.engine.selectedItem;
        if (!item || item.type !== 'image') return;
        this.engine.fillImageToSlide(item);
        this.studio.toast('Foto a página completa. Puedes deshacer.');
      });
    }

    // 1. Center inside current slide
    document.getElementById('btn-ctx-center-slide')?.addEventListener('click', () => {
      if (this.engine.selectedItem) {
        this.engine.centerItemInSlide(this.engine.selectedItem);
      }
    });

    // 2. Fit to current slide dimensions
    document.getElementById('btn-ctx-fit-slide')?.addEventListener('click', () => {
      if (this.engine.selectedItem) {
        this.engine.fitItemToSlide(this.engine.selectedItem);
      }
    });

    // 3. Snap to nearest seam
    document.getElementById('btn-ctx-snap-seam')?.addEventListener('click', () => {
      if (this.engine.selectedItem) {
        this.engine.snapToNearestSeam(this.engine.selectedItem);
      }
    });

    // 4. Recortar / Cropper Tool
    document.getElementById('btn-ctx-crop')?.addEventListener('click', () => {
      if (this.engine.selectedItem && this.engine.selectedItem.type === 'image') {
        this.cropper.open(this.engine.selectedItem);
      }
    });

    // 5. Manual Frame Adjuster (Pan/Zoom within shape)
    document.getElementById('btn-ctx-edit-frame')?.addEventListener('click', () => {
      if (this.engine.selectedItem && this.engine.selectedItem.type === 'image') {
        this.frameAdjuster.open(this.engine.selectedItem);
      }
    });

    // 6. Open shape selection drawer
    document.getElementById('btn-ctx-shapes')?.addEventListener('click', () => {
      this.openDrawer('adjust', 'Formas y Ajustes');
    });
    document.getElementById('btn-ctx-adjust').addEventListener('click', () => {
      this.openDrawer('adjust', this.engine.selectedItem?.type === 'text' ? 'Editar texto' : 'Editar elemento');
    });

    // 7. Step-by-step layer controls
    document.getElementById('btn-ctx-layer-up')?.addEventListener('click', () => {
      if (this.engine.selectedItem) {
        this.engine.bringForward(this.engine.selectedItem);
      }
    });
    document.getElementById('btn-ctx-layer-down')?.addEventListener('click', () => {
      if (this.engine.selectedItem) {
        this.engine.sendBackward(this.engine.selectedItem);
      }
    });

    // 8. Rotate 90 deg
    document.getElementById('btn-ctx-rotate')?.addEventListener('click', () => {
      if (this.engine.selectedItem) {
        this.engine.selectedItem.rotation = (this.engine.selectedItem.rotation + 90) % 360;
        this.engine.triggerChange();
        this.engine.saveHistory('Rotate 90 deg');
      }
    });

    // 6. Duplicate
    document.getElementById('btn-ctx-duplicate')?.addEventListener('click', () => {
      if (this.engine.selectedItem) {
        this.engine.duplicateItem(this.engine.selectedItem);
      }
    });

    // 7. Delete
    document.getElementById('btn-ctx-delete')?.addEventListener('click', () => {
      if (this.engine.selectedItem) {
        this.engine.removeItem(this.engine.selectedItem);
      }
    });

    // Bind Fine-Tuning Drawer Controls
    this.bindFineTuningControls();
  }

  bindFineTuningControls() {
    // Shape Choice Buttons (Normal, Circle, Star, Heart, Arch, Flower, Polaroid, Film)
    const shapeBtns = document.querySelectorAll('#shape-selector-grid .shape-choice-btn');
    shapeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        if (!this.engine.selectedItem || this.engine.selectedItem.type !== 'image') return;
        const shape = btn.dataset.shape;
        shapeBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const it = this.engine.selectedItem;
        if (shape === 'polaroid') {
          it.frameStyle = 'polaroid';
          it.clipShape = 'rect';
        } else if (shape === 'film') {
          it.frameStyle = 'film';
          it.clipShape = 'rect';
        } else {
          it.frameStyle = 'none';
          it.clipShape = shape;

          // For symmetrical 1:1 shapes, ensure dimensions are equalized without distortion
          if (['circle', 'star', 'flower', 'heart'].includes(shape)) {
            const s = Math.min(it.width, it.height);
            const cx = it.x + it.width / 2;
            const cy = it.y + it.height / 2;
            it.width = s;
            it.height = s;
            it.x = Math.round(cx - s / 2);
            it.y = Math.round(cy - s / 2);
            it.aspectRatio = 1.0;
          }
        }

        document.getElementById('mobile-field-polaroid')?.classList.toggle('hidden', it.frameStyle !== 'polaroid');
        this.engine.triggerChange();
        this.engine.saveHistory(`Change shape to ${shape}`);
      });
    });

    // Open Frame Adjuster from drawer
    document.getElementById('btn-open-frame-adjust')?.addEventListener('click', () => {
      if (this.engine.selectedItem && this.engine.selectedItem.type === 'image') {
        this.frameAdjuster.open(this.engine.selectedItem);
      }
    });

    // Alignment Tools in Drawer
    document.getElementById('btn-align-center-slide')?.addEventListener('click', () => {
      if (this.engine.selectedItem) this.engine.centerItemInSlide(this.engine.selectedItem);
    });
    document.getElementById('btn-align-fit-slide')?.addEventListener('click', () => {
      if (this.engine.selectedItem) this.engine.fitItemToSlide(this.engine.selectedItem);
    });
    document.getElementById('btn-align-snap-seam')?.addEventListener('click', () => {
      if (this.engine.selectedItem) this.engine.snapToNearestSeam(this.engine.selectedItem);
    });
    document.getElementById('btn-align-span-2')?.addEventListener('click', () => {
      if (!this.engine.selectedItem) return;
      const it = this.engine.selectedItem;
      const targetW = this.engine.slideWidth * 2 - 160;
      const aspect = it.width / it.height;
      it.width = targetW;
      it.height = Math.round(targetW / aspect);
      it.x = this.engine.slideWidth - it.width / 2;
      this.engine.triggerChange();
      this.engine.saveHistory('Span 2 slides');
    });

    // Polaroid input
    const polaroidInput = document.getElementById('mobile-input-polaroid');
    if (polaroidInput) {
      polaroidInput.addEventListener('input', (e) => {
        if (this.engine.selectedItem && this.engine.selectedItem.type === 'image') {
          this.engine.selectedItem.caption = e.target.value;
          this.engine.triggerChange();
        }
      });
    }

    // Text content input
    const textInput = document.getElementById('mobile-input-text');
    if (textInput) {
      textInput.addEventListener('input', (e) => {
        if (this.engine.selectedItem && this.engine.selectedItem.type === 'text') {
          this.engine.selectedItem.text = e.target.value;
          this.engine.triggerChange();
        }
      });
    }

    // Border Radius
    document.getElementById('mobile-slider-radius')?.addEventListener('input', (e) => {
      if (this.engine.selectedItem && this.engine.selectedItem.type === 'image') {
        this.engine.selectedItem.borderRadius = parseInt(e.target.value, 10);
        this.engine.triggerChange();
      }
    });

    // Opacity
    document.getElementById('mobile-slider-opacity')?.addEventListener('input', (e) => {
      if (this.engine.selectedItem) {
        this.engine.selectedItem.opacity = parseFloat(e.target.value);
        this.engine.triggerChange();
      }
    });

    // Shadow
    document.getElementById('mobile-toggle-shadow')?.addEventListener('change', (e) => {
      if (this.engine.selectedItem) {
        this.engine.selectedItem.shadow.enabled = e.target.checked;
        this.engine.triggerChange();
      }
    });

    // Layer Controls (Step by Step + Send to Front/Back)
    document.getElementById('btn-mobile-step-up')?.addEventListener('click', () => {
      if (this.engine.selectedItem) this.engine.bringForward(this.engine.selectedItem);
    });
    document.getElementById('btn-mobile-step-down')?.addEventListener('click', () => {
      if (this.engine.selectedItem) this.engine.sendBackward(this.engine.selectedItem);
    });
    document.getElementById('btn-mobile-layer-up')?.addEventListener('click', () => {
      if (this.engine.selectedItem) this.engine.bringToFront(this.engine.selectedItem);
    });
    document.getElementById('btn-mobile-layer-down')?.addEventListener('click', () => {
      if (this.engine.selectedItem) this.engine.sendToBack(this.engine.selectedItem);
    });
  }

  // 4. BOTTOM NAVIGATION & BOTTOM SHEET DRAWER
  bindBottomNavAndDrawer() {
    this.drawer = document.getElementById('bottom-sheet-drawer');
    this.drawerTitle = document.getElementById('drawer-title-text');
    this.navBtns = document.querySelectorAll('.nav-tab-btn');
    this.drawerTabs = document.querySelectorAll('.drawer-tab-content');

    const tabTitles = {
      photos: 'Añadir Fotos',
      text: 'Añadir Tipografía',
      stickers: 'Stickers & Vintage',
      templates: 'Plantillas SCRL',
      background: 'Color de Fondo'
    };

    this.navBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        if (!this.drawer.classList.contains('hidden') && document.getElementById(`drawer-tab-${tab}`).classList.contains('active')) {
          this.closeDrawer();
          return;
        }
        this.navBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.openDrawer(tab, tabTitles[tab] || 'Opciones');
      });
    });

    // Close Drawer button
    document.getElementById('btn-close-drawer')?.addEventListener('click', () => {
      this.closeDrawer();
    });

    // Add Text Presets
    document.getElementById('btn-add-mobile-heading')?.addEventListener('click', () => {
      const t = new TextItem('TÍTULO EDITORIAL', this.getSpawnX(640), 220, 640, 90);
      t.fontSize = 52;
      t.fontWeight = '700';
      this.engine.addItem(t);
      this.closeDrawer();
    });

    document.getElementById('btn-add-mobile-subheading')?.addEventListener('click', () => {
      const t = new TextItem('SUBTÍTULO MODERNO', this.getSpawnX(560), 320, 560, 50);
      t.fontSize = 24;
      t.fontWeight = '600';
      t.letterSpacing = 2;
      this.engine.addItem(t);
      this.closeDrawer();
    });

    document.getElementById('btn-add-mobile-body')?.addEventListener('click', () => {
      const t = new TextItem('Leyenda continua sobre las diapositivas.', this.getSpawnX(480), 400, 480, 70);
      t.fontSize = 20;
      t.fontFamily = "'Inter', sans-serif";
      this.engine.addItem(t);
      this.closeDrawer();
    });

    // Template Pickers
    document.querySelectorAll('.mobile-template-card').forEach(card => {
      card.addEventListener('click', async () => {
        const tName = card.dataset.template;
        this.closeDrawer();
        await this.studio.newProject(tName === 'blank' ? null : tName);
      });
    });
  }

  openDrawer(tabName, title) {
    this.drawerReturnFocus = this.drawer.classList.contains('hidden') ? document.activeElement : this.drawerReturnFocus;
    document.getElementById('drawer-backdrop').classList.remove('hidden');
    document.getElementById('object-adjustments').classList.remove('hidden');
    document.getElementById('layers-list').classList.add('hidden');
    this.drawerTabs.forEach(t => t.classList.remove('active'));
    const targetTab = document.getElementById(`drawer-tab-${tabName}`);
    if (targetTab) targetTab.classList.add('active');

    if (tabName === 'stickers' && this.giphyLoaded === false) {
      this.giphyLoaded = true;
      this.loadGiphy('');
    }

    if (this.drawerTitle) this.drawerTitle.textContent = title;
    this.drawer.classList.remove('hidden');
    this.drawer.focus({ preventScroll: true });
    this.navBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
      btn.setAttribute('aria-expanded', btn.dataset.tab === tabName ? 'true' : 'false');
    });

    // Update adjust drawer values if opened for item
    if (tabName === 'adjust' && this.engine.selectedItem) {
      const it = this.engine.selectedItem;
      const isImg = it.type === 'image';
      const isTxt = it.type === 'text';
      document.getElementById('shape-section-label').classList.toggle('hidden', !isImg);
      if (isTxt) {
        const fields = document.getElementById('object-adjustments');
        fields.prepend(document.getElementById('text-style-controls'));
        fields.prepend(document.getElementById('mobile-field-text'));
      }
      document.getElementById('text-style-controls').classList.toggle('hidden', !isTxt);
      document.getElementById('radius-field').classList.toggle('hidden', !isImg);
      document.getElementById('btn-open-frame-adjust').classList.toggle('hidden', !isImg);

      document.getElementById('shape-selector-grid').style.display = isImg ? 'grid' : 'none';
      document.getElementById('mobile-field-polaroid').classList.toggle('hidden', !isImg || it.frameStyle !== 'polaroid');
      document.getElementById('mobile-field-text').classList.toggle('hidden', !isTxt);

      if (isImg) {
        const currentShape = it.frameStyle === 'polaroid' ? 'polaroid' : (it.frameStyle === 'film' ? 'film' : (it.clipShape || 'rect'));
        document.querySelectorAll('#shape-selector-grid .shape-choice-btn').forEach(b => {
          b.classList.toggle('active', b.dataset.shape === currentShape);
        });

        document.getElementById('mobile-input-polaroid').value = it.caption || '';
        document.getElementById('mobile-slider-radius').value = it.borderRadius || 0;
      }

      if (isTxt) {
        document.getElementById('mobile-input-text').value = it.text || '';
        document.getElementById('text-font').value = it.fontFamily;
        document.getElementById('text-size').value = it.fontSize;
        document.getElementById('text-color').value = it.color;
        document.getElementById('text-align').value = it.textAlign;
      }

      document.getElementById('mobile-slider-opacity').value = it.opacity;
      document.getElementById('mobile-toggle-shadow').checked = it.shadow?.enabled || false;
    }
  }

  closeDrawer() {
    const wasOpen = !this.drawer.classList.contains('hidden');
    this.drawer.classList.add('hidden');
    document.getElementById('drawer-backdrop').classList.add('hidden');
    this.navBtns.forEach(b => { b.classList.remove('active'); b.setAttribute('aria-expanded', 'false'); });
    if (wasOpen && this.drawerReturnFocus?.isConnected) this.drawerReturnFocus.focus({ preventScroll: true });
  }

  getSpawnX(itemWidth) {
    return this.engine.getActiveSlideIndex() * this.engine.slideWidth + (this.engine.slideWidth - itemWidth) / 2;
  }

  // 5. FILE UPLOAD HANDLER
  bindFileUpload() {
    const uploadBtn = document.getElementById('btn-mobile-upload');
    const uploadInput = document.getElementById('mobile-file-input');

    if (uploadBtn && uploadInput) {
      uploadBtn.addEventListener('click', () => uploadInput.click());
      uploadInput.addEventListener('change', (e) => {
        this.handleFiles(e.target.files);
        uploadInput.value = '';
        this.closeDrawer();
      });
    }
  }

  handleFiles(files) {
    if (!files || files.length === 0) return;
    const projectId = this.storage.projectId;
    const selectedFiles = Array.from(files);
    this.uploadQueue = (this.uploadQueue || Promise.resolve()).then(async () => {
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        if (projectId !== this.storage.projectId) break;
        if (file.type.startsWith('video/')) {
          try {
            await this.addVideoFile(file, i);
          } catch (error) {
            this.studio.toast(error.message || 'Este vídeo no se pudo abrir. Prueba con MP4 o WebM.');
          }
          continue;
        }
        if (!file.type.startsWith('image/')) continue;
        if (file.type === 'image/gif') {
          try {
            await this.addGifFile(file, i);
          } catch (error) {
            this.studio.toast(error.message || 'Este GIF no se pudo abrir.');
          }
          continue;
        }
        try {
          const url = URL.createObjectURL(file);
          let img;
          const original = new Image();
          try {
            original.src = url;
            await original.decode();
            const scale = Math.min(1, 1280 / Math.max(original.naturalWidth, original.naturalHeight));
            const canvas = document.createElement('canvas');
            canvas.width = Math.max(1, Math.round(original.naturalWidth * scale));
            canvas.height = Math.max(1, Math.round(original.naturalHeight * scale));
            try {
              canvas.getContext('2d').drawImage(original, 0, 0, canvas.width, canvas.height);
              img = new Image();
              img.src = canvas.toDataURL(file.type === 'image/jpeg' ? 'image/jpeg' : 'image/png', 0.9);
            } finally {
              canvas.width = canvas.height = 0;
            }
          } finally {
            original.src = '';
            URL.revokeObjectURL(url);
          }
          await img.decode();
          if (projectId !== this.storage.projectId) break;
          const originalKey = await this.storage.saveOriginal(file);
          if (projectId !== this.storage.projectId) break;
          const scale = Math.min(1, this.engine.slideWidth * 0.75 / Math.max(img.naturalWidth, img.naturalHeight));
          const w = img.naturalWidth * scale;
          const h = img.naturalHeight * scale;
          const item = new ImageItem(img, this.getSpawnX(w) + i * 24, Math.max(0, (this.engine.slideHeight - h) / 2) + i * 24, Math.round(w), Math.round(h));
          item.borderRadius = 8;
          item.originalKey = originalKey;
          this.engine.addItem(item);
          await new Promise(resolve => setTimeout(resolve, 0));
        } catch (error) {
          this.studio.toast(error.message || 'Esta foto no se pudo abrir. Prueba con JPG, PNG o WebP.');
        }
      }
    });
    return this.uploadQueue;
  }

  async addVideoFile(file, index) {
    const video = document.createElement('video');
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.autoplay = true;
    video.src = URL.createObjectURL(file);
    await new Promise((resolve, reject) => {
      video.onloadeddata = resolve;
      video.onerror = () => reject(new Error('Este vídeo no se pudo abrir. Prueba con MP4 o WebM.'));
    });
    video.play().catch(() => {});
    const originalKey = await this.storage.saveOriginal(file).catch(() => null);
    await this.addMediaItem(video, 'video', index, originalKey ? { originalKey } : {});
  }

  async addGifFile(file, index) {
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Este GIF no se pudo abrir.'));
      reader.readAsDataURL(file);
    });
    const img = new Image();
    img.src = dataUrl;
    await img.decode();
    await this.addMediaItem(img, 'gif', index, {});
  }

  async addMediaItem(media, mediaType, index, extra) {
    const width = media.videoWidth || media.naturalWidth;
    const height = media.videoHeight || media.naturalHeight;
    const scale = Math.min(1, this.engine.slideWidth * 0.75 / Math.max(width, height));
    const w = Math.round(width * scale);
    const h = Math.round(height * scale);
    const item = new ImageItem(
      media,
      this.getSpawnX(w) + index * 24,
      Math.max(0, (this.engine.slideHeight - h) / 2) + index * 24,
      w,
      h
    );
    item.mediaType = mediaType;
    item.borderRadius = 8;
    Object.assign(item, extra);
    this.engine.addItem(item);
    await new Promise(resolve => setTimeout(resolve, 0));
  }

  bindGiphy() {
    this.giphyGrid = document.getElementById('giphy-grid');
    if (!this.giphyGrid) return;
    this.giphyStatus = document.getElementById('giphy-status');
    this.giphyKeyRow = document.getElementById('giphy-key-row');
    this.giphyKeyInput = document.getElementById('giphy-key-input');
    this.giphyLoaded = false;

    const savedKey = localStorage.getItem('notscrl_giphy_key');
    if (savedKey && this.giphyKeyInput) this.giphyKeyInput.value = savedKey;
    if (!savedKey) this.giphyKeyRow?.classList.remove('hidden');

    document.getElementById('giphy-key-save')?.addEventListener('click', () => {
      const key = (this.giphyKeyInput?.value || '').trim();
      if (key) localStorage.setItem('notscrl_giphy_key', key);
      else localStorage.removeItem('notscrl_giphy_key');
      this.giphyKeyRow?.classList.add('hidden');
      this.giphyLoaded = true;
      this.loadGiphy(document.getElementById('giphy-search-input')?.value || '');
    });

    document.getElementById('giphy-search-form')?.addEventListener('submit', (event) => {
      event.preventDefault();
      this.loadGiphy(document.getElementById('giphy-search-input')?.value || '');
    });
  }

  async loadGiphy(query) {
    if (!this.giphyGrid) return;
    const key = localStorage.getItem('notscrl_giphy_key') || '';
    this.giphyGrid.innerHTML = '';
    this.setGiphyStatus('Cargando GIFs…');
    try {
      const res = await fetch(`api/giphy/search?q=${encodeURIComponent(query)}`, {
        headers: key ? { 'x-giphy-key': key } : {}
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.error === 'missing_key') {
          this.giphyKeyRow?.classList.remove('hidden');
          this.setGiphyStatus('Añade tu API key de GIPHY (developers.giphy.com) para usar GIFs.');
        } else {
          this.setGiphyStatus('No se pudieron cargar los GIFs.');
        }
        return;
      }
      this.setGiphyStatus('');
      const items = data.items || [];
      items.forEach((gif) => {
        const cell = document.createElement('button');
        cell.type = 'button';
        cell.className = 'mobile-sticker-card giphy-cell';
        cell.innerHTML = `<img src="api/giphy/media?id=${encodeURIComponent(gif.id)}" alt="${gif.title}" loading="lazy"/>`;
        cell.addEventListener('click', () => this.addGiphyItem(gif));
        this.giphyGrid.appendChild(cell);
      });
      if (!items.length) this.setGiphyStatus('Sin resultados.');
    } catch {
      this.setGiphyStatus('No se pudieron cargar los GIFs. Revisa tu conexión.');
    }
  }

  addGiphyItem(gif) {
    const img = new Image();
    img.onload = () => {
      const ratio = gif.width && gif.height ? gif.width / gif.height : 1;
      const w = this.engine.slideWidth * 0.7;
      const h = w / ratio;
      const item = new ImageItem(img, this.getSpawnX(w), 280, Math.round(w), Math.round(h));
      item.mediaType = 'gif';
      item.borderRadius = 8;
      this.engine.addItem(item);
      this.closeDrawer();
    };
    img.onerror = () => this.studio.toast('No se pudo cargar el GIF.');
    img.src = `api/giphy/media?id=${encodeURIComponent(gif.id)}`;
  }

  setGiphyStatus(text) {
    if (!this.giphyStatus) return;
    this.giphyStatus.textContent = text;
    this.giphyStatus.classList.toggle('hidden', !text);
  }

  // 6. POPULATE MOBILE STICKER GALLERY
  populateStickers() {
    const grid = document.getElementById('mobile-stickers-grid');
    if (!grid) return;
    grid.innerHTML = '';

    STICKERS.forEach(sticker => {
      const itemEl = document.createElement('button');
      itemEl.className = 'mobile-sticker-card';
      itemEl.innerHTML = `<img src="${sticker.url}" alt="${sticker.title}"/>`;
      itemEl.addEventListener('click', () => {
        const img = new Image();
        img.onload = () => {
          const s = new StickerItem(img, this.getSpawnX(sticker.width * 1.4), 380, sticker.width * 1.4, sticker.height * 1.4, sticker.title);
          this.engine.addItem(s);
          this.closeDrawer();
        };
        img.src = sticker.url;
      });
      grid.appendChild(itemEl);
    });
  }

  populatePalettes() {
    const grid = document.getElementById('mobile-palette-grid');
    if (!grid) return;
    grid.innerHTML = '';

    PALETTES.forEach(pal => {
      const btn = document.createElement('button');
      btn.className = 'mobile-palette-btn';
      btn.title = pal.name;
      btn.setAttribute('aria-label', pal.name);
      btn.style.background = pal.bg;
      btn.addEventListener('click', () => {
        this.engine.background = pal.bg;
        this.engine.triggerChange();
        this.engine.saveHistory(`Background: ${pal.name}`);
        this.closeDrawer();
      });
      grid.appendChild(btn);
    });
  }

  // 7. SELECTION CHANGE CALLBACK
  onSelectionChanged(item) {
    document.getElementById('selection-toolbar').classList.toggle('has-selection', !!item);
    document.getElementById('btn-ctx-fill-slide')?.classList.toggle('hidden', item?.type !== 'image');
    document.getElementById('btn-align-fill-slide')?.classList.toggle('hidden', item?.type !== 'image');
    if (item) {
      document.getElementById('selection-hint').classList.add('hidden');
      this.contextBar.classList.remove('hidden');
      const isImg = item.type === 'image';
      document.getElementById('btn-ctx-crop')?.classList.toggle('hidden', !isImg);
      document.getElementById('btn-ctx-edit-frame')?.classList.toggle('hidden', !isImg);
      document.getElementById('btn-ctx-shapes')?.classList.toggle('hidden', !isImg);
    } else {
      document.getElementById('selection-hint').classList.remove('hidden');
      this.contextBar.classList.add('hidden');
      if (document.getElementById('drawer-tab-adjust')?.classList.contains('active')) {
        this.closeDrawer();
      }
    }
  }

  onCanvasChanged() {
    this.updateHeaderUI();
    if (this.loadingProject) return;
    this.studio?.update();
    // Auto-save project into persistent cache (IndexedDB + localStorage)
    this.storage.scheduleAutoSave();
    if (!this.engine.activeHandle) this.storage.flush();
  }

  bindTextStyles() {
    const font = document.getElementById('text-font');
    FONTS.forEach(entry => {
      const option = document.createElement('option');
      option.value = entry.family;
      option.textContent = entry.name;
      font.appendChild(option);
    });
    const controls = {
      'text-font': ['fontFamily', value => value],
      'text-size': ['fontSize', value => Math.max(10, Math.min(240, Number(value) || 10))],
      'text-color': ['color', value => value],
      'text-align': ['textAlign', value => value]
    };
    for (const [id, [property, convert]] of Object.entries(controls)) {
      document.getElementById(id).addEventListener('input', e => {
        const item = this.engine.selectedItem;
        if (!item || item.type !== 'text') return;
        item[property] = convert(e.target.value);
        this.engine.triggerChange();
      });
    }
    // Commit continuous controls once per interaction, so Undo stays useful.
    document.querySelectorAll('#object-adjustments input, #object-adjustments select, #object-adjustments textarea').forEach(control => {
      control.addEventListener('change', () => {
        if (this.engine.selectedItem) this.engine.saveHistory('Editar elemento');
      });
    });
    document.querySelectorAll('.mobile-template-card').forEach(card => {
      card.tabIndex = 0;
      card.setAttribute('role', 'button');
      card.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault(); card.click();
        }
      });
    });
  }

  bindDialogAccessibility() {
    const overlays = [...document.querySelectorAll('.mobile-modal-overlay')];
    overlays.forEach(modal => {
      modal.setAttribute('role', 'dialog');
      modal.setAttribute('aria-modal', 'true');
      modal.tabIndex = -1;
      modal.setAttribute('aria-label', {
        'preview-modal': 'Vista previa del carrusel', 'crop-modal': 'Recortar imagen',
        'frame-modal': 'Ajustar encuadre', 'export-modal': 'Exportar carrusel'
      }[modal.id]);
    });
    document.querySelectorAll('button[title]').forEach(btn => {
      if (!btn.textContent.trim() || btn.textContent.trim() === '✕') btn.setAttribute('aria-label', btn.title);
    });
    document.getElementById('btn-close-drawer').setAttribute('aria-label', 'Cerrar herramientas');
    document.getElementById('btn-close-export-sheet').setAttribute('aria-label', 'Cerrar exportación');
    document.getElementById('btn-close-ig-preview').setAttribute('aria-label', 'Cerrar vista previa');
    document.getElementById('frame-zoom-slider').setAttribute('aria-label', 'Zoom de la imagen');
    this.navBtns.forEach(btn => {
      btn.setAttribute('aria-controls', 'bottom-sheet-drawer');
      btn.setAttribute('aria-expanded', 'false');
    });
    const activeModal = () => overlays.filter(el => !el.classList.contains('hidden')).at(-1)
      || (!this.drawer.classList.contains('hidden') ? this.drawer : null);
    let previousModal = null;
    let returnFocus = null;
    const observer = new MutationObserver(() => {
      const modal = activeModal();
      const changed = modal !== previousModal;
      document.getElementById('editor-view').inert = !!modal;
      document.getElementById('home-view').inert = !!modal;
      this.drawer.inert = !!modal && modal !== this.drawer;
      overlays.forEach(el => { el.inert = !!modal && el !== modal; });
      if (changed && modal) {
        if (!previousModal) returnFocus = document.activeElement;
        const first = modal.querySelector('button:not(:disabled),input,textarea,select');
        (first || modal).focus({ preventScroll: true });
      }
      if (changed && !modal && returnFocus?.isConnected && returnFocus.getClientRects().length) {
        returnFocus.focus({ preventScroll: true });
      }
      previousModal = modal;
    });
    [...overlays, this.drawer].forEach(modal => observer.observe(modal, { attributes: true, attributeFilter: ['class'] }));
    document.addEventListener('keydown', e => {
      const modal = activeModal();
      if (!modal || e.key !== 'Tab') return;
      const focusable = [...modal.querySelectorAll('button:not(:disabled),input:not(:disabled),textarea,select,[tabindex="0"]')]
        .filter(el => el.getClientRects().length);
      const first = focusable[0], last = focusable.at(-1);
      if (e.shiftKey && (document.activeElement === first || document.activeElement === modal)) {
        e.preventDefault(); last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first?.focus();
      }
    });
  }

  // 8. EXPORT SHEET (PEAK-END CELEBRATION)
  bindExportSheet() {
    this.exportModal = document.getElementById('export-modal');
    this.stripContainer = document.getElementById('export-strip-container');
    this.btnZip = document.getElementById('btn-download-zip');
    this.btnPanorama = document.getElementById('btn-download-panorama');

    document.getElementById('btn-close-export-sheet')?.addEventListener('click', () => {
      this.exportModal.classList.add('hidden');
    });

    this.exportModal?.addEventListener('click', (e) => {
      if (e.target === this.exportModal) this.exportModal.classList.add('hidden');
    });

    if (this.btnZip) {
      this.btnZip.addEventListener('click', async () => {
        this.btnZip.disabled = true;
        this.btnZip.innerHTML = '<span class="spinner"></span> Preparando descarga…';
        const status = document.getElementById('export-status-label');
        try {
          await this.exporter.downloadAllAsZip(message => { status.textContent = message; });
          this.studio.toast('Tu historia está lista. Descarga iniciada.');
        } catch (error) {
          status.textContent = 'No se pudo crear el ZIP. Inténtalo otra vez o descarga cada PNG.';
        } finally {
          this.btnZip.disabled = false;
          this.btnZip.textContent = `Descargar ${this.engine.slideCount} páginas · ZIP`;
        }
      });
    }

    if (this.btnPanorama) {
      this.btnPanorama.addEventListener('click', async () => {
        this.btnPanorama.disabled = true;
        try { await this.exporter.downloadFullPanorama(); }
        catch { document.getElementById('export-status-label').textContent = 'No se pudo crear el panorama. Inténtalo otra vez.'; }
        finally { this.btnPanorama.disabled = false; }
      });
    }
  }

  openExportSheet() {
    this.exportModal.classList.remove('hidden');
    const slides = Array.from({ length: this.engine.slideCount }, (_, i) => ({
      index: i + 1, canvas: this.exporter.renderThumbnail(i, 180)
    }));
    document.querySelector('.export-subtitle').textContent = `${this.engine.slideCount} páginas · ${this.engine.slideWidth} × ${this.engine.slideHeight} px · PNG`;
    document.getElementById('export-status-label').textContent = 'Las imágenes se generan en tu dispositivo.';

    this.stripContainer.innerHTML = '';
    slides.forEach(slide => {
      const card = document.createElement('div');
      card.className = 'export-mini-card';

      const thumb = document.createElement('canvas');
      thumb.width = 180;
      thumb.height = slide.canvas.height;
      const ctx = thumb.getContext('2d');
      ctx.drawImage(slide.canvas, 0, 0);

      card.innerHTML = `
        <div class="export-mini-thumb"></div>
        <div class="export-mini-info">
          <span>Página ${slide.index}</span>
          <button class="btn-mini-dl" data-idx="${slide.index}">PNG</button>
        </div>
      `;

      card.querySelector('.export-mini-thumb').appendChild(thumb);
      card.querySelector('.btn-mini-dl').setAttribute('aria-label', `Descargar página ${slide.index} como PNG`);
      card.querySelector('.btn-mini-dl').addEventListener('click', async () => {
        try { await this.exporter.downloadSlide(slide.index); }
        catch { document.getElementById('export-status-label').textContent = 'No se pudo descargar la página. Inténtalo otra vez.'; }
      });
      this.stripContainer.appendChild(card);
    });

    if (this.btnZip) {
      this.btnZip.textContent = `Descargar ${this.engine.slideCount} páginas · ZIP`;
    }
  }
}

// Initialize on DOM load
window.addEventListener('DOMContentLoaded', () => {
  window.__notScrlApp = new NotScrlMobileApp();
});

// ---- END js/app.js ----

})();
