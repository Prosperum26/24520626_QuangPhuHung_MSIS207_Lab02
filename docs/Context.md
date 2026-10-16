# Context.md — Lab 02: Mini React Engine (VDOM, JSX, Reconciliation)

> Môn: MSIS207 (Phát triển phần mềm) · SV: 24520626 – Quang Phú Hùng
> Tài liệu này là nguồn sự thật về **bối cảnh, phạm vi và kiến thức** của lab. Quy tắc làm việc với AI nằm ở [Agents.md](../Agents.md).

---

## 1. Mục tiêu lab

Tự xây một engine kiểu React tối giản để hiểu cơ chế bên dưới, thay vì chỉ dùng React:

1. Biểu diễn UI bằng **VNode** (POJO).
2. Viết `createElement` + `renderToDOM` đệ quy.
3. Viết `useState` bằng closure + cursor, và **event delegation** hub.
4. Hiểu (ở mức awareness) JSX được biên dịch thế nào và reconciliation chạy ra sao.

Triết lý xuyên suốt: **AI sinh code (xác suất), developer kiểm chứng (tất định)**. AI tăng tốc, không thay thế việc hiểu nền tảng.

## 2. Phạm vi theo 3 tier

| Tier | Mức độ | Nội dung | Làm gì trong lab |
|---|---|---|---|
| **1 – CORE** | Phải tự cài đặt | POJO VNode; `createElement`; `createTextElement`; `renderToDOM` đệ quy; `useState` (cursor + closure); event delegation hub; reconciliation O(n) (type + key) | Code + test + commit |
| **2 – AWARENESS** | Hiểu để debug/tra cứu | Babel AST (Parser → Traverser → Generator); automatic JSX runtime (`_jsx`/`_jsxs`); Fiber work loop, time slicing; SyntheticEvent pooling; Scheduler (`MessageChannel`/`requestIdleCallback`) | Đọc, ghi chú, trả lời câu hỏi; **không** tự cài |
| **3 – LATER** | Lab sau | RSC, Suspense streaming, SSR hydration, Server Actions, Edge runtime, Island hydration | **Ngoài phạm vi** — không đụng tới |

> Quy tắc scope: nếu một việc thuộc Tier 2/3 thì chỉ giải thích, không cài đặt.

## 3. Kiến thức cốt lõi

### 3.1 Vì sao cần Virtual DOM
- Pipeline trình duyệt: JS → Style → Layout (reflow) → Paint → Composite.
- Reflow buộc tính lại hình học ancestor/sibling. **Layout thrashing** = đọc (`offsetWidth`) xen kẽ ghi (`style.width`) trong vòng lặp → tụt khung hình.
- Chiến lược VDOM: tính state trong bộ nhớ (POJO) → diff ra changeset tối thiểu → áp dụng DOM thật một lần (một commit phase / một animation frame).

### 3.2 VNode contract
- POJO nhẹ, không prototype chain, serializable (hỗ trợ SSR, snapshot test).
- Dạng chuẩn dùng trong lab (khớp với code `createElement`):

```ts
export type VNodeType = string | ((props: any) => VNode);

export interface VNode {
  readonly type: VNodeType;            // tag string | function component | 'TEXT_ELEMENT'
  readonly props: {
    readonly children: VNode[];        // luôn là mảng VNode
    readonly nodeValue?: string;       // chỉ cho TEXT_ELEMENT
    readonly key?: string | number;
    readonly [prop: string]: unknown;
  };
}
```

- Leaf luôn được chuẩn hoá thành `TEXT_ELEMENT`.

### 3.3 `createElement`
- Chuẩn hoá primitive (string/number) thành `TEXT_ELEMENT`.
- Lọc `null`, `undefined`, `false`; `flat(Infinity)` cho children lồng nhau.
- `props` luôn là object (fallback `{}` khi `null`).
- Trả về object **frozen** (immutability, tránh shared-state mutation).

### 3.4 `renderToDOM`
1. Tạo node: `createTextNode` cho `TEXT_ELEMENT`, `createElement` cho tag.
2. Gán prop (bỏ `children`, `nodeValue`); prop bắt đầu bằng `on` → listener (xem 3.6).
3. Đệ quy children, `appendChild`.
4. Mount vào container bằng `replaceChildren()`.
5. Function component: gọi `type(props)` ra VNode rồi render tiếp (typeguard `typeof type === 'function'`).

### 3.5 JSX và compiler (Tier 2)
- JSX **không phải** HTML trong JS; nó là cú pháp macro được biên dịch thành lời gọi hàm.
- Chữ thường (`div`) → string tag; chữ hoa (`Card`) → tham chiếu hàm. Attribute → object props; children lồng → đối số variadic/mảng.
- Pipeline: (1) Lex + parse → AST; (2) Traverse/transform (visitor trên `JSXElement`, plugin transform-react-jsx); (3) Codegen.
- Classic runtime: cần `import React`, phát ra `React.createElement`. Automatic runtime: compiler tự import `_jsx`/`_jsxs` từ `react/jsx-runtime`, children nằm trong `props.children`, `_jsxs` cho children tĩnh nhiều phần tử.
- Bundler hiện đại (Vite/esbuild/SWC) làm việc này bằng Rust/Go. TS: `"jsx": "react-jsx"`.
- **Lab này**: dùng custom `createElement` làm JSX factory (classic-style, `jsxFactory`), hoặc tự gọi hàm trực tiếp. Không dùng Babel standalone.

### 3.6 Event handling
- Cấm inline handler (`onclick="..."`) và `keypress`/`keyCode`; dùng `keydown` + `e.key`/`e.code`.
- Event delegation: một hub lắng nghe ở root, tra handler theo target, thay vì gắn listener lên từng node.
- Lưu ý code mẫu: `name.toLowerCase().substring(2)` biến `onClick` → `click`.

### 3.7 `useState` (Tier 1)
- State là **mảng tuyến tính + con trỏ (cursor)**; mỗi lần render reset cursor về 0.
- Mỗi `useState` đọc/ghi `states[cursor]`, giữ `cursor` bằng closure rồi tăng.
- Hệ quả: hook phải gọi **cùng thứ tự mọi lần render** (không trong `if`/loop).
- Setter cập nhật state rồi lên lịch re-render (batch).

### 3.8 Reconciliation (Tier 1, O(n))
- So sánh cây tổng quát là O(n³); React dùng 2 heuristic để về O(n):
  1. Khác `type` → huỷ cả cây cũ, dựng lại.
  2. Dùng `key` ổn định để nhận diện child giữa các lần render.
- Chỉ so sánh **cùng cấp**.
- Quyết định diff: `REPLACE` (type đổi / không có old) → `TEXT`/`NOOP` (text node) → `UPDATE` (diff props + diff children theo key).
- Patch action: `CREATE`, `REMOVE`, `UPDATE_PROPS`, `REORDER`.
- **Index làm key = bug**: xoá phần tử đầu thì state cục bộ (vd. nội dung input) "dính" sang phần tử khác. Key phải là ID thực thể bền vững (`task.uuid`).
- Fiber (awareness): node nối thành linked list (`child`, `sibling`, `return`) cho phép ngắt/tiếp tục render.

## 4. Chuẩn kỹ thuật bắt buộc (Modernization Audit)

| ❌ Cấm | ✅ Dùng |
|---|---|
| `var`, implicit global | `const` / `let` |
| `keypress`, `e.keyCode` | `keydown`, `e.key` / `e.code` |
| `innerHTML` với dữ liệu người dùng | DOM API, `textContent`, `replaceChildren` (chống XSS) |
| Inline handler `onclick=...` | Event delegation tập trung |
| Babel standalone | Vite/esbuild + JSX transform hiện đại |

## 5. Quy trình 4 giai đoạn (Anti-Monolithic Vibe Coding)

1. **Functional Slicing** — chia yêu cầu thành bài toán con độc lập.
2. **Contract-First** — viết interface/schema TypeScript trước khi sinh code.
3. **Atomic Generation** — mỗi lần prompt AI chỉ **một** hàm/module.
4. **Independent Verification** — kiểm chứng bằng DevTools profiler, test case, `git diff`.

Artifact bắt buộc: [project-rules.md](project-rules.md) và `TASK_DECOMPOSITION.md` (WBS, một file riêng trong folder của mỗi bài). Hợp đồng runtime:

```ts
export interface SystemContract<TState, TEvent> {
  readonly state: Readonly<TState>;
  transition(event: TEvent): TState;
  verifyInvariants(): boolean; // phải pass lúc runtime
}
```

## 6. Giả định (cần xác nhận / sửa)

Slide không nói rõ các điểm sau, mình tạm giả định:

- **Stack**: Vite + TypeScript cho contract/engine; test bằng Vitest (jsdom). Nếu đề yêu cầu JS thuần, bỏ TS và giữ contract dưới dạng JSDoc.
- **Cấu trúc đề xuất**:
  ```
  src/
    core/        vnode.ts, createElement.ts, renderToDOM.ts
    hooks/       useState.ts
    events/      delegation.ts
    reconcile/   diff.ts, patch.ts
    main.tsx
  tests/
  ```
- **Deliverable** của lab (báo cáo/demo/nộp bài) chưa rõ — bổ sung vào đây khi có đề.
- Phần reconciliation + `useState` có thuộc yêu cầu nộp hay chỉ VNode + render? Slide xếp cả hai vào Tier 1 nên mặc định là có.

## 7. Lỗi/mơ hồ trong tài liệu gốc (đừng chép nguyên)

Slide được chép từ ảnh nên có chỗ sai/vỡ định dạng. Khi dùng làm đặc tả, sửa như sau:

- `VNode` interface bị vỡ; sample đặt `children` trong `props` còn mô tả ghi `children` riêng → **chốt `props.children`** (mục 3.2).
- `diff` dùng lẫn `newNode`/`newVNode`/`newWNode` → thống nhất `newVNode`.
- `renderToDOM`: `'TEXT ELEMENT'` thiếu gạch dưới → `'TEXT_ELEMENT'`; dòng gán prop `dom[name === 'className' ? ...]` bị vỡ.
- `createElement` mẫu chưa có `Object.freeze`, chưa thấy nhánh function component, chưa xử lý `key`.
- Ví dụ layout-thrashing: `}` đặt sai chỗ, `width` đọc trong vòng lặp phải đưa ra ngoài (đọc một lần, ghi sau).
- Ví dụ key anti-pattern: `Key ('Task A'...` nên là `key 0 / key 1` (index) để ví dụ có nghĩa.
- Mã `name.startsWith('on')` cần whitelist/escape hợp lý, và event delegation (3.6) thay thế `addEventListener` từng node.
