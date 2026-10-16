# Project Rules — Lab 02

Quy tắc của dự án, tổng hợp từ slide của thầy và quy tắc cá nhân. Bối cảnh chi tiết xem [Context.md](Context.md); quy tắc dành riêng cho AI xem [../Agents.md](../Agents.md).

> Nguồn: **[Thầy]** = từ slide, **[Cá nhân]** = do mình đặt thêm. Hiện chưa có mục [Cá nhân] nào; bổ sung ở §9. Riêng WCAG 2.2 AA (§8) là yêu cầu bắt buộc cho UI và tài liệu.

## 1. Nguyên tắc nền tảng [Thầy]

1. HTML là nền ngữ nghĩa, CSS lo trình bày, JavaScript lo state và hành vi.
2. AI tăng tốc, **không thay** việc hiểu nền tảng. AI sinh code xác suất, developer kiểm chứng tất định.
3. Không nhận output AI chưa kiểm chứng.
4. Không "vibe coding" nguyên khối: chia task nhỏ, viết contract trước.

## 2. Quy trình 4 giai đoạn [Thầy]

1. **Functional Slicing** — chia yêu cầu thành bài toán con độc lập.
2. **Contract-First** — viết interface/schema trước khi sinh code.
3. **Atomic Generation** — mỗi lần prompt AI chỉ một hàm/module.
4. **Independent Verification** — DevTools, test case, `git diff`.

**Luật:** không bao giờ prompt AI với hơn 1 sub-task cùng lúc.

## 3. Cấm tuyệt đối [Thầy]

| Cấm | Thay bằng |
|---|---|
| `var`, implicit global | `const` / `let` |
| `keypress`, `e.keyCode` | `keydown`, `e.key` / `e.code` |
| `innerHTML` với dữ liệu động | DOM API, `textContent`, `createTextNode`, `replaceChildren` |
| Inline handler `onclick=...` | Event delegation tập trung |
| Babel standalone | Vite/esbuild + JSX transform hiện đại |

## 4. Quy tắc engine (Tier 1) [Thầy]

- VNode là POJO `{ type, props }` với `props.children: VNode[]`; text luôn là `TEXT_ELEMENT`.
- `createElement`: bọc primitive, lọc `null/undefined/false`, `flat(Infinity)`, `props` luôn là object, trả object frozen.
- `renderToDOM` đệ quy; mount bằng `replaceChildren()`.
- `useState`: mảng tuyến tính + cursor + closure; hook gọi cùng thứ tự mọi lần render.
- Reconciliation: khác type thì thay cả cây; so cùng cấp; dùng `key` ổn định.
- **Không** dùng index hoặc `Math.random()` làm key; dùng ID thực thể (vd. `task.uuid`).
- Tránh layout thrashing: đọc DOM và ghi DOM tách pha.

## 5. Phạm vi [Thầy]

- **Tier 1 (cài đặt):** VNode, `createElement`, `renderToDOM`, `useState`, event delegation, reconciliation.
- **Tier 2 (hiểu):** Babel AST, automatic JSX runtime, Fiber, time slicing, SyntheticEvent pooling.
- **Tier 3 (lab sau, không làm):** RSC, Suspense streaming, SSR hydration.

## 6. Deliverable & tài liệu

- Mỗi bài (exercise/homework) có `TASK_DECOMPOSITION.md` riêng trong folder của nó (WBS, tick khi đã verify).
- `docs/prompt_logs/`: export session AI cho mỗi lần code mỗi bài.
- `docs/AI_FAILURE_AUDIT.md`: 3 lỗi AI phát hiện, kèm bằng chứng DevTools và bản sửa thủ công (15% điểm).

## 7. Git [Thầy + thực hành]

- Mỗi task xong = một commit atomic, Conventional Commits (`feat(core): implement vdom engine`).
- Xem `git diff` trước khi commit.
- Không `--force`, không `--no-verify`.

## 8. Khả năng truy cập: WCAG 2.2 mức AA [Cá nhân]

Áp dụng cho **mọi UI** do lab tạo ra và cho **mọi tài liệu** trong repo.

### 8.1 Với UI / code

| Tiêu chí WCAG | Quy tắc |
|---|---|
| 1.3.1 Info and Relationships | Dùng thẻ ngữ nghĩa (`<main>`, `<header>`, `<section>`, `<button>`, `<ul>`). Không div-soup. Không dùng `role` thừa khi thẻ đã có role ngầm. |
| 1.4.1 Use of Color | Không truyền đạt thông tin chỉ bằng màu (ví dụ trạng thái `active`/`archived` phải có chữ). |
| 1.4.3 Contrast (Minimum) | Chữ thường tỉ lệ tương phản ít nhất 4.5:1, chữ lớn ít nhất 3:1. |
| 1.4.11 Non-text Contrast | Viền nút, icon, focus indicator ít nhất 3:1. |
| 2.1.1 Keyboard | Mọi chức năng dùng được bằng bàn phím. Dùng `<button>`, không dùng `<span>` gắn click. |
| 2.4.3 / 2.4.7 Focus | Thứ tự focus hợp lý; luôn thấy focus (`:focus-visible`). |
| 2.4.11 Focus Not Obscured (Minimum) [mới ở 2.2] | Phần tử đang focus không bị che hoàn toàn. |
| 2.5.7 Dragging Movements [mới ở 2.2] | Thao tác kéo thả phải có cách thay thế bằng nhấp/bàn phím. |
| 2.5.8 Target Size (Minimum) [mới ở 2.2] | Vùng bấm tối thiểu 24×24 CSS px. |
| 3.2.6 Consistent Help [mới ở 2.2] | Chỗ trợ giúp (nếu có) đặt nhất quán giữa các trang. |
| 3.3.7 Redundant Entry [mới ở 2.2] | Không bắt nhập lại thông tin đã nhập trong cùng quy trình. |
| 3.3.8 Accessible Authentication (Minimum) [mới ở 2.2] | Không bắt giải bài toán nhận thức để đăng nhập. |
| 4.1.2 Name, Role, Value | Control có tên truy cập được (nhãn hiển thị hoặc `aria-label`). |
| 4.1.3 Status Messages | Thông báo trạng thái động dùng `role="status"` hoặc `aria-live`. |

Ghi chú thêm:
- Ưu tiên HTML gốc trước, ARIA là phương án cuối. ARIA sai còn tệ hơn không có.
- Nội dung động đổ vào DOM bằng `textContent`/`createTextNode` (an toàn XSS và đọc đúng với screen reader).
- Dùng `lang` trên `<html>` và tiêu đề trang (`<title>`) có nghĩa.
- Kiểm tra bằng DevTools Accessibility panel, tab bằng bàn phím, và ít nhất một công cụ tự động (Lighthouse hoặc axe). Công cụ tự động không bắt hết lỗi, vẫn cần kiểm tra tay.

### 8.2 Với tài liệu Markdown

- Tiêu đề phân cấp liên tục (H1 → H2 → H3), mỗi file đúng một H1.
- Link có văn bản mô tả đích đến, không dùng "bấm vào đây".
- Bảng có hàng tiêu đề; không dùng bảng để dàn trang.
- Khối code luôn ghi ngôn ngữ (` ```js `, ` ```ts `).
- Không dùng emoji hay màu để mang nghĩa duy nhất; trạng thái luôn có chữ (ví dụ "Cấm", "Đã sửa").
- Ảnh (ví dụ ảnh chụp DevTools) phải có văn bản thay thế mô tả nội dung: `![Mô tả cụ thể](đường-dẫn)`.
- Câu ngắn, ngôn ngữ rõ ràng, giải thích từ viết tắt lần đầu xuất hiện.

## 9. Quy tắc cá nhân [Cá nhân]

<!-- Bổ sung quy tắc của riêng bạn ở đây, rồi nhờ mình viết lại cho gọn. -->

- _(chưa có)_
