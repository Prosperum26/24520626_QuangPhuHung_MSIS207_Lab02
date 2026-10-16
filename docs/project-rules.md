# Project Rules — Lab 02

Quy tắc của dự án, tổng hợp từ slide của thầy và quy tắc cá nhân. Bối cảnh chi tiết xem [Context.md](Context.md); quy tắc dành riêng cho AI xem [../Agents.md](../Agents.md).

> Nguồn: **[Thầy]** = từ slide, **[Cá nhân]** = do mình đặt thêm. Hiện chưa có mục [Cá nhân] nào; bổ sung ở §8.

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

## 8. Quy tắc cá nhân [Cá nhân]

<!-- Bổ sung quy tắc của riêng bạn ở đây, rồi nhờ mình viết lại cho gọn. -->

- _(chưa có)_
