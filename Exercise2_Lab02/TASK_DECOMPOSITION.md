# Exercise 2 — Task Decomposition (bản nháp ghi chú)

> Trạng thái: **mới ghi lại thông tin đề bài**. Chưa chia WBS. Khi bắt đầu làm, chia task theo [project-rules](../docs/project-rules.md): mỗi task một sub-task, có bước verify.
> Kiến thức nền xem [Context](../docs/Context.md), mục 3.9 đến 3.11.

## 1. Thông tin chung

| Mục | Nội dung |
|---|---|
| Tên bài | Reactive State Machine & Delegation Hub |
| Hình thức | In-class Sprint 2, 40 phút |
| Mục tiêu | Tự cài `useState` bằng closure và gắn Event Delegation hub ở root |
| Ứng dụng | Task Manager phản ứng theo thời gian thực, có nút lọc (filter toggles) |
| Deliverable | `useState` tự viết, lịch sử Git atomic, luồng dữ liệu một chiều |

## 2. Ràng buộc

1. State chỉ đi một chiều: sự kiện gọi setter, setter cập nhật state, runtime re-render, UI cập nhật.
2. Sự kiện đi qua **một** listener ở root (delegation). Không gắn listener lên từng nút con.
3. Hook tuân thủ quy tắc call-order (không đặt trong `if`, vòng lặp, hàm lồng).
4. Task Manager phải có bộ lọc (ví dụ `ALL`, và ít nhất một trạng thái khác).

## 3. Commit bắt buộc (atomic, theo thứ tự)

1. `feat(state): implement stateStore and resetCursor engine`
2. `feat(state): implement reactive useState dispatcher`
3. `feat(events): attach root event delegation listener`
4. `feat(ui): assemble reactive todo application`

## 4. Checkpoint 2

- Thay đổi state qua giao diện (bấm nút).
- Xác nhận **không có listener mồ côi** gắn trên các nút con. Gợi ý cách kiểm: trong DevTools Console dùng `getEventListeners(nút)` phải rỗng, và panel Elements, tab Event Listeners chỉ thấy listener ở root.

Mã kiểm tra mẫu, đã chỉnh lại cú pháp (slide gốc bị vỡ):

```jsx
// checkpoint2-verify.js — Checkpoint 2 Audit
import { useState, renderApp } from './reactive-engine.js';

function TaskApp() {
  const [tasks, setTasks] = useState(['Review PR', 'Verify AST']);
  const [filter, setFilter] = useState('ALL');
  return (
    <main className="app-container">
      <header>
        <h2>Tasks: {tasks.length}</h2>
      </header>
      <button onClick={() => setTasks([...tasks, `Task ${Date.now()}`])}>
        Add Task
      </button>
    </main>
  );
}
// Verify: bấm nút thì state cập nhật và giao diện re-render
```

Cần lưu ý:
- File mẫu tên `reactive-engine.js`, export `useState` và `renderApp`.
- Mẫu có biến `filter`, `setFilter` nhưng chưa dùng; bài thật phải render nút lọc và danh sách đã lọc.
- Mẫu viết JSX trong file `.js`. Cần cấu hình bundler (Vite/esbuild) cho JSX, hoặc đặt tên `.jsx`.
- Heading trong mẫu bắt đầu từ `<h2>`. Với WCAG, trang nên có một `<h1>`; xem mục 6.

## 5. Điều kiện hoàn thành (checklist nghiệm thu)

- [ ] `stateStore` và `resetCursor` hoạt động; cursor reset trước mỗi lần render
- [ ] `useState` giữ giá trị giữa các lần render, hỗ trợ updater dạng hàm (`setX(prev => ...)`)
- [ ] Chỉ re-render khi giá trị đổi thật (`Object.is`)
- [ ] Delegation hub: một listener cho mỗi loại sự kiện ở root; `renderToDOM` lưu VNode vào DOM node để hub tra handler
- [ ] Task Manager có thêm task và lọc task, cập nhật ngay
- [ ] DevTools: không có listener trên nút con
- [ ] Đúng 4 commit với đúng message và đúng thứ tự
- [ ] Prompt log của bài đã export vào `docs/prompt_logs/`

## 6. Ghi chú WCAG 2.2 AA cho Task Manager

- Nút lọc là `<button>`; trạng thái đang chọn dùng `aria-pressed` (hoặc nhóm radio), không chỉ đổi màu.
- Khi thêm task, thông báo cho trình đọc màn hình bằng vùng `role="status"` (tiêu chí 4.1.3).
- Danh sách task dùng `<ul>`/`<li>`; mỗi `<li>` có `key` là ID bền vững, không dùng index hay `Math.random()`.
- Có một `<h1>` cho trang; nút có vùng bấm tối thiểu 24×24 CSS px (2.5.8).

## 7. Câu hỏi còn mở

- Các giá trị của `filter` gồm những gì (`ALL`, `ACTIVE`, `DONE`)? Task có thể đánh dấu hoàn thành không? Slide chưa nói.
- Re-render là đồng bộ hay gom batch? (Nhắc: câu hỏi bảo vệ trực tiếp có thể yêu cầu đổi sang batch microtask queue; xem [Context](../docs/Context.md) mục 3.15.)
- Task nên là chuỗi hay object có `id`? Chuỗi đơn giản hơn nhưng không có key bền vững để làm key.
