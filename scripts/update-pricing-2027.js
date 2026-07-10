/**
 * Cập nhật bảng giá theo bộ báo giá 2027 (D:\Báo giá\2027\Gói chụp).
 * Chạy: node scripts/update-pricing-2027.js
 * An toàn chạy lại nhiều lần (ghi đè intro + tiers của 4 nhóm; váy cưới giữ nguyên).
 */
require('dotenv').config();
const { run, get } = require('../src/db');

const data = {
  'anh-cuoi': {
    intro: 'Các gói pre-wedding từ studio tối giản đến luxury thiết kế riêng. Giá đã gồm váy vest, trang điểm và ekip chỉ phục vụ một cặp đôi. Book founder Mr.Thắng chụp +8.000.000đ.',
    tiers: [
      { name: 'Package 1', price: '5.990.000đ', note: 'Studio · 3,5 giờ', highlight: false, items: [
        '01 váy chụp cao cấp, 01 vest kèm phụ kiện',
        'Ekip riêng phục vụ 1 cặp đôi, trang điểm và làm tóc cô dâu',
        '02 ảnh phóng 50x75 ép gỗ Laminate',
        'Toàn bộ file gốc và 15 file photoshop hoàn thiện',
        '01 video slide ảnh Basic'
      ]},
      { name: 'Package 2', price: '7.900.000đ', note: 'Studio phim trường độc quyền · 4 giờ', highlight: false, items: [
        '01 váy cao cấp + 01 set tự chuẩn bị, 01 vest + 01 set',
        'Trang điểm và làm tóc theo váy ngày chụp',
        '02 ảnh phóng 60x90 ép gỗ Laminate',
        'Toàn bộ file gốc và 30 file photoshop hoàn thiện',
        '01 video slide Basic, 02 ảnh để bàn gương 15x21'
      ]},
      { name: 'Package 3', price: '9.800.000đ', note: '01 địa điểm nội thành · 5 giờ', highlight: false, items: [
        '02 váy chụp cao cấp, 01 vest kèm phụ kiện',
        '02 ảnh 60x90 Laminate, file gốc + 30 file photoshop',
        '01 video slide Basic, 02 ảnh để bàn 15x21',
        'Album 20x30 Ultra HD 20 trang'
      ]},
      { name: 'Package 4', price: '12.800.000đ', note: 'Được chọn nhiều nhất', highlight: true, items: [
        '02 địa điểm nội thành · 8 giờ làm việc',
        '02 váy + 01 set tự chuẩn bị, 02 vest + 01 set',
        '02 ảnh 60x90, file gốc + 40 file photoshop',
        'Album 20x30 giấy Silk 30 trang, 02 ảnh để bàn',
        'Tặng thiệp cưới điện tử trị giá tối đa 2.000.000đ',
        'Tặng 02 clip TikTok (báo trước để sắp xếp ekip)'
      ]},
      { name: 'Package 5', price: '14.800.000đ', note: '02-03 địa điểm nội thành · 10 giờ', highlight: false, items: [
        '02 váy + 01 set tự chuẩn bị, 02 vest + 01 set',
        '02-03 địa điểm nội thành · 10 giờ làm việc',
        '02 ảnh 60x90, file gốc + 40 file photoshop',
        'Album 25x35 giấy Silk 30 trang, 04 ảnh để bàn',
        'Tặng thiệp điện tử 2.000.000đ và 02 clip TikTok'
      ]},
      { name: 'VIP 1', price: '20.800.000đ', note: '02-03 địa điểm · 10 giờ · tặng gói chụp tối', highlight: false, items: [
        '01 váy cao cấp + 01 váy VIP + 01 set, 02 vest',
        '02 ảnh 60x90 ép gỗ Meka, khung nhập khẩu',
        'File gốc + 45 file photoshop, video slide Hàn Quốc',
        '04 ảnh để bàn khung nhập khẩu',
        'Album 25x35 bìa tạp giấy Silk 30 trang + hộp thiết kế',
        'Thiệp điện tử 2.000.000đ, 02 clip TikTok'
      ]},
      { name: 'VIP 2', price: '28.000.000đ', note: '03 địa điểm · 10 giờ · tặng gói chụp tối', highlight: false, items: [
        '01 váy cao cấp + 01 váy VIP, 02 vest',
        'Team stylist Phy Creative Agency với 02 concept chính',
        '02 ảnh Meka khung nhập, file gốc + 50 file photoshop',
        'Video slide Hàn Quốc, 04 ảnh để bàn khung nhập',
        'Album 25x35 bìa tạp giấy Silk 36 trang + hộp thiết kế',
        'Thiệp điện tử 2.000.000đ, 02 clip TikTok'
      ]},
      { name: 'Luxury 1', price: '38.000.000đ', note: 'Founder Mr.Thắng trực tiếp chụp và tư vấn', highlight: false, items: [
        '02 váy chụp VIP + 01 set, 02 vest cao cấp',
        'Mr.Thắng chụp và hậu kỳ 50 file photoshop',
        '02 ảnh Meka khung nhập, video slide Hàn Quốc',
        '06 ảnh để bàn khung nhập khẩu',
        'Album 25x35 bìa da nổi 40 trang giấy Silk + hộp',
        '03 địa điểm · 10 giờ · 02 clip TikTok'
      ]},
      { name: 'Luxury 2', price: '60.000.000đ', note: 'Founder + Ximona Makeup + stylist Phy', highlight: false, items: [
        '02 váy VIP + 01 váy Luxury thiết kế riêng',
        'Founder Mr.Thắng chụp, Ximona Makeup & Academy',
        'Team stylist Phy Creative Agency với 03 concept',
        'File gốc + 60 file photoshop Mr.Thắng hậu kỳ',
        'Album 25x35 bìa da nổi 50 trang + hộp thiết kế',
        '03 địa điểm · 10 giờ · 02 clip TikTok'
      ]},
      { name: 'Ngoại Thành', price: '18.800.000đ', note: 'Chụp 1 ngày ngoại thành (thêm ngày +4.000.000đ)', highlight: false, items: [
        '02 váy + 01 set tự chuẩn bị, 02 vest + 01 set',
        '02 ảnh 60x90 Laminate, file gốc + 40 file photoshop',
        'Album 25x35 giấy Silk 30 trang, 04 ảnh để bàn',
        'Thiệp điện tử 2.000.000đ, 02 clip TikTok'
      ]},
      { name: 'Ngoại Thành VIP', price: '25.800.000đ', note: 'Chụp 1 ngày ngoại thành, sản phẩm chuẩn VIP', highlight: false, items: [
        '01 váy cao cấp + 01 váy VIP + 01 set, 02 vest',
        '02 ảnh Meka khung nhập, file gốc + 45 file photoshop',
        'Video slide Hàn Quốc, 04 ảnh để bàn khung nhập',
        'Album 25x35 bìa tạp giấy Silk 30 trang + hộp',
        'Thiệp điện tử 2.000.000đ, 02 clip TikTok'
      ]}
    ]
  },
  'phong-su': {
    intro: 'Phóng sự cưới bởi JA Studio, thương hiệu phóng sự của Rosé. Trả toàn bộ ảnh gốc sau thanh toán. Thêm giờ 600.000đ/giờ/nhân sự, thêm flycam 5.000.000đ, công tác phí ngoại thành 500-800k/nhân sự.',
    tiers: [
      { name: 'Photo · Ăn Hỏi', price: '6.800.000đ', note: 'Tối đa 4 giờ làm việc', highlight: false, items: [
        '02 máy chụp',
        'Trả toàn bộ file gốc và blend màu kỹ lưỡng 150 file'
      ]},
      { name: 'Photo · Lễ Cưới', price: '8.000.000đ', note: 'Tối đa 6 giờ làm việc', highlight: false, items: [
        '02 máy chụp',
        'Trả toàn bộ file gốc và blend màu kỹ lưỡng 250 file'
      ]},
      { name: 'Video · Ăn Hỏi', price: '10.000.000đ', note: 'Tối đa 4 giờ làm việc', highlight: false, items: [
        '02 máy quay',
        '01 video highlight 3-5 phút'
      ]},
      { name: 'Video · Lễ Cưới', price: '12.000.000đ', note: 'Tối đa 6 giờ làm việc', highlight: false, items: [
        '02 máy quay',
        '01 video highlight 4-6 phút'
      ]},
      { name: 'VIP 1', price: '14.500.000đ', note: 'Lễ cưới, Ceremony · tối đa 6 giờ', highlight: false, items: [
        '02 máy chụp + 01 máy quay',
        'Toàn bộ ảnh gốc và blend kỹ lưỡng 250 file',
        '01 video highlight 4-6 phút'
      ]},
      { name: 'VIP 2', price: '24.500.000đ', note: 'Được chọn nhiều nhất', highlight: true, items: [
        'Trọn 2 buổi: ăn hỏi (4 giờ) + ngày cưới (6 giờ)',
        'Mỗi buổi 02 máy chụp + 01 máy quay',
        'Toàn bộ ảnh gốc và blend màu 400 file',
        '01 video highlight 6-8 phút'
      ]},
      { name: 'VIP 3', price: '30.800.000đ', note: 'Trọn ăn hỏi + ngày cưới, đủ 4 máy', highlight: false, items: [
        'Ăn hỏi: 02 máy chụp + 02 máy quay (4 giờ)',
        'Ngày cưới: 02 máy chụp + 02 máy quay (6 giờ)',
        'Toàn bộ ảnh gốc và blend màu 400 file',
        '01 video highlight 6-8 phút'
      ]},
      { name: 'Luxury', price: '55.000.000đ', note: 'Founder JA Studio trực tiếp làm việc', highlight: false, items: [
        'Ăn hỏi: 02 máy chụp + 02 máy quay (4 giờ)',
        'Ngày cưới: 03 máy chụp + 03 máy quay (6 giờ)',
        '60 ảnh photoshop kỹ lưỡng do Founder edit',
        'Toàn bộ ảnh gốc và blend màu 600-800 ảnh',
        'Mỗi buổi 01 video highlight 3-6 phút'
      ]},
      { name: 'Destination Wedding', price: '24.000.000đ', note: 'Tiệc Intimate ngoài trời · tối đa 8 giờ', highlight: false, items: [
        '02 máy chụp + 02 máy quay',
        'Toàn bộ ảnh gốc và blend màu 200-300 file',
        '01 video highlight 4-6 phút'
      ]},
      { name: 'Destination Wedding II', price: '48.000.000đ', note: 'Founder JA trực tiếp · tối đa 8 giờ', highlight: false, items: [
        '03 máy chụp (Founder JA trực tiếp làm việc) + 03 máy quay',
        'Toàn bộ ảnh gốc và blend màu 300-500 file',
        '01 video highlight 4-6 phút'
      ]}
    ]
  },
  'combo': {
    intro: 'Ghép gói chụp, phóng sự JA Studio, váy áo ngày cưới và trang điểm trong một combo, tiết kiệm hơn hẳn đặt lẻ từng hạng mục. Giá niêm yết ghi kèm từng gói.',
    tiers: [
      { name: 'Combo 1', price: '16.500.000đ', note: 'Được chọn nhiều nhất', highlight: true, items: [
        'Niêm yết 23.800.000đ: gói chụp + váy áo ngày cưới',
        'Gói chụp 9.800.000đ (02 váy, 01 vest)',
        'Mượn 01 váy ngày cưới 8-10 triệu',
        'Mượn 01 áo dài ăn hỏi hoặc 01 vest tối đa 4 triệu',
        '02 ảnh 60x90, 30 file photoshop, album 20x30 Ultra HD 20 trang'
      ]},
      { name: 'Combo 2', price: '19.500.000đ', note: 'Được chọn nhiều nhất', highlight: true, items: [
        'Niêm yết 26.800.000đ: gói chụp + váy áo ngày cưới',
        'Gói chụp 12.800.000đ',
        'Mượn 01 váy ngày cưới 8-10 triệu + áo dài hoặc vest tối đa 4 triệu',
        'Album 20x30 Silk 30 trang, 40 file photoshop',
        'Tặng thiệp cưới điện tử 2.000.000đ'
      ]},
      { name: 'Combo 3', price: '24.800.000đ', note: 'Niêm yết 27.600.000đ · chụp + phóng sự cưới', highlight: false, items: [
        'Gói chụp 12.800.000đ (02 váy + 02 vest)',
        'Phóng sự JA Studio 14.800.000đ: 02 máy ngày cưới + 02 máy ăn hỏi',
        'Album 20x30 Silk 30 trang, 40 file photoshop, thiệp điện tử'
      ]},
      { name: 'Combo 4', price: '28.800.000đ', note: 'Niêm yết 38.800.000đ · chụp + váy áo cao cấp', highlight: false, items: [
        'Gói chụp 14.800.000đ',
        'Mượn 01 váy ngày cưới 15-20 triệu',
        'Mượn 01 áo dài ăn hỏi hoặc vest tối đa 4 triệu',
        'Album 25x35 Silk 30 trang, 04 ảnh để bàn'
      ]},
      { name: 'Combo 5', price: '35.000.000đ', note: 'Niêm yết 43.600.000đ · chụp + phóng sự + váy áo', highlight: false, items: [
        'Gói chụp 14.800.000đ',
        'Phóng sự JA Studio 14.800.000đ (02 máy cưới + 02 máy hỏi)',
        'Mượn váy ngày cưới 8-10 triệu + áo dài hoặc vest tối đa 4 triệu',
        'Album 25x35 Silk 30 trang'
      ]},
      { name: 'Combo VIP 1', price: '40.800.000đ', note: 'Niêm yết 45.600.000đ · chụp + phóng sự 4 máy', highlight: false, items: [
        'Gói chụp 14.800.000đ',
        'Phóng sự JA 30.800.000đ: 02 chụp + 02 quay cả ngày cưới lẫn ăn hỏi',
        'Album 25x35 Silk 30 trang, 04 ảnh để bàn'
      ]},
      { name: 'Combo VIP 2', price: '48.600.000đ', note: 'Niêm yết 61.600.000đ · thêm váy áo + makeup', highlight: false, items: [
        'Gói chụp 14.800.000đ + phóng sự JA 14.800.000đ',
        'Mượn váy ngày cưới 15-20 triệu + áo dài hoặc vest tối đa 4 triệu',
        'Trang điểm ăn hỏi + ngày cưới 8.000.000đ'
      ]},
      { name: 'Combo VIP 3', price: '60.800.000đ', note: 'Niêm yết 68.800.000đ · Founder chụp + PSC 4 máy', highlight: false, items: [
        'Gói chụp VIP 38.000.000đ: Mr.Thắng trực tiếp chụp và hậu kỳ',
        'Phóng sự JA 30.800.000đ: 02 chụp + 02 quay cả hai buổi',
        'Album 25x35 bìa da nổi 40 trang + hộp thiết kế'
      ]},
      { name: 'Combo VIP 4', price: '62.800.000đ', note: 'Niêm yết 75.600.000đ · chụp VIP + PSC + váy áo', highlight: false, items: [
        'Gói chụp 20.800.000đ (váy VIP, ảnh Meka khung nhập)',
        'Phóng sự JA 30.800.000đ (4 máy cả hai buổi)',
        'Mượn váy ngày cưới 15-20 triệu + áo dài hoặc vest tối đa 4 triệu',
        'Album 25x35 bìa tạp giấy Silk 30 trang + hộp'
      ]},
      { name: 'Combo VIP 5', price: '68.600.000đ', note: 'Niêm yết 83.600.000đ · VIP 4 + trang điểm 2 buổi', highlight: false, items: [
        'Gói chụp 20.800.000đ + phóng sự JA 30.800.000đ',
        'Mượn váy ngày cưới 15-20 triệu + áo dài hoặc vest tối đa 4 triệu',
        'Trang điểm ăn hỏi + ngày cưới 8.000.000đ'
      ]},
      { name: 'Combo Luxury 1', price: '82.800.000đ', note: 'Niêm yết 100.800.000đ · Founder toàn trình', highlight: false, items: [
        'Gói chụp 38.000.000đ: Mr.Thắng trực tiếp chụp, hậu kỳ 50 file',
        'Phóng sự JA 30.800.000đ (4 máy cả hai buổi)',
        'Mượn váy 15-20 triệu + áo dài hoặc vest, makeup 2 buổi 8.000.000đ',
        'Album 25x35 bìa da nổi 40 trang giấy Silk'
      ]},
      { name: 'Combo Luxury 2', price: '186.800.000đ', note: 'Niêm yết 206.000.000đ · mọi hạng mục thiết kế riêng', highlight: false, items: [
        'Gói chụp 60.000.000đ: Founder + Ximona Makeup + stylist Phy 03 concept',
        'Váy cưới thiết kế 50 triệu, cặp áo dài đôi 20 triệu, vest thiết kế 5 triệu theo số đo',
        'Phóng sự JA Luxury 55.000.000đ: ngày cưới 03 chụp + 03 quay (Mr.Thắng), ăn hỏi 02 + 02',
        'Trang điểm Leader Team 2 buổi 16.000.000đ',
        'Album 25x35 bìa da nổi 50 trang + hộp thiết kế'
      ]}
    ]
  },
  'gia-dinh': {
    intro: 'Lưu giữ khoảnh khắc sum vầy của gia đình với ekip riêng và trang điểm chuyên nghiệp. Áp dụng cho gia đình 3-4 người; thêm người chụp +500.000đ, thêm người trang điểm +1.000.000đ.',
    tiers: [
      { name: 'Family 1', price: '5.900.000đ', note: 'Studio · 4 giờ · gia đình 3-4 người', highlight: false, items: [
        'Ekip riêng, trang điểm và làm tóc cho mẹ',
        'Gia đình tự chuẩn bị trang phục (tối đa 2 set)',
        '01 ảnh phóng 40x60, 02 ảnh để bàn gương 15x21',
        'Toàn bộ file gốc và 15 file photoshop hoàn thiện',
        'In thêm album 20x30 20 trang +2.500.000đ (tặng 10 ảnh chỉnh sửa)'
      ]},
      { name: 'Family 2', price: '8.000.000đ', note: 'Được chọn nhiều nhất', highlight: true, items: [
        'Tặng 1 set váy cưới + vest cho bố mẹ trong buổi chụp',
        'Trang điểm và làm tóc cho mẹ · 5 giờ làm việc',
        '01 ảnh phóng 60x90, 02 ảnh để bàn gương 15x21',
        'Toàn bộ file gốc và 30 file photoshop hoàn thiện',
        'Gia đình tự chuẩn bị thêm trang phục (tối đa 2 set)',
        'Book thêm stylist +8.000.000đ'
      ]}
    ]
  }
};

/* GÓI VỚT KHÁCH — KHÔNG HIỂN THỊ TRÊN WEB (theo chốt của anh Thắng 2026-07-10).
   Chỉ dùng khi tư vấn riêng cho khách không đủ ngân sách:
   - Đồng Hành 1: 10.500.000đ (niêm yết 18.800.000đ) · chụp thứ 3-5 · 4 giờ
     01 váy + 01 vest, 02 ảnh 50x75, 15 file PTS, video Basic.
     Chọn 2/5 ưu đãi: mượn váy cưới 5-10tr, mượn vest, nâng ảnh 60x90,
     +5 ảnh để bàn, +15 file sửa chi tiết.
   - Đồng Hành 2: 13.800.000đ (niêm yết 22.800.000đ) · chụp thứ 2-4-6 · 5 giờ
     02 váy + 01 vest, 02 ảnh 60x90, 30 file PTS, album 20x30 Ultra HD 20 trang.
     Mượn 01 váy ngày cưới 5-10tr + 01 vest cưới. */

for (const [slug, d] of Object.entries(data)) {
  const row = get('SELECT id FROM pricing WHERE slug = ?', slug);
  if (!row) { console.log('KHÔNG THẤY nhóm:', slug); continue; }
  run('UPDATE pricing SET intro = ?, tiers_json = ? WHERE slug = ?', d.intro, JSON.stringify(d.tiers), slug);
  console.log('Đã cập nhật', slug + ':', d.tiers.length, 'gói');
}
console.log('Xong. Nhóm váy cưới giữ nguyên.');
