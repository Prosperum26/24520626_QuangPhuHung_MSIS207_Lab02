// @ts-check

const STATUS_ID = 'status';

/**
 * Vùng `role="status"` nằm ngoài cây bị thay (index.html): vùng live bị tạo lại mỗi
 * render thường không được trình đọc màn hình đọc ra (WCAG 4.1.3). Gọi từ handler,
 * không gọi trong lúc render, để mũi tên di chuyển giữa các ô không bị đọc lại thông báo cũ.
 * @param {string} message
 */
export function announce(message) {
  const region = document.getElementById(STATUS_ID);
  if (region !== null) region.textContent = message;
}
