/**
 * Nhập kho báo giá (ẩn, chỉ gửi link cho khách) từ thư mục anh Thắng: D:/Báo giá/Báo giá JA x Rosé wedding 2026
 * - Mỗi thư mục = một hạng mục (Pre-wedding, Combo trọn gói, Phóng sự cưới, Dịch vụ khác)
 * - Nén WebP: bản chính 2000px q82 (chữ trên trang báo giá phóng to vẫn đọc rõ), thumb 640px q74
 *   → public/img/bao-gia/<slug>/NN.webp; sinh scripts/bao-gia-manifest.json
 * - server.js đọc manifest khi khởi động để tạo dữ liệu (marker baogia_import_v1, chạy một lần)
 * Chạy: node scripts/import-bao-gia.js
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const SRC = 'D:/Báo giá/Báo giá JA x Rosé wedding 2026';
const OUT = path.join(__dirname, '..', 'public', 'img', 'bao-gia');
const MANIFEST = path.join(__dirname, 'bao-gia-manifest.json');

/* Tên từng trang lấy theo tiêu đề in trên trang báo giá */
const CATS = [
  {
    slug: 'pre-wedding-2026', name: 'Pre-wedding', desc: 'Các gói chụp ảnh cưới tại studio, phim trường và ngoại cảnh, kèm lưu ý khi đặt lịch.',
    files: [
      ['1.PRE-WEDDING/1.studio.jpg', 'Package 1'], ['1.PRE-WEDDING/2.Gói 2.jpg', 'Package 2'],
      ['1.PRE-WEDDING/3.Gói 3.jpg', 'Package 3'], ['1.PRE-WEDDING/4.Gói 4.jpg', 'Package 4'],
      ['1.PRE-WEDDING/5. gói 5.jpg', 'Package 5'], ['1.PRE-WEDDING/6. gói vip1.jpg', 'VIP 1'],
      ['1.PRE-WEDDING/7. gói vip2.jpg', 'VIP 2'], ['1.PRE-WEDDING/8. Gói luxury1.jpg', 'Luxury 1'],
      ['1.PRE-WEDDING/9. Gói luxury2.jpg', 'Luxury 2'],
      ['1.PRE-WEDDING/ngoại thành/10. gói ngoại thành.jpg', 'Ngoại thành'],
      ['1.PRE-WEDDING/ngoại thành/11. gói ngoại thành vip.jpg', 'Ngoại thành VIP'],
      ['1.PRE-WEDDING/12. Lưu ý.jpg', 'Lưu ý']
    ]
  },
  {
    slug: 'combo-tron-goi-2026', name: 'Combo trọn gói', desc: 'Chụp ảnh cưới, phóng sự ngày cưới, váy cưới và trang điểm trong một gói, tiết kiệm hơn đặt lẻ.',
    files: [
      ['2.COMBO TRỌN GÓI/1.cb1.jpg', 'Combo 1'], ['2.COMBO TRỌN GÓI/2.cb2.jpg', 'Combo 2'],
      ['2.COMBO TRỌN GÓI/3. cb3.jpg', 'Combo 3'], ['2.COMBO TRỌN GÓI/4.cb4.jpg', 'Combo 4'],
      ['2.COMBO TRỌN GÓI/5.cb5.jpg', 'Combo 5'], ['2.COMBO TRỌN GÓI/6.cbv1.jpg', 'Combo VIP 1'],
      ['2.COMBO TRỌN GÓI/7.jpg', 'Combo VIP 2'], ['2.COMBO TRỌN GÓI/8.cbv3.jpg', 'Combo VIP 3'],
      ['2.COMBO TRỌN GÓI/9.cbv4.jpg', 'Combo VIP 4'], ['2.COMBO TRỌN GÓI/10.cbv5.jpg', 'Combo VIP 5'],
      ['2.COMBO TRỌN GÓI/11.cbl1.jpg', 'Combo Luxury 1'], ['2.COMBO TRỌN GÓI/12.cbl2.jpg', 'Combo Luxury 2']
    ]
  },
  {
    slug: 'phong-su-cuoi-2026', name: 'Phóng sự cưới', desc: 'Chụp và quay phóng sự lễ ăn hỏi, ngày cưới cùng JA Studio.',
    files: [
      ['3.PHÓNG SỰ CƯỚI/1. Psc Photo.jpg', 'Phóng sự Photo'], ['3.PHÓNG SỰ CƯỚI/2. Psc video.jpg', 'Phóng sự Video'],
      ['3.PHÓNG SỰ CƯỚI/3.psc vip 1.jpg', 'Phóng sự VIP 1'], ['3.PHÓNG SỰ CƯỚI/4. PSC vip2.jpg', 'Phóng sự VIP 2'],
      ['3.PHÓNG SỰ CƯỚI/5 psc Vip 3.jpg', 'Phóng sự VIP 3'], ['3.PHÓNG SỰ CƯỚI/6. psc LUXXURY 2.jpg', 'Luxury Package'],
      ['3.PHÓNG SỰ CƯỚI/7. intimate wedding 1.jpg', 'Intimate Wedding 1'], ['3.PHÓNG SỰ CƯỚI/8. intimate wedding 2.jpg', 'Intimate Wedding 2']
    ]
  },
  {
    slug: 'dich-vu-khac-2026', name: 'Dịch vụ khác', desc: 'Gói đồng hành và chụp ảnh gia đình.',
    files: [
      ['Dịch vụ khác/dh 1.jpg', 'Đồng hành 1'], ['Dịch vụ khác/dh2..jpg', 'Đồng hành 2'],
      ['Dịch vụ khác/fam1 copy.jpg', 'Family 1'], ['Dịch vụ khác/fam2 copy.jpg', 'Family 2']
    ]
  }
];

(async () => {
  const manifest = [];
  for (let ci = 0; ci < CATS.length; ci++) {
    const c = CATS[ci];
    const outDir = path.join(OUT, c.slug);
    fs.mkdirSync(outDir, { recursive: true });
    const images = [];
    for (let i = 0; i < c.files.length; i++) {
      const [rel, label] = c.files[i];
      const n = String(i + 1).padStart(2, '0');
      const src = path.join(SRC, rel);
      const info = await sharp(src).rotate().resize({ width: 2000, withoutEnlargement: true }).webp({ quality: 82 })
        .toFile(path.join(outDir, `${n}.webp`));
      await sharp(src).rotate().resize({ width: 640, withoutEnlargement: true }).webp({ quality: 74 })
        .toFile(path.join(outDir, `${n}-thumb.webp`));
      images.push({ file: `/img/bao-gia/${c.slug}/${n}.webp`, thumb: `/img/bao-gia/${c.slug}/${n}-thumb.webp`, label, w: info.width, h: info.height });
    }
    manifest.push({ slug: c.slug, name: c.name, desc: c.desc, sort: ci + 1, images });
    console.log(`${c.name}: ${images.length} trang`);
  }
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));
  console.log('Đã ghi', MANIFEST);
})();
