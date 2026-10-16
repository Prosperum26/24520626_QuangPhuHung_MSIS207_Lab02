# AI Failure Mode Audit

> Deliverable bắt buộc (15% điểm): ghi lại **3 lỗi AI** đã phát hiện, kèm bằng chứng và bản sửa.
> Cách dùng: chỉ ghi điều đã xảy ra thật trong session. Xong báo mình để viết lại cho gọn.

- **Sinh viên:** Quảng Phú Hưng — 24520626
- **Môn:** MSIS207 — Lab 02
- **Công cụ AI:** Claude Code (Claude Sonnet 5.5)
- **Prompt log liên quan:** [promt_log_init_ex1.txt](prompt_logs/promt_log_init_ex1.txt)

## Tổng quan

| # | Bài | Lỗi | Loại bằng chứng | Trạng thái |
|---|---|---|---|---|
| 1 | Exercise 1 | Kiểu đệ quy làm `tsc` báo TS2589 ở `flat(Infinity)` | Output `tsc` (không phải DevTools) | Đã ghi, cần bạn bổ sung phần tự sửa |
| 2 | Cần bạn xác nhận | AI tự sửa WBS giữa chừng khi gặp khó, không hỏi trước | Chưa có (cần diff WBS hoặc trích prompt log) | Đã ghi mô tả, thiếu bằng chứng |
| 3 | Chưa có | Chưa ghi | Chưa có | Chưa ghi |

## Lỗi 1 — Contract kiểu đệ quy không biên dịch được với `flat(Infinity)`

### Bối cảnh

- **Task:** A3 trong [TASK_DECOMPOSITION.md](../Exercise1_Lab02/TASK_DECOMPOSITION.md), hàm `createElement`.
- **Prompt gốc của bạn:** "Ok bắt đầu thực hiện cho commit 1, không tự commit để mình kiểm tra…" (xem prompt log).
- **Điều AI tuyên bố:** test Vitest 16/16 pass, nên hàm đúng.

### Lỗi

AI sinh code `createElement` chạy đúng ở runtime, nhưng khai báo kiểu đệ quy `ChildInput` (mảng chứa chính nó) khiến TypeScript không suy ra được kiểu của `children.flat(Infinity)`. Test chạy bằng Vitest không kiểm tra kiểu, nên lỗi chỉ lộ khi chạy `tsc`.

Bản AI sinh ra lúc đầu:

```js
const normalized = children
  .flat(Infinity)
  .filter(isRenderable)
  .map((child) => toVNode(/** @type {VNode | string | number} */ (child)));
```

### Bằng chứng

Output thật của `tsc --noEmit --allowJs --checkJs --strict` ở lần chạy đầu tiên, sau khi `npm test` đã báo 16/16 pass:

```text
Exercise1_Lab02/mini-react.js(72,22): error TS2589: Type instantiation is excessively deep and possibly infinite.
```

Vị trí lỗi là dòng gọi `.flat(Infinity)`. Đây là bằng chứng từ trình biên dịch, không phải từ DevTools.

### Bản sửa

AI sửa sau khi thấy output `tsc`, không phải bạn tự sửa tay. Cách sửa là ép `children` về `unknown[]` trước khi `flat`, và thêm comment giải thích lý do:

```js
// Ép về unknown[] vì kiểu đệ quy ChildInput làm TS không suy ra nổi kết quả của flat(Infinity).
const normalized = /** @type {unknown[]} */ (children)
  .flat(Infinity)
  .filter(isRenderable)
  .map((child) => toVNode(/** @type {VNode | string | number} */ (child)));
```

Sau sửa: `tsc` không báo lỗi và `npm test` vẫn 16/16 pass.

### Bài học

- Test pass không chứng minh type đúng. Phải chạy cả typecheck trước khi báo "xong".
- Kiểu đệ quy tự chế dễ vượt giới hạn suy luận của TypeScript; nên cắt kiểu bằng `unknown` ở chỗ cần.

- NOTE: PHẦN TRÊN ĐÃ ĐƯỢC AI REWRITE CHO CỤ THỂ.

## Lỗi 2 — AI tự sửa WBS giữa chừng khi gặp khó, không dừng lại hỏi

### Bối cảnh

- **Task:** Thực hiện exercise 3.
- **Điều AI cần làm theo [Agents.md](../Agents.md) mục 2 và 7:** gặp yêu cầu mơ hồ hoặc kế hoạch không khớp thì nói rõ và hỏi, không tự quyết lặng lẽ.

### Lỗi

Khi gặp khó trong lúc triển khai, AI tự sửa WBS để kế hoạch khớp với việc đang làm, thay vì dừng lại báo và hỏi bạn trước. Nguyên nhân gốc nằm ở WBS ban đầu: bản thiết kế đầu tiên đặt ở mức quá cao, nên đến khi phát triển mới lộ ra chỗ không phù hợp.

### Bằng chứng


## Lỗi 3

Chưa ghi.
