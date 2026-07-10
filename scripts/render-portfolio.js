/**
 * Render từng trang "Portfolio Rose wedding.pdf" thành ảnh WebP cho trang Về Rosé.
 * Chạy 1 lần trên máy local: node scripts/render-portfolio.js "D:/Báo giá/Portfolio Rose wedding.pdf"
 * Kết quả: public/img/portfolio/trang-01.webp ... (rộng 1600px, chất lượng 82)
 */
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

async function main() {
  const pdfPath = process.argv[2] || 'D:/Báo giá/Portfolio Rose wedding.pdf';
  const outDir = path.join(__dirname, '..', 'public', 'img', 'portfolio');
  fs.mkdirSync(outDir, { recursive: true });

  const napi = require('@napi-rs/canvas');
  const { createCanvas } = napi;
  // pdfjs vẽ chữ qua Path2D/DOMMatrix toàn cục vốn không có trong Node
  if (napi.Path2D && !global.Path2D) global.Path2D = napi.Path2D;
  if (napi.DOMMatrix && !global.DOMMatrix) global.DOMMatrix = napi.DOMMatrix;
  if (napi.ImageData && !global.ImageData) global.ImageData = napi.ImageData;
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');

  const data = new Uint8Array(fs.readFileSync(pdfPath));
  // disableFontFace: vẽ chữ bằng đường nét glyph (tránh lỗi font trên môi trường Node)
  const doc = await pdfjs.getDocument({ data, disableFontFace: true }).promise;
  console.log('PDF có', doc.numPages, 'trang');

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const scale = 1600 / page.getViewport({ scale: 1 }).width;
    const viewport = page.getViewport({ scale });
    const canvas = createCanvas(Math.round(viewport.width), Math.round(viewport.height));
    const ctx = canvas.getContext('2d');
    // Font nhúng đôi khi tạo chuỗi font mà canvas từ chối: bỏ qua để không chết cả trang
    const proto = Object.getPrototypeOf(ctx);
    const fontDesc = Object.getOwnPropertyDescriptor(proto, 'font');
    if (fontDesc && fontDesc.set) {
      Object.defineProperty(ctx, 'font', {
        get() { return fontDesc.get.call(this); },
        set(v) { try { fontDesc.set.call(this, v); } catch (e) { /* giữ font hiện tại */ } }
      });
    }
    await page.render({ canvasContext: ctx, viewport }).promise;
    const png = canvas.toBuffer('image/png');
    const out = path.join(outDir, `trang-${String(i).padStart(2, '0')}.webp`);
    await sharp(png).webp({ quality: 82 }).toFile(out);
    console.log('đã render', path.basename(out), `(${Math.round(viewport.width)}x${Math.round(viewport.height)})`);
  }
  console.log('Xong →', outDir);
}

main().catch(e => { console.error(e); process.exit(1); });
