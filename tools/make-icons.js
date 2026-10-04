/* ============================================================
 * 图标生成工具：纯 Node 生成 PNG（无第三方依赖）
 * 图案：柔和蓝底 + 白色小兵剪影
 * 运行：node tools/make-icons.js
 * 生成：icons/icon-512.png、icons/maskable-512.png
 * （192 尺寸由 sips 等工具缩放，见 README）
 * ============================================================ */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

/* ---------- PNG 编码（RGBA，无依赖） ---------- */
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function encodePNG(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  // 每行前加过滤字节 0
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

/* ---------- 画小兵剪影 ---------- */
function drawIcon(size, padding) {
  const rgba = Buffer.alloc(size * size * 4);
  const cx = size / 2;
  const R = size / 2 - padding;
  const set = (x, y, r, g, b, a) => {
    const i = (y * size + x) * 4;
    // 简单 alpha 混合
    const na = a / 255;
    rgba[i] = Math.round(r * na + rgba[i] * (1 - na));
    rgba[i + 1] = Math.round(g * na + rgba[i + 1] * (1 - na));
    rgba[i + 2] = Math.round(b * na + rgba[i + 2] * (1 - na));
    rgba[i + 3] = Math.max(rgba[i + 3], a);
  };
  const inCircle = (x, y, ccx, ccy, r) => (x - ccx) ** 2 + (y - ccy) ** 2 <= r * r;
  const inRect = (x, y, x0, y0, x1, y1, rad) => {
    if (x < x0 || x > x1 || y < y0 || y > y1) return false;
    // 圆角
    const cxr = Math.min(Math.max(x, x0 + rad), x1 - rad);
    const cyr = Math.min(Math.max(y, y0 + rad), y1 - rad);
    return (x - cxr) ** 2 + (y - cyr) ** 2 <= rad * rad || (x >= x0 + rad && x <= x1 - rad) || (y >= y0 + rad && y <= y1 - rad);
  };
  const inTrapezoid = (x, y, topW, botW, yTop, yBot) => {
    if (y < yTop || y > yBot) return false;
    const t = (y - yTop) / (yBot - yTop);
    const halfW = topW + (botW - topW) * t;
    return Math.abs(x - cx) <= halfW;
  };

  const headR = R * 0.30;
  const headY = padding + R * 0.38;
  const neckTop = headY + headR * 0.72;
  const collarY = neckTop + R * 0.16;
  const baseTop = padding + R * 1.32;
  const baseBot = padding + R * 1.62;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // 背景：柔和蓝 + 底部微渐变
      const t = y / size;
      const r = Math.round(91 + 30 * t);
      const g = Math.round(141 + 20 * t);
      const b = Math.round(239 + 5 * t);
      let a = 255;
      let pr = 255, pg = 255, pb = 255; // 白色棋子

      const isPiece =
        inCircle(x, y, cx, headY, headR) ||
        inTrapezoid(x, y, R * 0.14, R * 0.30, neckTop, baseTop) ||
        inRect(x, y, cx - R * 0.30, collarY - R * 0.05, cx + R * 0.30, collarY + R * 0.05, R * 0.04) ||
        inRect(x, y, cx - R * 0.44, baseTop, cx + R * 0.44, baseBot, R * 0.10);

      if (isPiece) set(x, y, pr, pg, pb, 255);
      else set(x, y, r, g, b, a);
    }
  }
  return rgba;
}

const outDir = path.join(__dirname, '..', 'icons');
fs.mkdirSync(outDir, { recursive: true });
for (const [name, size, pad] of [['icon-512.png', 512, 64], ['maskable-512.png', 512, 108]]) {
  const png = encodePNG(size, size, drawIcon(size, pad));
  fs.writeFileSync(path.join(outDir, name), png);
  console.log('生成', name, png.length, 'bytes');
}
console.log('完成。运行: sips -z 192 512 icons/icon-512.png --out icons/icon-192.png 生成 192 尺寸');
