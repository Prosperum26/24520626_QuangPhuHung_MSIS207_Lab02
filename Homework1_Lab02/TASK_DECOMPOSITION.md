# Homework 1 — Task Decomposition

> Bối cảnh: [Context](../docs/Context.md). Quy tắc: [project-rules](../docs/project-rules.md) và [Agents](../Agents.md). Mẫu WBS: [Exercise 3](../Exercise3_Lab02/TASK_DECOMPOSITION.md).
> Trạng thái (2026-10-28): nhóm A đến E đã làm và verify bằng test; F1 và F5 (phần kiểm chứng) đã chạy; **F2 (Lighthouse), F3 (trình đọc màn hình) và prompt log là việc của bạn**, hướng dẫn ở mục 11.
> Quy ước: tick `[x]` chỉ khi đã chạy lệnh kiểm chứng và thấy output thật. Mỗi lượt làm đúng một task.

## 1. Thông tin chung

| Mục | Nội dung |
|---|---|
| Tên bài | Production Enterprise Data-Grid (WCAG 2.2 AA) |
| Thời hạn | 1 tuần |
| Mục tiêu | Data-Grid truy cập được: sort, filter, pagination, điều hướng bàn phím; Lighthouse Accessibility và Best Practices đều 100 |
| Ngôn ngữ | JavaScript thuần, contract bằng JSDoc, `// @ts-check` (như Exercise 1 đến 3) |
| Engine | Bản sao engine Exercise 3 trong `src/engine/`, chỉ sửa một chỗ (giữ caret, task C1); bản Exercise 3 không đổi |
| Test | Vitest + jsdom, mỗi module một file `*.test.js` cạnh nó |
| Chạy thử | `python -m http.server 8765` từ gốc repo, mở `http://127.0.0.1:8765/Homework1_Lab02/index.html` |

### 1.1 Cấu trúc thư mục

```text
Homework1_Lab02/
  index.html            trang demo (lang, title, main > h1, #app, #status)
  main.js               điểm vào: gắn hub, render grid
  main.test.js          test điểm vào, index.html, style.css
  style.css
  TASK_DECOMPOSITION.md
  evidence/             ảnh chụp và browser-audit.json
  src/
    engine/             engine Mini-React (bản sao Exercise 3 + giữ caret)
    grid/               data-grid.js và các module logic thuần grid-*.js, announce.js
    data/               employees.js (dữ liệu mẫu), employee-columns.js (cấu hình cột)
```

Quy tắc phụ thuộc: `engine` không biết `grid`; `grid` chỉ import `engine`; `data` không import gì ngoài kiểu của `grid`. Logic thuần (`grid-sort`, `grid-filter`, `grid-page`, `grid-nav`, `grid-selection`, `grid-view`) không đụng DOM nên test không cần jsdom; chỉ `data-grid.js` và `announce.js` đụng DOM.

## 2. Ràng buộc từ đề

1. WCAG 2.2 AA, tương phản chữ 4.5:1, hỗ trợ trình đọc màn hình.
2. Mũi tên Lên/Xuống/Trái/Phải di chuyển giữa các ô. `Enter` chọn, `Space` bật/tắt.
3. Lighthouse Accessibility = 100 và Best Practices = 100, có ảnh chụp.
4. Không div-soup: `<table>`, `<thead>`, `<tbody>`, `<th scope="col">`, `<button>`.
5. Bất biến: ngữ nghĩa ARIA grid (`role="grid"`, `row`, `gridcell`).

## 3. Hợp đồng kiểu

```ts
export interface ColumnDef<T> {
  header: string;
  accessorKey: keyof T;
  sortable?: boolean;
}

export interface DataGridProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  onRowSelect?: (item: T) => void;
  ariaLabel: string;
}
```

Hai interface giữ nguyên như đề. Trạng thái nội bộ (không nằm trong props):

```ts
type SortDir = 'asc' | 'desc';
interface GridState {
  sort: { key: string; dir: SortDir } | null; // null = thứ tự gốc
  filter: string;
  page: number;                                // bắt đầu từ 1
  activeCell: { row: number; col: number };    // row 0 = hàng tiêu đề
  selected: ReadonlySet<number>;               // chỉ số dòng trong data gốc
}
```

## 4. Quyết định thiết kế (mỗi quyết định ở một chỗ)

| Quyết định | Chốt | Lý do |
|---|---|---|
| Engine | Dùng lại engine Exercise 3, grid là function component | Bạn đã chốt; đúng tinh thần Tier 1 |
| `role="grid"` trên `<table>` | Có, ghi rõ ngoại lệ | Đề bắt buộc bất biến grid; `td`/`th` trong grid tự hiểu là `gridcell`/`columnheader`, không gắn role thừa cho `tr`, `th`, `td` (có test) |
| Phần tử nhận focus | Ô dữ liệu: chính `<td tabindex>`. Ô tiêu đề sortable: `<button>` bên trong `<th>`; ô tiêu đề không sortable: chính `<th tabindex>` | Mẫu APG sortable grid; một `<button>` thật nên Enter/Space tự sort, không viết lại |
| Roving tabindex | Chỉ `activeCell` có `tabindex="0"`, còn lại `-1` | Một lần Tab vào, một lần Tab ra |
| Một handler bàn phím | `onKeydown` ở `<table>` duy nhất, đọc toạ độ từ `id` của `event.target` | Hub của engine tra handler theo `_vnode`; một chỗ để sửa khi bảo vệ |
| Id ô | `${gridId}-r${row}-c${col}`, theo **vị trí**, không theo nội dung | Engine chỉ khôi phục focus theo `id`; sau sort, focus ở nguyên vị trí |
| Di chuyển focus | Handler cập nhật `activeCell`, rồi `document.getElementById(idĐích).focus()` (render đồng bộ nên cây mới đã có) | `writeFocus` của engine khôi phục focus **cũ**, không biết ô đích. Cùng mẫu `recoverLostFocus` của Exercise 3 |
| Enter trên ô dữ liệu | Chọn **riêng** dòng đó (bỏ các dòng khác) và gọi `onRowSelect(item)` | Đề không nói rõ; Enter có hiệu ứng nhìn thấy được. Giả định, chờ bạn xác nhận (mục 9) |
| Space trên ô dữ liệu | Bật/tắt dòng đó trong tập đã chọn (chọn nhiều), `preventDefault` chặn cuộn trang | Như trên |
| Enter/Space ở hàng tiêu đề | Không xử lý; `<button>` tự sort bằng click gốc | Không viết lại hành vi gốc của trình duyệt |
| Trạng thái chọn | `aria-selected` trên `<tr>` bằng **chuỗi** `'true'`/`'false'`; kiểu dáng có vạch trái, dấu ✓ (alt rỗng) và chữ đậm | `createElement` bỏ prop `false`; không chỉ truyền đạt bằng màu (1.4.1) |
| Sắp xếp | Vòng `asc → desc → bỏ sort`; chỉ cột đang sort có `aria-sort`; chỉ báo ▲/▼ ẩn khỏi trình đọc màn hình | APG; số so như số, chuỗi `localeCompare` với `numeric: true`; sort ổn định; ô trống xuống cuối |
| Lọc | Một ô `<input type="search">` có `<label for>`, khớp chuỗi con không phân biệt hoa thường trên mọi cột | Đủ yêu cầu; lọc theo cột là YAGNI. Dùng `includes`, không dựng RegExp |
| Phân trang | 10 dòng mỗi trang; `<nav aria-label>`, Previous/Next, cửa sổ tối đa 5 số trang, `aria-current="page"`; nút ở biên dùng `aria-disabled`, không dùng `disabled` | `disabled` làm mất focus và mất khỏi thứ tự Tab; handler tự bỏ qua click |
| Dòng ảo | Chỉ hiển thị trang hiện tại; `aria-rowcount` = tổng dòng đã lọc + 1; mỗi `<tr>` có `aria-rowindex` | Trình đọc màn hình biết vị trí thật trong tập kết quả |
| Thông báo | `#status role="status"` ngoài `#app`; ghi từ handler, không ghi lúc render | 4.1.3; tách khỏi cây bị thay mỗi lần render; mũi tên không đọc lại thông báo cũ |
| Dữ liệu | `employees.js`: 240 dòng sinh **tất định** (không `Math.random`), có cột số và ngày | Test lặp lại được; ảnh chụp luôn cùng dữ liệu |
| Bọc cuộn ngang | `<div class="grid-scroll">` với `overflow-x: auto` quanh `<table>` | Reflow 320 px (1.4.10); bảng có phần tử focus được |
| Vẽ vòng focus trong ô | `outline-offset` âm cho `td`, `th`, `th button` | `overflow-x: auto` cắt outline vẽ ra ngoài mép |

## 5. WBS và kế hoạch commit

Cột "Commit" là commit thực tế (mã rút gọn) khi đã có. Các task D1 đến D6 gộp thành một commit vì cùng nằm trong `data-grid.js` và không tách sạch được bằng `git add`.

### Nhóm A — Nền

- [x] **A0 Sao chép engine.** Chép nguyên văn `mini-react.js`, `reactive-engine.js` và hai file test từ Exercise 3.
  - Commit: `9d63527 chore(hw1): copy exercise 3 engine`.
  - Kết quả: `cmp` từng file khớp byte; sau đó chuyển vào `src/engine/` (mục 1.1).
- [x] **A1 Contract.** `grid-contract.js`: JSDoc `ColumnDef`, `DataGridProps`, `GridState`; hằng `SORT_CYCLE`, `PAGE_SIZE = 10`, `initialGridState` đóng băng.
  - Commit: `3c65776 feat(grid): add data-grid contract`.
- [x] **A2 Dữ liệu mẫu.** `employees.js`: `createEmployees(count)` tất định; xuất `EMPLOYEES` (240 dòng).
  - Commit: `1153d98 feat(grid): add deterministic employee mock data`.

### Nhóm B — Logic thuần (không DOM)

- [x] **B1 `sortRows`.** Ổn định, số và chuỗi, `null` về cuối, không sửa mảng đầu vào. Commit: `2f82ae6 feat(grid): implement sortRows and nextSort` (gồm cả `nextSort` của B5).
- [x] **B2 `filterRows`.** Commit: `8a5c774 feat(grid): implement filterRows`.
- [x] **B3 `paginate` và `pageWindow`.** Commit: `30c1a5a feat(grid): implement paginate and pageWindow`.
- [x] **B4 `nextCell`, `cellId`, `parseCellId`.** Commit: `7d425e7 feat(grid): implement cell navigation model`. Thêm `clampCell` ở D5.
- [x] **B5 `toggleSelection` và `nextSort`.** Commit: `dc4ff06 feat(grid): implement toggleSelection`.
  - Lệch plan: `Object.freeze` không chặn được `Set.add`, nên chỉ đảm bảo hàm không sửa `Set` đầu vào và trả `Set` mới (có test).

### Nhóm C — Engine

- [x] **C1 Giữ caret khi khôi phục focus.** `readFocus`/`writeFocus` ghi nhớ và khôi phục `selectionStart`/`selectionEnd`/hướng của `<input>`.
  - Commit: `db92ff1 feat(engine): preserve caret when restoring focus`.
  - Kiểm chứng: 6 test; cố ý bỏ bước khôi phục caret thì 4 test fail. Gõ giữa chuỗi trong Edge thật cho kết quả đúng (mục 6.1).

### Nhóm D — UI

- [x] **D0 `deriveView` (thêm vào plan).** Lọc, rồi sort, rồi cắt trang, kèm chỉ số dòng gốc; hàm thuần. Commit: `ae12eb1 feat(grid): derive visible rows from filter, sort and page`.
- [x] **D1 Bảng ngữ nghĩa.** `table[role=grid] > thead > tr > th[scope=col]`, `tbody > tr[aria-rowindex] > td`; XSS: ô chứa `<img onerror>` hiện như chữ.
- [x] **D2 Sắp xếp.** `<button>` trong `<th>`, `aria-sort` chỉ một cột, thông báo "Sorted by Name, ascending".
- [x] **D3 Lọc.** `<label for>` + `<input type="search">`, "Showing N of 240 rows", "No matching rows" đặt ngoài bảng.
- [x] **D4 Phân trang.** `<nav aria-label="Pagination">`, `aria-current="page"`, `aria-disabled` ở biên, "Page 3 of 24".
- [x] **D5 Điều hướng bàn phím.** Roving tabindex, một `onKeydown` ở `<table>`, `clampCell`. Không nuốt Alt/Meta + mũi tên (phím tắt trình duyệt).
- [x] **D6 Chọn dòng.** Enter và Space như mục 4; `aria-selected` bằng chuỗi.
  - Commit chung D1 đến D6: `d8d6db1 feat(grid): render accessible data grid with sort, filter, pagination, keyboard and selection`.
  - Kiểm chứng: 70 test trong `data-grid.test.js`. Đã thử phá 9 lỗi cố ý (bỏ `.focus()` sau khi di chuyển, bỏ `clampCell`, bỏ guard Alt/Meta, bỏ `preventDefault`, bỏ `id` của ô, chọn theo vị trí thay vì chỉ số gốc, Enter dùng toggle, `aria-selected` kiểu boolean, chọn ở hàng tiêu đề); cả 9 đều bị test bắt.
  - Lệch plan: D1 hiển thị 10 dòng đầu thay vì toàn bộ dữ liệu vì dùng `deriveView` ngay từ đầu; Enter vừa chọn riêng dòng vừa gọi `onRowSelect`.

### Nhóm E — Trang và kiểu dáng

- [x] **E1 `index.html`, `main.js`, `style.css`, `employee-columns.js`.** Chưa commit.
  - Thêm ngoài plan: `employee-columns.js` (một chỗ cấu hình cột), `<p id="opened">` hiện kết quả `onRowSelect` để thấy Enter hoạt động.
  - Bỏ so với plan: `scroll-padding`, vì không có tiêu đề dính nên không có gì che focus (xem 2.4.11 ở mục 7).
  - Kiểm chứng: `main.test.js` 11 test (hub gắn một lần, render 10 dòng, Enter gọi `onRowSelect`, HTML/CSS chứa các thuộc tính cần thiết).
  - Commit dự kiến: `feat(ui): add grid page, entry point and styles`.
- [x] **E2 Tổ chức lại thư mục (theo yêu cầu).** Chia `src/engine`, `src/grid`, `src/data`; sửa đường dẫn import. Chưa commit.
  - Kiểm chứng: 505 test pass ngay sau khi chuyển; không file nào của Exercise 1 đến 3 bị đổi.
  - Commit dự kiến: `refactor(hw1): group sources into engine, grid and data folders`.

### Nhóm F — Kiểm chứng và bằng chứng

- [x] **F1 Đo tương phản, vùng bấm và hành vi trong Edge thật.** Chạy Edge headless qua Chrome DevTools Protocol (không cài gì): 19 kiểm tra pass, console không lỗi hay cảnh báo. Kết quả ở mục 6.1; báo cáo thô ở [evidence/browser-audit.json](evidence/browser-audit.json). Script chạy từ thư mục tạm, không lưu vào repo.
  - Commit dự kiến: `docs(hw1): record browser measurements and wcag status`.
- [ ] **F2 Lighthouse.** **Việc của bạn.** Chạy Accessibility và Best Practices, Desktop và Mobile, ba trạng thái (mục 11.1). Đạt 100 mới tick; không đạt thì ghi từng mục lỗi để mình sửa bằng commit riêng.
  - Phần Accessibility của Lighthouse là tập con rule của axe-core, nên không có bước axe riêng (đã chốt không cài thêm).
- [ ] **F3 Kiểm tay bàn phím và trình đọc màn hình.** **Việc của bạn** (mục 11.2). Mình đã thử phím thật trong Edge qua CDP nhưng đó không phải trình đọc màn hình.
- [x] **F4 Bảng kiểm WCAG 2.2 AA.** Đã điền mục 7 đúng mức đã kiểm. **Không ghi "đạt WCAG"**: còn nhiều dòng "Một phần".
- [ ] **F5 Verify cuối và prompt log.**
  - [x] Verify: `npm test` toàn repo 25 file, 516 test pass (riêng HW1: 13 file, 224 test); `grep` các từ cấm trong code HW1 không có kết quả; `addEventListener` chỉ còn ở hub của engine; `git diff --stat -- Exercise1_Lab02 Exercise2_Lab02 Exercise3_Lab02` rỗng.
  - [ ] Prompt log: **việc của bạn**, export vào `docs/prompt_logs/` (AI không xuất được phiên làm việc của chính nó).

## 6. Điều kiện hoàn thành (checklist nghiệm thu)

- [x] Dùng `<table>`, `<thead>`, `<tbody>`, `<th scope="col">`, `<button>` đúng chỗ (D1, D2)
- [x] Mũi tên di chuyển giữa ô; `Enter` chọn; `Space` bật/tắt (D5, D6; phím thật trong Edge ở F1)
- [x] Sort, lọc, phân trang chạy và có `aria-sort`, `aria-current`, thông báo trạng thái (D2 đến D4)
- [x] Tương phản 4.5:1 (chữ) và 3:1 (viền, focus), đo trong Edge (F1)
- [ ] Lighthouse Accessibility = 100 và Best Practices = 100, có ảnh (F2, chờ bạn)
- [ ] Kiểm tay bằng bàn phím và ít nhất một trình đọc màn hình (F3, chờ bạn)
- [x] `npm test` pass, không sửa Exercise 1 đến 3 (F5)
- [ ] Mỗi commit atomic, Conventional Commits (còn E1, E2, F1, F4 chưa commit)
- [ ] Prompt log đã export (F5, chờ bạn)

### 6.1 Kết quả đo trong Edge thật (F1)

Môi trường: Edge headless, viewport 1280×900 (và 320×640 cho reflow), dữ liệu 240 dòng. Tương phản tính từ `getComputedStyle` theo công thức WCAG; hai dòng ghi "từ CSS" tính từ giá trị màu khai báo, chưa đo `getComputedStyle`.

| Phần tử | Tương phản chữ | Tương phản viền | Kích thước (px) |
|---|---|---|---|
| `h1` | 17.40 | không viền | 1024×42 |
| Dòng hướng dẫn và `#status` | 8.86 | không viền | 1024×24 |
| `th` (tiêu đề cột) | 15.25 | không viền | 200×57 |
| `th button` (nút sort) | 15.25 | viền trong suốt | 91×40 |
| `td` (ô dữ liệu) | 17.40 | không viền | 200×42 |
| Ô lọc | 17.40 | 6.69 | 384×40 |
| Nút Next, số trang thường | 17.40 | 6.69 | 40×40 trở lên |
| Nút Previous khi `aria-disabled` | 7.92 | 6.69 (nét đứt) | 88×40 |
| Nút trang hiện tại (`aria-current`) | 9.96 | 9.96 | 40×40 |
| Vòng focus `#1a3d8f` so với nền trắng | không áp dụng | 9.96 | không áp dụng |
| Vòng focus so với nền dòng được chọn | không áp dụng | 8.35 (từ CSS) | không áp dụng |
| Chữ trên nền dòng được chọn `#e3ebff` | 14.58 (từ CSS) | không áp dụng | không áp dụng |

Hành vi chạy bằng phím thật (`Input.dispatchKeyEvent`) trong Edge, tất cả pass:

| Kiểm tra | Kết quả |
|---|---|
| Mũi tên, Home, End di chuyển đúng ô | Đúng chuỗi `r1-c0, r1-c1, r2-c1, r2-c0, r1-c0, r1-c4, r1-c0` |
| `:focus-visible` khớp sau khi di chuyển bằng phím | Có |
| Đúng một tab stop trong bảng | 1 |
| Space chọn dòng, focus giữ nguyên ô | Có |
| Enter chọn riêng một dòng và `onRowSelect` chạy | Có ("Last selected with Enter: Chi Pham, Finance") |
| Hai dòng chọn cùng lúc (Enter rồi Space dòng khác) | 2 dòng |
| Mũi tên không cuộn trang | `scrollY` vẫn 0 |
| Enter và Space trên nút sort | Đúng `ascending` rồi `descending`, focus giữ ở nút, `#status` đọc "Sorted by Name, descending" |
| Gõ vào ô lọc | Giá trị, caret, focus giữ nguyên |
| Gõ giữa chuỗi ("engi", lùi 2, gõ X) | `enXgi`, caret 3 (không bị chèn ngược) |
| `#status` sau khi lọc | "Showing 48 of 240 rows" |
| Next bằng Enter | Trang 2, focus còn ở Next |
| Reflow 320 px | `scrollWidth` 320 bằng `clientWidth`; chỉ bảng cuộn ngang |
| Console | Không có lỗi hay cảnh báo |

Cây accessibility (rút gọn): `searchbox "Filter rows"`, `grid "Employees"`, `navigation "Pagination"`, `button "Previous"` (disabled), `button "Page 1"` đến `"Page 5"`, `button "Next"`, `columnheader "Name"`, `"Department"`, `"Role"`.

Ảnh chụp: [evidence/grid-initial.png](evidence/grid-initial.png), [evidence/grid-selected-focus.png](evidence/grid-selected-focus.png), [evidence/grid-filtered.png](evidence/grid-filtered.png), [evidence/grid-320px.png](evidence/grid-320px.png). Ảnh do script chụp để mình tự kiểm tra giao diện; ảnh nộp bài (Lighthouse, DevTools) bạn tự chụp.

## 7. Kiểm tra WCAG 2.2 AA (F4)

Cột "Cách đã kiểm" ghi đúng việc đã làm. "Đã kiểm" nghĩa là đã làm bằng chứng đủ cho tiêu chí đó ở mức công cụ cho phép; "Một phần" nghĩa là còn thiếu bước ghi trong cột.

| Tiêu chí | Cách đã kiểm | Trạng thái |
|---|---|---|
| 1.3.1 Thông tin và quan hệ | Test jsdom cấu trúc `table > thead > th[scope=col]`, không role thừa, không div trong bảng; cây accessibility trong Edge (grid, columnheader, searchbox, navigation) | Một phần: chưa nghe bằng trình đọc màn hình |
| 1.4.1 Không chỉ dùng màu | Dòng chọn có vạch, ✓ và chữ đậm; trang hiện tại có gạch chân; nút vô hiệu có viền nét đứt; cột sort có ▲/▼; đã xem ảnh `grid-selected-focus.png` | Một phần: mình tự xem ảnh, cần bạn xác nhận bằng mắt |
| 1.4.3 Tương phản tối thiểu | `getComputedStyle` trong Edge (mục 6.1): mọi chữ từ 7.92 trở lên | Một phần: chưa đo chữ trên nền hover bằng `getComputedStyle` (từ CSS: 15.82); chưa có Lighthouse |
| 1.4.10 Reflow | Đo ở 320 px trong Edge: trang không cuộn ngang, chỉ bảng cuộn | Một phần: chưa thử zoom 400% bằng tay |
| 1.4.11 Tương phản phi văn bản | Viền control 6.69, vòng focus 9.96 và 8.35 | Một phần: nút sort không có viền, chỉ có chữ và gạch chân nét chấm; mình xem đó là đủ nhận biết (chữ tự nhận biết) nhưng cần bạn xác nhận |
| 2.1.1 Bàn phím | Test jsdom và phím thật trong Edge (mũi tên, Home, End, Enter, Space, Next bằng Enter) | Một phần: chưa thử Tab vào và ra bằng tay, chưa Ctrl+Home/End trong Edge |
| 2.4.3 Thứ tự focus | Test `activeElement` sau sort, lọc, sang trang; Edge: focus giữ ở nút sort, ô lọc, Next | Một phần: chưa thử tay |
| 2.4.7 Focus nhìn thấy | `:focus-visible` khớp sau phím di chuyển trong Edge; vòng focus vẽ vào trong ô; thấy trong ảnh | Một phần: chưa kiểm sau khi Tab từ ngoài vào |
| 2.4.11 Focus không bị che | Không có tiêu đề dính hay lớp phủ trong thiết kế | Một phần: chưa thử khi cuộn ngang bảng ở màn hẹp bằng tay |
| 2.5.3 Nhãn trong tên | Nút số trang có `aria-label="Page 2"` chứa chữ hiển thị "2" | Đã kiểm bằng test |
| 2.5.8 Vùng bấm 24×24 | Đo `getBoundingClientRect` trong Edge: mọi control cao từ 40 px, ô lọc 384×40, nút số trang 40×40 | Đã kiểm cho các control đo ở mục 6.1 |
| 3.3.2 Nhãn hoặc hướng dẫn | `<label for>` hiển thị; cây accessibility cho `searchbox "Filter rows"` | Đã kiểm |
| 4.1.2 Tên, vai trò, giá trị | Cây accessibility: tên của grid, nút trang, nút Previous (disabled); test `aria-sort`, `aria-selected`, `aria-current` | Một phần: chưa xem thuộc tính sort và selected trong cây accessibility của Edge |
| 4.1.3 Thông báo trạng thái | Test và Edge: nội dung `#status` đổi đúng sau sort, lọc, chọn | Một phần: chưa nghe bằng NVDA hoặc Narrator |

Chưa làm: Lighthouse (F2), trình đọc màn hình (F3), Firefox và Safari (CSS `content: '✓ ' / ''` có dòng dự phòng cho trình duyệt không hiểu cú pháp alt), zoom 400%.

## 8. Rủi ro và điểm cần giải thích khi bảo vệ

- **Mỗi phím mũi tên render lại cả bảng.** Engine thay cả cây bằng `replaceChildren`. Với 10 dòng thì không đáng kể; nếu thầy đổi `PAGE_SIZE` lên vài trăm sẽ thấy chậm. Focus phải được trả lại bằng `getElementById(...).focus()` ngay sau render; bỏ dòng đó thì 4 test fail (đã thử phá).
- **`writeFocus` khôi phục focus cũ, không phải ô đích.** Đây là lý do handler phải tự gọi `.focus()`. Nếu thầy hỏi vì sao không sửa engine: giữ engine nhỏ, quyết định nằm ở một chỗ (handler của grid).
- **`aria-selected={false}` bị `createElement` bỏ.** `applyProp` bỏ qua giá trị `false`; phải truyền chuỗi `'false'`.
- **Nhãn dùng `for`, không dùng `htmlFor`.** Engine chỉ ánh xạ `className → class`.
- **`overflow-x: auto` cắt outline vẽ ra ngoài.** Vì vậy vòng focus của ô dùng `outline-offset` âm. Nếu ai đổi về giá trị dương, vòng focus ở ô sát mép bị cắt (vi phạm 2.4.7); có test kiểm chuỗi CSS.
- **`role="grid"` trái luật "không role thừa".** Đề bắt buộc bất biến; ngoại lệ ghi ở mục 4. `aria-sort` chỉ gắn một cột (khuyến nghị của APG), không gắn `none` cho các cột còn lại.
- **Alt rỗng của dấu ✓.** Cú pháp `content: '✓ ' / ''` chưa chắc được mọi trình duyệt hiểu; có dòng `content` thường đứng trước làm dự phòng. Khi dự phòng chạy, một số trình đọc màn hình có thể đọc thêm "check mark" bên cạnh `aria-selected`. Chưa kiểm.
- **Thông báo giống hệt lần trước** (ví dụ hai lần liên tiếp "1 row selected") có thể không được đọc lại. Chưa kiểm với trình đọc màn hình; nếu gặp ở F3, xoá nội dung `#status` trước khi ghi.
- **Lighthouse 100 không đồng nghĩa WCAG.** Công cụ tự động chỉ phủ một phần; F3 là phần kiểm tay bắt buộc.
- **Đo bằng Edge headless chưa phải DevTools trên màn hình thật.** Công thức và giá trị tính được giống nhau, nhưng ảnh nộp bài và điểm Lighthouse vẫn do bạn chạy.
- **Hai lỗi TypeScript nhẹ ở `grid-sort.js`** (bạn đã thấy trong VS Code): chưa sửa theo yêu cầu. VS Code diagnostics phía mình trả rỗng vì chỉ phân tích file đang mở. Nghi ngờ: `SORT_CYCLE` bị suy ra kiểu `string[]` thay vì `SortDir[]`; cần bạn dán nội dung lỗi để xác nhận trước khi sửa.

## 9. Câu hỏi còn mở và giả định

| Câu hỏi | Mặc định đang dùng | Trạng thái |
|---|---|---|
| `Enter` chọn, `Space` bật/tắt nghĩa là gì | Enter: chọn riêng dòng và gọi `onRowSelect`; Space: bật/tắt trong tập chọn nhiều | Giả định, chờ bạn xác nhận |
| Số commit tối thiểu | Một commit mỗi task; D1 đến D6 gộp một commit | Đề chưa nói |
| `AI_FAILURE_AUDIT.md` cho bài này | Không bắt buộc riêng; ghi lỗi AI gặp ở F5 nếu có | Chờ bạn xác nhận |
| Công cụ kiểm tra tự động | Chỉ Lighthouse trong DevTools; không cài `axe-core` hay `lighthouse` CLI, `package.json` không đổi | Đã chốt |
| Kích thước dữ liệu và cỡ trang | 240 dòng, 10 dòng mỗi trang | Giả định |
| Lệnh typecheck | Chỉ VS Code diagnostics, như Exercise 3 | Giả định |
| Lọc theo cột hay toàn bảng | Một ô lọc cho toàn bảng | Giả định |

## 10. Ghi chú nguồn

Đề gốc: slide Homework 1 (đã chép ở mục 2 và 3). Chuẩn WCAG: [project-rules mục 8](../docs/project-rules.md). Mẫu tương tác: ARIA Authoring Practices Guide, các mẫu "Data Grid" và "Sortable Table" (chưa tra lại bản mới nhất; đối chiếu khi cần giải thích lúc bảo vệ).

## 11. Hướng dẫn kiểm tra tay (F2, F3)

Phần này là việc của bạn vì ảnh chụp Lighthouse và trình đọc màn hình không do AI tạo được. Làm xong thì báo kết quả (kể cả mục không đạt) để cập nhật mục 7 và tick F2, F3.

### 11.1 F2 — Lighthouse

Chuẩn bị:

```bash
python -m http.server 8765
```

Mở **cửa sổ ẩn danh** của Edge hoặc Chrome (để extension không làm lệch điểm), vào `http://127.0.0.1:8765/Homework1_Lab02/index.html`, nhấn F12, chọn tab Lighthouse, tick **Accessibility** và **Best Practices**.

| # | Trạng thái trang | Thiết bị | Ảnh lưu vào `evidence/` |
|---|---|---|---|
| 1 | Vừa tải, chưa thao tác | Desktop | `lighthouse-desktop-initial.png` |
| 2 | Vừa tải, chưa thao tác | Mobile | `lighthouse-mobile-initial.png` |
| 3 | Sau khi gõ "eng" vào ô lọc và bấm sort cột Salary | Desktop | `lighthouse-desktop-filtered.png` |
| 4 | Sang trang cuối (bấm Next nhiều lần) | Desktop | `lighthouse-desktop-lastpage.png` |

Mỗi ảnh phải thấy điểm Accessibility, Best Practices và thiết bị. Nếu có mục không đạt, mở mục đó, chụp phần mô tả và gửi cho mình; mình sửa bằng commit riêng rồi bạn chạy lại. Điểm ở trạng thái 3 và 4 là bằng chứng quan trọng vì Lighthouse chỉ kiểm cây DOM tại lúc chạy.

### 11.2 F3 — Bàn phím và trình đọc màn hình

Chỉ dùng bàn phím (không chuột) với `http://127.0.0.1:8765/Homework1_Lab02/index.html`:

| # | Thao tác | Kết quả đúng |
|---|---|---|
| 1 | Tab từ đầu trang | Tới ô lọc, rồi vào bảng ở ô tiêu đề đầu tiên (nút "Name"); một lần Tab nữa ra khỏi bảng tới Previous/số trang |
| 2 | Mũi tên Xuống, Phải, Trái, Lên; Home, End; Ctrl+Home, Ctrl+End | Vòng focus di chuyển đúng ô, thấy rõ, không cuộn trang |
| 3 | Enter trên một ô dữ liệu | Dòng được chọn (vạch xanh, ✓, chữ đậm); dòng "Last selected with Enter" đổi |
| 4 | Space trên ô dữ liệu khác | Thêm dòng thứ hai vào vùng chọn; Space lần nữa bỏ chọn |
| 5 | Ở nút "Name" bấm Enter, rồi Space | Sắp xếp tăng, rồi giảm; focus vẫn ở nút |
| 6 | Gõ vào ô lọc, rồi dùng Tab | Số dòng đổi, thông báo "Showing N of 240 rows" |
| 7 | Tab tới số trang và Next, bấm Enter | Trang đổi, focus không rơi về đầu trang |

Trình đọc màn hình (NVDA miễn phí, hoặc Narrator: Windows + Ctrl + Enter), ghi lại **câu mà nó đọc** cho từng mục, kể cả khi sai:

| # | Thao tác | Cần nghe |
|---|---|---|
| 1 | Vào bảng bằng Tab | Tên bảng "Employees", số dòng/cột nếu có |
| 2 | Mũi tên Xuống một ô | Giá trị ô, tên cột, vị trí dòng (ví dụ "row 3 of 241") |
| 3 | Sort cột Name | "Sorted by Name, ascending" và trạng thái sắp xếp của cột |
| 4 | Gõ "eng" vào ô lọc | "Showing ... of 240 rows" |
| 5 | Space chọn một dòng | "1 row selected"; có đọc "selected" ở dòng không |
| 6 | Bấm một số trang | "Page N of 24" |
| 7 | Dòng được chọn có đọc thêm "check mark" không | Ghi có hoặc không |

### 11.3 Sau khi làm xong

1. Báo kết quả từng mục kèm tên file ảnh. Mình cập nhật mục 7 (không ghi "đạt WCAG" nếu còn mục "Một phần") và tick F2, F3.
2. Export prompt log của bài này vào `docs/prompt_logs/`.
3. Commit (mình chạy khi bạn xác nhận), theo thứ tự:

```bash
git add -u Homework1_Lab02/src
git commit -m "refactor(hw1): group sources into engine, grid and data folders"
git add Homework1_Lab02/index.html Homework1_Lab02/main.js Homework1_Lab02/main.test.js Homework1_Lab02/style.css Homework1_Lab02/src/data/employee-columns.js
git commit -m "feat(ui): add grid page, entry point and styles"
git add Homework1_Lab02/evidence Homework1_Lab02/TASK_DECOMPOSITION.md
git commit -m "docs(hw1): record browser measurements and wcag status"
```

Mỗi commit kèm dòng `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
