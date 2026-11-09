/**
 * Lightweight Zero-Dependency Client-Side ZIP File Generator
 * Implements the standard ZIP format (PK\x03\x04 and PK\x01\x02)
 * Supports browser CompressionStream ('deflate-raw') with fallback to STORE (uncompressed)
 */
export class SimpleZip {
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
