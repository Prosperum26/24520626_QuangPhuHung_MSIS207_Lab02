# Homework 3 — Task Decomposition (bản nháp ghi chú)

> Trạng thái: **mới ghi lại thông tin đề bài**. Chưa chia WBS. Khi bắt đầu làm, chia task theo [project-rules](../docs/project-rules.md).
> Quy tắc WCAG: xem [project-rules, mục 8](../docs/project-rules.md).

## 1. Thông tin chung

| Mục | Nội dung |
|---|---|
| Tên bài | High-Concurrency Flash-Sale E-Commerce Engine |
| Thời hạn | 1 tuần |
| Bối cảnh | Kịch bản thị trường Việt Nam: siêu sale (Shopee, Lazada 11.11, flash sale lúc nửa đêm) |
| Mục tiêu | Đồng hồ đếm ngược không trôi (zero-drift) và máy trạng thái giữ hàng tồn kho |

## 2. Yêu cầu

1. **Đồng hồ không trôi:** đếm ngược chính xác đến mili giây bằng hiệu `Date.now()`, không dùng `setInterval` (dễ lệch).
2. **Khóa tồn kho lạc quan (optimistic inventory lock):** máy trạng thái hữu hạn xử lý giữ hàng, hết hạn khóa và thanh toán.
3. **Kiểm toán lỗi AI:** bắt buộc có `AI_FAILURE_AUDIT.md` ghi nhận **ít nhất 3** lỗi của AI. Xem [mẫu](../docs/AI_FAILURE_AUDIT.md).
4. **Commit atomic:** tối thiểu **8** commit riêng biệt theo Conventional Commits.

## 3. Khung mã mẫu

```ts
// anti-drift-timer.ts
export function createAntiDriftTimer(
  durationMs: number,
  onTick: (remaining: number) => void
) {
  const targetTime = Date.now() + durationMs;
  let rafId: number;

  function tick() {
    const remaining = Math.max(0, targetTime - Date.now());
    onTick(remaining);
    if (remaining > 0) {
      rafId = requestAnimationFrame(tick); // Không trôi, khác với setInterval
    }
  }

  rafId = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(rafId);
}
```

Nhận xét kỹ thuật:
- Thời gian còn lại luôn tính từ mốc đích, nên không tích lũy sai số như `setInterval`.
- `requestAnimationFrame` bị tạm dừng hoặc giảm tần suất khi tab bị ẩn; khi quay lại, giá trị vẫn đúng vì tính từ `Date.now()`.
- `Date.now()` là giờ hệ thống và có thể bị đổi (đồng bộ NTP, người dùng chỉnh giờ). Với flash sale thật cần lấy giờ máy chủ và tính độ lệch; có thể cân nhắc `performance.now()` cho phần đo khoảng thời gian.
- Khung mẫu không tự dừng khi `remaining === 0` ngoài việc không lên lịch tiếp; cần gọi `onTick(0)` đúng một lần để chuyển trạng thái.

## 4. Gợi ý máy trạng thái tồn kho (cần xác nhận)

Đề chưa nêu rõ tập trạng thái. Phác thảo để thảo luận:

| Trạng thái | Ý nghĩa | Chuyển sang |
|---|---|---|
| `AVAILABLE` | Còn hàng, chưa ai giữ | `RESERVED` |
| `RESERVED` | Đã khóa tạm cho một người mua, có hạn | `CHECKOUT`, `EXPIRED` |
| `CHECKOUT` | Đang thanh toán | `SOLD`, `AVAILABLE` (thất bại) |
| `EXPIRED` | Khóa hết hạn | `AVAILABLE` |
| `SOLD` | Đã bán, kết thúc | (không có) |

Quy tắc: mọi chuyển trạng thái đi qua một hàm duy nhất, các chuyển không hợp lệ bị từ chối; hàng không bao giờ bán quá số lượng tồn.

## 5. Ghi chú WCAG 2.2 AA

- **Timing Adjustable (2.2.1):** khóa giữ hàng có giới hạn thời gian phải có cảnh báo trước khi hết hạn và cho người dùng gia hạn hoặc tắt giới hạn.
- Không đặt `aria-live` trên đồng hồ chạy từng mili giây. Chỉ thông báo các mốc quan trọng (ví dụ còn 1 phút, còn 10 giây, đã hết) qua `role="status"` hoặc `role="alert"` cho mốc khẩn cấp.
- Đồng hồ hiển thị bằng văn bản có thể đọc, dùng thẻ `<time>`; không dùng hình ảnh để biểu diễn thời gian.
- Trạng thái hàng ("Còn hàng", "Đã hết", "Đang giữ") dùng chữ, không chỉ dựa vào màu.
- Nút mua và nút thanh toán là `<button>`, vùng bấm tối thiểu 24×24 CSS px, thấy rõ focus.
- Không bắt nhập lại thông tin đã nhập trong cùng quy trình thanh toán (3.3.7).

## 6. Điều kiện hoàn thành (checklist nghiệm thu)

- [ ] Đồng hồ đếm ngược đến mili giây, không trôi khi đo dài và khi tab bị ẩn
- [ ] Máy trạng thái tồn kho có đủ giữ hàng, hết hạn khóa, thanh toán; chuyển trạng thái hợp lệ
- [ ] Không bán quá số lượng khi nhiều yêu cầu đồng thời (có test mô phỏng)
- [ ] `AI_FAILURE_AUDIT.md` ghi đủ ít nhất 3 lỗi AI, có bằng chứng DevTools và bản sửa
- [ ] Tối thiểu 8 commit riêng biệt, đúng Conventional Commits
- [ ] Kiểm tra WCAG 2.2 AA như mục 5
- [ ] Prompt log đã export vào `docs/prompt_logs/`

## 7. Câu hỏi còn mở

- Bài này có phải làm `AI_FAILURE_AUDIT.md` riêng hay dùng chung một file `docs/AI_FAILURE_AUDIT.md` cho toàn lab? Đề lab nói một báo cáo 3 lỗi, đề HW3 lại yêu cầu "ít nhất 3". Cần hỏi thầy.
- Giờ máy chủ lấy từ đâu (giả lập hay API thật)?
- Có cần giao diện đầy đủ hay chỉ engine và demo tối thiểu?
- Dùng Mini-React tự viết hay framework thật?
