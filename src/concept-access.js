/**
 * Kho concept không quảng bá công khai: không có trong menu, sơ đồ trang, và chặn Google lập chỉ mục.
 * Anh Thắng chốt 18/11/2026: link gửi khách vẫn là rosewedding.vn/concept (không kèm mã),
 * ai có link là xem được; chỉ không để khách lạ tìm thấy qua web hay Google.
 */
function gate(req, res, next) {
  res.set('X-Robots-Tag', 'noindex, nofollow');
  res.locals.noindex = true;
  next();
}

module.exports = { gate };
