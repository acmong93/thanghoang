/**
 * Gửi email thông báo khi có khách đặt lịch.
 * Nếu chưa cấu hình SMTP_PASS trong .env thì bỏ qua (không làm hỏng luồng đặt lịch).
 */
const nodemailer = require('nodemailer');

function isConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

/* Chống chèn HTML từ dữ liệu khách nhập vào email */
const esc = s => String(s || '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function sendBookingNotification(lead) {
  if (!isConfigured()) {
    console.log('[mail] SMTP chưa cấu hình — bỏ qua gửi email (lead vẫn được lưu).');
    return false;
  }
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });

  await transporter.sendMail({
    from: `"Rosé Wedding Website" <${process.env.SMTP_USER}>`,
    to: process.env.NOTIFY_EMAIL || process.env.SMTP_USER,
    subject: `[Đặt lịch mới] ${lead.name.replace(/[\r\n]/g, ' ')} — ${(lead.service || 'Chưa chọn dịch vụ').replace(/[\r\n]/g, ' ')}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;border:1px solid #eee;border-radius:8px;overflow:hidden">
        <div style="background:#1a1a1a;color:#c9a25e;padding:18px 24px;font-size:18px;font-weight:bold">Rosé Wedding — Yêu cầu tư vấn mới</div>
        <div style="padding:24px;color:#222;line-height:1.7">
          <p><b>Họ tên:</b> ${esc(lead.name)}</p>
          <p><b>Điện thoại:</b> <a href="tel:${esc(lead.phone)}">${esc(lead.phone)}</a></p>
          <p><b>Dịch vụ quan tâm:</b> ${esc(lead.service) || '—'}</p>
          <p><b>Lời nhắn:</b><br>${esc(lead.message || '—').replace(/\n/g, '<br>')}</p>
          <p style="color:#888;font-size:13px;margin-top:24px">Gửi lúc ${new Date().toLocaleString('vi-VN')} · Xem tất cả trong trang quản trị /admin/leads</p>
        </div>
      </div>`
  });
  return true;
}

module.exports = { sendBookingNotification };
