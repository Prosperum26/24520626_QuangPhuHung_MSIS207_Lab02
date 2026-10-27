# Homework 1 — Task Decomposition

> Bối cảnh: [Context](../docs/Context.md). Quy tắc: [project-rules](../docs/project-rules.md) và [Agents](../Agents.md). Mẫu WBS: [Exercise 3](../Exercise3_Lab02/TASK_DECOMPOSITION.md).
> Trạng thái: **bản plan chờ bạn duyệt**, chưa có dòng code nào. Quy ước: tick `[x]` chỉ khi đã chạy lệnh kiểm chứng và thấy output thật. Mỗi lượt làm đúng một task, mỗi task một commit.

## 1. Thông tin chung

| Mục | Nội dung |
|---|---|
| Tên bài | Production Enterprise Data-Grid (WCAG 2.2 AA) |
| Thời hạn | 1 tuần |
| Mục tiêu | Data-Grid truy cập được: sort, filter, pagination, điều hướng bàn phím; Lighthouse Accessibility và Best Practices đều 100 |
| Ngôn ngữ | JavaScript thuần, contract bằng JSDoc, `// @ts-check` (như Exercise 1 đến 3) |
| Engine | Sao chép `mini-react.js` và `reactive-engine.js` từ Exercise 3 vào `Homework1_Lab02/`, không sửa bản gốc |
| Test | Vitest + jsdom, mỗi module một file `*.test.js` cạnh nó |
| Chạy thử | `python -m http.server 8765` từ gốc repo, mở `Homework1_Lab02/index.html` |

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
| `role="grid"` trên `<table>` | Có, ghi rõ ngoại lệ | Đề bắt buộc bất biến grid; `td`/`th` trong grid tự hiểu là `gridcell`/`columnheader`, không gắn role thừa cho `tr`, `td` |
| Phần tử nhận focus | Ô dữ liệu: chính `<td tabindex>`. Ô tiêu đề sortable: `<button>` bên trong `<th>` | Mẫu APG sortable grid; một `<button>` thật nên Enter/Space tự sort, không viết lại |
| Roving tabindex | Chỉ `activeCell` có `tabindex="0"`, còn lại `-1` | Một lần Tab vào, một lần Tab ra |
| Một handler bàn phím | `onKeydown` ở `<table>` duy nhất, đọc toạ độ từ `id` của `event.target` | Hub của engine tra handler theo `_vnode`; một chỗ để sửa khi bảo vệ |
| Id ô | `${gridId}-r${row}-c${col}` | Engine chỉ khôi phục focus theo `id` |
| Di chuyển focus | Handler gọi `setActiveCell`, rồi `document.getElementById(nextId).focus()` (render đồng bộ nên cây mới đã có) | `writeFocus` của engine khôi phục focus **cũ**, không biết ô đích. Cùng mẫu `recoverLostFocus` của Exercise 3 |
| Space và Enter trên ô | `Enter` gọi `onRowSelect(item)` và đánh dấu dòng đang chọn; `Space` bật/tắt `aria-selected` của dòng (chọn nhiều) và `preventDefault` chặn cuộn trang | Đề không nói "toggle cái gì"; đây là cách hiểu hợp lý, chờ bạn xác nhận (mục 9) |
| Trạng thái chọn | `aria-selected` trên `<tr>` bằng **chuỗi** `'true'`/`'false'`, kèm chữ ẩn thị giác hoặc dấu "Selected" ở ô đầu | `createElement` bỏ prop `false`; không chỉ truyền đạt bằng màu (1.4.1) |
| Sắp xếp | Vòng `none → asc → desc → none`; chỉ cột đang sort có `aria-sort` | APG: chỉ một cột mang `aria-sort`; so sánh số bằng số, chuỗi bằng `localeCompare` với `numeric: true`; sort ổn định |
| Lọc | Một ô văn bản có `<label>`, lọc không phân biệt hoa thường trên mọi cột | Đủ yêu cầu; lọc theo cột là YAGNI |
| Phân trang | Cố định 10 dòng mỗi trang; `<nav aria-label>`, nút Trước/Sau, cửa sổ tối đa 5 số trang, trang hiện tại có `aria-current="page"`; nút ở biên dùng `aria-disabled`, không dùng `disabled` | `disabled` làm mất focus; bỏ qua click ở handler |
| Dòng ảo | Chỉ hiển thị trang hiện tại, nên `aria-rowcount` = tổng dòng đã lọc + 1 và mỗi `<tr>` có `aria-rowindex` | Trình đọc màn hình biết vị trí thật trong tập kết quả |
| Thông báo | Dùng lại `#status role="status"` ngoài `#app`; đọc "Showing 12 of 240 rows", "Sorted by Name, ascending", "Page 3 of 24" | 4.1.3; tách khỏi cây bị thay mỗi lần render |
| Dữ liệu | `employees.js`: 240 dòng sinh **tất định** (không `Math.random`), có cột số và ngày | Test lặp lại được; có dữ liệu đủ để thấy phân trang |
| Bọc cuộn ngang | `<div class="grid-scroll">` với `overflow-x: auto` quanh `<table>` | Reflow 320px (1.4.10); bảng có phần tử focus được nên không dính lỗi "vùng cuộn không focus được" |
| Style | CSS riêng; tương phản, focus, vùng bấm tối thiểu 2.5rem như Exercise 3 | Không dùng màu làm kênh duy nhất |

## 5. WBS và kế hoạch commit

Mỗi dòng là một task, một commit. Các nhóm B đến D độc lập với DOM nên thứ tự trong nhóm có thể đổi mà không phá nhau. Cột "Commit" dùng Conventional Commits, kèm dòng `Co-Authored-By` theo Agents.md.

### Nhóm A — Nền

- [ ] **A0 Sao chép engine.** Chép nguyên văn `mini-react.js`, `reactive-engine.js` và hai file test từ Exercise 3.
  - Commit: `chore(hw1): copy exercise 3 engine`.
  - Nghiệm thu: `diff` từng file không khác; `npm test` pass; `git status` không thấy file ngoài `Homework1_Lab02/` bị đổi.
- [ ] **A1 Contract.** `grid-contract.js`: JSDoc `ColumnDef`, `DataGridProps`, `GridState`; hằng `SORT_CYCLE`, `PAGE_SIZE = 10`, `initialGridState` đóng băng.
  - Commit: `feat(grid): add data-grid contract`.
  - Test: hằng đóng băng; `PAGE_SIZE` là số nguyên dương.
- [ ] **A2 Dữ liệu mẫu.** `employees.js`: `createEmployees(count)` tất định; xuất `EMPLOYEES` (240 dòng). Cột: `id`, `name`, `department`, `role`, `salary` (số), `joined` (chuỗi ISO).
  - Commit: `feat(grid): add deterministic employee mock data`.
  - Test: gọi hai lần ra kết quả bằng nhau; `id` không trùng; có đủ kiểu số và chuỗi.

### Nhóm B — Logic thuần (không DOM)

- [ ] **B1 `sortRows`.** Sort ổn định, số và chuỗi, `null` về cuối, không sửa mảng đầu vào.
  - Commit: `feat(grid): implement stable sortRows`.
  - Test: asc/desc, hai dòng bằng nhau giữ thứ tự gốc, `sort = null` trả đúng thứ tự gốc, giá trị `null`/`undefined`, "item2" trước "item10" nhờ `numeric`.
- [ ] **B2 `filterRows`.** Không phân biệt hoa thường, trên mọi cột có trong `columns`; chuỗi rỗng trả toàn bộ.
  - Commit: `feat(grid): implement filterRows`.
  - Test: khớp một phần, hoa thường, số được ép chuỗi, không khớp trả mảng rỗng, ký tự regex (`.*`) được coi là chữ thường.
- [ ] **B3 `paginate` và `pageWindow`.** `paginate(rows, page, size)` trả `{ rows, totalPages, page }` với `page` bị kẹp vào `[1, totalPages]`; `pageWindow(page, totalPages, max=5)` trả danh sách số trang quanh trang hiện tại.
  - Commit: `feat(grid): implement paginate and pageWindow`.
  - Test: trang đầu, cuối, vượt biên, 0 dòng (một trang rỗng, `totalPages = 1`), 7 dòng với size 10, cửa sổ ở đầu, giữa, cuối.
- [ ] **B4 `nextCell` và `cellId`.** `nextCell(cell, key, { rows, cols })` với `ArrowUp/Down/Left/Right`, `Home`, `End`, `Ctrl+Home`, `Ctrl+End`; kẹp biên, không vòng; `cellId(gridId, row, col)` và `parseCellId` là hai hàm ngược nhau.
  - Commit: `feat(grid): implement cell navigation model`.
  - Test: mỗi phím ở giữa và ở biên; phím lạ trả cùng ô; `parseCellId(cellId(...))` khứ hồi; id lạ trả `null`.
- [ ] **B5 `toggleSelection` và `nextSort`.** Hàm thuần: bật/tắt phần tử trong `Set` (trả `Set` mới, đóng băng); `nextSort(sort, key)` đi theo `SORT_CYCLE`.
  - Commit: `feat(grid): implement selection and sort cycle helpers`.
  - Test: bật rồi tắt, không sửa `Set` cũ; sort đổi cột thì quay về `asc`; đủ vòng `asc → desc → null`.

### Nhóm C — Engine (bản sao của HW1)

- [ ] **C1 Giữ caret khi khôi phục focus.** Mở rộng `readFocusedId`/`writeFocus` ở bản sao: nếu phần tử focus là `<input>`, ghi nhớ và khôi phục `selectionStart`/`selectionEnd`. Chỉ sửa trong `Homework1_Lab02/reactive-engine.js`, bản Exercise 3 không đổi.
  - Commit: `feat(engine): preserve caret when restoring focus`.
  - Lý do: gõ vào ô lọc làm `replaceChildren` tạo input mới; không có bước này, caret nhảy về đầu và gõ tiếp bị ngược (bài học lỗi mất chữ của Exercise 2).
  - Test: input có `value`, đặt caret giữa chuỗi, render lại, caret giữ nguyên; phần tử không phải input không lỗi.
  - Nghiệm thu: test engine cũ vẫn pass.

### Nhóm D — UI (mỗi tính năng một commit)

- [ ] **D1 Bảng tĩnh.** `data-grid.js`: `createDataGrid(props)` trả function component; dựng `<table role="grid" aria-label aria-rowcount>` với `<thead><tr><th scope="col">` và `<tbody><tr aria-rowindex><td>`; hiển thị toàn bộ `data`, chưa có sort/lọc/trang.
  - Commit: `feat(grid): render semantic table with grid roles`.
  - Test: đúng cấu trúc `table > thead > tr > th[scope=col]`, `tbody > tr > td`; `aria-rowcount`/`aria-rowindex` đúng; **chống XSS**: ô chứa `<img src=x onerror=alert(1)>` hiện như chữ, không tạo `<img>`; không có `div` trong bảng.
- [ ] **D2 Sắp xếp.** Cột `sortable` có `<button>` trong `<th>`; click gọi `nextSort`; `aria-sort` chỉ ở cột đang sort; vùng thông báo ghi "Sorted by Name, ascending".
  - Commit: `feat(grid): add column sorting with aria-sort`.
  - Test: click ba lần đi `ascending → descending → bỏ thuộc tính`; chỉ một `th` có `aria-sort`; cột không `sortable` không có `<button>`; `#status` đổi nội dung.
- [ ] **D3 Lọc.** `<label for>` + `<input type="search">`; gõ gọi `onInput`; `aria-rowcount` và `#status` cập nhật ("Showing 12 of 240 rows"); trả về trang 1.
  - Commit: `feat(grid): add text filter with live result count`.
  - Test: gõ lọc đúng dòng; nhãn gắn đúng input (`label[for]` khớp `id`); focus và caret còn sau mỗi ký tự; 0 kết quả hiện dòng "No matching rows" và thông báo.
- [ ] **D4 Phân trang.** `<nav aria-label="Pagination">` với nút Previous/Next và nút số trang; `aria-current="page"`; nút biên dùng `aria-disabled`; `#status` ghi "Page 3 of 24".
  - Commit: `feat(grid): add pagination nav`.
  - Test: click số trang đổi đúng 10 dòng; `aria-current` chỉ một nút; Previous ở trang 1 không đổi trang; `aria-rowindex` của dòng đầu trang 3 là 22 (1 tiêu đề + 20 dòng trước); lọc làm co số trang và kẹp trang hiện tại.
- [ ] **D5 Điều hướng bàn phím.** Roving tabindex, `onKeydown` ở `<table>`, di chuyển focus bằng `getElementById(...).focus()`; click vào ô cũng đặt `activeCell`. Bỏ qua `Enter`/`Space` khi `target` là `<button>` tiêu đề.
  - Commit: `feat(grid): add arrow key navigation with roving tabindex`.
  - Test: đúng một phần tử `tabindex="0"` trong bảng; mũi tên Phải, Xuống, Trái, Lên đổi `document.activeElement` theo đúng ô; `Home`, `End`, `Ctrl+Home`, `Ctrl+End`; biên không vòng; sau sort/lọc/chuyển trang `activeElement` không bao giờ là `<body>` và `activeCell` bị kẹp vào vùng còn tồn tại; dùng `e.key`, không `keyCode`.
- [ ] **D6 Chọn dòng.** `Enter` gọi `onRowSelect(item)`; `Space` bật/tắt `aria-selected` và `preventDefault`; dòng được chọn có dấu chữ, không chỉ màu.
  - Commit: `feat(grid): add row selection with Enter and Space`.
  - Test: `onRowSelect` nhận đúng `item` (kể cả sau sort và sang trang); `Space` hai lần về `aria-selected="false"`; `aria-selected` luôn là chuỗi; `Space` không chặn trên `<button>` tiêu đề.

### Nhóm E — Trang và kiểu dáng

- [ ] **E1 `index.html`, `main.js`, `style.css`.** `<html lang="en">`, `<title>` có nghĩa, `<main>` với `<h1>`, `#app`, `<p id="status" role="status">`; `main.js` gắn hub một lần và render grid với `EMPLOYEES`. CSS: bọc cuộn ngang, `:focus-visible` rõ, `scroll-padding` để focus không bị tiêu đề dính che, vùng bấm tối thiểu 2.5rem, ô được chọn có viền và dấu chữ.
  - Commit: `feat(ui): add grid page, entry point and styles`.
  - Test: `main.test.js` như Exercise 3 (hub đúng một lần, render lần đầu có 10 dòng); `style.css` chứa `:focus-visible` và `overflow-x`.

### Nhóm F — Kiểm chứng và bằng chứng

- [ ] **F1 Kiểm tương phản và kích thước.** Script `getComputedStyle` trong Edge như Exercise 3 mục 10.4, thêm ô chọn, hàng hover, nút phân trang.
  - Commit: `docs(hw1): record contrast and target-size measurements`.
- [ ] **F2 Lighthouse.** Chạy Accessibility và Best Practices, chế độ Desktop và Mobile, ở ba trạng thái: ban đầu, sau khi sort + lọc, trang cuối. Chụp ảnh vào `evidence/`. Đạt 100 mới tick; nếu không đạt, ghi từng mục lỗi và sửa bằng commit riêng.
  - Commit: `docs(hw1): add lighthouse evidence`.
  - Cách chạy: cửa sổ ẩn danh để extension không làm lệch điểm; tab Lighthouse trong DevTools của Edge hoặc Chrome, chọn Accessibility và Best Practices. Phần Accessibility của Lighthouse là tập con rule của axe-core, nên không có bước axe riêng.
  - Hệ quả của việc không cài axe: lỗi ARIA và cấu trúc bảng chỉ được bắt bằng test jsdom tự viết ở D1 đến D6 và bằng Lighthouse ở F2, nên các test cấu trúc ở D1 đến D6 phải kiểm kỹ `role`, `scope`, `aria-rowindex`, `aria-selected`, `aria-sort`.
  - Việc của bạn: ảnh chụp từ DevTools thật; mình không khẳng định thay.
- [ ] **F3 Kiểm tay bàn phím và trình đọc màn hình.** Chỉ dùng bàn phím; thử NVDA hoặc Narrator: đọc `aria-label` của bảng, "row 2 of 241", tên cột, `aria-sort`, thông báo `#status`. Ghi cả kết quả không đạt.
  - Commit: `docs(hw1): record manual accessibility check`.
- [ ] **F4 Bảng kiểm WCAG 2.2 AA.** Điền mục 7 với cột "Cách kiểm" và "Trạng thái". Không ghi "đạt WCAG" khi còn dòng "Một phần" hoặc "Chưa làm".
  - Commit: `docs(hw1): fill wcag checklist`.
- [ ] **F5 Verify cuối và prompt log.** `npm test` toàn bộ; `grep` cấm (`var`, `innerHTML`, `keypress`, `keyCode`, `onclick=`, `addEventListener` trong file grid); `git diff --stat -- Exercise1_Lab02 Exercise2_Lab02 Exercise3_Lab02` rỗng; VS Code diagnostics sạch. Bạn export prompt log vào `docs/prompt_logs/`.
  - Commit: `docs(hw1): add prompt log`.

## 6. Điều kiện hoàn thành (checklist nghiệm thu)

- [ ] Dùng `<table>`, `<thead>`, `<tbody>`, `<th scope="col">`, `<button>` đúng chỗ (D1, D2)
- [ ] Mũi tên di chuyển giữa ô; `Enter` chọn; `Space` bật/tắt (D5, D6)
- [ ] Sort, lọc, phân trang chạy và có `aria-sort`, `aria-current`, thông báo trạng thái (D2 đến D4)
- [ ] Tương phản 4.5:1 (chữ) và 3:1 (viền, focus) (F1)
- [ ] Lighthouse Accessibility = 100 và Best Practices = 100, có ảnh (F2)
- [ ] Kiểm tay bằng bàn phím và ít nhất một trình đọc màn hình (F3)
- [ ] `npm test` pass, không sửa Exercise 1 đến 3 (F5)
- [ ] Mỗi commit atomic, Conventional Commits (toàn bộ)
- [ ] Prompt log đã export (F5)

## 7. Kiểm tra WCAG 2.2 AA (điền ở F4)

| Tiêu chí | Cách kiểm dự kiến | Trạng thái |
|---|---|---|
| 1.3.1 Thông tin và quan hệ | Test cấu trúc bảng; cây accessibility trong Edge | Chưa làm |
| 1.4.1 Không chỉ dùng màu | Dòng được chọn và cột sort có chữ hoặc dấu; xem ảnh | Chưa làm |
| 1.4.3 Tương phản | Script `getComputedStyle` (F1) và Lighthouse | Chưa làm |
| 1.4.10 Reflow | Thu cửa sổ về 320 px, kiểm không cuộn ngang trang (chỉ bảng cuộn) | Chưa làm |
| 1.4.11 Tương phản phi văn bản | Viền nút, focus, viền ô (F1) | Chưa làm |
| 2.1.1 Bàn phím | Test jsdom (D5, D6) và thử tay (F3) | Chưa làm |
| 2.4.3 Thứ tự focus | Test `activeElement` sau sort/lọc/trang; thử tay | Chưa làm |
| 2.4.7 Focus nhìn thấy | `:focus-visible`; xem ảnh | Chưa làm |
| 2.4.11 Focus không bị che | Kiểm khi cuộn bảng và khi tiêu đề dính (nếu có) | Chưa làm |
| 2.5.8 Vùng bấm 24×24 | Đo `getBoundingClientRect` (F1) | Chưa làm |
| 3.3.2 Nhãn | `<label for>` của ô lọc; test | Chưa làm |
| 4.1.2 Tên, vai trò, giá trị | `aria-label` bảng, `aria-sort`, `aria-selected`, `aria-current` | Chưa làm |
| 4.1.3 Thông báo trạng thái | Test `#status`; NVDA (F3) | Chưa làm |

## 8. Rủi ro và điểm cần giải thích khi bảo vệ

- **Mỗi phím mũi tên render lại cả bảng.** Engine thay cả cây bằng `replaceChildren`. Với 10 dòng thì không đáng kể, nhưng focus phải được trả lại bằng `getElementById(...).focus()` ngay sau render; thiếu bước đó thì focus rơi về `<body>`. Có test D5 bắt lỗi này.
- **`writeFocus` khôi phục focus cũ, không phải ô đích.** Đây là lý do handler phải tự gọi `.focus()`. Nếu thầy hỏi vì sao không sửa engine: giữ engine nhỏ, quyết định nằm ở một chỗ (handler của grid).
- **`aria-selected={false}` bị `createElement` bỏ.** `applyProp` bỏ qua giá trị `false`; phải truyền chuỗi `'false'`.
- **Nhãn dùng `for`, không dùng `htmlFor`.** Engine chỉ ánh xạ `className → class`; `htmlFor` sẽ thành attribute sai.
- **`role="grid"` trái luật "không role thừa".** Đề bắt buộc bất biến; ngoại lệ đã ghi ở mục 4. `aria-sort` chỉ gắn một cột, khác gợi ý "`none`" ở bản nháp cũ (APG khuyến nghị vậy).
- **Lighthouse 100 không đồng nghĩa WCAG.** Công cụ tự động chỉ phủ một phần; F3 là phần kiểm tay bắt buộc.
- **Phản hồi trình đọc màn hình khác nhau** giữa NVDA, JAWS, Narrator; chỉ ghi kết quả của công cụ đã thử.
- **Chuỗi thông báo giống hệt lần trước** có thể không được đọc lại; nếu gặp khi thử (F3), xoá nội dung `#status` trước khi ghi.

## 9. Câu hỏi còn mở và giả định

| Câu hỏi | Mặc định đang dùng | Trạng thái |
|---|---|---|
| `Enter` chọn, `Space` bật/tắt nghĩa là gì | `Enter` = `onRowSelect` cho dòng; `Space` = bật/tắt `aria-selected` (chọn nhiều) | Giả định, chờ bạn xác nhận |
| Số commit tối thiểu | Một commit mỗi task (khoảng 20) | Đề chưa nói |
| `AI_FAILURE_AUDIT.md` cho bài này | Không bắt buộc riêng; ghi lỗi AI gặp ở F5 nếu có | Chờ bạn xác nhận |
| Công cụ kiểm tra tự động | Chỉ Lighthouse trong DevTools; không cài `axe-core` hay `lighthouse` CLI, `package.json` không đổi | Đã chốt |
| Kích thước dữ liệu và cỡ trang | 240 dòng, 10 dòng mỗi trang | Giả định |
| Lệnh typecheck | Chỉ VS Code diagnostics, như Exercise 3 | Giả định |
| Lọc theo cột hay toàn bảng | Một ô lọc cho toàn bảng | Giả định |

## 10. Ghi chú nguồn

Đề gốc: slide Homework 1 (đã chép ở mục 2 và 3). Chuẩn WCAG: [project-rules mục 8](../docs/project-rules.md). Mẫu tương tác: ARIA Authoring Practices Guide, các mẫu "Data Grid" và "Sortable Table" (chưa tra lại bản mới nhất; đối chiếu khi làm D2 và D5).
