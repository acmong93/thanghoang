/**
 * Seed dữ liệu ban đầu từ nội dung web cũ (data.js) vào SQLite.
 * Chạy lại an toàn: chỉ seed khi bảng còn trống.
 *
 * Đường dẫn ảnh trỏ tới bản WebP đã tối ưu trong public/img
 * (tạo bởi scripts/optimize-images.js — cùng quy tắc đổi tên).
 */
require('dotenv').config();
const { db, get, run, setSetting, ensureAdmin } = require('../src/db');

// Cùng quy tắc slug với optimize-images.js
function slugName(file) {
  return file.replace(/\.(jpe?g|png)$/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'anh';
}
// 'sac-rose' + '_TH_0084.jpg' -> '/img/sac-rose/th-0084.webp'
const img = (folder, file) => `/img/${folder}/${slugName(file)}.webp`;
const thumb = (folder, file) => `/img/${folder}/${slugName(file)}-thumb.webp`;

const already = get('SELECT COUNT(*) AS n FROM albums').n > 0;
if (already) {
  console.log('[seed] Database đã có dữ liệu — bỏ qua seed.');
  ensureAdmin();
  process.exit(0);
}

console.log('[seed] Bắt đầu seed dữ liệu...');

/* ============ CÀI ĐẶT CHUNG ============ */
const settings = {
  site_name: 'Rosé Wedding',
  tagline: 'Timeless Moments',
  slogan: 'Chỉn chu, sáng tạo và màu sắc khác biệt',
  moment_img: img('lam-diep', '_TH_9723.jpg'),
  moment_line: 'Chỉn chu, sáng tạo và màu sắc khác biệt',
  about_stats: '',
  hotline: '0966 669 935',
  hotline_tel: '0966669935',
  cskh: '0865 428 824',
  cskh_tel: '0865428824',
  email: 'rosewedding.ceo@gmail.com',
  address: 'Số 102-104 An Trạch, Ô Chợ Dừa, Hà Nội',
  hours: '9:00 tới 21:00, cả tuần',
  instagram: 'https://www.instagram.com/rosewedding_vn/',
  facebook: 'https://www.facebook.com/RoseWeddingHanoi',
  zalo: '0966669935',
  messenger: 'https://m.me/RoseWeddingHanoi',
  tiktok: 'https://www.tiktok.com/@anhcuoi_rosewedding',
  map_embed: 'https://maps.google.com/maps?q=21.0272874,105.828378&z=16&hl=vi&output=embed',
  hero_images: JSON.stringify([
    img('editorial', '9.jpg'),
    img('sac-rose', '_TH_0120.jpg'),
    img('fine-art', '5.jpg'),
    img('phim-truong', '_TH_9690.jpg')
  ]),
  about_img_1: img('sac-rose', '_TH_0084.jpg'),
  about_img_2: img('han-quoc', '7.jpg'),
  about_img_3: img('editorial', '9.jpg'),
  feature_vay_img: img('sac-rose', '_TH_0223.jpg'),
  feature_phongsu_img: img('phong-su', '1.jpg'),
  pricing_note: 'Số liệu hiển thị là mức tham khảo. Vui lòng liên hệ để nhận báo giá chi tiết và ưu đãi mới nhất.'
};
for (const [k, v] of Object.entries(settings)) setSetting(k, v);

/* ============ ALBUMS ============ */
// desc đã được trau chuốt lại câu chữ so với bản cũ
const albums = [
  {
    slug: 'huong-lien', category: 'wedding', folder: 'huong-lien',
    name: 'Chuyện của Hương - Liên', tag: 'Real Wedding · Khách hàng Rosé',
    desc: 'Một câu chuyện thật của khách hàng Rosé. Nhẹ nhàng, đời thường và đầy yêu thương, đúng tinh thần tối giản mà sâu lắng của chúng tôi.',
    imgs: ['1.jpg','2.JPG','7.JPG','8.jpg','9.jpg','14.JPG','15.jpg','16.jpg','_TH_3434 (2).jpg','_TH_3443 (2).jpg','_TH_3459..jpg']
  },
  {
    slug: 'han-quoc', category: 'wedding', folder: 'han-quoc',
    name: 'Hàn Quốc Trong Trẻo', tag: 'Pre-Wedding · Studio',
    desc: 'Trong trẻo, tinh khôi, tập trung vào cảm xúc tự nhiên của hai người. Tông màu nhẹ nhàng tối giản, để nét bình yên của tình yêu tự cất lời.',
    imgs: Array.from({length: 21}, (_, i) => `${i + 1}.jpg`)
  },
  {
    slug: 'editorial', category: 'wedding', folder: 'editorial',
    name: 'Tạp Chí Editorial', tag: 'Pre-Wedding · Studio',
    desc: 'Sang trọng và thời thượng như một trang bìa tạp chí thời trang. Bố cục mạnh, màu sắc khác biệt, tôn vẻ đẹp kiêu sa của cô dâu chú rể.',
    imgs: ['1.jpg','2.jpg','3.jpg','4.jpg','6.jpg','7.jpg','9.jpg','10.jpg','18.jpg','20.jpg','23.jpg','31.jpg','32.jpg','35.jpg','36.jpg','37.jpg','39.jpg','_TH_8723-1.jpg']
  },
  {
    slug: 'fine-art', category: 'wedding', folder: 'fine-art',
    name: 'Fine Art Điện Ảnh', tag: 'Pre-Wedding · Nghệ thuật',
    desc: 'Nhẹ nhàng, sâu lắng, màu sắc mang hơi hướng điện ảnh. Mỗi khung hình là một tác phẩm có chiều sâu cảm xúc và tinh thần quiet luxury.',
    imgs: Array.from({length: 18}, (_, i) => `${i + 1}.jpg`)
  },
  {
    slug: 'vuon-yeu', category: 'wedding', folder: 'vuon-yeu',
    name: 'Vườn Yêu Ngoại Cảnh', tag: 'Pre-Wedding · Ngoại cảnh',
    desc: 'Thiên nhiên trong trẻo làm nền cho câu chuyện tình. Ánh sáng tự nhiên, sắc xanh dịu mắt, không gian rộng mở cho những khoảnh khắc thật và đời thường nhất.',
    imgs: Array.from({length: 15}, (_, i) => `${i + 1}.jpg`)
  },
  {
    slug: 'phim-truong', category: 'wedding', folder: 'phim-truong',
    name: 'Phim Trường Cổ Điển', tag: 'Pre-Wedding · Concept',
    desc: 'Sang trọng nhưng không kém phần lãng mạn. Bối cảnh phim trường được dàn dựng tỉ mỉ, đưa hai bạn vào một thước phim tình yêu của riêng mình.',
    imgs: ['1.jpg','2.jpg','3.jpg','4.jpg','5.jpg','6.jpg','7.jpg','9.jpg','10.jpg','11.jpg','12.jpg','13.jpg','14.jpg','15.jpg','_TH_9650.jpg','_TH_9667.jpg','_TH_9690.jpg','_TH_9739.jpg']
  },
  {
    slug: 'sac-rose', category: 'wedding', folder: 'sac-rose',
    name: 'Sắc Rosé', tag: 'Bridal · Editorial',
    desc: 'Bộ sưu tập tôn vinh vẻ đẹp cô dâu trong sắc hồng phấn đặc trưng của Rosé. Tinh tế, nữ tính, hiện đại và có gu.',
    imgs: ['_TH_0013.jpg','_TH_0044.jpg','_TH_0076.jpg','_TH_0079.jpg','_TH_0084.jpg','_TH_0120.jpg','_TH_0128.jpg','_TH_0169.jpg','_TH_0180.jpg','_TH_0192.jpg','_TH_0194.jpg','_TH_0209.jpg','_TH_0215.jpg','_TH_0223.jpg','_TH_0227.jpg','_TH_0237.jpg','_TH_0247.jpg','_TH_0254.jpg']
  },
  {
    slug: 'phong-su', category: 'phong-su', folder: 'phong-su',
    name: 'Phóng Sự Cưới', tag: 'Wedding Day · Phóng sự',
    desc: 'Ghi lại trọn vẹn cảm xúc chân thật của ngày trọng đại, từ khoảnh khắc chuẩn bị đến giây phút trao nhau lời hẹn ước. Tự nhiên, đời thường và đầy nước mắt hạnh phúc.',
    imgs: ['0.jpg','1.jpg','2.jpg','3.JPG','7.jpg','_BTQ6789.JPG']
  },
  {
    slug: 'lam-diep', category: 'signature', folder: 'lam-diep',
    name: 'Lam Điệp', tag: 'Concept Độc Bản · The 2026 Editorial Collection',
    desc: 'Khi thị trường vẫn loay hoay Việt hoá những concept của nước ngoài, Rosé chọn một con đường khác, sáng tạo hoàn toàn từ gốc rễ Việt Nam. Lam Điệp bắt đầu từ sắc xanh men lam, màu của di sản và sự tĩnh tại đầy khí chất. Linh hồn của câu chuyện là cánh bướm Lam Điệp, lời hẹn ước được tái sinh trên một tuyệt tác thủ công, che chở cho một tình yêu lãng mạn và bất tử. Từng chi tiết nhỏ, từ chiếc trâm cài tóc đến hoạ tiết trên áo chú rể, đều là một mảnh ghép của câu chuyện lớn ấy.',
    imgs: ['1.jpg','2.jpg','3.jpg','4.jpg','5.jpg','6.jpg','7.jpg','8.jpg','9.jpg','10.jpg','11.jpg','12.jpg','13.jpg','14.jpg','_TH_9685.jpg','_TH_9702.jpg','_TH_9709_1.jpg','_TH_9723.jpg','_TH_9724.jpg','_TH_9731.jpg','P__07600.jpg','P__07610.jpg','P__07613.jpg','P__07638.jpg']
  },
  {
    slug: 'sac-sen', category: 'signature', folder: 'sac-sen',
    name: 'Sắc Sen', tag: 'Concept Độc Bản · Tinh thần Việt',
    desc: 'Một concept độc bản lấy cảm hứng từ quốc hoa của người Việt. Sen gợi sự thuần khiết, thanh cao và bình yên, được kể lại bằng ngôn ngữ thời trang cưới hiện đại. Sắc Sen tôn vẻ đẹp dịu dàng mà sâu sắc của cô dâu, nơi truyền thống và tinh thần tối giản gặp nhau trong từng khung hình.',
    imgs: ['a1.jpg','a2.JPG','a3.jpg','a4.jpg','a5.jpg','a6.JPG','a7.jpg','a8.jpg','a9.jpg','a10.jpg','a11.jpg','a12.jpg','a13.jpg','a14.jpg','a15.jpg','a16.jpg','a17.jpg','a18.jpg','a21.jpg','a24.jpg','a26.jpg','a28.jpg']
  }
];

const insAlbum = db.prepare('INSERT INTO albums(slug,name,tag,desc,category,sort_order) VALUES(?,?,?,?,?,?)');
const insImage = db.prepare('INSERT INTO images(album_id,file,thumb,alt,sort_order,is_cover) VALUES(?,?,?,?,?,?)');
albums.forEach((a, ai) => {
  const { lastInsertRowid: albumId } = insAlbum.run(a.slug, a.name, a.tag, a.desc, a.category, ai);
  a.imgs.forEach((f, i) => {
    insImage.run(albumId, img(a.folder, f), thumb(a.folder, f), `${a.name} · Rosé Wedding`, i, i === 0 ? 1 : 0);
  });
});
console.log(`[seed] ${albums.length} album, ${albums.reduce((s, a) => s + a.imgs.length, 0)} ảnh.`);

/* ============ VIDEOS ============ */
const videos = [
  ['CkkOOj2ka_w', 'Bên nhau mãi mãi'],
  ['EOcZk4Xa8hw', 'Mình cứ đi cùng nhau · Đà Lạt'],
  ['DDC5jch0qbM', 'Khi hai ta về chung một nhà']
];
videos.forEach(([id, title], i) => run('INSERT INTO videos(youtube_id,title,sort_order) VALUES(?,?,?)', id, title, i));

/* ============ BẢNG GIÁ ============ */
const pricing = [
  {
    slug: 'anh-cuoi', name: 'Báo Giá Ảnh Cưới', tag: 'Pre-Wedding',
    intro: 'Chụp ảnh cưới tại studio độc quyền và ngoại cảnh, makeup và thử váy miễn phí, album thiết kế riêng cho mỗi cặp đôi.',
    hero: img('sac-rose', '_TH_0084.jpg'),
    tiers: [
      { name: 'Nội Thành', price: '8.900.000đ', note: 'Dành cho cặp đôi yêu sự tối giản', items: ['1 buổi chụp trong ngày tại Hà Nội','Studio độc quyền và 1 ngoại cảnh nội thành','Makeup cô dâu và làm tóc','Thử và chọn váy tại studio','40 ảnh chỉnh sửa kỹ, album để bàn'] },
      { name: 'Ngoại Cảnh', price: '15.900.000đ', highlight: true, note: 'Được chọn nhiều nhất', items: ['1 ngày chụp, nhiều bối cảnh','Ekip di chuyển ngoại tỉnh','Nhiều concept, nhiều bộ váy','Makeup và stylist theo sát','60 ảnh chỉnh sửa, album cao cấp','Ảnh phóng treo phòng cưới'] },
      { name: 'Cao Cấp', price: '22.900.000đ', note: 'Trải nghiệm editorial trọn vẹn', items: ['Concept editorial cá nhân hoá','Direction ánh sáng và tạo dáng riêng','Toàn bộ file gốc tuyển chọn','Album fine art khổ lớn','Ưu tiên lịch và ekip cứng'] }
    ]
  },
  {
    slug: 'phong-su', name: 'Báo Giá Phóng Sự Cưới', tag: 'Wedding Day',
    intro: 'Ghi lại trọn vẹn cảm xúc ngày cưới một cách chân thật, không dàn dựng. Ekip linh hoạt bắt trọn từng chi tiết nhỏ.',
    hero: img('concept-6', '_TH_0406.jpg'),
    tiers: [
      { name: 'Nửa Ngày', price: '6.900.000đ', note: 'Lễ thành hôn hoặc tiệc', items: ['1 photographer phóng sự','Khoảng 5 giờ tác nghiệp','Toàn bộ ảnh chỉnh sửa cơ bản','Giao ảnh online trong 7 ngày'] },
      { name: 'Trọn Ngày', price: '12.900.000đ', highlight: true, note: 'Phổ biến nhất', items: ['2 photographer','Theo suốt từ chuẩn bị tới hết tiệc','Ảnh chỉnh sửa kỹ tuyển chọn','Album phóng sự thiết kế'] },
      { name: 'Phóng Sự và Video', price: '19.900.000đ', note: 'Ảnh và phim cùng lúc', items: ['Ekip ảnh và quay phim','Phim highlight cảm xúc','Ảnh chỉnh sửa đầy đủ','Hậu kỳ phim chuẩn điện ảnh'] }
    ]
  },
  {
    slug: 'combo', name: 'Báo Giá Combo Trọn Gói', tag: 'Trọn gói tiết kiệm',
    intro: 'Trọn gói ảnh cưới, váy và phóng sự trong một combo, đồng hành từ pre-wedding tới ngày cưới, tối ưu chi phí.',
    hero: img('editorial', '9.jpg'),
    tiers: [
      { name: 'Combo Bạc', price: '25.000.000đ', note: 'Khởi đầu trọn vẹn', items: ['Pre-wedding nội thành','Váy cô dâu và vest chú rể','Phóng sự nửa ngày cưới','Makeup ngày chụp','Album và ảnh phóng'] },
      { name: 'Combo Vàng', price: '35.000.000đ', highlight: true, note: 'Cân bằng nhất', items: ['Pre-wedding ngoại cảnh nhiều concept','Nhiều bộ váy và vest','Phóng sự trọn ngày cưới','Makeup pre-wedding và ngày cưới','Album cao cấp, voucher đối tác'] },
      { name: 'Combo Kim Cương', price: '49.000.000đ', note: 'Đẳng cấp trọn vẹn', items: ['Pre-wedding ngoại tỉnh cao cấp','Váy thiết kế riêng theo dáng','Phóng sự và video ngày cưới','Đồng hành makeup toàn bộ','Album fine art, ảnh treo khổ lớn'] }
    ]
  },
  {
    slug: 'vay-cuoi', name: 'Báo Giá Váy Cưới', tag: 'Bridal',
    intro: 'Kho váy đa dạng, cập nhật liên tục theo xu hướng. Tư vấn 1-1 cùng stylist, thử váy thực tế tại studio.',
    hero: img('sac-rose', '_TH_0120.jpg'),
    tiers: [
      { name: 'Thuê Lẻ', price: 'Từ 2.000.000đ', note: 'Theo từng bộ', items: ['Thuê 1 bộ váy cho buổi chụp','Tư vấn chọn dáng theo vóc dáng','Đặt giữ váy theo lịch'] },
      { name: 'Váy Ngày Cưới', price: 'Từ 5.000.000đ', highlight: true, note: 'Trọn ngày trọng đại', items: ['Váy mặc trong lễ cưới','Nhiều lựa chọn theo nghi thức','Chỉnh sửa vừa vặn cho cô dâu','Phụ kiện đi kèm'] },
      { name: 'Gói Váy Cao Cấp', price: 'Liên hệ', note: 'Thiết kế riêng', items: ['Váy thiết kế theo dáng cô dâu','Chất liệu cao cấp','Nhiều buổi thử và chỉnh'] }
    ]
  },
  {
    slug: 'gia-dinh', name: 'Báo Giá Chụp Gia Đình', tag: 'Family',
    intro: 'Lưu giữ những khoảnh khắc sum vầy của gia đình, kỷ niệm ngày cưới hay album cho bé, với cùng chất lượng và sự tử tế của Rosé.',
    hero: img('vuon-yeu', '6.jpg'),
    tiers: [
      { name: 'Cơ Bản', price: '3.900.000đ', note: 'Buổi chụp ấm cúng', items: ['1 buổi chụp tại studio','Makeup nhẹ cho mẹ','25 ảnh chỉnh sửa','Album để bàn'] },
      { name: 'Tiêu Chuẩn', price: '6.900.000đ', highlight: true, note: 'Đầy đủ kỷ niệm', items: ['Studio và ngoại cảnh','Trang phục đồng bộ gia đình','40 ảnh chỉnh sửa','Album và ảnh phóng'] },
      { name: 'Kỷ Niệm Ngày Cưới', price: 'Liên hệ', note: 'Dành cho khách thân thiết', items: ['Concept theo yêu cầu','Ưu tiên giá khách cũ','Album thiết kế riêng'] }
    ]
  }
];
pricing.forEach((p, i) =>
  run('INSERT INTO pricing(slug,name,tag,intro,hero,tiers_json,sort_order) VALUES(?,?,?,?,?,?,?)',
    p.slug, p.name, p.tag, p.intro, p.hero, JSON.stringify(p.tiers), i));
console.log(`[seed] ${pricing.length} nhóm bảng giá.`);

/* ============ BÀI VIẾT ============ */
const posts = [
  {
    slug: 'lam-diep-2026', title: 'Lam Điệp, khi di sản Việt bước vào ảnh cưới',
    cat: 'Hậu trường', date: '20.08.2025', cover: img('lam-diep', '2.jpg'),
    excerpt: 'Câu chuyện đằng sau bộ sưu tập độc bản lấy cảm hứng từ gốm men lam và cánh bướm Lam Điệp.',
    body: [
      'Khi thị trường vẫn loay hoay Việt hoá những concept của nước ngoài, Rosé chọn một con đường khác, đó là sáng tạo hoàn toàn từ gốc rễ Việt Nam.',
      'Mọi thứ bắt đầu từ sắc xanh men lam, màu của di sản và sự tĩnh tại đầy khí chất. Rồi linh hồn của câu chuyện xuất hiện, cánh bướm Lam Điệp, lời hẹn ước được tái sinh trên một tuyệt tác thủ công.',
      'Từng chi tiết nhỏ, từ chiếc trâm cài tóc đến hoạ tiết trên áo chú rể, đều là một mảnh ghép của câu chuyện lớn. Sự khác biệt không đến từ việc sao chép giỏi thế nào, mà từ việc giải mã và kể lại văn hoá của mình sâu sắc ra sao.'
    ].join('\n\n')
  },
  {
    slug: 'chuan-bi-chup-cuoi', title: 'Bí quyết chuẩn bị cho buổi chụp ảnh cưới trọn vẹn',
    cat: 'Kinh nghiệm', date: '12.07.2025', cover: img('han-quoc', '3.jpg'),
    excerpt: 'Vài lưu ý nhỏ về da, tóc, trang phục và tinh thần để buổi chụp của hai bạn thật thoải mái và tự tin.',
    body: [
      'Một buổi chụp đẹp bắt đầu từ sự chuẩn bị kỹ. Hãy đắp mặt nạ trước hai tới ba ngày, gội đầu vào tối hôm trước và ngủ đủ giấc để có thần thái tươi tắn nhất.',
      'Chuẩn bị đủ phụ kiện đi kèm như giày, túi và trang sức. Mang theo đồ lót phù hợp với từng bộ váy và một chút snack nhẹ nếu lịch chụp kéo dài.',
      'Quan trọng nhất, hãy thả lỏng và tin tưởng ekip. Chúng tôi sẽ luôn gợi ý dáng và đồng hành để hai bạn được là chính mình trước ống kính.'
    ].join('\n\n')
  },
  {
    slug: 'xu-huong-toi-gian', title: 'Vì sao ảnh cưới tối giản không bao giờ lỗi mốt',
    cat: 'Phong cách', date: '28.05.2025', cover: img('sac-rose', '_TH_0084.jpg'),
    excerpt: 'Phong cách tối giản và quiet luxury giúp bộ ảnh của bạn đẹp bền bỉ theo thời gian.',
    body: [
      'Xu hướng thay đổi mỗi năm, nhưng sự tối giản thì luôn ở lại. Ít chi tiết thừa nghĩa là ít thứ khiến bộ ảnh trở nên cũ kỹ sau vài mùa.',
      'Tối giản không phải là đơn điệu. Đó là sự tiết chế có chủ đích, để ánh sáng, cảm xúc và câu chuyện của hai người được lên tiếng.',
      'Đây cũng là tinh thần quiet luxury mà Rosé theo đuổi, vẻ sang trọng không phô trương, đủ tinh tế để bạn còn rung động khi xem lại sau nhiều năm.'
    ].join('\n\n')
  }
];
posts.forEach(p => run('INSERT INTO posts(slug,title,cat,date,cover,excerpt,body) VALUES(?,?,?,?,?,?,?)',
  p.slug, p.title, p.cat, p.date, p.cover, p.excerpt, p.body));
console.log(`[seed] ${posts.length} bài viết.`);

ensureAdmin();
console.log('[seed] Hoàn tất.');
