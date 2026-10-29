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

## Homework 3 — lỗi AI ghi từ phiên làm HW3

> Ghi chú về nguồn: phần này do AI tổng hợp từ chính phiên làm HW3 (Claude Code, Claude Sonnet 5.5). Mỗi lỗi đều có output thật dán lại bên dưới và có thể kiểm lại bằng lệnh nêu kèm. Bằng chứng ở lỗi 2 và 3 lấy từ Edge điều khiển bằng Chrome DevTools Protocol (CDP), không phải ảnh chụp thủ công trong cửa sổ DevTools. Bạn cần đọc lại và xác nhận đây đúng là các lỗi bạn muốn nộp; nếu có lỗi khác bạn tự gặp thì thay vào.
> Prompt log liên quan: [promt_log_init_hm3.txt](prompt_logs/promt_log_init_hm3.txt).

### Tổng quan HW3

| # | Lỗi | Loại bằng chứng | Bắt bởi |
|---|---|---|---|
| H3-1 | AI khẳng định sai trong plan rằng bỏ kiểm `version` thì test "không bán quá" sẽ đỏ | Output Vitest sau khi tự gây đột biến | Phép thử đột biến, không phải test thường |
| H3-2 | Giao diện do AI sinh làm focus bàn phím rơi về `<body>` sau khi bấm "Giữ hàng" dù 112 test pass | Output script CDP (phím thật, `document.activeElement`) | Chạy trong Edge thật |
| H3-3 | Trang do AI sinh gây lỗi console 404 `favicon.ico` | Console của Edge qua CDP | Chạy trong Edge thật |
| H3-4 | (phụ) Plan nói `version` chỉ tăng khi event được chấp nhận, code tăng cả khi việc quét hết hạn làm đổi state | So sánh plan và code | AI tự thấy lúc cài đặt |
| H3-5 | (phụ) Test đầu tiên đọc `index.html` bằng `import.meta.url` nên lỗi trong môi trường jsdom | Output Vitest | Chạy test |

### Lỗi H3-1 — Khẳng định sai về sức mạnh của test khi bỏ kiểm version

#### Bối cảnh

- **Task:** plan HW3 mục 7 (bảng đột biến cho bảo vệ trực tiếp) và nhóm D (khóa lạc quan).
- **Điều AI tuyên bố trong plan:** dòng "Bỏ kiểm `version` ở `commit` | `inventory-store.js` | test đồng thời phải đỏ (bán quá)".

#### Lỗi

AI giả định rằng nếu `commit` không kiểm `version` thì kho sẽ bán quá và test mô phỏng 200 người mua sẽ đỏ. Điều đó sai: `transition` luôn áp event lên state hiện tại và tự chặn `SOLD_OUT`, nên kho vẫn không bán quá. Chỉ các test kiểm trực tiếp `CONFLICT` mới đỏ. Nếu tin dòng ghi chú này, bạn sẽ giải thích sai khi giảng viên bỏ kiểm `version` lúc bảo vệ.

#### Bằng chứng

Đột biến: đổi `if (state.version !== expectedVersion) {` thành `if (false) {` trong `inventory-store.js`, rồi chạy `npx vitest run Homework3_Lab02`. Output thật (rút gọn):

```text
 FAIL  inventory-store.test.js > D1 > commit() with a stale version returns CONFLICT and leaves state unchanged
 FAIL  inventory-store.test.js > D1 > two concurrent commits at the same version: exactly one wins
 FAIL  reserve-with-retry.test.js > D2 > retries after a CONFLICT with a fresh read and then succeeds
 FAIL  buyers.test.js > D3 > really races: the optimistic lock rejects stale commits
 FAIL  buyers.test.js > D3 > bounded retry: with maxRetries 0 some buyers give up, still never oversell
 Tests  5 failed | 60 passed (65)
```

Test "reserves exactly 10 and never more than the stock" không nằm trong danh sách đỏ, tức là vẫn xanh khi bỏ kiểm `version`.

#### Bản sửa

Sửa dòng đó trong [TASK_DECOMPOSITION.md](../Homework3_Lab02/TASK_DECOMPOSITION.md) mục 7: test đỏ là các test `CONFLICT`, còn bán quá thật chỉ tái hiện được bằng `simulateNaiveBuyers` (đọc, chờ, ghi đè không kiểm version). Hoàn nguyên đột biến, chạy lại 65 test xanh.

#### Bài học

- Đừng tin "test này sẽ đỏ" khi chưa tự gây đột biến và nhìn output.
- Hai lớp bảo vệ (kiểm `version` và kiểm tồn kho trong `transition`) che nhau; muốn thấy lớp nào làm việc phải test riêng từng lớp.

### Lỗi H3-2 — Focus bàn phím rơi về body sau khi bấm "Giữ hàng"

#### Bối cảnh

- **Task:** nhóm E (giao diện) và yêu cầu bàn phím, trình đọc màn hình.
- **Điều AI báo:** nhóm E xong, 112 test của HW3 pass, "hỗ trợ bàn phím" vì mọi điều khiển là `<button>`.

#### Lỗi

Sau khi bấm "Giữ hàng" bằng phím Enter, nút đó bị vô hiệu hóa nên trình duyệt đẩy focus về `<body>`. Người dùng bàn phím và trình đọc màn hình phải Tab lại từ đầu trang (WCAG 2.4.3 Focus Order). Test jsdom không bắt được vì jsdom không mô phỏng việc trình duyệt thật chuyển focus khi nút bị vô hiệu hóa.

#### Bằng chứng

Script CDP gửi phím Tab và Enter thật vào Edge (`Input.dispatchKeyEvent`), đọc `document.activeElement` sau khi giữ hàng. Output thật lần chạy đầu:

```text
PASS bàn phím: Tab tới nút Giữ hàng ["a.skip-link","button[reserve]"]
PASS bàn phím: Enter trên Giữ hàng tạo lượt giữ và có thông báo status
FAIL bàn phím: focus không rơi về <body> sau khi bấm Giữ hàng (WCAG 2.4.3) BODY
```

#### Bản sửa

Thêm `keepFocus()` trong [flash-sale-app.js](../Homework3_Lab02/src/app/flash-sale-app.js): sau mỗi thao tác, nếu focus bị mất thì đưa focus về tiêu đề `#hold-title` (có `tabindex="-1"`). Thêm 2 test jsdom (focus chuyển về tiêu đề khi nút bị vô hiệu hóa; giữ nguyên khi nút vẫn dùng được). Chạy lại script CDP:

```text
PASS bàn phím: focus không rơi về <body> sau khi bấm Giữ hàng (WCAG 2.4.3) h2#hold-title
PASS bàn phím: sau Tiến hành thanh toán focus không rơi về <body> h2#hold-title
PASS bàn phím: sau Xác nhận thanh toán focus không rơi về <body> h2#hold-title
```

#### Bài học

- Test đơn vị trong jsdom không thay thế được phép thử bàn phím trong trình duyệt thật.
- Điều khiển bị vô hiệu hóa hoặc ẩn đúng lúc người dùng đang focus vào nó là lỗi trợ năng hay gặp ở code AI sinh.

### Lỗi H3-3 — Thiếu favicon gây lỗi console 404

#### Bối cảnh

- **Task:** nhóm E, `index.html` và `drift-demo.html`.
- **Điều AI báo:** trang chạy, không có lỗi.

#### Lỗi

Hai trang AI sinh không khai báo icon nên trình duyệt tự gọi `/favicon.ico` và nhận 404, tạo một lỗi trong console. Lỗi loại này làm giảm điểm Best Practices của Lighthouse ("Browser errors were logged to the console").

#### Bằng chứng

Console của Edge (CDP `Log.entryAdded`) khi mở trang lần đầu:

```text
log error: Failed to load resource: the server responded with a status of 404 (Not Found) http://127.0.0.1:8790/favicon.ico
```

#### Bản sửa

Thêm `<link rel="icon" href="data:,">` vào cả hai trang. Chạy lại: console không còn lỗi, Lighthouse Best Practices 100 (xem [lighthouse-hw3.json](../Homework3_Lab02/evidence/lighthouse-hw3.json)). Mình không có số Lighthouse trước khi sửa nên không khẳng định điểm tăng bao nhiêu.

#### Bài học

- "Không lỗi" chỉ đúng sau khi mở trang thật và đọc console.

### Các lỗi phụ

- **H3-4:** plan viết bất biến "`version` chỉ tăng khi event được chấp nhận". Lúc cài đặt, AI nhận ra nếu event bị từ chối mà việc quét hết hạn đã đổi state thì vẫn phải lưu state đó và tăng `version`, nếu không lượt quá hạn "sống lại". AI sửa mục 3.2 của plan cho khớp code; đây là lỗi tự phát hiện, không có output.
- **H3-5:** test đầu tiên của nhóm E dùng `new URL('../../index.html', import.meta.url)`. Output: `TypeError: The URL must be of scheme file`. Sửa bằng đường dẫn tương đối từ gốc repo như HW2.
