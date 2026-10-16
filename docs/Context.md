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

### 2.1 Bài tập và đánh giá

| Bài | Chủ đề | Thời lượng | Ghi chú |
|---|---|---|---|
| Exercise 1 | VNode và mounting engine | 35 phút | [Exercise1_Lab02](../Exercise1_Lab02/TASK_DECOMPOSITION.md) |
| Exercise 2 | `useState` và delegation hub (Task Manager) | 40 phút | [Exercise2_Lab02](../Exercise2_Lab02/TASK_DECOMPOSITION.md) |
| Exercise 3 | FSM 4 trạng thái và skeleton loader | 35 phút | [Exercise3_Lab02](../Exercise3_Lab02/TASK_DECOMPOSITION.md) |
| Homework 1 | Data-Grid WCAG 2.2 AA, Lighthouse 100 | 1 tuần | [Homework1_Lab02](../Homework1_Lab02/TASK_DECOMPOSITION.md) |
| Homework 2 | Hàng đợi FIFO âm thanh và visualizer | 1 tuần | [Homework2_Lab02](../Homework2_Lab02/TASK_DECOMPOSITION.md) |
| Homework 3 | Flash-sale engine, timer không trôi | 1 tuần | [Homework3_Lab02](../Homework3_Lab02/TASK_DECOMPOSITION.md) |

Các thành phần điểm đã biết (phần còn lại chưa rõ):

| Thành phần | Tỉ trọng | Ghi chú |
|---|---|---|
| Bảo vệ trực tiếp (live defense) | 25% | Mã chưa kiểm chứng được thì điểm phần này bằng 0 (xem 3.15) |
| `AI_FAILURE_AUDIT.md` | 15% | 3 lỗi AI có bằng chứng DevTools và bản sửa thủ công |

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

### 3.9 Function component (Tier 1)
- Component là hàm thuần: `f(props, state) = VNode`. Cùng input phải ra cùng output.
- Tên viết hoa (`<Header />`) là component, viết thường (`<header>`) là thẻ native.
- **Props bất biến và chảy một chiều** từ cha xuống con. Component con không được sửa props nhận vào.
- Ưu tiên composition hơn inheritance: dùng `props.children` và render props.
- Contract mẫu:

```ts
interface CardProps {
  title: string;
  status: 'active' | 'archived';
  children: VNode | VNode[];
}
```

- Ví dụ `StatusCard` trong slide trả về `<article>` với `<header>` và `<h3>`. Phần body trong slide dùng `<div className="card__body">`; khi làm bài nên cân nhắc thẻ ngữ nghĩa hơn (xem quy tắc "không div-soup").

### 3.10 State store và call-order của hook (Tier 1)
- Hàm component chạy lại từ đầu mỗi lần render, nên state **không** nằm trong hàm. State nằm trong mảng tuyến tính bên ngoài, do runtime quản lý.
- Cursor là con trỏ toàn cục cho biết hook nào đang xin state. Reset về 0 trước mỗi lần render. Setter đóng (closure) trên `currentCursor` được cấp lúc gọi hook.
- Trình tự `useState`:
  1. Khởi tạo: nếu `states[cursor]` chưa có thì gán giá trị đầu.
  2. Tạo dispatcher: `const currentCursor = cursor`.
  3. Nếu setter nhận hàm, gọi hàm đó với state trước.
  4. Chỉ re-render khi giá trị đổi thật (`Object.is`).
- API tối thiểu của runtime: `useState`, `setRenderer(fn)`, `resetCursor()`.
- **Quy tắc Hooks** (bất biến thứ tự gọi):
  1. Chỉ gọi hook ở top level của component hoặc custom hook.
  2. Không gọi trong `if`, `for`/`while` hay hàm lồng.
  - Vi phạm làm lệch cursor: ví dụ `BuggyProfile` bỏ hook `tier` ở render 2 thì `age` nhận nhầm giá trị `'Platinum'` (state bị hỏng). Ngoài đời, `eslint-plugin-react-hooks` bắt lỗi này lúc build.

### 3.11 Event delegation hub (Tier 1)
- Cách ngây thơ gắn hàng nghìn `addEventListener` tốn bộ nhớ và tạo áp lực GC.
- Delegation: gắn **một** listener cho mỗi loại event (`click`, `input`, `keydown`) ở root; sự kiện nổi bọt lên, hub đọc `event.target`.
- Hub đi ngược từ `target` lên `rootContainer` qua `parentElement`, tìm node có handler tương ứng (`onClick`, `onInput`, `onKeydown`...) rồi gọi và dừng.
- Điều kiện để hub chạy: `renderToDOM` phải lưu VNode vào DOM node (ví dụ `dom._vnode = vNode`) để hub tra `props` được.
- Synthetic event (chuẩn hoá cross-browser, pooling) chỉ ở mức awareness, không cài.

### 3.12 Re-render lan truyền và memo hóa (hiệu năng)
- Mặc định, khi cha render thì mọi component con bị gọi lại. Re-render **không** đồng nghĩa với đổi DOM thật; nó chỉ tính lại cây VDOM.
- Điểm nghẽn: cây lớn phải cấp phát hàng nghìn VNode (ví dụ `<ExpensiveDataVisualization />` bị gọi lại khi chỉ có bộ đếm của cha đổi).
- **Quy tắc kỹ thuật:** tối ưu sau khi đo bằng profiler (React DevTools Profiler hoặc Performance panel). Không tối ưu sớm.
- Công cụ:
  - `memo(Component)`: so sánh nông (`Object.is`) giữa props cũ và mới, bỏ qua render nếu giống nhau.
  - `useMemo(() => fn, [deps])`: lưu kết quả của hàm thuần tốn kém.
  - `useCallback(fn, [deps])`: giữ tham chiếu hàm ổn định để không phá `memo` ở component con.
- Cạm bẫy: object hoặc mảng literal tạo trong thân render là tham chiếu mới mỗi lần, làm `memo` mất tác dụng.
- Mẫu `memo` tự viết (đã chỉnh lỗi gõ):

```js
export function memo(FunctionalComponent) {
  let prevProps = null;
  let prevVNode = null;
  return function MemoizedComponent(props) {
    if (prevProps && shallowEqual(prevProps, props)) {
      return prevVNode; // Bỏ qua: dùng lại cây VNode đã lưu
    }
    prevProps = props;
    prevVNode = FunctionalComponent(props);
    return prevVNode;
  };
}

function shallowEqual(objA, objB) {
  const keysA = Object.keys(objA);
  return (
    keysA.length === Object.keys(objB).length &&
    keysA.every((key) => Object.is(objA[key], objB[key]))
  );
}
```

### 3.13 Windowing (virtual scrolling) cho danh sách lớn
- Vấn đề: dựng 100.000 `<tr>` làm sập thiết bị di động và cạn bộ nhớ (OOM).
- Ý tưởng: chỉ dựng lát cắt đang giao với viewport (khoảng 10 đến 20 dòng), số node DOM gần như không đổi (O(1)).
- **Phantom spacer:** một vùng vô hình cao `totalHeight = itemCount * itemHeight` để thanh cuộn thể hiện đúng toàn bộ danh sách.
- Các dòng thật được dịch vị trí bằng `transform: translateY(offsetY)` (tăng tốc GPU).
- Công thức:

```ts
startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
endIndex   = Math.min(totalCount, Math.ceil((scrollTop + viewportHeight) / itemHeight) + overscan);
offsetY    = startIndex * itemHeight;
totalHeight = totalCount * itemHeight;
```

- Overscan 2 đến 3 dòng trên và dưới để tránh nháy trắng khi cuộn nhanh.
- Hàm mẫu đã chỉnh lỗi gõ:

```ts
export interface WindowParams {
  scrollTop: number;
  viewportHeight: number;
  itemHeight: number;
  totalCount: number;
  buffer?: number;
}

export function calculateWindow({
  scrollTop, viewportHeight, itemHeight, totalCount, buffer = 2,
}: WindowParams) {
  const rawStart = Math.floor(scrollTop / itemHeight);
  const visibleCount = Math.ceil(viewportHeight / itemHeight);
  const startIndex = Math.max(0, rawStart - buffer);
  const endIndex = Math.min(totalCount, rawStart + visibleCount + buffer);
  const offsetY = startIndex * itemHeight;
  const totalHeight = totalCount * itemHeight;
  return { startIndex, endIndex, offsetY, totalHeight };
}
```

- Truy cập được: danh sách ảo hóa cần `aria-rowcount`/`aria-rowindex` (hoặc `aria-setsize`/`aria-posinset`) để trình đọc màn hình biết tổng số dòng, và bàn phím phải cuộn tới mục chưa dựng.

### 3.14 Runtime VDOM và compiler (awareness, Tier 2)
- **Runtime reconciliation** (React, Vue): đóng gói engine (khoảng 40 đến 100 KB), so sánh cây VDOM lúc chạy, rất linh hoạt.
- **Compiler** (Svelte, Solid): biên dịch component thành lệnh sửa DOM chính xác (`text_node.data = ctx.count`), không có VDOM, không có thuật toán diff lúc chạy, bundle nhỏ, phản ứng mịn (fine-grained).
- Cùng thay đổi `count += 1`: React chạy lại `App()`, cấp phát VDOM mới, diff, rồi vá DOM; compiler chỉ gán trực tiếp node bị ảnh hưởng.
- Chỉ cần hiểu và so sánh, không phải cài đặt.

### 3.15 Bảo vệ trực tiếp 3 phút (live defense)
- 1 đối 1 tại bàn giảng viên, 60 đến 180 giây, chiếm **25%** điểm. Mã không kiểm chứng được thì điểm phần này bằng 0.
- Giảng viên sửa một biến kiến trúc trên repo đang chạy; sinh viên phải **chẩn đoán nguyên nhân, sửa logic ngay, và kiểm chứng bằng DevTools**.
- Ví dụ đột biến đã biết:
  - Đổi setter đồng bộ sang hàng đợi microtask (batch).
  - Đổi ánh xạ prop `className` sang `class`.
  - Đảo logic overscan của cửa sổ ảo.
- Thử thách mẫu:
  - A: `renderToDOM` hỗ trợ SVG, dùng `document.createElementNS('http://www.w3.org/2000/svg', type)`.
  - B: `useState` phải xử lý setter dạng hàm: `typeof nextValue === 'function' ? nextValue(prev) : nextValue`.
  - C: thêm kiểm tra phát hiện vòng lặp (cycle) khi làm phẳng `children` trong `createElement`.
- Hệ quả thiết kế: giữ mã nhỏ, tách module rõ ràng, tên có nghĩa, mỗi quyết định (ánh xạ prop, nơi gọi `triggerRender`, thuật toán cửa sổ) nằm ở **một chỗ** để sửa nhanh. Phải hiểu từng dòng, nên không nhận mã AI mà không giải thích được.

## 4. Chuẩn kỹ thuật bắt buộc (Modernization Audit)

| Cấm | Dùng thay thế |
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
- `useState` mẫu dùng `stateStore[cursor] ?? initialValue`: nếu state hợp lệ là `null`/`undefined` thì bị khởi tạo lại mỗi lần. Nên kiểm tra theo độ dài mảng hoặc cờ "đã khởi tạo".
- `useState` mẫu không gọi `resetCursor()` ở đâu; runtime phải gọi trước mỗi lần render, nếu không cursor tăng mãi.
- Event hub mẫu chỉ chạy khi DOM node có `_vnode`; slide `renderToDOM` chưa gán thuộc tính này.
- Slide `functional-component` có `className={card card--${status}}` thiếu dấu backtick; viết lại là `` className={`card card--${status}`} ``.
- Slide Exercise 1 bị vỡ cú pháp (thiếu `=`, ngoặc); bản sửa nằm trong [Exercise1_Lab02/TASK_DECOMPOSITION.md](../Exercise1_Lab02/TASK_DECOMPOSITION.md).
- Slide Exercise 2: template literal hỏng (`` `Task ${Date.now()}` ``), biến `filter` khai báo nhưng chưa dùng, mẫu JSX nằm trong file `.js`.
- Slide Exercise 3: chuỗi `'LOADING"` lệch dấu nháy; `err.message` sai kiểu trong TypeScript (`err` là `unknown`); mẫu chưa chặn race condition dù mục tiêu bài là loại bỏ race condition.
- Slide `memo`: viết sai `prevWNode` (đúng là `prevVNode`) và đặt `prevProps = props` sai vị trí. Ngoài ra bộ nhớ đệm nằm ở phạm vi `memo()` nên mọi instance của cùng component dùng chung một cache; ở bản thật cache phải gắn theo từng instance.
- Slide `calculateWindow`: `offsety` (đúng là `offsetY`), thiếu toán tử (`rawStart - buffer`, `totalCount * itemHeight`). Cách tính `endIndex` của hàm (`rawStart + visibleCount + buffer`) có thể thiếu một dòng so với công thức (`Math.ceil((scrollTop + viewportHeight) / itemHeight) + buffer`) khi `scrollTop` không chia hết `itemHeight`; cần viết test kiểm tra biên.
- Slide thử thách B (live defense) bị vỡ ký hiệu (`Rightarrow`); ý đúng là setter dạng hàm `setCount(c => c + 1)`.
- Slide Homework 2 và Homework 3: khung mã chưa hoàn chỉnh (thiếu `AudioTask`, `processNext`); `Date.now()` có thể bị đổi giờ hệ thống nên không tuyệt đối đơn điệu.

## 8. Tài liệu và bài tập liên quan

- Quy tắc dự án (gồm WCAG 2.2 AA): [project-rules.md](project-rules.md)
- Báo cáo lỗi AI: [AI_FAILURE_AUDIT.md](AI_FAILURE_AUDIT.md)
- Bài tập: xem bảng ở mục 2.1 để mở từng `TASK_DECOMPOSITION.md`.
