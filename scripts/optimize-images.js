/**
 * Tối ưu ảnh gốc sang WebP cho web.
 * Nguồn:  "Xây dựng weibsite/ảnh" (ảnh gốc, giữ nguyên không đụng tới)
 * Đích:   public/img/<slug-album>/<n>.webp  + <n>-thumb.webp
 *
 * Chạy:   npm run optimize-images
 * Chạy lại an toàn: file đích đã tồn tại sẽ được bỏ qua.
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const SRC_ROOT = path.join(__dirname, '..', 'Xây dựng weibsite', 'ảnh');
const OUT_ROOT = path.join(__dirname, '..', 'public', 'img');

// Đổi tên thư mục tiếng Việt sang slug ASCII an toàn cho URL
const FOLDER_MAP = {
  '0': 'editorial',
  '1': 'han-quoc',
  '2': 'vuon-yeu',
  '3': 'fine-art',
  'cp3': 'concept-3',
  'cp4': 'phim-truong',
  'cp5': 'sac-rose',
  'cp6': 'concept-6',
  'huong lien': 'huong-lien',
  'logo': 'logo',
  'độc bản/lam điệp': 'lam-diep',
  'độc bản/sắc sen': 'sac-sen',
  'ảnh phóng sự cưới': 'phong-su'
};

const FULL_WIDTH = 1600;   // ảnh xem trong album / hero
const THUMB_WIDTH = 640;   // ảnh lưới, cover
const QUALITY_FULL = 82;
const QUALITY_THUMB = 74;

const isImage = f => /\.(jpe?g|png)$/i.test(f);

// "_TH_3459..jpg" -> "th-3459", "a1.JPG" -> "a1"
function slugName(file) {
  return path.basename(file).replace(/\.(jpe?g|png)$/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'anh';
}

async function processDir(srcDir, outSlug) {
  const outDir = path.join(OUT_ROOT, outSlug);
  fs.mkdirSync(outDir, { recursive: true });
  const files = fs.readdirSync(srcDir).filter(isImage).sort();
  let done = 0, skipped = 0, failed = 0;
  const used = new Set();

  for (const file of files) {
    let base = slugName(file);
    while (used.has(base)) base += '-2';
    used.add(base);

    const srcPath = path.join(srcDir, file);
    const fullOut = path.join(outDir, `${base}.webp`);
    const thumbOut = path.join(outDir, `${base}-thumb.webp`);

    if (fs.existsSync(fullOut) && fs.existsSync(thumbOut)) { skipped++; continue; }
    try {
      const img = sharp(srcPath, { failOn: 'none' }).rotate();
      await img.clone()
        .resize({ width: FULL_WIDTH, withoutEnlargement: true })
        .webp({ quality: QUALITY_FULL })
        .toFile(fullOut);
      await img.clone()
        .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
        .webp({ quality: QUALITY_THUMB })
        .toFile(thumbOut);
      done++;
    } catch (err) {
      failed++;
      console.error(`  LOI ${outSlug}/${file}: ${err.message}`);
    }
  }
  console.log(`${outSlug}: ${done} xong, ${skipped} bo qua, ${failed} loi (${files.length} anh nguon)`);
}

// Logo giữ PNG trong suốt, chỉ resize
async function processLogos(srcDir) {
  const outDir = path.join(OUT_ROOT, 'logo');
  fs.mkdirSync(outDir, { recursive: true });
  for (const file of fs.readdirSync(srcDir).filter(isImage)) {
    const base = slugName(file);
    const out = path.join(outDir, `${base}.png`);
    if (fs.existsSync(out)) continue;
    try {
      await sharp(path.join(srcDir, file), { failOn: 'none' })
        .resize({ width: 480, withoutEnlargement: true })
        .png({ compressionLevel: 9 })
        .toFile(out);
      console.log(`logo/${base}.png`);
    } catch (err) {
      console.error(`  LOI logo/${file}: ${err.message}`);
    }
  }
}

(async () => {
  console.log('Bat dau toi uu anh...\n');
  const t0 = Date.now();
  for (const [rel, slug] of Object.entries(FOLDER_MAP)) {
    const srcDir = path.join(SRC_ROOT, rel);
    if (!fs.existsSync(srcDir)) { console.warn(`Bo qua (khong thay): ${rel}`); continue; }
    if (slug === 'logo') await processLogos(srcDir);
    else await processDir(srcDir, slug);
  }
  console.log(`\nHoan tat sau ${((Date.now() - t0) / 1000 / 60).toFixed(1)} phut.`);
})();
