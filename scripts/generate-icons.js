// Script to generate valid PNG icons for VKU Field Survey PWA using pure Node.js built-in zlib
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

const ICONS_DIR = path.resolve('assets/icons');
if (!fs.existsSync(ICONS_DIR)) {
  fs.mkdirSync(ICONS_DIR, { recursive: true });
}

// Function to generate a raw uncompressed PNG with given dimensions and drawing callback
function createPNG(width, height, isMaskable = false) {
  // RGB or RGBA channels
  const channels = 4;
  // Row size = 1 byte filter type (0) + width * 4 bytes RGBA
  const rowSize = 1 + width * channels;
  const rawBuffer = Buffer.alloc(height * rowSize);

  const cx = width / 2;
  const cy = height / 2;
  const r = width * (isMaskable ? 0.48 : 0.44);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawBuffer[rowOffset] = 0; // Filter None

    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * channels;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Background gradient: Deep VKU Navy to Blue
      let rVal = 0;
      let gVal = 84;
      let bVal = 166; // #0054A6
      let aVal = 255;

      if (!isMaskable && dist > r) {
        // Outside circle for non-maskable icon (transparent corners)
        aVal = 0;
      } else {
        // Gradient from top to bottom
        const t = y / height;
        rVal = Math.round(11 + (0 - 11) * t);
        gVal = Math.round(19 + (84 - 19) * t);
        bVal = Math.round(43 + (166 - 43) * t);

        // Gold border ring
        if (dist >= r - (width * 0.035) && dist <= r) {
          rVal = 253;
          gVal = 185;
          bVal = 19; // #FDB913
        }

        // Draw clipboard in center
        const cw = width * 0.44;
        const ch = height * 0.52;
        const left = cx - cw / 2;
        const top = cy - ch / 2 + (height * 0.03);
        const right = left + cw;
        const bottom = top + ch;

        // Clipboard body (white/slate)
        if (x >= left && x <= right && y >= top && y <= bottom) {
          rVal = 245;
          gVal = 247;
          bVal = 250;

          // Checklist lines
          const lineLeft = left + cw * 0.28;
          const lineRight = right - cw * 0.15;
          const lineH = Math.max(2, Math.round(height * 0.022));

          const lineY1 = top + ch * 0.32;
          const lineY2 = top + ch * 0.52;
          const lineY3 = top + ch * 0.72;

          // Checkmarks (Green)
          const chkLeft = left + cw * 0.12;
          const chkRight = left + cw * 0.22;

          if (x >= lineLeft && x <= lineRight) {
            if ((y >= lineY1 && y < lineY1 + lineH) ||
                (y >= lineY2 && y < lineY2 + lineH) ||
                (y >= lineY3 && y < lineY3 + lineH)) {
              rVal = 100;
              gVal = 116;
              bVal = 139; // Slate-500
            }
          }

          if (x >= chkLeft && x <= chkRight) {
            if ((y >= lineY1 && y < lineY1 + lineH) ||
                (y >= lineY2 && y < lineY2 + lineH) ||
                (y >= lineY3 && y < lineY3 + lineH)) {
              rVal = 16;
              gVal = 185;
              bVal = 129; // Emerald green check
            }
          }
        }

        // Clipboard top clip (Gold/Crimson VKU accent)
        const clipW = cw * 0.45;
        const clipH = height * 0.06;
        const clipLeft = cx - clipW / 2;
        const clipTop = top - clipH * 0.55;
        if (x >= clipLeft && x <= clipLeft + clipW && y >= clipTop && y <= clipTop + clipH) {
          rVal = 237;
          gVal = 28;
          bVal = 36; // VKU Red #ED1C24
        }
      }

      rawBuffer[pxOffset] = rVal;
      rawBuffer[pxOffset + 1] = gVal;
      rawBuffer[pxOffset + 2] = bVal;
      rawBuffer[pxOffset + 3] = aVal;
    }
  }

  // Compress IDAT data using zlib
  const compressed = zlib.deflateSync(rawBuffer);

  // PNG Signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // Helper to build chunk
  function makeChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crcBuf = Buffer.alloc(4);

    const crcPayload = Buffer.concat([typeBuf, data]);
    const crcVal = crc32(crcPayload);
    crcBuf.writeUInt32BE(crcVal >>> 0, 0);

    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // Bit depth
  ihdr[9] = 6; // Color type (RGBA)
  ihdr[10] = 0; // Compression
  ihdr[11] = 0; // Filter
  ihdr[12] = 0; // Interlace

  const ihdrChunk = makeChunk('IHDR', ihdr);
  const idatChunk = makeChunk('IDAT', compressed);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

// CRC32 implementation
function crc32(buf) {
  let table = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      if (c & 1) c = 0xedb88320 ^ (c >>> 1);
      else c = c >>> 1;
    }
    table[n] = c;
  }

  let crc = 0 ^ (-1);
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ (-1)) >>> 0;
}

// Generate PNGs
console.log('Generating PWA icons...');
fs.writeFileSync(path.join(ICONS_DIR, 'icon-192x192.png'), createPNG(192, 192, false));
fs.writeFileSync(path.join(ICONS_DIR, 'icon-512x512.png'), createPNG(512, 512, false));
fs.writeFileSync(path.join(ICONS_DIR, 'icon-maskable-192x192.png'), createPNG(192, 192, true));
fs.writeFileSync(path.join(ICONS_DIR, 'icon-maskable-512x512.png'), createPNG(512, 512, true));
fs.writeFileSync(path.join(ICONS_DIR, 'favicon.png'), createPNG(64, 64, false));

// Also generate an SVG icon for vector clarity
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0054A6"/>
      <stop offset="100%" stop-color="#0B132B"/>
    </linearGradient>
    <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#FDB913"/>
      <stop offset="100%" stop-color="#F59E0B"/>
    </linearGradient>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#000000" flood-opacity="0.35"/>
    </filter>
  </defs>
  <!-- Background Rounded Shield -->
  <rect width="512" height="512" rx="112" fill="url(#bgGrad)"/>
  <!-- Gold Accent Ring -->
  <rect x="24" y="24" width="464" height="464" rx="96" fill="none" stroke="url(#goldGrad)" stroke-width="8" opacity="0.85"/>
  
  <!-- Clipboard Body -->
  <rect x="136" y="110" width="240" height="300" rx="20" fill="#FFFFFF" filter="url(#shadow)"/>
  
  <!-- Top Clip (VKU Crimson) -->
  <rect x="200" y="86" width="112" height="42" rx="10" fill="#ED1C24" filter="url(#shadow)"/>
  <circle cx="256" cy="107" r="8" fill="#FFFFFF"/>
  
  <!-- Checklist Items -->
  <!-- Item 1: Checked -->
  <circle cx="180" cy="180" r="14" fill="#10B981"/>
  <path d="M174 180 L178 184 L187 175" stroke="#FFFFFF" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  <rect x="208" y="174" width="138" height="12" rx="6" fill="#334155"/>

  <!-- Item 2: Checked -->
  <circle cx="180" cy="236" r="14" fill="#10B981"/>
  <path d="M174 236 L178 240 L187 231" stroke="#FFFFFF" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  <rect x="208" y="230" width="120" height="12" rx="6" fill="#334155"/>

  <!-- Item 3: Inspection Alert / Warning -->
  <circle cx="180" cy="292" r="14" fill="#F59E0B"/>
  <rect x="178.5" y="284" width="3" height="10" rx="1.5" fill="#FFFFFF"/>
  <circle cx="180" cy="299" r="1.8" fill="#FFFFFF"/>
  <rect x="208" y="286" width="105" height="12" rx="6" fill="#334155"/>

  <!-- Item 4: Normal check -->
  <circle cx="180" cy="348" r="14" fill="#0054A6"/>
  <path d="M174 348 L178 352 L187 343" stroke="#FFFFFF" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  <rect x="208" y="342" width="130" height="12" rx="6" fill="#64748B"/>

  <!-- Badge at bottom: VKU -->
  <rect x="166" y="425" width="180" height="38" rx="19" fill="url(#goldGrad)"/>
  <text x="256" y="451" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="20" font-weight="900" fill="#003B75" text-anchor="middle" letter-spacing="3">VKU SURVEY</text>
</svg>`;

fs.writeFileSync(path.join(ICONS_DIR, 'icon.svg'), svgContent);
console.log('PWA icons created successfully in assets/icons/');
