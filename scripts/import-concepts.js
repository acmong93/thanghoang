/**
 * Nhập kho ảnh concept từ thư mục anh Thắng đã phân loại sẵn.
 * - Nén WebP: bản chính 1600px q82, thumb 640px q74 → public/img/concepts/<slug>/
 * - Đo kích thước từng ảnh (w/h) để trang xem xếp bố cục justified kiểu Flickr
 * - Sinh scripts/concepts-manifest.json — server.js đọc file này khi boot để
 *   tạo dữ liệu concept trên môi trường mới (marker chạy đúng 1 lần)
 * Chạy: node scripts/import-concepts.js [--force]
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const SRC = 'C:/Users/sieus/Downloads/Compressed/cac concept up web';
const OUT = path.join(__dirname, '..', 'public', 'img', 'concepts');
const MANIFEST = path.join(__dirname, 'concepts-manifest.json');

/* Danh mục concept: thư mục nguồn → slug, tên hiển thị, nhóm, mô tả (giọng Rosé) */
const CONCEPTS = [
  {
    dir: 'STUDIO - Phim Trường/1.Studio Phim Trường Rosé',
    slug: 'studio-phim-truong', name: 'Studio Phim Trường Rosé', grp: 'Studio - Phim Trường',
    desc: 'Hệ phim trường độc quyền ngay tại Rosé: nhiều bối cảnh được dàn dựng và thay mới liên tục, chụp trọn trong một buổi không lo thời tiết.'
  },
  {
    dir: 'STUDIO - Phim Trường/Editorial - Tạp Chí',
    slug: 'editorial-tap-chi', name: 'Editorial - Tạp Chí', grp: 'Studio - Phim Trường',
    desc: 'Chất tạp chí thời trang: ánh sáng điện ảnh, dáng pose chủ đích, mỗi khung hình như một trang bìa dành riêng cho hai bạn.'
  },
  {
    dir: 'STUDIO - Phim Trường/Áo dài',
    slug: 'ao-dai', name: 'Áo Dài', grp: 'Studio - Phim Trường',
    desc: 'Vẻ đẹp Việt trong tà áo dài, tiết chế và sang trọng, để nét truyền thống tự cất lời.'
  },
  {
    dir: 'Ngoại cảnh',
    slug: 'ngoai-canh', name: 'Ngoại Cảnh', grp: 'Ngoại cảnh',
    desc: 'Nắng gió và không gian thật: những địa điểm ngoại cảnh được Rosé tuyển chọn theo mùa đẹp nhất trong năm.'
  }
];

const isImg = f => /\.(jpe?g|png|webp)$/i.test(f);
/* Sắp tự nhiên theo số trong tên file: 2 trước 10, "10.1" sau "10" */
const natural = (a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });

(async () => {
  const force = process.argv.includes('--force');
  const manifest = [];
  let total = 0;

  for (let ci = 0; ci < CONCEPTS.length; ci++) {
    const c = CONCEPTS[ci];
    const srcDir = path.join(SRC, c.dir);
    const outDir = path.join(OUT, c.slug);
    fs.mkdirSync(outDir, { recursive: true });

    const files = fs.readdirSync(srcDir).filter(isImg).sort(natural);
    const images = [];
    for (let i = 0; i < files.length; i++) {
      const n = String(i + 1).padStart(2, '0');
      const main = path.join(outDir, `${n}.webp`);
      const thumb = path.join(outDir, `${n}-thumb.webp`);
      if (force || !fs.existsSync(main)) {
        const buf = fs.readFileSync(path.join(srcDir, files[i]));
        await sharp(buf, { failOn: 'none' }).rotate()
          .resize({ width: 1600, withoutEnlargement: true }).webp({ quality: 82 }).toFile(main);
        await sharp(buf, { failOn: 'none' }).rotate()
          .resize({ width: 640, withoutEnlargement: true }).webp({ quality: 74 }).toFile(thumb);
      }
      const meta = await sharp(main).metadata();
      images.push({
        file: `/img/concepts/${c.slug}/${n}.webp`,
        thumb: `/img/concepts/${c.slug}/${n}-thumb.webp`,
        w: meta.width || 0, h: meta.height || 0
      });
      total++;
    }
    manifest.push({ slug: c.slug, name: c.name, grp: c.grp, desc: c.desc, sort: ci, images });
    console.log(`[concept] ${c.name}: ${images.length} ảnh`);
  }

  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 1));
  console.log(`Xong: ${total} ảnh, manifest tại ${MANIFEST}`);
})();
