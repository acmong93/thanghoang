# Hướng dẫn đưa website lên GitHub và Hostinger

## Phần 1 — Đưa code lên GitHub

### Bước 1: Tạo repository trên GitHub
1. Đăng nhập [github.com](https://github.com) → bấm **New repository**
2. Đặt tên, ví dụ `rose-wedding` → chọn **Private** (nên chọn Private vì đây là web kinh doanh)
3. KHÔNG tick "Add a README" (đã có sẵn) → **Create repository**

### Bước 2: Push code từ máy lên
Mở terminal trong thư mục dự án và chạy:

```bash
git remote add origin https://github.com/TEN-TAI-KHOAN/rose-wedding.git
git push -u origin main
```

> Git sẽ hỏi đăng nhập GitHub lần đầu — làm theo hướng dẫn trên màn hình.
> Lưu ý: ảnh gốc 1.8GB, database và file `.env` đã được loại khỏi Git (xem `.gitignore`) — chỉ code và ảnh WebP đã nén (~79MB) được đưa lên.

Sau này mỗi lần sửa code:
```bash
git add -A
git commit -m "Mô tả thay đổi"
git push
```

---

## Phần 2 — Chọn gói Hostinger phù hợp

Website này chạy **Node.js server** (có trang quản trị + database), nên **KHÔNG chạy được** trên gói Web Hosting thường (Premium/Business — các gói đó chỉ chạy web tĩnh/PHP/WordPress).

**Gói cần mua: Hostinger VPS** (khuyến nghị KVM 1 hoặc KVM 2, ~119.000–229.000đ/tháng):
- Chạy được Node.js, tự cài đặt mọi thứ
- KVM 1 (4GB RAM) là quá đủ cho website này

> Cách khác nếu không muốn quản lý VPS: giữ Hostinger cho domain, còn deploy app lên [Railway](https://railway.app) / [Render](https://render.com) (có gói miễn phí/rẻ, deploy thẳng từ GitHub, ít phải cấu hình). Nhưng hướng dẫn dưới đây viết cho Hostinger VPS.

---

## Phần 3 — Deploy lên Hostinger VPS

### Bước 1: Tạo VPS
1. Trong hPanel → **VPS** → chọn template **Ubuntu 24.04**
2. Đặt mật khẩu root mạnh → ghi lại IP của VPS

### Bước 2: Kết nối SSH vào VPS
Trên máy Windows, mở PowerShell:
```bash
ssh root@IP-CUA-VPS
```

### Bước 3: Cài Node.js 22 + PM2
```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs git
npm install -g pm2
node --version   # phải >= 22.5
```

### Bước 4: Kéo code về và cài đặt
```bash
cd /var/www
git clone https://github.com/TEN-TAI-KHOAN/rose-wedding.git
cd rose-wedding
npm install --omit=dev
```

### Bước 5: Đưa ảnh đã nén lên VPS
Ảnh WebP nằm trong Git nên đã có sẵn sau `git clone`. Nếu sau này có ảnh upload từ admin trên máy local, copy thủ công:
```bash
# chạy trên máy Windows (PowerShell), từ thư mục dự án:
scp -r public/uploads root@IP-CUA-VPS:/var/www/rose-wedding/public/
```

### Bước 6: Cấu hình môi trường
```bash
cp .env.example .env
nano .env
```
Sửa các giá trị:
- `SESSION_SECRET` — chuỗi ngẫu nhiên dài bất kỳ
- `ADMIN_USER` / `ADMIN_PASSWORD` — tài khoản quản trị (đặt mật khẩu MẠNH)
- `SMTP_PASS` — App Password của Gmail (tạo tại myaccount.google.com/apppasswords, cần bật 2FA trước)

Lưu (Ctrl+O, Enter) rồi thoát (Ctrl+X). Sau đó nạp dữ liệu:
```bash
npm run seed
```

### Bước 7: Chạy website bằng PM2 (tự khởi động lại khi VPS reboot)
```bash
pm2 start server.js --name rose-wedding
pm2 save
pm2 startup   # chạy lệnh mà nó in ra
```

### Bước 8: Cài Nginx làm reverse proxy + HTTPS
```bash
apt install -y nginx certbot python3-certbot-nginx
nano /etc/nginx/sites-available/rose-wedding
```
Dán nội dung (thay `tenmien.com` bằng domain của bạn):
```nginx
server {
    listen 80;
    server_name tenmien.com www.tenmien.com;
    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```
Kích hoạt + cấp SSL miễn phí:
```bash
ln -s /etc/nginx/sites-available/rose-wedding /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
certbot --nginx -d tenmien.com -d www.tenmien.com
```

### Bước 9: Trỏ domain về VPS
Trong hPanel → **Domains** → DNS Zone:
- Bản ghi `A` cho `@` → IP của VPS
- Bản ghi `A` cho `www` → IP của VPS

Chờ 5–30 phút cho DNS cập nhật. Xong! Website chạy tại `https://tenmien.com`, quản trị tại `https://tenmien.com/admin`.

---

## Phần 4 — Cập nhật website sau này

```bash
# trên máy: sửa code → git add -A → git commit -m "..." → git push
# trên VPS:
cd /var/www/rose-wedding
git pull
npm install --omit=dev
pm2 restart rose-wedding
```

## Phần 5 — Sao lưu dữ liệu (QUAN TRỌNG)

Database (`data/rose.db`) và ảnh upload (`public/uploads/`) KHÔNG nằm trong Git. Định kỳ tải về máy:
```bash
scp root@IP-CUA-VPS:/var/www/rose-wedding/data/rose.db D:\backup\
scp -r root@IP-CUA-VPS:/var/www/rose-wedding/public/uploads D:\backup\
```
