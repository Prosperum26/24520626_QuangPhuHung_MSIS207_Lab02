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
| Nhập tiêu đề | `<input>` không điều khiển (đọc `value` trong handler của nút), Enter gửi qua `keydown` + `e.key` và bỏ qua khi `isComposing` | Tránh re-render mỗi phím gõ: làm mất caret và phá bộ gõ IME (gõ tiếng Việt). Đổi lại, chữ đang gõ mất khi control khác gây re-render (có test ghi nhận) |
| Giữ focus sau re-render | `readFocusedId` (pha đọc) trước và `writeFocus` (pha ghi) sau `replaceChildren`, trong `mount` của `reactive-engine.js` | `replaceChildren` huỷ nút đang focus; người dùng bàn phím mất vị trí (WCAG 2.4.3). Đọc DOM và ghi DOM tách pha |
| Focus khi phần tử bị xoá | `recoverLostFocus` đưa focus về `<h2 id="task-count" tabindex="-1">` | Phát hiện bằng trình duyệt thật: sau Delete focus rơi về `<body>`. Không dùng ô nhập để khỏi bật bàn phím ảo |
| Vị trí vùng status | `<p id="status" role="status">` trong `index.html`, ngoài `#app`; `announce()` ghi bằng `textContent` | Vùng live bị tạo lại mỗi render thường không được đọc ra |

## 4. WBS

Mỗi task là một lượt làm riêng (Slice → Contract → Generate → Verify). Test đi cùng module của nó.

### Nhóm A — Commit 1: `feat(state): implement stateStore and resetCursor engine`

- [x] A0 Setup: sao chép `Exercise1_Lab02/mini-react.js` thành `Exercise2_Lab02/mini-react.js` (chưa sửa gì); kiểm tra `vitest.config.js` đã quét thư mục `Exercise2_Lab02`. Không cài thêm dependency.
- [x] A1 Contract trong `reactive-engine.js`: JSDoc cho `StateStore`, `Setter<T>`, `UseStateResult<T>`; khai báo `stateStore`, `cursor`; chữ ký `resetCursor`, `useState`, `setRenderer`, `renderApp` (chưa có thân hàm).
  - Invariant ghi trong comment: `0 <= cursor <= stateStore.length`; mỗi lần render bắt đầu với `cursor === 0`.
- [x] A2 `resetCursor()`: đặt `cursor = 0`, không xoá `stateStore`. Test: gọi sau khi cursor đã tăng thì về 0; `stateStore` giữ nguyên.
- [x] A3 Hàm nội bộ `claimSlot(initialValue)`: nếu `cursor >= stateStore.length` thì đẩy giá trị đầu, trả về `index` rồi tăng `cursor`. Test: lần gọi đầu khởi tạo, lần sau (sau `resetCursor`) giữ giá trị cũ, kể cả khi giá trị là `null` hoặc `undefined`.
- [x] A4 Verify và commit 1: chạy `npm test` và kiểm tra không còn `var`/biến global ngầm; xem `git diff`; tick WBS; commit đúng message.

### Nhóm B — Commit 2: `feat(state): implement reactive useState dispatcher`

- [x] B1 `useState(initialValue)` bản đọc: dùng `claimSlot`, trả `[value, setter]` với `value` lấy từ `stateStore[index]`. Test: giữ giá trị qua nhiều lần render; hai hook trả đúng giá trị theo thứ tự gọi.
- [x] B2 Setter có closure trên `index` (không phải `cursor` lúc gọi): ghi `stateStore[index]`. Test: gọi setter sau khi cursor đã đổi vẫn ghi đúng ô.
- [x] B3 Setter nhận hàm: `typeof next === 'function' ? next(prev) : next`. Test: `setCount(c => c + 1)` hai lần liên tiếp cho kết quả cộng dồn.
- [x] B4 Bỏ qua khi không đổi: `Object.is(prev, next)` thì không gọi renderer. Test: renderer là `vi.fn()`, setter cùng giá trị gọi 0 lần; giá trị khác gọi 1 lần; `NaN` với `NaN` coi là không đổi.
- [x] B5 `setRenderer(fn)` và `renderApp(component, container)`: lưu component + container, gọi `resetCursor()`, dựng cây bằng `renderToDOM`, `container.replaceChildren(...)`. Setter gọi lại `renderApp`. Test: component đếm với nút giả, gọi setter thì DOM cập nhật.
- [x] B6 Test quy tắc Hooks (tài liệu hoá, không cố ngăn): component gọi hook trong `if` làm lệch cursor ở render thứ hai (mô phỏng `BuggyProfile` của Context 3.10). Mục đích là để giải thích khi bảo vệ.
- [x] B7 Verify và commit 2: `npm test`, xem `git diff`, kiểm tra không `var`/`innerHTML`, tick WBS, commit đúng message.

### Nhóm C — Commit 3: `feat(events): attach root event delegation listener`

- [x] C1 `renderToDOM` (bản sao ở Exercise 2) gán `dom._vnode = vNode` cho element; text node không cần. Test: node sau render có `_vnode` trỏ đúng VNode.
- [x] C2 Bỏ `addEventListener` trực tiếp trong `applyProp`: prop `on*` bị bỏ qua khi dựng DOM (handler nằm trong `_vnode.props`). Cập nhật test B3 của bản sao cho khớp. Test: nút có `onClick` không có listener nào gắn lên chính nó.
- [x] C3 `handlerPropOf(eventType)` và `findHandler(target, root, eventType)`: đi từ `target` lên `root` qua `parentElement`, trả handler đầu tiên tìm được. Test: click vào `<span>` bên trong `<button>` vẫn tìm ra `onClick` của button; gặp root thì trả `null`.
- [x] C4 `setupEventDelegation(root)`: đúng một `addEventListener` cho mỗi loại `click`, `input`, `keydown`; gọi handler rồi dừng. Test: `vi.spyOn(root, 'addEventListener')` được gọi đúng 3 lần; click gọi đúng handler một lần.
- [x] C5 Test bàn phím: `keydown` với `e.key === 'Enter'` tới `onKeydown`; không có `keypress` và `keyCode` ở bất kỳ đâu (`grep`).
- [x] C6 Test "không listener mồ côi" (thay cho `getEventListeners`, vốn chỉ có trong DevTools): spy `Element.prototype.addEventListener` khi mount cây có 3 nút; chỉ `root` xuất hiện trong danh sách `this`.
- [x] C7 Verify và commit 3: `npm test`, xem `git diff`, tick WBS, commit đúng message.

### Nhóm D — Commit 4: `feat(ui): assemble reactive todo application`

- [x] D1 `TaskApp` trong `task-app.js`: `useState` cho `tasks` (mảng object, seed `seed-1`, `seed-2`) và `filter` (`'ALL'`); `<section>` + `<header>` + `<h1>` + `<h2>Tasks: n</h2>`. Test: render lần đầu hiện số task đúng.
  - Lệch kế hoạch: `<main>` nằm trong `index.html` (bọc `#app` và vùng status), không nằm trong `TaskApp`, để tránh hai `<main>` lồng nhau.
- [x] D2 Thêm task: `<input id="task-title">` (có `<label>`), nút "Add Task". Handler đọc `value`, bỏ qua nếu rỗng sau `trim` (và báo qua status), gọi `setTasks(prev => [...prev, {id: crypto.randomUUID(), title, done:false}])`. Enter trong input cũng thêm (qua `onKeydown` + `e.key`, bỏ qua `isComposing`). Test: thêm, rỗng, cắt khoảng trắng, Enter, IME, XSS.
- [x] D3 Danh sách: `<ul>` với `<li key={task.id}>`; mỗi task có nút "Mark done"/"Mark not done" và "Delete" (xoá task thêm theo yêu cầu, không có trong bản kế hoạch đầu). Test: đổi `done` đúng task, xoá đúng task, danh sách trống hiện thông báo, `key` là `task.id`.
- [x] D4 Bộ lọc: ba `<button>` `ALL`/`ACTIVE`/`DONE`, `aria-pressed` ("true"/"false" dạng chuỗi) cho nút đang chọn; danh sách hiển thị qua hàm thuần `visibleTasks(tasks, filter)`. Test: hàm thuần có test riêng; click nút đổi danh sách.
- [x] D5 Giữ focus sau re-render: `mount` trong `reactive-engine.js` đọc id phần tử focus trước, trả focus sau `replaceChildren`. Mọi control có `id` ổn định (`filter-all`, `task-title`, `toggle-<task.id>`...). Nếu phần tử bị xoá khỏi cây thì `recoverLostFocus` đưa focus về `#task-count`. Test: nút lọc, ô nhập, nút toggle giữ focus; xoá và toggle-trong-bộ-lọc đưa focus về tiêu đề đếm. Đã thử phá (bỏ `writeFocus`): 3 test focus fail đúng như kỳ vọng.
- [x] D6 Thông báo cho trình đọc màn hình: vùng `role="status"` nằm ngoài cây bị thay (trong `index.html`), cập nhật qua `announce()` khi thêm, xoá, toggle, lọc. Test: cùng một phần tử `#status` sống qua các lần render, nội dung đổi đúng. Việc trình đọc màn hình có đọc ra hay không chưa kiểm (xem mục 6).
- [x] D7 `index.html`, `main.js`, `style.css`: `<main>` bọc `#app` và `#status`; `main.js` gọi `setupEventDelegation(root)` rồi `renderApp(TaskApp, root)`; CSS có `:focus-visible`, vùng bấm tối thiểu 2.5rem, tương phản đo ở mục 6. Chạy qua `python -m http.server` vì ES module không chạy từ `file://`. Test: `main.test.js`.
- [ ] D8 Checkpoint 2 (kiểm trong Edge thật qua Chrome DevTools Protocol, sự kiện chuột và phím thật):
  1. Bấm Add Task và Enter: danh sách, số đếm đổi ngay. Đã kiểm.
  2. `DOMDebugger.getEventListeners` (cùng nguồn dữ liệu với `getEventListeners` trong Console): 12 nút, ô nhập và `<li>` đều rỗng; `#app` có đúng `click`, `input`, `keydown`; `document` và `<main>` rỗng. Đã kiểm. Kết quả lưu ở `evidence/browser-audit.json`.
  3. Ảnh chụp trang lưu ở `evidence/task-manager.png`. Còn thiếu ảnh panel Elements > Event Listeners thật, cần tự chụp bằng DevTools (giống mục B7 của Exercise 1), nên chưa tick.
- [ ] D9 Export prompt log vào `docs/prompt_logs/` (việc của bạn: AI không xuất được phiên làm việc của chính nó); `npm test` toàn bộ; xem `git diff`; tick WBS; commit 4 đúng message. Đã xong: `npm test`, `git diff`, commit. Chưa xong: prompt log.

### Phần mở rộng (chỉ làm khi cần, hoặc khi thầy yêu cầu lúc bảo vệ)

- [ ] C-extra Batch render: setter đánh dấu "dirty" và gọi `queueMicrotask(flush)` một lần cho nhiều setter liên tiếp. Test: ba setter trong cùng một tick chỉ render một lần. Không nằm trong 4 commit bắt buộc; nếu làm trước khi nộp thì gộp vào commit 2 và ghi chú lý do.

## 5. Điều kiện hoàn thành (checklist nghiệm thu)

- [x] `stateStore` và `resetCursor` hoạt động; cursor reset trước mỗi lần render
- [x] `useState` giữ giá trị giữa các lần render, hỗ trợ `setX(prev => ...)`
- [x] Chỉ re-render khi giá trị đổi thật (`Object.is`)
- [x] Hub: một listener cho mỗi loại sự kiện ở root; `renderToDOM` lưu VNode vào DOM node
- [x] Task Manager thêm task, xoá, đánh dấu xong và lọc, cập nhật ngay (test jsdom và Edge thật)
- [x] Mỗi `<li>` có `key` là `task.id`
- [ ] DevTools: không có listener trên nút con (kèm ảnh): đã kiểm bằng CDP, còn thiếu ảnh panel thật (D8)
- [x] `npm test` pass: 5 file, 137 test
- [x] Không có `var`, `innerHTML` (ngoài việc đọc trong test), `keypress`, `keyCode`, inline handler (đã `grep`)
- [ ] Đúng 4 commit, đúng message và thứ tự ở mục 2 (kiểm sau khi commit 4 được tạo)
- [ ] Prompt log đã export vào `docs/prompt_logs/`

## 6. Kiểm tra WCAG 2.2 AA (ghi rõ đã kiểm gì, bằng cách nào)

| Tiêu chí | Cách kiểm | Trạng thái |
|---|---|---|
| 1.3.1 Cấu trúc ngữ nghĩa | Test jsdom (`section > header > h1`, `ul > li`, `label[for]`) và cây accessibility của Edge (main, heading mức 1 và 2, list, listitem, textbox, button, group). Hai `<div>` còn lại (`add-task`, `filters`) là khung bố cục; nhóm lọc có `role="group"` và `aria-label` | Đã kiểm |
| 1.4.1 Không chỉ dùng màu | Nút lọc đang chọn có `aria-pressed`, chữ đậm và gạch chân; task xong có chữ "Completed", không chỉ gạch ngang. Xem ảnh chụp `evidence/task-manager.png` | Đã kiểm bằng mắt |
| 1.4.3 Tương phản 4.5:1 | Script tính theo công thức WCAG từ `getComputedStyle` trong Edge: thấp nhất 8.86:1 (chữ trạng thái và nhãn Completed), chữ chính 17.4:1, nút đang chọn 9.96:1 | Đã kiểm (không dùng công cụ ngoài) |
| 1.4.11 Tương phản phi văn bản | Viền nút 6.69:1 so với nền; vòng focus (`#1a3d8f`) 9.96:1 so với nền trắng | Đã kiểm |
| 2.1.1 Bàn phím | Phím Tab thật qua CDP đi qua cả 12 nút theo thứ tự hợp lý; Enter trên nút lọc hoạt động; Enter trong ô nhập thêm task. Phím Space chưa thử | Một phần |
| 2.4.3 Thứ tự focus | Test D5 và Edge thật: focus giữ nguyên sau bấm chuột, thêm bằng Enter, toggle, lọc; sau Delete focus về `#task-count` | Đã kiểm |
| 2.4.7 Focus nhìn thấy | Sau mỗi lần Tab, `:focus-visible` khớp và outline là `solid 3px rgb(26, 61, 143)` | Đã kiểm |
| 2.5.3 Nhãn trong tên | Test: `aria-label` của nút trong danh sách chứa chữ hiển thị | Đã kiểm |
| 2.5.8 Vùng bấm 24×24 | Đo `getBoundingClientRect` mọi nút và ô nhập trong Edge: không có control nào nhỏ hơn 24 px | Đã kiểm |
| 4.1.2 Tên truy cập được | Cây accessibility của Edge: mọi nút có tên (ví dụ "Mark done: Browser task"), ô nhập tên "New task" | Đã kiểm |
| 4.1.3 Thông báo trạng thái | Test D6 và cây accessibility có phần tử `status`; chưa nghe bằng trình đọc màn hình thật | Một phần |

Chưa làm: chạy axe hoặc Lighthouse (project-rules mục 8.1 yêu cầu ít nhất một công cụ tự động; chưa cài), thử trên trình đọc màn hình, thử trên Firefox hoặc Safari.

Không ghi "đạt WCAG" cho tới khi các dòng "Một phần" và mục "Chưa làm" ở trên được xử lý.

## 7. Rủi ro và điểm cần giải thích khi bảo vệ

- **Closure trên `index`, không phải `cursor`:** setter chạy sau khi cursor đã đổi; nếu closure đọc `cursor` lúc gọi thì ghi nhầm ô. Đây là câu hỏi dễ bị hỏi.
- **Gọi hook có điều kiện làm lệch state:** B6 là ví dụ sống.
- **Thay cả cây mất focus và trạng thái cục bộ của DOM:** D5 xử lý focus; trạng thái khác chưa xử lý, thuộc lý do cần diff ở Exercise 3. Hai giới hạn đã biết: chữ đang gõ trong ô nhập mất khi control khác gây re-render (có test ghi nhận), và vị trí cuộn, vùng chọn văn bản không được giữ.
- **`recoverLostFocus` đoán "mất focus" bằng `activeElement === body`:** trên trình duyệt không focus nút khi bấm chuột (chưa thử trên Safari hoặc Firefox macOS) có thể chuyển focus về tiêu đề đếm sau mỗi toggle. Chưa kiểm.
- **`crypto.randomUUID()` chỉ có trong secure context:** `localhost` và HTTPS đều được; `http://<IP>` thì không.
- **Bỏ `addEventListener` làm Exercise 1 và Exercise 2 khác nhau:** vì vậy dùng bản sao `mini-react.js`.
- **Test jsdom không có `getEventListeners`:** C6 dùng spy làm bằng chứng thay thế; vẫn phải kiểm tay bằng DevTools ở D8.

## 8. Câu hỏi còn mở

| Câu hỏi | Mặc định đang dùng | Trạng thái |
|---|---|---|
| Sao chép `mini-react.js` hay sửa chung với Exercise 1 | Sao chép vào `Exercise2_Lab02/` (kèm bản sao test) | Đã thực hiện; chờ bạn xác nhận |
| Cách chạy HTTP cục bộ cho `index.html` | `python -m http.server 8765` từ thư mục gốc repo, mở `http://127.0.0.1:8765/Exercise2_Lab02/index.html`; không cài dependency | Đã dùng khi kiểm D8 |
| "Đúng 4 commit" có tính commit setup (A0) và export prompt log (D9) không | Setup vào commit 1, prompt log vào commit 4 | Giả định, mâu thuẫn nhẹ với Agents.md mục 5 |
| Batch render | Đồng bộ, batch là phần mở rộng | Giả định |
| Kiểm tay với trình đọc màn hình (D6) | Bạn tự kiểm; mình không khẳng định thay | Cần bạn thực hiện |
