// Generates icon-192.png and icon-512.png using only Node built-ins
import zlib from "zlib";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "../public");
fs.mkdirSync(publicDir, { recursive: true });

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length);
  const body = Buffer.concat([typeBuf, data]);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(body));
  return Buffer.concat([lenBuf, body, crcBuf]);
}

// Draw a "D" shaped icon
// Returns pixel array [r,g,b,a] x width x height (RGBA)
function makePixels(size) {
  const pixels = new Uint8Array(size * size * 4);

  // Fill background: #0D0D10
  for (let i = 0; i < size * size; i++) {
    pixels[i * 4 + 0] = 13;
    pixels[i * 4 + 1] = 13;
    pixels[i * 4 + 2] = 16;
    pixels[i * 4 + 3] = 255;
  }

  function setPixel(x, y, r, g, b) {
    if (x < 0 || x >= size || y < 0 || y >= size) return;
    const i = (y * size + x) * 4;
    pixels[i] = r;
    pixels[i + 1] = g;
    pixels[i + 2] = b;
    pixels[i + 3] = 255;
  }

  function fillRect(x0, y0, w, h, r, g, b) {
    for (let y = y0; y < y0 + h; y++)
      for (let x = x0; x < x0 + w; x++)
        setPixel(x, y, r, g, b);
  }

  // Draw "D" letter (white) centered, scaled to icon size
  const scale = size / 192;
  const pad = Math.round(40 * scale);
  const lw = Math.round(26 * scale);  // left bar width
  const th = Math.round(20 * scale);  // top/bottom band height
  const letterH = Math.round(100 * scale);
  const letterW = Math.round(96 * scale);
  const x0 = Math.round(48 * scale);
  const y0 = Math.round(46 * scale);

  // Left vertical bar
  fillRect(x0, y0, lw, letterH, 255, 255, 255);
  // Top bar
  fillRect(x0, y0, letterW - Math.round(20 * scale), th, 255, 255, 255);
  // Bottom bar
  fillRect(x0, y0 + letterH - th, letterW - Math.round(20 * scale), th, 255, 255, 255);
  // Upper curve
  fillRect(x0 + Math.round(60 * scale), y0 + th, Math.round(28 * scale), th, 255, 255, 255);
  // Right side
  fillRect(x0 + letterW - Math.round(20 * scale), y0 + Math.round(25 * scale), Math.round(20 * scale), letterH - Math.round(50 * scale), 255, 255, 255);
  // Lower curve
  fillRect(x0 + Math.round(60 * scale), y0 + letterH - Math.round(40 * scale), Math.round(28 * scale), th, 255, 255, 255);

  return pixels;
}

function makePNG(size) {
  const pixels = makePixels(size);
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(size, 0);
  ihdrData.writeUInt32BE(size, 4);
  ihdrData[8] = 8;  // bit depth
  ihdrData[9] = 6;  // RGBA
  const ihdr = pngChunk("IHDR", ihdrData);

  // Raw scanlines with filter byte 0
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const src = (y * size + x) * 4;
      const dst = y * (size * 4 + 1) + 1 + x * 4;
      raw[dst] = pixels[src];
      raw[dst + 1] = pixels[src + 1];
      raw[dst + 2] = pixels[src + 2];
      raw[dst + 3] = pixels[src + 3];
    }
  }

  const compressed = zlib.deflateSync(raw);
  const idat = pngChunk("IDAT", compressed);
  const iend = pngChunk("IEND", Buffer.alloc(0));

  return Buffer.concat([sig, ihdr, idat, iend]);
}

for (const size of [192, 512]) {
  const outPath = path.join(publicDir, `icon-${size}.png`);
  fs.writeFileSync(outPath, makePNG(size));
  console.log(`Generated ${outPath}`);
}
