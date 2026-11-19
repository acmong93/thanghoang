/**
 * Nhập bộ concept + ảnh từ scripts/concepts-manifest.json (marker chạy đúng 1 lần).
 * Gọi ở 2 chỗ: khi boot server, và sau khi khôi phục sao lưu — bản sao lưu chụp
 * trước đợt concept không có dữ liệu lẫn marker, nếu không nhập lại thì trang
 * /concept trống cho tới lần restart kế tiếp.
 */
const fs = require('fs');
const path = require('path');

function ensureConcepts() {
  const { get, run, setting, setSetting } = require('./db');
  if (setting('concepts_import_v1')) return;
  try {
    const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'scripts', 'concepts-manifest.json'), 'utf8'));
    for (const c of manifest) {
      if (get('SELECT id FROM albums WHERE slug = ?', c.slug)) continue;
      const a = run(
        "INSERT INTO albums(slug, name, tag, [desc], category, grp, sort_order, visible) VALUES(?,?,?,?,'concept',?,?,1)",
        c.slug, c.name, c.grp, c.desc, c.grp, c.sort
      );
      c.images.forEach((im, i) => run(
        'INSERT INTO images(album_id, file, thumb, alt, sort_order, is_cover, w, h) VALUES(?,?,?,?,?,?,?,?)',
        a.lastInsertRowid, im.file, im.thumb, c.name, i, i === 0 ? 1 : 0, im.w, im.h
      ));
    }
    setSetting('concepts_import_v1', '1');
    console.log('[init] Đã nhập ' + manifest.length + ' bộ concept từ manifest');
  } catch (e) {
    console.error('[init] Lỗi nhập concept:', e.message);
  }
}

/* Kho báo giá (ẩn, gửi link cho khách): nhập từ scripts/bao-gia-manifest.json một lần (marker baogia_import_v1).
   category 'baogia', nhóm 'Báo giá' để quản lý chung trong Admin → Concept (thêm/xoá/kéo thả ảnh như concept).
   Nhãn từng trang (Package 1, Combo VIP 2...) lưu ở images.alt. */
function ensureBaoGia() {
  const { get, run, setting, setSetting } = require('./db');
  if (setting('baogia_import_v1')) return;
  try {
    const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'scripts', 'bao-gia-manifest.json'), 'utf8'));
    const base = get('SELECT COALESCE(MAX(sort_order),0) m FROM albums').m;
    for (const c of manifest) {
      if (get('SELECT id FROM albums WHERE slug = ?', c.slug)) continue;
      const a = run(
        "INSERT INTO albums(slug, name, tag, [desc], category, grp, sort_order, visible) VALUES(?,?,?,?,'baogia','Báo giá',?,1)",
        c.slug, c.name, 'Báo giá', c.desc, base + c.sort
      );
      c.images.forEach((im, i) => run(
        'INSERT INTO images(album_id, file, thumb, alt, sort_order, is_cover, w, h) VALUES(?,?,?,?,?,?,?,?)',
        a.lastInsertRowid, im.file, im.thumb, im.label, i, i === 0 ? 1 : 0, im.w, im.h
      ));
    }
    setSetting('baogia_import_v1', '1');
    console.log('[init] Đã nhập ' + manifest.length + ' hạng mục báo giá từ manifest');
  } catch (e) {
    console.error('[init] Lỗi nhập báo giá:', e.message);
  }
}

module.exports = { ensureConcepts, ensureBaoGia };
