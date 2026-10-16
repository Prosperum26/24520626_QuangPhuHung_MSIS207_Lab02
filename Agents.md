# Agents.md — Hướng dẫn cho AI agent (Lab 02)

Đọc [docs/Context.md](docs/Context.md) và [docs/project-rules.md](docs/project-rules.md) trước. File này là **luật làm việc**: AI sinh code, con người kiểm chứng. Không chấp nhận output chưa kiểm chứng vào production.

## 1. Nguyên tắc

1. **Atomic**: mỗi lượt chỉ làm **một** sub-task trong `TASK_DECOMPOSITION.md` của bài đang làm (nằm trong folder của bài đó). Không gộp >1 task, không "dump" cả engine một phát.
2. **Contract-first**: có interface/type trước, rồi mới viết implementation.
3. **Verify-before-claim**: chỉ nói "xong" khi đã chạy test/lệnh kiểm chứng và thấy output.
4. **Giải thích được**: người dùng phải hiểu code; thêm lý do ngắn khi chọn thiết kế (đây là bài học, không chỉ là nộp bài).
5. **Đúng scope**: Tier 1 thì cài đặt; Tier 2 chỉ giải thích; Tier 3 không làm (xem Context.md §2).

## 2. Quy trình mỗi task (4 giai đoạn)

1. **Slice** — xác nhận task thuộc dòng nào của WBS.
2. **Contract** — viết/cập nhật type + invariant.
3. **Generate** — viết đúng một hàm/module.
4. **Verify** — viết/chạy test, xem `git diff`, kiểm tra bằng DevTools nếu liên quan hiệu năng; báo kết quả thật (cả khi fail).

Trước khi bắt đầu, nếu yêu cầu mơ hồ hoặc phải đoán, **hỏi một câu ngắn** thay vì tự bịa.

## 3. Quy tắc code (bắt buộc)

**Cấm:**
- `var`, biến global ngầm.
- `keypress`, `e.keyCode`.
- `innerHTML` (và `outerHTML`, `insertAdjacentHTML`) với dữ liệu động.
- Inline handler (`onclick="..."`).
- Babel standalone; mọi thư viện UI có sẵn (React, Preact…) trong phần engine Tier 1.
- Dùng index mảng làm `key`.
- Gọi hook có điều kiện/trong vòng lặp.

**Phải:**
- `const`/`let`, ES modules, strict typing (không `any` trừ chỗ type contract đã cho phép).
- `keydown` + `e.key`/`e.code`; event delegation tập trung ở một hub.
- Dựng DOM bằng `createElement`/`createTextNode`/`textContent`/`replaceChildren`.
- VNode bất biến (`Object.freeze`), `props` luôn là object, text luôn là `TEXT_ELEMENT`.
- Đọc DOM và ghi DOM tách pha (tránh layout thrashing).
- Hàm nhỏ, một trách nhiệm, tên rõ nghĩa; comment chỉ khi giải thích *vì sao*.

## 4. Kiểm chứng

- Test runner: Vitest + jsdom (giả định; xem Context.md §6). Mỗi module Tier 1 có test đi kèm.
- Test tối thiểu:
  - `createElement`: bọc text, lọc `null/false`, flatten lồng nhau, `props` null, frozen.
  - `renderToDOM`: text vs element, gán prop, đệ quy children, function component.
  - Chống XSS: chuỗi `<img onerror=...>` hiển thị như text, không tạo element.
  - `useState`: giữ giá trị qua render, nhiều hook theo thứ tự, cursor reset.
  - Event delegation: handler đúng target, `keydown` + `e.key`.
  - Diff: đổi type → `REPLACE`, text → `TEXT`/`NOOP`, reorder theo key, **xoá item đầu không làm rò state** (regression cho bug index-key).
- Trước khi báo hoàn thành: chạy test + typecheck + lint (nếu có) và dán kết quả thật.

## 5. Git

- Mỗi task xong = **một commit atomic**, Conventional Commits, ví dụ `feat(core): implement vdom engine`, `test(core): cover createElement`, `docs: add context and agents`.
- Xem `git diff` trước khi commit; không commit file không liên quan.
- Chỉ commit/push khi người dùng yêu cầu. Không `--force`, `--no-verify`.
- Cuối commit message thêm: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## 6. Artifact cần giữ

| File | Vai trò |
|---|---|
| [docs/Context.md](docs/Context.md) | Bối cảnh, phạm vi, kiến thức |
| [Agents.md](Agents.md) | Luật cho AI (file này) |
| [docs/project-rules.md](docs/project-rules.md) | Quy tắc dự án (thầy + cá nhân) |
| [docs/AI_FAILURE_AUDIT.md](docs/AI_FAILURE_AUDIT.md) | Báo cáo 3 lỗi AI (người dùng điền, AI chỉ viết lại) |
| `docs/prompt_logs/` | Export session AI cho mỗi lần code mỗi bài |
| `<folder bài>/TASK_DECOMPOSITION.md` | WBS riêng từng bài, tick `[x]` khi task xong và đã verify |

Với `AI_FAILURE_AUDIT.md`: nội dung do người dùng viết. AI chỉ chỉnh câu chữ/định dạng, **không bịa** bằng chứng, prompt hay kết quả DevTools.

WBS khởi điểm (từ slide), mở rộng khi cần:

```markdown
- [ ] 1.1 Define VNode & Props interfaces (contract)
- [ ] 1.2 createTextElement
- [ ] 1.3 createElement (flatten, filter, map, freeze)
- [ ] 1.4 renderToDOM đệ quy + typeguard
- [ ] 1.5 Commit: feat(core): implement vdom engine
- [ ] 2.1 Event delegation hub
- [ ] 2.2 useState (cursor + closure)
- [ ] 3.1 diff(old, new) + patch types
- [ ] 3.2 Keyed children reconciliation
```

## 7. Cách trả lời người dùng

- Tiếng Việt, thuật ngữ kỹ thuật giữ tiếng Anh. Ngắn gọn, nói thẳng kết quả.
- Nêu rõ đã verify gì và chưa verify gì. Nếu test fail thì nói và dán output.
- Phát hiện slide/đề sai hoặc mơ hồ (xem Context.md §7) thì báo, đừng im lặng chép theo.
- Việc ngoài scope hoặc khó đảo ngược (xoá file, đổi stack, cài dependency lớn): hỏi trước.
