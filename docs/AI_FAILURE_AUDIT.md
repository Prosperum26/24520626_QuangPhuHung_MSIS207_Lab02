# AI Failure Mode Audit

> Deliverable bắt buộc (15% điểm): ghi lại **3 lỗi AI** đã phát hiện, kèm bằng chứng DevTools và bản sửa thủ công.
> Cách dùng: điền các chỗ `<...>` bằng thông tin thật từ session của bạn. Xong báo mình để viết lại cho gọn và đẹp.

- **Sinh viên:** Quang Phú Hùng — 24520626
- **Môn:** MSIS207 — Lab 02
- **Công cụ AI:** <Claude Code / model nào>
- **Prompt log liên quan:** <đường dẫn tới file trong `docs/prompt_logs/`>

## Tóm tắt

| # | Nhóm lỗi | Bài | Mức độ | Trạng thái |
|---|---|---|---|---|
| 01 | Security — raw `innerHTML` (XSS) | <ex/hw> | <Cao/TB/Thấp> | <Đã sửa> |
| 02 | Memory leak — listener gắn trong render | <ex/hw> | <...> | <...> |
| 03 | Phantom key — `Math.random()` / index | <ex/hw> | <...> | <...> |

> 3 nhóm trên là ví dụ kinh điển từ slide. Nếu bạn gặp lỗi khác thật sự xảy ra trong bài, ưu tiên ghi lỗi thật và đổi nhóm cho phù hợp.

---

## Vulnerability 01: Raw `innerHTML` Ingestion

- **Bài / file:** <vd. exercise-02 / src/core/renderToDOM.js>
- **AI Prompt:**
  > <Dán nguyên văn prompt đã dùng>
- **AI Generated Code:**
  ```js
  <Dán đoạn code AI sinh ra, ví dụ container.innerHTML = comment.text;>
  ```
- **Risk:** <Mô tả rủi ro, ví dụ Stored XSS: `<img src=x onerror=stealToken()>` chạy được script>
- **Detection Method:** <Phát hiện bằng gì: DevTools Elements/Security/Console, `git diff`, test nào fail>
- **DevTools Proof:** <Screenshot hoặc log, ví dụ `docs/evidence/01-xss.png`>
- **Engineering Refactor:**
  ```js
  const textNode = document.createTextNode(comment.text);
  container.replaceChildren(textNode);
  ```
- **Verification sau khi sửa:** <Test/lệnh đã chạy và kết quả>
- **Bài học:** <1–2 câu>

---

## Vulnerability 02: Memory Leak do gắn listener trong render

- **Bài / file:** <...>
- **AI Prompt:**
  > <...>
- **AI Generated Code:**
  ```js
  <Ví dụ: addEventListener trong thân hàm render, không gỡ khi unmount, không dùng delegation>
  ```
- **Risk:** <Mỗi lần render thêm listener mới, node cũ bị giữ trong bộ nhớ, handler chạy nhiều lần>
- **Detection Method:** <DevTools Memory (heap snapshot) / Performance Monitor (JS event listeners, DOM nodes) / `getEventListeners`>
- **DevTools Proof:** <Số listener/DOM nodes trước và sau N lần render, kèm screenshot>
- **Engineering Refactor:**
  ```js
  <Event delegation: một listener ở root, tra handler theo e.target>
  ```
- **Verification sau khi sửa:** <...>
- **Bài học:** <...>

---

## Vulnerability 03: Phantom Keys

- **Bài / file:** <...>
- **AI Prompt:**
  > <...>
- **AI Generated Code:**
  ```jsx
  <Ví dụ: key={Math.random()} hoặc key={index}>
  ```
- **Risk:** <`Math.random()`: key đổi mỗi render nên DOM bị huỷ và dựng lại toàn bộ. Index: xoá/chèn phần tử làm state cục bộ (vd. nội dung input) dính sang item khác>
- **Detection Method:** <DevTools Elements (node nháy/bị thay mới), Performance profiler, test xoá item đầu>
- **DevTools Proof:** <Screenshot/ghi chú>
- **Engineering Refactor:**
  ```jsx
  <TaskItem key={task.uuid} data={task} />
  ```
- **Verification sau khi sửa:** <...>
- **Bài học:** <...>

---

## Kết luận

<2–4 câu: AI hay sai ở đâu, quy trình verify nào giúp bắt được, bạn sẽ làm gì khác lần sau.>
