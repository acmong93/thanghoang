/**
 * Chuyển nội dung bài viết soạn bằng cú pháp đơn giản thành HTML an toàn.
 *
 * Cú pháp hỗ trợ (mỗi khối cách nhau MỘT DÒNG TRỐNG):
 *   ## Tiêu đề mục lớn          -> H2
 *   ### Tiêu đề mục nhỏ         -> H3
 *   > Câu trích dẫn             -> blockquote
 *   /uploads/posts/a.webp       -> ảnh full-width trong bài
 *   /uploads/posts/a.webp | Chú thích ảnh
 *   **chữ đậm**  *chữ nghiêng*  [chữ có link](/bang-gia/anh-cuoi)
 *   Còn lại là đoạn văn thường.
 *
 * Mọi nội dung được escape trước khi áp cú pháp: không lo chèn mã độc.
 */
const esc = s => String(s).replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function inline(text) {
  let t = esc(text);
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  t = t.replace(/(^|[\s(“])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  t = t.replace(/\[([^\]]+)\]\((\/[^)\s]*|https?:\/\/[^)\s]+)\)/g,
    (m, label, url) => `<a href="${url}"${url.startsWith('http') ? ' target="_blank" rel="noopener"' : ''}>${label}</a>`);
  return t;
}

function renderPostBody(body) {
  const blocks = String(body || '').split(/\r?\n\s*\r?\n/);
  const out = [];
  for (const block of blocks) {
    const t = block.trim();
    if (!t) continue;
    if (/^###\s+/.test(t)) { out.push('<h3>' + inline(t.replace(/^###\s+/, '')) + '</h3>'); continue; }
    if (/^##\s+/.test(t)) { out.push('<h2>' + inline(t.replace(/^##\s+/, '')) + '</h2>'); continue; }
    if (/^>\s?/.test(t)) {
      out.push('<blockquote>' + inline(t.split(/\r?\n/).map(l => l.replace(/^>\s?/, '')).join(' ')) + '</blockquote>');
      continue;
    }
    const img = t.match(/^(\/(?:uploads|img)\/[\w\-./%]+\.(?:webp|jpe?g|png|gif))\s*(?:\|\s*(.+))?$/i);
    if (img) {
      const caption = img[2] ? `<figcaption>${inline(img[2])}</figcaption>` : '';
      out.push(`<figure class="pb-img"><img loading="lazy" src="${esc(img[1])}" alt="${esc(img[2] || 'Ảnh cưới Rosé Wedding')}" />${caption}</figure>`);
      continue;
    }
    out.push('<p>' + inline(t).replace(/\r?\n/g, '<br/>') + '</p>');
  }
  return out.join('\n');
}

module.exports = { renderPostBody };
