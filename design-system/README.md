# Rosé Wedding · Design System v1.0

Bộ quy chuẩn thiết kế chưng cất từ website rosewedding.net, dùng để xây mọi website, landing page và app phần mềm mang thương hiệu Rosé (hoặc dự án mới muốn kế thừa ngôn ngữ này).

**Bộ này gồm 3 file:**
| File | Dùng cho |
|---|---|
| `README.md` | Người đọc: quy tắc, lý do, ví dụ đúng/sai |
| `tokens.css` | Website: nhúng biến CSS là dùng được ngay |
| `tokens.json` | App/phần mềm: dev đọc giá trị chuẩn (Flutter, React Native, WPF...) |

---

## 1. Triết lý: Quiet Luxury · Editorial · Tối giản

Mọi quyết định thiết kế trả lời một câu hỏi: **"Có tiết chế hơn được nữa không?"**

- **Ít chi tiết, nhiều khoảng thở.** Sang trọng đến từ không gian trống, không phải từ hoa văn.
- **Nội dung là nhân vật chính** (ảnh cưới, câu chuyện thật); giao diện là khung tranh im lặng.
- **Một màu nhấn duy nhất** (vàng đồng). Trang không bao giờ "nhiều màu".
- **Chuyển động chậm và mượt** như lật album; không hiệu ứng giật gân.
- **Cạnh sắc, không bo góc** trên sản phẩm hướng khách: gợi chất giấy ảnh, thiệp cưới ép kim.

## 2. Màu sắc

### Nền (từ sáng đến tối)
| Token | Hex | Vai trò |
|---|---|---|
| `cream` | `#FAF8F4` | Nền chính toàn trang, trắng kem ấm |
| `pearl` | `#FFFFFF` | Nền section xen kẽ, thẻ nội dung |
| `paper` | `#F3EFE8` | Placeholder ảnh, khối phụ |
| `blush` | `#EFE3DC` | Hồng phấn điểm xuyết (rất tiết chế) |
| `dark`  | `#000000` | Section tối tạo nhịp: concept độc bản, CTA |

**Nhịp trang chuẩn:** các section xen kẽ cream → pearl → dark → cream... để trang có "hơi thở", không dàn một màu từ đầu tới cuối.

### Chữ
| Token | Giá trị | Vai trò |
|---|---|---|
| `ink` | `#1E1C1A` | Chữ chính. **Không dùng đen tuyền #000 cho chữ** — nâu đen ấm mới đúng chất |
| `muted` | `#6F685F` | Chữ phụ, mô tả |
| `onDark` | `rgba(250,248,244,.78)` | Chữ thường trên nền tối |

### Nhấn — chỉ một họ: vàng đồng
| Token | Hex | Dùng khi |
|---|---|---|
| `gold` | `#C0A062` | Trên nền tối; hover; gạch chân active |
| `goldDeep` | `#A6884B` | Trên nền sáng (đậm hơn để đủ tương phản) |
| `line` | `rgba(192,160,98,.35)` | **Mọi đường kẻ/viền trong hệ** — không bao giờ dùng xám |

> ✅ Đúng: viền thẻ, ngăn cách cột, gạch dưới menu đều là vàng nhạt trong suốt
> ❌ Sai: thêm màu nhấn thứ hai (xanh, đỏ...); dùng `#ddd` cho border
> Ngoại lệ duy nhất: màu nhận diện nền tảng thứ ba trên nút liên hệ (Zalo xanh, Messenger gradient).

### Ngữ nghĩa
Lỗi `#A4392A` (đất nung trầm — không đỏ tươi), thành công `#4A7A4C`.

## 3. Chữ (Typography) — bộ ba vai

| Vai | Font | Weight | Dùng cho |
|---|---|---|---|
| **Display** | Playfair Display | 400/500/600 | Mọi tiêu đề. 500 là chuẩn |
| **Accent** | Cormorant Garamond *(luôn nghiêng)* | 400/500 | Chữ ký, trích dẫn, slogan, chữ số La Mã — "giọng cảm xúc" |
| **Body** | Montserrat | 300/400/500/600 | Thân bài (300), nhãn/nút (400-500) |

Google Fonts: `Playfair+Display:ital,wght@0,400;0,500;0,600;1,400;1,500` · `Cormorant+Garamond:ital,wght@1,400;1,500` · `Montserrat:wght@300;400;500;600`

### Thang cỡ chữ (fluid)
| Vai | Cỡ |
|---|---|
| Tiêu đề hero | `clamp(30px, 6.6vw, 80px)` |
| H2 section | `clamp(30px, 4.5vw, 50px)` |
| H3 thẻ | 21px |
| Trích dẫn (accent) | `clamp(19px, 2.3vw, 27px)` |
| Thân bài | 15.5px (bài đọc dài: 16.5px, line-height 1.85) |
| Eyebrow | 11px · HOA · giãn 0.42em |
| Nút | 12px · HOA · giãn 0.28em |
| Nhãn nhỏ | 10.5px · HOA · giãn 0.22em |

**Hai quy tắc vàng:**
1. Chữ hoa cỡ nhỏ **luôn** đi kèm giãn chữ rộng (≥0.16em). Chữ hoa không giãn = nghiệp dư.
2. Tiêu đề được phép chen đúng **một** từ nghiêng để tạo nhịp: *Bài viết* ***khác*** — không lạm dụng cả câu.

### Cấu trúc "cụm tiêu đề section" (dùng ở mọi section)
```
EYEBROW VÀNG GIÃN RỘNG        ← nhãn dẫn 2-5 từ
Tiêu đề lớn Playfair           ← có thể 1 từ nghiêng
Một đoạn dẫn màu muted, ngắn.  ← text-wrap: balance
```

## 4. Bố cục & khoảng cách

- Khung nội dung: **1240px** (chuẩn) · 1400px (lưới ảnh rộng) · **800px (trang đọc dài)** · đệm ngang 28px
- Đệm dọc section: **120px** desktop → **54px** mobile · section phụ 72px
- Khe lưới thẻ 22px · khe 2 cột chữ-ảnh 70px · cụm tiêu đề cách nội dung 64px
- Breakpoint: **980px** (tablet) và **680px** (mobile)
- Mobile: lưới thẻ về **2 cột** (không phải 1 cột dài lê thê), đệm dọc giảm ~55%

**Nguyên tắc:** thà rộng còn hơn chật. Nếu phân vân giữa 2 mức đệm, chọn mức lớn.

## 5. Thành phần (Components)

### Nút
- Viền 1px, **không nền, không bo góc**, chữ HOA 12px giãn 0.28em, đệm 16×34
- Hover: nền **trượt từ dưới lên** lấp đầy (không đổi màu tức thì) — 0.5s easing chữ ký
- 3 biến thể: `ink` (nền sáng) · `gold` (CTA chính) · `light` (trên ảnh/nền tối)

### Thẻ ảnh (album, concept, khách VIP)
- Ảnh phủ khung theo tỉ lệ cố định (album 3:4, concept 4:5, VIP 16:11)
- Gradient tối cố định phía chân: `linear-gradient(180deg, transparent 40%, rgba(20,18,16,.72) 100%)` — chữ trắng luôn đọc được
- Meta trong thẻ: nhãn hoa nhỏ vàng → tên Playfair trắng → hành động ẩn, hiện khi hover
- Hover: ảnh scale 1.05–1.08 trong **1.4s** (rất chậm), thẻ giá nổi lên translateY(-8px) + bóng

### Đường kẻ & ngăn cách
Mọi ngăn cách là **1px màu `line`** (vàng trong suốt): dưới header, giữa cột số liệu, viền thẻ giá, chân bảng.

### Trích dẫn
Viền trái 2px vàng, chữ Cormorant nghiêng 21px, không nền.

### Bóng đổ
**Một bóng duy nhất** trong hệ: `0 24px 60px -28px rgba(30,28,26,.45)` — chỉ xuất hiện khi thẻ nổi lên lúc hover. Trạng thái nghỉ không có bóng.

## 6. Chuyển động

| Chuyển động | Thông số |
|---|---|
| Easing chữ ký (mọi transition) | `cubic-bezier(.22, .61, .36, 1)` |
| Hiện khi cuộn (reveal) | fade + translateY(36px), 1s, kích hoạt ở ~90% khung nhìn |
| Ảnh hover | scale 1.05–1.08, 1.4s |
| Hero Ken Burns | scale 1.06→1.14, 7s |
| Số liệu đếm tăng | 1.4s, ease-out bậc 3, khi vào khung nhìn |
| Nhanh/vừa | 0.3s (màu, trạng thái) / 0.5s (nút, thẻ) |

**Quy tắc:** chuyển động của Rosé **chậm hơn mặc định của ngành** — đó là chủ ý (lật album, không lướt app). Luôn tôn trọng `prefers-reduced-motion`.

## 7. Hình ảnh

- Định dạng WebP chất lượng 82 (thumb 640px, chất lượng 74); ảnh hiển thị lớn 1600–1920px
- Ảnh trong khung cắt **luôn có điểm neo dọc điều chỉnh được** (object-position) — không bao giờ để mặt người bị cắt
- Ảnh dọc chuẩn 2:3; hero desktop ảnh ngang, hero mobile dùng **bộ ảnh dọc riêng**
- Chữ đè lên ảnh bắt buộc có gradient tối phía dưới (xem mục Thẻ)

## 8. Giọng nội dung

- **Không dùng dấu gạch dài (—)** trong mọi nội dung hiển thị — quy tắc cứng của thương hiệu
- Xưng "chúng tôi/Rosé", gọi khách "bạn/hai bạn"; ấm, tiết chế, không đao to búa lớn
- Slogan: *"Chỉn chu, sáng tạo và màu sắc khác biệt"* · Tagline: *Timeless Moments*
- Nhãn eyebrow: HOA, 2-5 từ, gợi cảm xúc ("NIỀM TIN GỬI TRAO", "SÁNG TẠO TỪ GỐC RỄ VIỆT NAM")

## 9. Áp dụng cho app phần mềm

Đọc giá trị từ `tokens.json`. Lưu ý chuyển đổi:

- **Màn hình khách hàng** (app booking, xem album): giữ radius 0, nền cream, đủ 3 font
- **Công cụ nội bộ** (quản lý, dashboard): được phép bo góc 8px, font Inter/system thay Montserrat, nền `#F5F3EF` — tham chiếu bộ admin đang chạy tại `/admin` của web
- Đệm dọc section 120px của web ≈ 48–64px trong app (màn hình nhỏ hơn, mật độ cao hơn — giữ TỈ LỆ thoáng, không giữ số tuyệt đối)
- Easing: iOS dùng `UICubicTimingParameters(controlPoint1: (0.22, 0.61), controlPoint2: (0.36, 1))`; Android/Flutter `Cubic(0.22, 0.61, 0.36, 1.0)`

## 10. Checklist nghiệm thu nhanh

Một màn hình đạt chuẩn Rosé khi:
- [ ] Chỉ có vàng đồng làm màu nhấn; đường kẻ là vàng nhạt, không xám
- [ ] Chữ chính là `#1E1C1A`, không phải đen tuyền
- [ ] Chữ hoa nhỏ đều giãn rộng; tiêu đề Playfair
- [ ] Không bo góc (sản phẩm hướng khách); không bóng đổ khi nghỉ
- [ ] Khoảng thở rộng rãi; section xen kẽ sáng/tối có nhịp
- [ ] Chuyển động chậm, cùng một easing; ảnh hover phóng rất nhẹ
- [ ] Không có dấu gạch dài trong câu chữ
