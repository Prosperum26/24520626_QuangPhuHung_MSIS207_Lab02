# Exercise 3 — Task Decomposition

> Bối cảnh: [Context](../docs/Context.md). Quy tắc: [project-rules](../docs/project-rules.md) và [Agents](../Agents.md). Mẫu WBS: [Exercise 2](../Exercise2_Lab02/TASK_DECOMPOSITION.md).
> Quy ước: tick `[x]` chỉ khi task đã chạy lệnh kiểm chứng và thấy output thật. Mỗi lượt làm đúng một task. Tài liệu này là spec chính của bài; chưa có dòng code nào được viết.

## 1. Thông tin chung

| Mục | Nội dung |
|---|---|
| Tên bài | Resilient State Machine & Skeleton Loader |
| Hình thức | In-class Sprint 3, 35 phút |
| Mục tiêu | Loại bỏ race condition và trạng thái UI không nhất quán khi tải dữ liệu bất đồng bộ |
| Deliverable | Vòng đời 4 trạng thái bền vững: `IDLE`, `LOADING`, `SUCCESS`, `ERROR` |
| Ngôn ngữ | JavaScript thuần, contract bằng JSDoc, bật `// @ts-check` (giữ như Exercise 1 và 2) |
| Engine | Sao chép `mini-react.js` và `reactive-engine.js` từ Exercise 2 vào `Exercise3_Lab02/`, không sửa bản gốc |
| File mới | `state-machine.js`, `feed-mock.js`, `feed-loader.js`, `data-feed.js`, `main.js`, `index.html`, `style.css` |
| Test | Vitest + jsdom, mỗi module một file `*.test.js` cạnh nó |
| Luồng dữ liệu | click → hub → `loader.load(dispatch)` → `dispatch(event)` → `setState(prev => transition(prev, event))` → re-render |

## 2. Ràng buộc từ đề

1. **Máy trạng thái hữu hạn (FSM):** `status` chỉ là một trong `'IDLE' | 'LOADING' | 'SUCCESS' | 'ERROR'`.
2. **Skeleton screen:** khi `LOADING`, hiển thị khung xương CSS có hiệu ứng nhấp nháy (pulsing).
3. **Error boundary và thử lại:** khi `ERROR`, hiển thị thông báo lỗi dễ hiểu kèm nút **Retry Connection**.
4. **Git:** một commit mốc: `feat(ui): implement multi-state data component with skeleton feedback`.

## 3. Hợp đồng kiểu (đã chỉnh lỗi gõ của slide)

```ts
type ViewState<T> =
  | { status: 'IDLE' }
  | { status: 'LOADING' }
  | { status: 'SUCCESS'; data: T }
  | { status: 'ERROR'; error: string };
```

Contract này giữ nguyên, **không thêm trường** (kể cả `requestId`). Lý do: đề yêu cầu đúng 4 trạng thái, và chống race là việc của lớp tải dữ liệu, không phải của FSM.

Sự kiện đưa vào `transition` (do mình đặt, slide không có):

```ts
type FeedEvent =
  | { type: 'LOAD' }
  | { type: 'RESOLVE'; data: Item[] }
  | { type: 'REJECT'; error: string };

type Item = { id: string; title: string; summary: string };
```

Điểm slide chưa xử lý và cách WBS này xử lý:

| Vấn đề của slide | Cách xử lý | Task |
|---|---|---|
| Không chặn race condition | Request ID trong `createFeedLoader` | B5 |
| `err.message` sai kiểu (`err` là `unknown`) | `errorMessageOf(err)` kiểm `instanceof Error` | B4 |
| Chuyển trạng thái không kiểm soát | `transition` là hàm thuần, bảng chuyển hợp lệ | A2, A3 |
| Retry không rõ đi đâu | Retry là `LOAD`, đi qua `LOADING`, không nhảy thẳng `SUCCESS` | A2, C4 |
| `catch` thiếu `try` đúng chỗ, dấu nháy `'LOADING"` | Viết lại từ đầu | A1, B5 |

## 4. Quyết định thiết kế (mỗi quyết định ở một chỗ)

| Quyết định | Chốt | Lý do |
|---|---|---|
| Viết app bằng gì | Gọi `createElement` trực tiếp, không JSX, không React | Agents.md cấm thư viện UI ở Tier 1; giống Exercise 2 |
| Nơi chứa luật chuyển trạng thái | Hàm thuần `transition(state, event)` trong `state-machine.js` | Test không cần DOM; sửa luật ở một chỗ |
| Chuyển trạng thái không hợp lệ | Trả về **cùng tham chiếu** `state` (không ném lỗi) | Setter bỏ qua khi `Object.is` bằng nhau nên không re-render thừa; phản hồi muộn vô hại thay vì làm app sập |
| `LOAD` khi đang `LOADING` | Cho phép, ra `LOADING` mới và bắt đầu yêu cầu mới ("bản mới nhất thắng") | Đây là đường duy nhất tạo race thật qua UI, nên phải test được |
| Nơi chống race | `createFeedLoader(fetchFeed)` giữ `latestId` trong closure; phản hồi có `id !== latestId` bị bỏ | `transition` không biết yêu cầu nào là mới nhất. Chỉ `RESOLVE` vào `LOADING` mới cần guard này: ở `SUCCESS` hoặc `ERROR`, bảng chuyển đã bỏ qua `RESOLVE` |
| Vì sao không dùng `AbortController` | Chỉ là phần mở rộng (mục 7) | Request ID dễ giải thích khi bảo vệ và test được không cần `fetch` thật. Hạn chế: không huỷ yêu cầu mạng, chỉ bỏ qua kết quả |
| Loader sống bao lâu | Tạo **một lần** trong `createDataFeed({ fetchFeed })`, ngoài hàm component | Component chạy lại mỗi lần render; tạo loader trong thân component sẽ reset `latestId` và mất bảo vệ. Đây là câu hỏi dễ bị hỏi khi bảo vệ |
| Cách loader gọi ngược về state | `loader.load(dispatch)` nhận `dispatch` mỗi lần gọi | Setter của `useState` ổn định theo `index` (đóng trên `index`, không phải `cursor`), nên `dispatch` của bất kỳ lần render nào cũng đúng |
| `fetchFeed` | Mock có điều khiển, không gọi mạng thật | Test tất định; dựng đúng kịch bản "phản hồi 1 về sau phản hồi 2" |
| Hai kiểu mock | `createDeferredFeed()` cho test (resolve/reject bằng tay); `createTimedFeed(plan)` cho demo (độ trễ và lỗi theo kế hoạch) | Test không phụ thuộc đồng hồ; demo có bằng chứng nhìn thấy được |
| Kế hoạch demo | Query string `?plan=3000,500,fail`, đọc trong `main.js` | Không cần thêm UI điều khiển. Mỗi phần tử là độ trễ (ms) hoặc `fail`; yêu cầu thứ n dùng phần tử thứ n, hết thì lặp phần tử cuối |
| Điểm bắt đầu của `IDLE` | Nút "Load feed" luôn hiện, không tự tải khi mount | `IDLE` quan sát và test được; không có hành vi bất ngờ khi vào trang |
| Nút tải | Một nút `<button id="load-feed">` hiện ở mọi trạng thái; nhãn "Load feed" khi `IDLE`, "Reload feed" khi còn lại | Nút tồn tại trong `LOADING` nên bấm liên tiếp được; id ổn định để `writeFocus` giữ focus |
| Nút Retry | `<button id="retry-feed">Retry Connection</button>` trong khối lỗi | Đúng nhãn của đề |
| Focus khi nút bị gỡ | Sau khi bấm Retry, focus về `<h2 id="feed-heading" tabindex="-1">` | Retry bị xoá khi sang `LOADING`, focus rơi về `<body>` (WCAG 2.4.3). Cùng mẫu `recoverLostFocus` của `task-app.js` Exercise 2 |
| Vùng thông báo | `<p id="status" role="status">` trong `index.html`, ngoài `#app`; `announce()` ghi bằng `textContent` | Vùng live bị tạo lại mỗi render thường không được đọc ra (bài học từ Exercise 2) |
| Render | Đồng bộ, `replaceChildren` cả cây, chưa diff | Diff thuộc phần sau của lab; không thêm vào bài này |
| Key danh sách | `item.id` | Không dùng index |

## 5. WBS

Mỗi task là một lượt làm riêng (Slice → Contract → Generate → Verify). Test đi cùng module của nó. Cột "Phụ thuộc" cho biết task phải xong trước.

### Nhóm A — FSM 4 trạng thái và `transition()`

- [x] **A0 Setup.** Sao chép nguyên văn `Exercise2_Lab02/mini-react.js`, `reactive-engine.js` và hai file test của chúng vào `Exercise3_Lab02/`. Không cài thêm dependency.
  - Phụ thuộc: không.
  - Nghiệm thu: `diff` từng file với bản Exercise 2 không có khác biệt; `npm test` quét được thư mục mới và các test sao chép pass; `git status` cho thấy không file nào trong `Exercise2_Lab02/` bị đổi.
  - Test: chính hai file test sao chép (chứng minh bản sao còn nguyên).
- [x] **A1 Contract trong `state-machine.js`.** JSDoc cho `Item`, `ViewState`, `FeedEvent`; hằng `STATUS` đóng băng gồm đúng 4 giá trị; `initialState` là `{ status: 'IDLE' }` đóng băng. Chữ ký `transition` chưa có thân.
  - Phụ thuộc: A0.
  - Nghiệm thu: không có giá trị thứ năm; `Object.isFrozen(STATUS)` và `Object.isFrozen(initialState)` là `true`; file có `// @ts-check` và VS Code không báo lỗi kiểu.
  - Test: `Object.values(STATUS)` bằng đúng `['IDLE','LOADING','SUCCESS','ERROR']`; `initialState.status === 'IDLE'`.
- [x] **A2 `transition` đường hợp lệ.** Bảng chuyển:

  | Từ | `LOAD` | `RESOLVE` | `REJECT` |
  |---|---|---|---|
  | `IDLE` | `LOADING` | không đổi | không đổi |
  | `LOADING` | `LOADING` (yêu cầu mới) | `SUCCESS` | `ERROR` |
  | `SUCCESS` | `LOADING` | không đổi | không đổi |
  | `ERROR` | `LOADING` | không đổi | không đổi |

  - Phụ thuộc: A1.
  - Nghiệm thu: trạng thái trả về là object đóng băng; `SUCCESS` mang đúng `data` của sự kiện; `ERROR` mang đúng `error`; `ERROR → LOADING` không giữ lại `error` cũ, `SUCCESS → LOADING` không giữ lại `data` cũ (không hiện dữ liệu cũ lẫn lộn).
  - Test: `IDLE→LOADING`, `LOADING→SUCCESS`, `LOADING→ERROR`, `SUCCESS→LOADING`, `ERROR→LOADING` (Retry không nhảy thẳng `SUCCESS`); object trả về không có khoá thừa.
- [x] **A3 `transition` đường không hợp lệ và tính đầy đủ.**
  - Phụ thuộc: A2.
  - Nghiệm thu: mọi cặp (trạng thái, sự kiện) không có trong bảng trả về **cùng tham chiếu** `state`; không trạng thái nào ngoài 4 giá trị xuất hiện; `transition` không sửa `state` đầu vào.
  - Test: bảng 4 × 3 = 12 ca theo dạng `it.each`; ca `RESOLVE` khi `IDLE` và `SUCCESS` trả về `toBe(state)`; sự kiện có `type` lạ trả về `toBe(state)`.
- [x] **A4 Verify nhóm A.** `npm test`; `grep` không có `var`, `innerHTML`, `keypress`, `keyCode`; VS Code diagnostics sạch cho `state-machine.js`; tick WBS. Không commit.
  - Phụ thuộc: A3.
  - Nghiệm thu: dán output thật của `npm test` và `grep`.

### Nhóm B — `fetchFeed` mock, retry, chống race bằng request ID

- [x] **B1 Contract.** Trong `feed-mock.js`: JSDoc `FetchFeed = () => Promise<Item[]>`, `PlanStep = number | 'fail'`; hằng `FEED_ITEMS` (3 `Item`, `id` ổn định, đóng băng).
  - Phụ thuộc: A1.
  - Nghiệm thu: `FEED_ITEMS` đóng băng, `id` không trùng.
  - Test: `new Set(FEED_ITEMS.map(i => i.id)).size === FEED_ITEMS.length`.
- [x] **B2 `createDeferredFeed()` (mock cho test).** Trả `{ fetchFeed, calls }`; mỗi lần gọi `fetchFeed()` tạo một promise treo và đẩy `{ resolve(items), reject(error) }` vào `calls`.
  - Phụ thuộc: B1.
  - Nghiệm thu: `fetchFeed` không tự settle; `calls[n]` điều khiển đúng lần gọi thứ n; thứ tự settle do test quyết định.
  - Test: gọi hai lần được hai phần tử trong `calls`; resolve lần 2 trước lần 1 thì promise 2 settle trước.
- [x] **B3 `createTimedFeed(plan)` và `parsePlan(search)` (mock cho demo).** `parsePlan('?plan=3000,500,fail')` trả `[3000, 500, 'fail']`; `createTimedFeed` dùng `setTimeout`, tên mục trong kết quả ghi số thứ tự yêu cầu (ví dụ "Item A (request #2)") để thấy ngay phản hồi của yêu cầu nào đang hiển thị.
  - Phụ thuộc: B1.
  - Nghiệm thu: `plan` rỗng hoặc sai định dạng cho kế hoạch mặc định (một bước nhanh, không lỗi) thay vì ném lỗi; bước `'fail'` reject bằng `Error` có thông điệp đọc được; hết kế hoạch thì lặp bước cuối.
  - Test: dùng `vi.useFakeTimers()`; `parsePlan` với đầu vào rỗng, có khoảng trắng, giá trị âm hoặc chữ lạ; `createTimedFeed([100,'fail'])` resolve sau 100 ms, lần hai reject, lần ba reject (lặp bước cuối).
- [x] **B4 `errorMessageOf(err)`.** Nhận `unknown`, trả `string`: `Error` thì `err.message`; `string` thì chính nó; còn lại thì thông điệp mặc định "Unknown error"; chuỗi rỗng cũng thành mặc định.
  - Phụ thuộc: A1.
  - Nghiệm thu: không bao giờ trả `undefined` hay chuỗi rỗng; không đọc `.message` trên giá trị chưa kiểm kiểu.
  - Test: `new Error('x')`, `'boom'`, `undefined`, `null`, `42`, `{ message: 'fake' }` (không phải `Error` nên ra mặc định), `new Error('')`.
- [x] **B5 `createFeedLoader(fetchFeed)` trong `feed-loader.js`.** `load(dispatch)`: tăng `latestId`, lấy `id`, `dispatch({ type: 'LOAD' })`, `await` (bọc để cả lỗi ném đồng bộ lẫn promise bị reject đều thành `REJECT`), nếu `id !== latestId` thì bỏ, ngược lại `dispatch(RESOLVE | REJECT)`.
  - Phụ thuộc: A3, B2, B4.
  - Nghiệm thu: `latestId` ở đúng một chỗ, nằm trong closure của loader, hai loader không dùng chung; `dispatch` luôn nhận `LOAD` trước mọi `RESOLVE`/`REJECT`; loader không biết DOM hay `useState`.
  - Test (dùng B2 và `transition` thật để quan sát trạng thái cuối):
    1. Đường vui: `RESOLVE` → trạng thái `SUCCESS` với đúng `data`.
    2. Lỗi: reject bằng `Error('Network down')` → `ERROR` với `error === 'Network down'`; reject bằng giá trị không phải `Error` → `ERROR` với thông điệp mặc định; `fetchFeed` ném đồng bộ → vẫn `ERROR`.
    3. **Phản hồi cũ về muộn:** gọi `load` hai lần; resolve lần 2 (`SUCCESS`, dữ liệu B), rồi resolve lần 1 (dữ liệu A) → trạng thái vẫn là `SUCCESS` với dữ liệu B, `dispatch` không nhận `RESOLVE` của lần 1.
    4. **Phản hồi cũ về sớm:** gọi hai lần; resolve lần 1 trước → trạng thái vẫn `LOADING`; resolve lần 2 → `SUCCESS` với dữ liệu lần 2.
    5. **Lỗi cũ về muộn:** lần 2 thành công, lần 1 reject sau → vẫn `SUCCESS`, không chuyển `ERROR`.
    6. **Lỗi cũ về sớm khi lần mới còn chờ:** lần 1 reject trong lúc lần 2 chưa xong → vẫn `LOADING`.
    7. **Retry:** lần 1 reject (`ERROR`), gọi `load` lại → `LOADING` rồi resolve → `SUCCESS`; không có bước nhảy thẳng từ `ERROR` sang `SUCCESS`.
    8. Hai loader độc lập: `latestId` của loader này không làm loader kia bỏ phản hồi.
- [x] **B6 Thử phá guard.** Tạm bỏ dòng so sánh `id === latestId` rồi chạy `npm test`; các ca 3, 4, 6 của B5 phải fail. Hoàn nguyên và chạy lại pass.
  - Kết quả thực tế: bỏ guard thì ca 3, 4, 6 fail (3 failed, 16 passed); hoàn nguyên thì 19 passed. Ca 5 và 8 không fail khi bỏ guard: ca 5 (lỗi cũ về muộn sau `SUCCESS`) đã bị bảng `transition` chặn (`REJECT` ở `SUCCESS` bị bỏ qua), đúng như quyết định thiết kế "chỉ `LOADING` mới cần guard"; ca 8 kiểm hai loader độc lập, không phụ thuộc guard. Ca 3 fail nhờ assertion đếm số lần `RESOLVE` được dispatch, không phải nhờ trạng thái cuối.
  - Phụ thuộc: B5.
  - Nghiệm thu: dán output fail rồi output pass; `git diff` sau khi hoàn nguyên không còn thay đổi ở `feed-loader.js` ngoài bản gốc của B5. Mục đích: chứng minh test thật sự bắt được race, và có kịch bản sửa-trực-tiếp sẵn cho buổi bảo vệ.
- [x] **B7 Verify nhóm B.** `npm test`; `grep` cấm; VS Code diagnostics sạch; tick WBS. Không commit.
  - Phụ thuộc: B6, B3.

### Nhóm C — UI: skeleton, success, error, Retry Connection

- [ ] **C1 Khung `createDataFeed` và trạng thái `IDLE`.** `createDataFeed({ fetchFeed })` tạo loader một lần rồi trả hàm component `DataFeed`. `DataFeed` gọi `useState(initialState)`, dựng `dispatch = (event) => setState(prev => transition(prev, event))`, trả `<section aria-labelledby="feed-heading">` gồm `<h2 id="feed-heading" tabindex="-1">`, nút `#load-feed`, và vùng nội dung theo trạng thái. `IDLE` hiện câu hướng dẫn "Press Load feed to start.". `onClick` của nút gọi `loader.load(dispatch)`.
  - Phụ thuộc: A3, B5.
  - Nghiệm thu: render lần đầu là `IDLE`, chưa gọi `fetchFeed`; bấm nút gọi `fetchFeed` đúng một lần; không `addEventListener` trên nút (hub xử lý).
  - Test: dùng `setupEventDelegation`, `renderApp`, `createDeferredFeed`; `calls.length === 0` sau mount; sau click `calls.length === 1`; nút có nhãn "Load feed".
- [ ] **C2 `LOADING` và skeleton.** Vùng nội dung có `aria-busy="true"`; hiện khối `<div class="skeleton" aria-hidden="true">` gồm 3 hàng giữ chỗ; `announce('Loading feed')` ghi vào `#status`. Nhãn nút đổi thành "Reload feed". Không còn dữ liệu cũ khi vào `LOADING` từ `SUCCESS`.
  - Phụ thuộc: C1.
  - Nghiệm thu: skeleton không chứa chữ, ẩn khỏi trình đọc màn hình; `aria-busy` là chuỗi `"true"` ở `LOADING` và không có (hoặc `"false"`) ở các trạng thái khác; không có `<li>` dữ liệu trong `LOADING`.
  - Test: sau click, DOM có `.skeleton[aria-hidden="true"]` và vùng có `aria-busy="true"`; `#status` chứa "Loading feed"; đi `SUCCESS → LOADING` thì tiêu đề các item cũ biến mất khỏi DOM.
- [ ] **C3 `SUCCESS`.** `<ul>` với `<li key={item.id}>`, mỗi item hiện `title` và `summary` qua `createElement` (không `innerHTML`). Mảng rỗng hiện "No items to show." thay vì `<ul>` rỗng. `announce('Loaded N items')`.
  - Phụ thuộc: C2.
  - Nghiệm thu: số `<li>` bằng số item; `key` của VNode là `item.id`; `aria-busy` không còn là `true`.
  - Test: resolve với `FEED_ITEMS` → đủ `<li>` đúng thứ tự; mảng rỗng → thông báo, không có `<ul>`; item có `title` là `<img src=x onerror=alert(1)>` hiển thị như chữ, không tạo `<img>`.
- [ ] **C4 `ERROR` và Retry Connection.** Khối `<div role="alert">` gồm `<h3>` "Couldn't load the feed", đoạn chữ lỗi (`textContent` từ `state.error`) và `<button id="retry-feed">Retry Connection</button>`. Bấm Retry gọi `loader.load(dispatch)`.
  - Phụ thuộc: C2.
  - Nghiệm thu: thông báo dễ hiểu và không chỉ dựa vào màu (có chữ và tiêu đề); Retry là `<button>`; Retry đưa trạng thái qua `LOADING` rồi mới tới `SUCCESS` hoặc `ERROR`; lỗi có HTML được hiển thị như chữ.
  - Test: reject bằng `Error('Network down')` → DOM có `[role="alert"]` chứa "Network down" và nút tên "Retry Connection"; click Retry → có skeleton, `calls.length === 2`; resolve lần 2 → hiện danh sách, hết `role="alert"`; retry rồi lỗi tiếp → quay lại `ERROR`; `error` chứa `<b>x</b>` không sinh thẻ `<b>`.
- [ ] **C5 Quản lý focus.** (a) Nút `#load-feed` giữ focus qua các lần render nhờ `writeFocus` của engine. (b) Bấm `#retry-feed` làm nút biến mất; sau `load(dispatch)` đưa focus về `#feed-heading`. Hàm khôi phục focus đặt ở `data-feed.js`, không sửa engine (cùng mẫu `recoverLostFocus` của Exercise 2).
  - Phụ thuộc: C4.
  - Nghiệm thu: sau mọi thao tác `document.activeElement` không bao giờ là `<body>`.
  - Test: focus `#load-feed`, bấm, kiểm tra `document.activeElement.id === 'load-feed'` qua `LOADING` và `SUCCESS`; focus `#retry-feed`, bấm, kiểm tra `activeElement.id === 'feed-heading'`; thử phá (bỏ hàm khôi phục) thì test (b) fail.
- [ ] **C6 Kiểm thử vòng đời đầy đủ qua UI.** Gộp các kịch bản của B5 lên DOM thật.
  - Phụ thuộc: C5.
  - Nghiệm thu: không có kết hợp thao tác nào để lại UI ở trạng thái mâu thuẫn (ví dụ skeleton và danh sách cùng hiện).
  - Test:
    1. **Race qua UI:** bấm `#load-feed` hai lần; resolve lần 2 (dữ liệu B), rồi resolve lần 1 (dữ liệu A) → DOM hiện dữ liệu B, không có dữ liệu A.
    2. Bấm hai lần; resolve lần 1 trước → vẫn skeleton; resolve lần 2 → dữ liệu của lần 2.
    3. `IDLE → LOADING → ERROR → (Retry) LOADING → SUCCESS`, kiểm DOM ở từng bước.
    4. `SUCCESS → (Reload) LOADING → ERROR`: danh sách cũ biến mất, hiện lỗi.
    5. Tại mọi bước, chỉ đúng một trong {gợi ý IDLE, skeleton, danh sách, khối lỗi} có trong DOM.
- [ ] **C7 Verify nhóm C.** `npm test`; `grep` cấm (thêm: không `onclick=`, không `addEventListener` trong `data-feed.js`); VS Code diagnostics sạch; tick WBS. Không commit.
  - Phụ thuộc: C6.

### Nhóm D — Accessibility, demo và verification

- [ ] **D1 `index.html`, `main.js`, `style.css`.** `<html lang="en">`, `<title>` có nghĩa, `<main>` bọc `#app` và `<p id="status" role="status">`. `main.js`: `setupEventDelegation(root)`, `renderApp(createDataFeed({ fetchFeed }), root)` với `fetchFeed` là `createTimedFeed(parsePlan(location.search))`. CSS: `.skeleton` có `@keyframes` đổi `opacity` chu kỳ không ngắn hơn 1 giây; `@media (prefers-reduced-motion: reduce)` tắt animation; `:focus-visible` rõ; vùng bấm tối thiểu 2.5rem; khối lỗi có viền và biểu tượng chữ, không chỉ màu đỏ. Chạy qua `python -m http.server` vì ES module không chạy từ `file://`.
  - Phụ thuộc: C7, B3.
  - Nghiệm thu: trang chạy, nút Load feed hoạt động; mở `?plan=3000,500` hiển thị skeleton rồi dữ liệu.
  - Test: `main.test.js` (mẫu như Exercise 2): `main.js` gắn hub đúng một lần và render `IDLE`; `style.css` đọc ra chuỗi chứa `prefers-reduced-motion` và `@keyframes` (kiểm bằng chuỗi vì jsdom không chạy animation).
- [ ] **D2 Kiểm tra màu và kích thước.** Script tính tương phản theo công thức WCAG từ `getComputedStyle` trong Edge, như Exercise 2.
  - Phụ thuộc: D1.
  - Nghiệm thu: chữ thường ≥ 4.5:1; viền nút, vòng focus, khối skeleton so với nền ≥ 3:1; mọi control ≥ 24×24 CSS px.
  - Test: không có test tự động; kết quả ghi vào mục 6.
- [ ] **D3 Checkpoint trong Edge thật.** Chụp ảnh và ghi lại:
  1. Skeleton đang nhấp nháy (`?plan=3000`): ảnh chụp có chú thích.
  2. **Race:** `?plan=3000,500`; bấm Load, rồi trong 1 giây bấm Reload. Sau 0.5 giây hiện "(request #2)". Chờ qua 3 giây: danh sách vẫn là "(request #2)", không bị ghi đè bởi "(request #1)". Chụp ảnh ở hai mốc.
  3. Lỗi và Retry: `?plan=fail,500`; hiện lỗi, bấm Retry, hiện dữ liệu.
  4. Emulate `prefers-reduced-motion: reduce` trong DevTools (Rendering) và xác nhận skeleton đứng yên.
  5. Chỉ dùng bàn phím: Tab tới Load feed, Enter, tới Retry, Enter; focus không rơi về `<body>`.
  - Phụ thuộc: D1.
  - Nghiệm thu: có ảnh cho các mục 1, 2, 3 trong `Exercise3_Lab02/evidence/`; mục 4 và 5 có ghi chú kết quả.
  - Việc của bạn: ảnh chụp bằng DevTools thật và chạy Lighthouse hoặc axe (chưa cài; Lighthouse có sẵn trong DevTools của Edge và Chrome). Mình không khẳng định thay.
- [ ] **D4 Bảng kiểm WCAG 2.2 AA.** Điền mục 6 với đúng cột "Cách kiểm" và "Trạng thái" như Exercise 2. Không ghi "đạt WCAG" khi còn dòng "Một phần" hoặc "Chưa làm".
  - Phụ thuộc: D2, D3.
- [ ] **D5 Verify cuối.** `npm test` toàn bộ repo; `grep` cấm trên các file mới; `git status` và `git diff --stat -- Exercise1_Lab02 Exercise2_Lab02` rỗng (không sửa bài cũ); VS Code diagnostics sạch cho mọi file `.js` mới; xem `git diff`; tick mục 5 (checklist) với bằng chứng thật.
  - Phụ thuộc: D4.
- [ ] **D6 Prompt log và commit mốc.** Bạn export prompt log vào `docs/prompt_logs/` (AI không xuất được phiên làm việc của chính nó). Khi bạn yêu cầu: một commit `feat(ui): implement multi-state data component with skeleton feedback`, kèm dòng `Co-Authored-By` theo Agents.md.
  - Phụ thuộc: D5.

### Phần mở rộng (chỉ khi cần hoặc khi thầy yêu cầu lúc bảo vệ)

- [ ] X1 `AbortController`: `createFeedLoader` truyền `signal` cho `fetchFeed` và `abort()` yêu cầu cũ khi có yêu cầu mới. Test: mock tôn trọng `signal`, yêu cầu cũ nhận `AbortError` và loader không dispatch `REJECT`.
- [ ] X2 Chặn bấm liên tiếp: nút Reload `disabled` khi `LOADING` (thay cho "bản mới nhất thắng"). Lưu ý `disabled` làm nút mất khỏi thứ tự Tab; cần cân nhắc `aria-disabled`.

## 5. Điều kiện hoàn thành (checklist nghiệm thu)

- [ ] Kiểu `ViewState` đúng như hợp đồng, không có trạng thái thứ năm (A1, A3)
- [ ] `IDLE`: có điểm khởi đầu rõ ràng là nút "Load feed" (C1)
- [ ] `LOADING`: hiện skeleton, không hiện dữ liệu cũ lẫn lộn (A2, C2, C6)
- [ ] `SUCCESS`: hiện dữ liệu, an toàn XSS (C3)
- [ ] `ERROR`: thông báo dễ hiểu và nút **Retry Connection** hoạt động (C4)
- [ ] Bấm tải nhiều lần liên tiếp không tạo race condition: test B5 (3 đến 6) và C6 (1, 2), bằng chứng DevTools ở D3 mục 2 (B5, B6, C6, D3)
- [ ] Retry đi qua `LOADING`, không nhảy thẳng `SUCCESS` (A2, B5 ca 7, C4)
- [ ] Skeleton tôn trọng `prefers-reduced-motion`, không nhấp nháy quá 3 lần mỗi giây (D1, D3)
- [ ] Focus không rơi về `<body>` sau Retry (C5, D3)
- [ ] `npm test` pass toàn bộ, không sửa Exercise 1 và 2 (D5)
- [ ] Không có `var`, `innerHTML`, `keypress`, `keyCode`, inline handler (đã `grep`) (D5)
- [ ] 1 commit mốc đúng message (D6)
- [ ] Prompt log đã export vào `docs/prompt_logs/` (D6)

## 6. Kiểm tra WCAG 2.2 AA (điền ở D4; ghi rõ đã kiểm gì, bằng cách nào)

| Tiêu chí | Cách kiểm dự kiến | Trạng thái |
|---|---|---|
| 1.3.1 Cấu trúc ngữ nghĩa | Test jsdom (`main > section > h2`, `ul > li`, `button`) và cây accessibility của Edge | Chưa kiểm |
| 1.4.1 Không chỉ dùng màu | Khối lỗi có tiêu đề, chữ và viền; xem ảnh chụp | Chưa kiểm |
| 1.4.3 Tương phản 4.5:1 | Script từ `getComputedStyle` trong Edge (D2) | Chưa kiểm |
| 1.4.11 Tương phản phi văn bản | Viền nút, vòng focus, khối skeleton so với nền, ≥ 3:1 (D2) | Chưa kiểm |
| 2.1.1 Bàn phím | Tab và Enter thật (D3 mục 5); phím Space chưa thử trước khi kiểm | Chưa kiểm |
| 2.3.1 Không nhấp nháy quá 3 lần mỗi giây | Đọc chu kỳ `@keyframes` trong `style.css` | Chưa kiểm |
| Tôn trọng `prefers-reduced-motion` (thực hành tốt; tiêu chí 2.3.3 gần nhất thuộc mức AAA, ngoài AA) | Test chuỗi CSS (D1) và Emulate trong DevTools (D3 mục 4) | Chưa kiểm |
| 2.4.3 Thứ tự focus | Test C5 và Edge thật | Chưa kiểm |
| 2.4.7 Focus nhìn thấy | `:focus-visible` sau mỗi lần Tab | Chưa kiểm |
| 2.5.8 Vùng bấm 24×24 | Đo `getBoundingClientRect` (D2) | Chưa kiểm |
| 4.1.2 Tên truy cập được | Cây accessibility: "Load feed", "Retry Connection" | Chưa kiểm |
| 4.1.3 Thông báo trạng thái | Test: `#status` sống qua các lần render và đổi nội dung; `role="alert"` ở khối lỗi. Chưa nghe bằng trình đọc màn hình thật | Chưa kiểm |

Chưa làm: axe hoặc Lighthouse (project-rules 8.1 yêu cầu ít nhất một công cụ tự động), thử trình đọc màn hình, thử Firefox hoặc Safari.

## 7. Rủi ro và điểm cần giải thích khi bảo vệ

- **Loader phải sống ngoài hàm component.** Tạo `createFeedLoader` trong thân `DataFeed` sẽ reset `latestId` mỗi lần render, race quay lại mà test đơn lẻ của loader vẫn pass. Test C6 (1) bắt lỗi này vì chạy qua `renderApp`.
- **Request ID không huỷ yêu cầu mạng**, chỉ bỏ kết quả muộn. Với `fetch` thật, yêu cầu cũ vẫn tốn băng thông; `AbortController` (X1) giải quyết phần đó.
- **`transition` không biết yêu cầu nào mới nhất.** Nếu thầy hỏi "đưa `requestId` vào `LOADING`", câu trả lời: làm vậy thêm trường vào contract mà đề giữ cố định 4 hình dạng; guard đặt ở loader là một chỗ duy nhất.
- **Trả về cùng tham chiếu cho chuyển không hợp lệ** dựa vào `Object.is` trong setter của engine để khỏi render thừa. Nếu ai đó đổi `transition` trả về object mới, sẽ có re-render thừa nhưng không sai kết quả.
- **`aria-busy` nằm trong cây bị thay mỗi lần render.** Phần tử mới tạo mang sẵn thuộc tính nên hiệu quả với trình đọc màn hình có thể yếu hơn mong đợi; thông báo thật sự dựa vào `#status` ngoài cây. Chưa kiểm với trình đọc màn hình.
- **`role="alert"` trên node mới chèn** thường được đọc ngay, nhưng hành vi khác nhau giữa trình đọc màn hình; chưa kiểm.
- **Mất state cục bộ khi thay cả cây:** Exercise 3 không có ô nhập nên không gặp lỗi mất chữ đang gõ của Exercise 2. Vị trí cuộn và vùng chọn văn bản vẫn không được giữ.
- **`createTimedFeed` dùng `setTimeout`:** tab nền có thể bị trình duyệt làm chậm timer; không ảnh hưởng đúng sai nhưng làm số giây trong ảnh chụp D3 lệch.
- **Kiểm kiểu chỉ qua editor:** `// @ts-check` chỉ có tác dụng trong VS Code; repo chưa có `tsc` nên không có lệnh typecheck trong terminal (xem mục 8).
- **`crypto.randomUUID()` không dùng ở bài này**; `id` của item là hằng cố định nên không dính giới hạn secure context của Exercise 2.

## 8. Câu hỏi còn mở và giả định

| Câu hỏi | Mặc định đang dùng | Trạng thái |
|---|---|---|
| `fetchFeed` là API thật hay giả lập | Mock có điều khiển (B2 cho test, B3 cho demo) | Giả định, chờ bạn xác nhận |
| Dùng engine Exercise 2 hay React | Sao chép engine Exercise 2, không React | Đã chốt theo Agents.md |
| Cách chứng minh "không race" mà thầy chấp nhận | Test B5 và C6 cộng bằng chứng DevTools ở D3 mục 2 (kịch bản `?plan=3000,500`) | Giả định, chưa rõ thầy muốn gì |
| "1 commit mốc" so với "mỗi task xong một commit" (Agents.md mục 5) | Một commit mốc đúng message của đề, gộp cả nhóm A đến D | Mâu thuẫn nhẹ; chờ bạn xác nhận |
| Lệnh typecheck | Chỉ dựa vào VS Code diagnostics. Cài `typescript` để chạy `tsc --noEmit` là thêm dependency | Cần bạn quyết (hỏi trước khi cài) |
| `IDLE` tự tải hay bấm nút | Bấm nút "Load feed" | Giả định |
| Nút Reload khi `LOADING`: cho bấm hay khoá | Cho bấm ("bản mới nhất thắng"); khoá là X2 | Giả định |
| Có sao chép hai file test của engine vào Exercise 3 không | Có, để chứng minh bản sao còn nguyên (A0) | Giả định, làm repo thêm test trùng lặp |

## 9. Ghi chú nguồn

Thông tin đề gốc nằm ở slide Sprint 3 (đã chép lại ở mục 2 và 3, kèm các sửa lỗi gõ liệt kê trong [Context mục 7](../docs/Context.md)). Ghi chú WCAG ở mục 6 kế thừa bản nháp trước và chuẩn trong [project-rules mục 8](../docs/project-rules.md).
