# Exercise 1 — Task Decomposition (bản nháp ghi chú)

> Trạng thái: **mới ghi lại thông tin đề bài**. Chưa chia WBS. Khi bắt đầu làm, chia thành các task nhỏ theo [project-rules](../docs/project-rules.md) (mỗi task một sub-task, có bước verify).
> Kiến thức nền xem [Context](../docs/Context.md).

## 1. Thông tin chung

| Mục | Nội dung |
|---|---|
| Tên bài | Building Mini-React VNode & Mounting Engine |
| Hình thức | In-class Sprint 1, 35 phút |
| Mục tiêu | Tự cài `createElement`, `createTextElement`, `renderToDOM` |

## 2. Deliverable

- Không có "div-soup".
- Typeguard được kiểm chứng chặt.
- Audit trực tiếp bằng DevTools.

## 3. Ràng buộc

1. **Semantic HTML:** output phải dùng thẻ ngữ nghĩa như `<main>`, `<section>`, `<button>`. Cấm div-soup.
2. **Bảo mật:** kiểm tra khả năng chống XSS khi truyền chuỗi `<script>alert(1)</script>` làm child. Chuỗi phải hiển thị như text, không được thực thi.
3. **DevTools audit:** dùng panel Elements để xác nhận DOM khớp với cây VNode và không có node mồ côi (orphan).
4. **Git:** đúng 2 commit, theo thứ tự:
   1. `feat(core): implement createElement factory`
   2. `feat(core): implement renderToDOM`

## 4. Bộ kiểm tra Checkpoint 1

Slide gốc bị vỡ định dạng (thiếu dấu `=`). Dưới đây là bản đã chỉnh lại cho đúng cú pháp, giữ nguyên ý:

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

Cần lưu ý:
- File engine tên `mini-react.js`, export `createElement` và `renderToDOM`.
- `role="main"` trên `<main>` là thừa (thẻ đã có role ngầm). Giữ vì đề cho, nhưng nên ghi nhận khi audit.
- Chuỗi `<img onerror=alert(1)> Safe Text` phải hiện nguyên văn như text, không tạo thẻ `<img>`.

## 5. Điều kiện hoàn thành (checklist nghiệm thu)

- [ ] `createTextElement` và `createElement` có trong `mini-react.js`
- [ ] `renderToDOM` có trong `mini-react.js`
- [ ] `console.assert` ở trên không báo lỗi
- [ ] Không có `<div>` thừa; thẻ ngữ nghĩa đúng chỗ
- [ ] `<script>alert(1)</script>` làm child: không có hộp thoại alert, không có thẻ `<script>` trong DOM
- [ ] DevTools Elements: cây DOM khớp cây VNode, không node mồ côi
- [ ] Đúng 2 commit với đúng message ở §3
- [ ] Prompt log của bài đã export vào `docs/prompt_logs/`

## 6. Câu hỏi còn mở

- Cấu trúc file của bài: để `mini-react.js` ở gốc `exercise1/` hay trong `src/`?
- Có dùng TypeScript cho bài này không? Slide dùng file `.js`.
- `renderToDOM` trong bài này gắn `onClick` bằng `addEventListener` trực tiếp (theo slide mẫu). Event delegation là bài sau, nên chấp nhận tạm ở Exercise 1?
- Có cần lưu ảnh chụp DevTools làm bằng chứng không, và để ở đâu?
