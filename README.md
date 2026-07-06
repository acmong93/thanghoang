# Rosé Wedding — Website & Trang quản trị

Website ảnh cưới phong cách **tối giản · editorial · quiet luxury**, xây dựng bằng Node.js (Express + EJS + SQLite), kèm trang quản trị đầy đủ.

## Tính năng

**Trang public**
- Trang chủ với hero slider, câu chuyện thương hiệu, bộ sưu tập, concept độc bản, quy trình, bảng giá, phim cưới, form đặt lịch
- Trang album với lightbox xem ảnh (phím mũi tên, Esc)
- Bảng giá theo 5 nhóm dịch vụ, tin tức/blog, váy cưới, câu chuyện
- Ảnh WebP tối ưu (nguồn 1.8GB → 79MB), lazy-load, responsive mobile-first
- SEO cơ bản: meta description, redirect 301 từ URL cũ

**Trang quản trị `/admin`**
- Đăng nhập bảo mật (bcrypt + session)
- Quản lý album & ảnh: upload nhiều ảnh cùng lúc (tự nén WebP + thumbnail), đặt ảnh bìa, sắp thứ tự, ẩn/hiện
- Quản lý bảng giá: sửa gói, giá, quyền lợi, gói nổi bật
- Quản lý bài viết: soạn, sửa, ẩn/hiện, upload ảnh bìa
- Quản lý yêu cầu đặt lịch (leads): lọc theo trạng thái Mới / Đã liên hệ / Hoàn tất
- Cài đặt: thông tin liên hệ, giờ mở cửa, mạng xã hội, Google Maps, video YouTube

## Chạy trên máy

Yêu cầu: **Node.js ≥ 22.5** (dùng SQLite tích hợp sẵn của Node, không cần cài database).

```bash
npm install
copy .env.example .env    # rồi sửa các giá trị trong .env
npm run optimize-images   # chỉ lần đầu: nén ảnh gốc sang public/img
npm run seed              # chỉ lần đầu: nạp nội dung vào database
npm start                 # chạy tại http://localhost:3000
```

Trang quản trị: `http://localhost:3000/admin` — tài khoản lấy từ `ADMIN_USER` / `ADMIN_PASSWORD` trong `.env` (tạo lúc khởi động đầu tiên).

## Cấu trúc

```
server.js            # Khởi động Express
src/db.js            # SQLite (node:sqlite) + schema
src/mailer.js        # Gửi email thông báo đặt lịch (nodemailer)
src/routes/public.js # Các trang khách xem
src/routes/admin.js  # Trang quản trị + upload ảnh
views/               # Giao diện EJS (public + admin)
public/css|js|img    # Tài nguyên tĩnh (img = ảnh WebP đã nén)
public/uploads/      # Ảnh upload từ admin (gitignore — backup riêng)
scripts/             # optimize-images.js, seed.js
data/rose.db         # Database (gitignore — backup riêng)
docs/DEPLOY.md       # Hướng dẫn đưa web lên GitHub + Hostinger
```

## Deploy

Xem hướng dẫn chi tiết từng bước trong [docs/DEPLOY.md](docs/DEPLOY.md).
