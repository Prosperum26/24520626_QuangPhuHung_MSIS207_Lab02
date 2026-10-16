# Exercise 1 — Task Decomposition

> Bối cảnh: [Context](../docs/Context.md). Quy tắc: [project-rules](../docs/project-rules.md) và [Agents](../Agents.md).
> Quy ước: tick `[x]` chỉ khi task đã chạy lệnh kiểm chứng và thấy output thật.

## 1. Thông tin chung

| Mục | Nội dung |
|---|---|
| Tên bài | Building Mini-React VNode & Mounting Engine |
| Hình thức | In-class Sprint 1, 35 phút |
| Mục tiêu | Tự cài `createElement`, `createTextElement`, `renderToDOM` |
| Ngôn ngữ | JavaScript thuần, contract bằng JSDoc, bật `// @ts-check` (đã chốt) |
| File engine | `Exercise1_Lab02/mini-react.js` (slide import `./mini-react.js`) |
| Test | Vitest + jsdom, file `Exercise1_Lab02/mini-react.test.js` |

## 2. Ràng buộc từ đề

1. **Semantic HTML:** dùng `<main>`, `<header>`, `<button>`. Cấm div-soup.
2. **Bảo mật:** `<script>alert(1)</script>` và `<img onerror=alert(1)>` làm child phải hiện như text.
3. **DevTools audit:** panel Elements khớp cây VNode, không có node mồ côi.
4. **Git:** đúng 2 commit, theo thứ tự:
   1. `feat(core): implement createElement factory`
   2. `feat(core): implement renderToDOM`

## 3. Quyết định thiết kế (mỗi quyết định ở một chỗ)

| Quyết định | Chốt | Lý do |
|---|---|---|
| Hằng loại text | `TEXT_ELEMENT` export một lần | Sửa tên ở một chỗ khi bị đổi lúc bảo vệ |
| Ánh xạ `className` → `class` | Một hàm `applyProp` duy nhất | Đột biến thầy hay đổi ở đây |
| Tên event | `name.toLowerCase().substring(2)` trong một hàm `eventNameOf` | `onClick` → `click` |
| Gắn listener | `addEventListener` trực tiếp trên node | Event delegation là Exercise 2; ghi chú `why` trong code |
| `key` | Giữ trong `props.key`, chưa dùng ở bài này | Reconciliation thuộc Exercise sau |
| Nơi `Object.freeze` | Chỉ trong `createElement` và `createTextElement` | Immutability của VNode |
| Function component | `renderToDOM` gọi `type(props)` khi `typeof type === 'function'` | Typeguard mà đề yêu cầu "kiểm chứng chặt" |

## 4. WBS

Mỗi task là một lượt làm riêng (Slice → Contract → Generate → Verify). Test đi cùng module của nó.

### Nhóm A — Commit 1: `feat(core): implement createElement factory`

- [ ] A0 Setup: `package.json`, Vitest + jsdom, script `test`. **Hỏi trước khi cài dependency.**
- [ ] A1 Contract: JSDoc typedef `VNode`, `VNodeProps`, hằng `TEXT_ELEMENT`, chữ ký ba hàm (chưa có thân hàm).
- [ ] A2 `createTextElement(text)`: trả VNode `TEXT_ELEMENT`, `nodeValue` là chuỗi, `children: []`, frozen. Test: số được ép thành chuỗi, kết quả frozen.
- [ ] A3 `createElement(type, props, ...children)`:
  - bọc `string`/`number` thành text VNode
  - lọc `null`, `undefined`, `false`
  - `flat(Infinity)` cho children lồng nhau
  - `props` null thành `{}`
  - `Object.freeze` cả VNode lẫn `props`
  - Test: từng ý trên một case, thêm case `0` không bị lọc nhầm.
- [ ] A4 Verify và commit 1: chạy `npm test`, xem `git diff`, kiểm tra không còn `var`/`innerHTML`, commit đúng message.

### Nhóm B — Commit 2: `feat(core): implement renderToDOM`

- [ ] B1 `renderToDOM(vNode)` nhánh tạo node: `createTextNode` cho `TEXT_ELEMENT`, `document.createElement` cho tag. Test: text vs element.
- [ ] B2 `applyProp(dom, name, value)`: bỏ `children`/`nodeValue`/`key`, ánh xạ `className` → `class`, gán attribute bằng `setAttribute`. Test: `id`, `role`, `className`.
- [ ] B3 Prop `on*`: `eventNameOf` rồi `addEventListener`. Test: dispatch `click` gọi handler đúng một lần.
- [ ] B4 Đệ quy children + `appendChild` + nhánh function component (typeguard). Test: cây lồng 3 cấp, component trả cây con.
- [ ] B5 Test bảo mật: child là `<script>alert(1)</script>` và `<img onerror=alert(1)> Safe Text` hiện như text; `querySelector('script')` và `querySelector('img')` đều `null`.
- [ ] B6 Checkpoint 1: chạy `test-runner.js` của đề trong trình duyệt, `console.assert` không báo lỗi.
- [ ] B7 Audit DevTools: Elements khớp VNode, không node mồ côi, ghi nhận `role="main"` thừa; lưu ảnh chụp vào `Exercise1_Lab02/evidence/` (có alt text khi nhúng).
- [ ] B8 Export prompt log vào `docs/prompt_logs/`; verify, commit 2 đúng message.

## 5. Bộ kiểm tra Checkpoint 1

Bản đã sửa cú pháp từ slide:

```js
// test-runner.js — Checkpoint 1
import { createElement, renderToDOM } from './mini-react.js';

const vApp = createElement(
  'main',
  { id: 'root-view', role: 'main' },
  createElement(
    'header',
    { className: 'hero' },
    createElement('h1', null, 'Mini React Engine'),
    createElement('p', null, '<img onerror=alert(1)> Safe Text')
  ),
  createElement('button', { onClick: () => console.log('Ping') }, 'Click')
);

const root = document.getElementById('app');
root.replaceChildren(renderToDOM(vApp));
console.assert(root.querySelector('button') != null, 'Mount Failed');
```

Lưu ý:
- `role="main"` trên `<main>` là thừa. Giữ theo đề, ghi nhận khi audit.
- Chuỗi `<img onerror=alert(1)> Safe Text` phải hiện nguyên văn, không tạo thẻ `<img>`.

## 6. Điều kiện hoàn thành

- [ ] `createTextElement`, `createElement`, `renderToDOM` đều có trong `mini-react.js`
- [ ] `npm test` pass, dán output thật
- [ ] `console.assert` của Checkpoint 1 không báo lỗi
- [ ] Không có `<div>` thừa; thẻ ngữ nghĩa đúng chỗ
- [ ] `<script>alert(1)</script>` làm child: không có alert, không có thẻ `<script>` trong DOM
- [ ] DevTools Elements: cây DOM khớp cây VNode, không node mồ côi
- [ ] Đúng 2 commit, đúng message và thứ tự ở §2
- [ ] Prompt log đã export vào `docs/prompt_logs/`

## 7. Câu hỏi còn mở

| Câu hỏi | Mặc định đang dùng | Trạng thái |
|---|---|---|
| Dùng JS hay TS | JS + JSDoc `@ts-check` | Đã chốt |
| Vị trí `mini-react.js` | Gốc `Exercise1_Lab02/` | Giả định, chờ xác nhận |
| `addEventListener` trực tiếp ở bài này | Chấp nhận, delegation để Exercise 2 | Giả định, chờ xác nhận |
| Chỗ lưu ảnh DevTools | `Exercise1_Lab02/evidence/` | Giả định, chờ xác nhận |
| "Đúng 2 commit" có tính commit docs và setup không | Setup vào commit 1; cập nhật tick WBS đi cùng commit 2 | Cần xác nhận, mâu thuẫn với Agents.md §5 (mỗi task một commit) |
