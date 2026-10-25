import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

function crc32(buf) {
  let table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

function makeChunk(type, data) {
  const len = data.length;
  const buf = Buffer.alloc(8 + len + 4);
  buf.writeUInt32BE(len, 0);
  buf.write(type, 4, 4, "ascii");
  data.copy(buf, 8);
  const typeAndData = buf.subarray(4, 8 + len);
  const crc = crc32(typeAndData);
  buf.writeUInt32BE(crc, 8 + len);
  return buf;
}

function createNoctisPng(width, height, isMaskable = false) {
  const rowSize = 1 + width * 4;
  const rawData = Buffer.alloc(rowSize * height);

  // Noctis primary: #0F766E (R: 15, G: 118, B: 110)
  const bgR = 15, bgG = 118, bgB = 110;
  const fgR = 255, fgG = 255, fgB = 255;

  const cx = width / 2;
  const cy = height / 2;

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // Filter type 0

    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 4;

      let r = 0, g = 0, b = 0, a = 0;

      if (isMaskable) {
        // Full bleed background for adaptive icons
        r = bgR; g = bgG; b = bgB; a = 255;
      } else {
        // Rounded badge shape (squircle)
        const cornerRadius = width * 0.22;
        const qx = Math.abs(x - cx) - (cx - cornerRadius);
        const qy = Math.abs(y - cy) - (cy - cornerRadius);
        const outsideDist = Math.hypot(Math.max(0, qx), Math.max(0, qy));
        if (outsideDist <= cornerRadius) {
          r = bgR; g = bgG; b = bgB; a = 255;
        }
      }

      // Stylized "N" logo symbol
      const scale = isMaskable ? 0.75 : 1.0; // Maskable requires safe zone margin
      const nW = width * 0.38 * scale;
      const nH = height * 0.44 * scale;
      const x1 = cx - nW / 2;
      const x2 = cx + nW / 2;
      const y1 = cy - nH / 2;
      const y2 = cy + nH / 2;
      const stemW = width * 0.08 * scale;

      if (a > 0 && y >= y1 && y <= y2) {
        // Left stem
        if (x >= x1 && x <= x1 + stemW) {
          r = fgR; g = fgG; b = fgB; a = 255;
        }
        // Right stem
        else if (x >= x2 - stemW && x <= x2) {
          r = fgR; g = fgG; b = fgB; a = 255;
        }
        // Diagonal bridge
        else if (x >= x1 && x <= x2) {
          const t = (x - x1) / (x2 - x1);
          const diagY = y1 + t * (y2 - y1);
          if (Math.abs(y - diagY) <= stemW * 0.8) {
            r = fgR; g = fgG; b = fgB; a = 255;
          }
        }
      }

      rawData[pxOffset] = r;
      rawData[pxOffset + 1] = g;
      rawData[pxOffset + 2] = b;
      rawData[pxOffset + 3] = a;
    }
  }

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const ihdrChunk = makeChunk("IHDR", ihdr);

  const compressed = zlib.deflateSync(rawData);
  const idatChunk = makeChunk("IDAT", compressed);

  const iendChunk = makeChunk("IEND", Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

const targetDir = path.resolve(process.cwd(), "public/icons");
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

const icons = [
  { file: "icon-192x192.png", size: 192, maskable: false },
  { file: "icon-512x512.png", size: 512, maskable: false },
  { file: "icon-maskable-192x192.png", size: 192, maskable: true },
  { file: "icon-maskable-512x512.png", size: 512, maskable: true },
  { file: "apple-touch-icon.png", size: 180, maskable: false },
];

for (const icon of icons) {
  const filePath = path.join(targetDir, icon.file);
  const buf = createNoctisPng(icon.size, icon.size, icon.maskable);
  fs.writeFileSync(filePath, buf);
  console.log(`Generated: ${icon.file} (${buf.length} bytes)`);
}

console.log("All PWA icons generated successfully!");
