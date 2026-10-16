# Exercise 2 — Task Decomposition

> Bối cảnh: [Context](../docs/Context.md) (mục 3.7, 3.10, 3.11). Quy tắc: [project-rules](../docs/project-rules.md) và [Agents](../Agents.md).
> Quy ước: tick `[x]` chỉ khi task đã chạy lệnh kiểm chứng và thấy output thật. Mỗi lượt làm đúng một task.

## 1. Thông tin chung

| Mục | Nội dung |
|---|---|
| Tên bài | Reactive State Machine & Delegation Hub |
| Hình thức | In-class Sprint 2, 40 phút |
| Mục tiêu | Tự cài `useState` bằng closure (cursor + mảng state) và một event delegation hub ở root |
| Ứng dụng | Task Manager phản ứng theo thời gian thực, có nút lọc `ALL` / `ACTIVE` / `DONE` |
| Ngôn ngữ | JavaScript thuần, contract bằng JSDoc, bật `// @ts-check` (giữ như Exercise 1) |
| File engine | `Exercise2_Lab02/reactive-engine.js` (đề import `./reactive-engine.js`) |
| File app | `Exercise2_Lab02/task-app.js` và `Exercise2_Lab02/index.html` |
| Test | Vitest + jsdom: `reactive-engine.test.js`, `task-app.test.js` |
| Luồng dữ liệu | click → hub → handler → setter → cập nhật state → re-render → DOM |

## 2. Ràng buộc từ đề

1. State đi một chiều: sự kiện gọi setter, setter cập nhật state, runtime re-render, UI cập nhật. UI không ghi ngược vào state.
2. Sự kiện đi qua **một** listener cho mỗi loại event ở root. Không gắn listener lên nút con.
3. Hook tuân thủ call-order: không đặt trong `if`, vòng lặp, hàm lồng.
4. Task Manager có bộ lọc.
5. Git: đúng 4 commit, theo thứ tự:
   1. `feat(state): implement stateStore and resetCursor engine`
   2. `feat(state): implement reactive useState dispatcher`
   3. `feat(events): attach root event delegation listener`
   4. `feat(ui): assemble reactive todo application`

## 3. Quyết định thiết kế (mỗi quyết định ở một chỗ)

| Quyết định | Chốt | Lý do |
|---|---|---|
| Viết app bằng gì | Gọi `createElement` trực tiếp, không JSX | Không cài thêm dependency, không Babel, dễ giải thích khi bảo vệ. Mẫu JSX của đề chỉ là minh hoạ |
| Nơi giữ state | Hai biến module trong `reactive-engine.js`: `stateStore` (mảng) và `cursor` (số) | Đúng mô hình Context 3.10; sửa ở một chỗ |
| Phân biệt "chưa khởi tạo" | So `cursor >= stateStore.length`, không dùng `??` | `null`/`undefined` là state hợp lệ; `??` sẽ khởi tạo lại mỗi lần (Context mục 7) |
| Chỗ gọi `resetCursor()` | Duy nhất trong `renderApp`, ngay trước khi gọi component gốc | Nếu quên, cursor tăng mãi và state lệch |
| Setter | Nhận giá trị hoặc hàm `prev => next`; bỏ qua nếu `Object.is(prev, next)` | Đúng Context 3.10 bước 3 và 4 |
| Render | Đồng bộ ở commit 2. Batch bằng `queueMicrotask` là phần mở rộng (task C-extra) | Đề tài liệu nhắc thầy có thể bắt đổi sang batch khi bảo vệ |
| Cách cập nhật DOM | `root.replaceChildren(renderToDOM(App()))`, chưa diff | Diff/patch thuộc Exercise 3 |
| Tên event của hub | Bảng `click`→`onClick`, `input`→`onInput`, `keydown`→`onKeydown` trong một hàm `handlerPropOf` | Đổi quy ước tên ở một chỗ |
| Hub lưu VNode | `renderToDOM` gán `dom._vnode = vNode`; hub đi từ `event.target` lên root, gặp node có handler thì gọi và dừng | Context 3.11 |
| `mini-react.js` | **Sao chép** từ Exercise 1 vào `Exercise2_Lab02/mini-react.js`, sửa bản sao ở commit 3 | Bỏ `addEventListener` trực tiếp sẽ làm hỏng test B3 của Exercise 1; giữ Exercise 1 nguyên trạng để nộp |
| Hình dạng task | `{ id: string, title: string, done: boolean }`, `id` từ `crypto.randomUUID()` | `id` bền vững làm `key` cho `<li>`; không dùng index hay `Math.random()` |
| Nhập tiêu đề | `<input>` không điều khiển (đọc `value` trong handler của nút), Enter gửi qua `keydown` + `e.key` | Tránh re-render mỗi phím gõ làm mất caret |
| Giữ focus sau re-render | Đọc `document.activeElement.id` trước khi thay cây, gọi `.focus()` sau khi thay | `replaceChildren` huỷ nút đang focus; người dùng bàn phím mất vị trí (WCAG 2.4.3). Đọc DOM và ghi DOM tách pha |

## 4. WBS

Mỗi task là một lượt làm riêng (Slice → Contract → Generate → Verify). Test đi cùng module của nó.

### Nhóm A — Commit 1: `feat(state): implement stateStore and resetCursor engine`

- [ ] A0 Setup: sao chép `Exercise1_Lab02/mini-react.js` thành `Exercise2_Lab02/mini-react.js` (chưa sửa gì); kiểm tra `vitest.config.js` đã quét thư mục `Exercise2_Lab02`. Không cài thêm dependency.
- [ ] A1 Contract trong `reactive-engine.js`: JSDoc cho `StateStore`, `Setter<T>`, `UseStateResult<T>`; khai báo `stateStore`, `cursor`; chữ ký `resetCursor`, `useState`, `setRenderer`, `renderApp` (chưa có thân hàm).
  - Invariant ghi trong comment: `0 <= cursor <= stateStore.length`; mỗi lần render bắt đầu với `cursor === 0`.
- [ ] A2 `resetCursor()`: đặt `cursor = 0`, không xoá `stateStore`. Test: gọi sau khi cursor đã tăng thì về 0; `stateStore` giữ nguyên.
- [ ] A3 Hàm nội bộ `claimSlot(initialValue)`: nếu `cursor >= stateStore.length` thì đẩy giá trị đầu, trả về `index` rồi tăng `cursor`. Test: lần gọi đầu khởi tạo, lần sau (sau `resetCursor`) giữ giá trị cũ, kể cả khi giá trị là `null` hoặc `undefined`.
- [ ] A4 Verify và commit 1: chạy `npm test` và kiểm tra không còn `var`/biến global ngầm; xem `git diff`; tick WBS; commit đúng message.

### Nhóm B — Commit 2: `feat(state): implement reactive useState dispatcher`

- [ ] B1 `useState(initialValue)` bản đọc: dùng `claimSlot`, trả `[value, setter]` với `value` lấy từ `stateStore[index]`. Test: giữ giá trị qua nhiều lần render; hai hook trả đúng giá trị theo thứ tự gọi.
- [ ] B2 Setter có closure trên `index` (không phải `cursor` lúc gọi): ghi `stateStore[index]`. Test: gọi setter sau khi cursor đã đổi vẫn ghi đúng ô.
- [ ] B3 Setter nhận hàm: `typeof next === 'function' ? next(prev) : next`. Test: `setCount(c => c + 1)` hai lần liên tiếp cho kết quả cộng dồn.
- [ ] B4 Bỏ qua khi không đổi: `Object.is(prev, next)` thì không gọi renderer. Test: renderer là `vi.fn()`, setter cùng giá trị gọi 0 lần; giá trị khác gọi 1 lần; `NaN` với `NaN` coi là không đổi.
- [ ] B5 `setRenderer(fn)` và `renderApp(component, container)`: lưu component + container, gọi `resetCursor()`, dựng cây bằng `renderToDOM`, `container.replaceChildren(...)`. Setter gọi lại `renderApp`. Test: component đếm với nút giả, gọi setter thì DOM cập nhật.
- [ ] B6 Test quy tắc Hooks (tài liệu hoá, không cố ngăn): component gọi hook trong `if` làm lệch cursor ở render thứ hai (mô phỏng `BuggyProfile` của Context 3.10). Mục đích là để giải thích khi bảo vệ.
- [ ] B7 Verify và commit 2: `npm test`, xem `git diff`, kiểm tra không `var`/`innerHTML`, tick WBS, commit đúng message.

### Nhóm C — Commit 3: `feat(events): attach root event delegation listener`

- [ ] C1 `renderToDOM` (bản sao ở Exercise 2) gán `dom._vnode = vNode` cho element; text node không cần. Test: node sau render có `_vnode` trỏ đúng VNode.
- [ ] C2 Bỏ `addEventListener` trực tiếp trong `applyProp`: prop `on*` bị bỏ qua khi dựng DOM (handler nằm trong `_vnode.props`). Cập nhật test B3 của bản sao cho khớp. Test: nút có `onClick` không có listener nào gắn lên chính nó.
- [ ] C3 `handlerPropOf(eventType)` và `findHandler(target, root, eventType)`: đi từ `target` lên `root` qua `parentElement`, trả handler đầu tiên tìm được. Test: click vào `<span>` bên trong `<button>` vẫn tìm ra `onClick` của button; gặp root thì trả `null`.
- [ ] C4 `setupEventDelegation(root)`: đúng một `addEventListener` cho mỗi loại `click`, `input`, `keydown`; gọi handler rồi dừng. Test: `vi.spyOn(root, 'addEventListener')` được gọi đúng 3 lần; click gọi đúng handler một lần.
- [ ] C5 Test bàn phím: `keydown` với `e.key === 'Enter'` tới `onKeydown`; không có `keypress` và `keyCode` ở bất kỳ đâu (`grep`).
- [ ] C6 Test "không listener mồ côi" (thay cho `getEventListeners`, vốn chỉ có trong DevTools): spy `Element.prototype.addEventListener` khi mount cây có 3 nút; chỉ `root` xuất hiện trong danh sách `this`.
- [ ] C7 Verify và commit 3: `npm test`, xem `git diff`, tick WBS, commit đúng message.

### Nhóm D — Commit 4: `feat(ui): assemble reactive todo application`

- [ ] D1 `TaskApp` bản tối thiểu trong `task-app.js`: `useState` cho `tasks` (mảng object) và `filter` (`'ALL'`); `<main>`, `<header>`, `<h1>`, `<h2>Tasks: n</h2>`. Test: render lần đầu hiện số task đúng.
- [ ] D2 Thêm task: `<input id="task-title">` (có `<label>`), nút "Add Task". Handler đọc `value`, bỏ qua nếu rỗng sau `trim`, gọi `setTasks(prev => [...prev, {id, title, done:false}])`. Enter trong input cũng thêm (qua `onKeydown` + `e.key`). Test: thêm task, rỗng bị bỏ qua, Enter hoạt động.
- [ ] D3 Danh sách: `<ul>` với `<li key={task.id}>`; mỗi task có nút "Done"/"Undo" gọi `setTasks(prev => prev.map(...))`. Test: bấm nút đổi `done` đúng task, các task khác không đổi.
- [ ] D4 Bộ lọc: ba `<button>` `ALL`/`ACTIVE`/`DONE`, `aria-pressed` cho nút đang chọn; danh sách hiển thị theo `filter` qua hàm thuần `visibleTasks(tasks, filter)`. Test: hàm thuần có test riêng; click nút đổi danh sách.
- [ ] D5 Giữ focus sau re-render: trong `renderApp`, pha đọc lấy `document.activeElement?.id`, pha ghi sau `replaceChildren` gọi `getElementById(id)?.focus()`. Mọi nút/input tương tác cần `id` ổn định (ví dụ `filter-all`, `task-title`, `toggle-<task.id>`). Test: sau khi bấm nút lọc, `document.activeElement` vẫn là nút lọc đó.
- [ ] D6 Thông báo cho trình đọc màn hình: vùng `role="status"` cập nhật khi thêm task ("Đã thêm: ..."). Đặt vùng này bên ngoài cây bị thay (trong `index.html`) vì vùng live bị tạo lại mỗi lần render thường không được đọc. Test: nội dung vùng đổi sau khi thêm. Việc có thật sự được đọc hay không cần kiểm tay với trình đọc màn hình, chưa thể khẳng định bằng test tự động.
- [ ] D7 `index.html`: `<main id="app">` bọc bởi trang có `<h1>` duy nhất, gọi `setupEventDelegation(root)` rồi `renderApp(TaskApp, root)`; CSS tối thiểu cho focus nhìn thấy, vùng bấm ít nhất 24×24 CSS px, tương phản chữ 4.5:1. Chạy qua HTTP cục bộ vì ES module không chạy từ `file://`.
- [ ] D8 Checkpoint 2 (chạy tay, ghi kết quả thật):
  1. Bấm Add Task, danh sách và số đếm đổi ngay.
  2. Console: `getEventListeners(document.querySelector('button'))` phải rỗng; Elements → Event Listeners chỉ thấy `click`, `input`, `keydown` ở root.
  3. Lưu ảnh chụp vào `Exercise2_Lab02/evidence/` (nhúng kèm alt text).
- [ ] D9 Export prompt log vào `docs/prompt_logs/`; `npm test` toàn bộ; xem `git diff`; tick WBS; commit 4 đúng message.

### Phần mở rộng (chỉ làm khi cần, hoặc khi thầy yêu cầu lúc bảo vệ)

- [ ] C-extra Batch render: setter đánh dấu "dirty" và gọi `queueMicrotask(flush)` một lần cho nhiều setter liên tiếp. Test: ba setter trong cùng một tick chỉ render một lần. Không nằm trong 4 commit bắt buộc; nếu làm trước khi nộp thì gộp vào commit 2 và ghi chú lý do.

## 5. Điều kiện hoàn thành (checklist nghiệm thu)

- [ ] `stateStore` và `resetCursor` hoạt động; cursor reset trước mỗi lần render
- [ ] `useState` giữ giá trị giữa các lần render, hỗ trợ `setX(prev => ...)`
- [ ] Chỉ re-render khi giá trị đổi thật (`Object.is`)
- [ ] Hub: một listener cho mỗi loại sự kiện ở root; `renderToDOM` lưu VNode vào DOM node
- [ ] Task Manager thêm task, đánh dấu xong và lọc, cập nhật ngay
- [ ] Mỗi `<li>` có `key` là `task.id`
- [ ] DevTools: không có listener trên nút con (kèm ảnh)
- [ ] `npm test` pass, dán output thật
- [ ] Không có `var`, `innerHTML`, `keypress`, `keyCode`, inline handler (đã `grep`)
- [ ] Đúng 4 commit, đúng message và thứ tự ở mục 2
- [ ] Prompt log đã export vào `docs/prompt_logs/`

## 6. Kiểm tra WCAG 2.2 AA (ghi rõ đã kiểm gì, bằng cách nào)

| Tiêu chí | Cách kiểm | Trạng thái |
|---|---|---|
| 1.3.1 Cấu trúc ngữ nghĩa | Test kiểm thẻ `main`, `header`, `ul`, `li`, `button`, `label`; không `div` | Chưa làm |
| 1.4.1 Không chỉ dùng màu | `aria-pressed` trên nút lọc, nhìn bằng mắt thêm dấu hiệu không phải màu | Chưa làm |
| 1.4.3 Tương phản 4.5:1 | Đo bằng DevTools hoặc công cụ tương phản | Chưa làm |
| 2.1.1 Bàn phím | Đi hết app bằng Tab, Enter, Space, không dùng chuột | Chưa làm |
| 2.4.3 Thứ tự focus | Test D5 + kiểm tay | Chưa làm |
| 2.4.7 Focus nhìn thấy | Nhìn bằng mắt | Chưa làm |
| 2.5.8 Vùng bấm 24×24 | Đo trong DevTools | Chưa làm |
| 4.1.2 Tên truy cập được | Mọi nút/input có tên (nhìn Accessibility tree) | Chưa làm |
| 4.1.3 Thông báo trạng thái | Test D6 + kiểm tay với trình đọc màn hình | Chưa làm |

Không ghi "đạt WCAG" cho tới khi cột trạng thái chuyển sang "Đã kiểm" kèm cách kiểm.

## 7. Rủi ro và điểm cần giải thích khi bảo vệ

- **Closure trên `index`, không phải `cursor`:** setter chạy sau khi cursor đã đổi; nếu closure đọc `cursor` lúc gọi thì ghi nhầm ô. Đây là câu hỏi dễ bị hỏi.
- **Gọi hook có điều kiện làm lệch state:** B6 là ví dụ sống.
- **Thay cả cây mất focus và trạng thái cục bộ của DOM:** D5 xử lý focus; trạng thái khác (vị trí cuộn, vùng chọn) chưa xử lý, thuộc lý do cần diff ở Exercise 3.
- **Bỏ `addEventListener` làm Exercise 1 và Exercise 2 khác nhau:** vì vậy dùng bản sao `mini-react.js`.
- **Test jsdom không có `getEventListeners`:** C6 dùng spy làm bằng chứng thay thế; vẫn phải kiểm tay bằng DevTools ở D8.

## 8. Câu hỏi còn mở

| Câu hỏi | Mặc định đang dùng | Trạng thái |
|---|---|---|
| Sao chép `mini-react.js` hay sửa chung với Exercise 1 | Sao chép vào `Exercise2_Lab02/` | Giả định, chờ xác nhận |
| Cách chạy HTTP cục bộ cho `index.html` | Một server tĩnh sẵn có (chưa chọn); không cài dependency mới nếu chưa hỏi | Cần chọn |
| "Đúng 4 commit" có tính commit setup (A0) và export prompt log (D9) không | Setup vào commit 1, prompt log vào commit 4 | Giả định, mâu thuẫn nhẹ với Agents.md mục 5 |
| Batch render | Đồng bộ, batch là phần mở rộng | Giả định |
| Kiểm tay với trình đọc màn hình (D6) | Bạn tự kiểm; mình không khẳng định thay | Cần bạn thực hiện |
