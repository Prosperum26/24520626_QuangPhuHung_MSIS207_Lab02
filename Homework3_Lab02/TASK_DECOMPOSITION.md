# Homework 3 — Task Decomposition

> Bối cảnh: [Context](../docs/Context.md). Quy tắc: [project-rules](../docs/project-rules.md) và [Agents](../Agents.md). Mẫu WBS: [Homework 2](../Homework2_Lab02/TASK_DECOMPOSITION.md).
> Trạng thái (2026-10-29): **nhóm A đến E đã làm và verify (114 test của HW3). Nhóm F đã đo bằng Edge headless điều khiển qua CDP và Lighthouse CLI; còn lại là việc cần người thật: nghe bằng NVDA hoặc Narrator (F3), đọc lại và xác nhận `AI_FAILURE_AUDIT.md` (F5, F8)**. Kết quả và bằng chứng ở mục 11; cột "Trạng thái" ở mục 8 đã điền theo đó. Các sửa sau phép đo (focus, favicon) và thư mục `evidence/` chưa commit.
> Quy ước: tick `[x]` chỉ khi đã chạy lệnh kiểm chứng và thấy output thật. Mỗi lượt làm đúng một task.

## 1. Thông tin chung

| Mục | Nội dung |
|---|---|
| Tên bài | High-Concurrency Flash-Sale E-Commerce Engine |
| Thời hạn | 1 tuần |
| Bối cảnh | Siêu sale thị trường Việt Nam (Shopee, Lazada 11.11, flash sale nửa đêm) |
| Mục tiêu | Đồng hồ đếm ngược không trôi và máy trạng thái giữ hàng với khóa lạc quan; **không bao giờ bán quá số lượng** |
| Ngôn ngữ | JavaScript thuần, contract bằng JSDoc, `// @ts-check` (như Homework 1 và 2). Khung mã của đề viết bằng TypeScript chỉ là mẫu |
| Engine Mini-React | **Không dùng.** UI dựng bằng DOM API (`createElement`, `textContent`, `replaceChildren`) |
| Giờ máy chủ | Giả lập trong code (một hàm `serverNow` có độ lệch và độ trễ cấu hình được), không gọi API thật |
| Test | Vitest + jsdom, mỗi module một file `*.test.js` cạnh nó |
| Chạy thử | `python -m http.server 8765` từ gốc repo, mở `http://127.0.0.1:8765/Homework3_Lab02/index.html` |

### 1.1 Cấu trúc thư mục

```text
Homework3_Lab02/
  index.html              trang demo (lang, title, main > h1, thẻ sản phẩm, panel giữ hàng, #status)
  main.js                 điểm vào: nối clock, timer, store, UI; một hub sự kiện
  main.test.js            test điểm vào, index.html, style.css
  style.css
  drift-demo.html         trang đo drift setInterval so với deadline (bằng chứng, task B4)
  TASK_DECOMPOSITION.md
  evidence/               ảnh chụp DevTools, kết quả đo
  src/
    clock/                server-clock.js
    timer/                countdown.js, anti-drift-timer.js
    inventory/            types.js, inventory-fsm.js, inventory-store.js, reserve-with-retry.js
    sim/                  fake-server.js, buyers.js
    app/                  flash-sale-app.js, format-time.js, milestones.js
```

Quy tắc phụ thuộc:

- `inventory` không biết DOM, `requestAnimationFrame` hay `Date.now()`. Mọi thời điểm đi vào qua tham số `now`.
- `timer` chỉ biết hàm `now` và `raf` được truyền vào; không biết `inventory`.
- `clock` chỉ biết hàm lấy giờ máy chủ và `performance.now`.
- `sim` chỉ dùng để demo và test, `inventory` không import `sim`.
- Chỉ `app` và `main.js` biết tất cả và đụng DOM.

Nhờ vậy `inventory` (phần quan trọng nhất) test được thuần, không cần fake timer; `timer` test bằng đồng hồ và `raf` giả, vì jsdom không đảm bảo `requestAnimationFrame` chạy theo thời gian thật.

## 2. Ràng buộc từ đề

1. Đếm ngược chính xác đến mili giây bằng hiệu `Date.now()` so với mốc đích, không dùng `setInterval`.
2. Khóa tồn kho lạc quan bằng máy trạng thái hữu hạn: giữ hàng, hết hạn khóa, thanh toán.
3. `AI_FAILURE_AUDIT.md` ghi ít nhất 3 lỗi AI (người dùng viết, AI chỉ chỉnh câu chữ).
4. Tối thiểu 8 commit riêng biệt, Conventional Commits.
5. WCAG 2.2 AA cho UI (project-rules mục 8), thêm các tiêu chí ở mục 8.

## 3. Quyết định thiết kế và lý do

| Quyết định | Lý do |
|---|---|
| Timer tách làm hai lớp: `createCountdown(targetTime, ...)` là lõi, `createAntiDriftTimer(durationMs, ...)` chỉ tính `targetTime = now() + durationMs` rồi gọi lõi | Khóa giữ hàng có mốc tuyệt đối `expiresAt`, đồng hồ sale có mốc tuyệt đối `startsAt`. Một lõi dùng cho cả hai, quyết định "đếm từ mốc đích" nằm ở một chỗ |
| Timer chỉ dùng để **hiển thị**, không quyết định hết hạn | `requestAnimationFrame` bị dừng khi tab ẩn nhưng hàng vẫn phải được nhả. Hết hạn do reducer quyết định bằng so sánh `now >= expiresAt` ở mỗi event, cộng một `setTimeout` đánh thức để UI cập nhật |
| Tính "giờ" bằng `serverAnchor + (performance.now() - monoAnchor)`, không đọc `Date.now()` mỗi tick | `Date.now()` nhảy khi NTP đồng bộ hoặc người dùng đổi giờ; `performance.now()` đơn điệu. Neo vào giờ máy chủ một lần lúc sync. Đây là chỗ **lệch có chủ ý** so với khung mẫu của đề (dùng `Date.now()` trực tiếp); phần deadline vẫn đúng tinh thần "tính từ mốc đích, không cộng dồn" |
| Mô hình tồn kho có số lượng: `{ total, sold, version, reservations }` và mỗi `Reservation` có FSM riêng | Sale thật có N hàng và nhiều người giữ cùng lúc. Bảng trạng thái theo từng món trong đề (`AVAILABLE` ... `SOLD`) trở thành trạng thái **suy ra**: `available = total - sold - số lượt giữ đang hiệu lực` |
| FSM là reducer thuần `transition(state, event) -> { state, result }` | Mọi chuyển trạng thái đi qua một hàm duy nhất (đúng ghi chú đề). Test từng cạnh không cần thời gian thật. Khi giảng viên đổi luật lúc bảo vệ thì chỉ sửa một chỗ |
| Khóa lạc quan bằng `version` (compare-and-swap), không dùng mutex | Đúng nghĩa "optimistic": đọc `version`, gửi `commit(expectedVersion, event)`; lệch thì `CONFLICT` và thử lại |
| Race xảy ra giữa `await` đọc và `await` ghi, nên store là **bất đồng bộ có độ trễ cấu hình** | JavaScript đơn luồng, chỉ có race khi có `await` xen vào. Không có độ trễ thì test "không bán quá" vô nghĩa vì luôn qua |
| Có một test chứng minh bản **ngây thơ** (đọc, chờ, ghi, không kiểm version) bán quá | Chứng minh race có thật và test của bản đúng thật sự bắt được; cũng là tư liệu cho phần bảo vệ trực tiếp |

### 3.1 Hợp đồng kiểu

```js
/** @typedef {'RESERVED'|'CHECKOUT'|'SOLD'|'EXPIRED'|'CANCELLED'} ReservationStatus */

/**
 * @typedef {Object} Reservation
 * @property {number} id                 tăng dần, duy nhất trong một kho
 * @property {string} buyerId
 * @property {ReservationStatus} status
 * @property {number} expiresAt          ms theo giờ máy chủ; mốc hết hạn của RESERVED và CHECKOUT
 * @property {number} extensions         số lần đã gia hạn, tối đa MAX_EXTENSIONS
 */

/**
 * @typedef {Object} Inventory
 * @property {number} total
 * @property {number} sold               số lượt ở trạng thái SOLD
 * @property {number} version            tăng 1 mỗi lần một event được chấp nhận
 * @property {{ startsAt: number, endsAt: number }} saleWindow
 * @property {ReadonlyArray<Readonly<Reservation>>} reservations
 */

/**
 * @typedef {{ type: 'RESERVE', buyerId: string, now: number }
 *   | { type: 'BEGIN_CHECKOUT', id: number, now: number }
 *   | { type: 'PAY_SUCCESS', id: number, now: number }
 *   | { type: 'PAY_FAIL', id: number, now: number }
 *   | { type: 'EXTEND', id: number, now: number }
 *   | { type: 'CANCEL', id: number, now: number }
 *   | { type: 'EXPIRE_DUE', now: number }} InventoryEvent
 */

/**
 * @typedef {{ ok: true, id?: number }
 *   | { ok: false, reason: 'SALE_NOT_LIVE'|'SOLD_OUT'|'NOT_FOUND'|'INVALID_TRANSITION'|'HOLD_EXPIRED'|'EXTENSION_LIMIT' }} TransitionResult
 */

/**
 * @typedef {{ ok: true, state: Inventory, result: TransitionResult }
 *   | { ok: false, reason: 'CONFLICT', current: Inventory }} CommitResult
 */
```

### 3.2 Bảng chuyển trạng thái của một `Reservation`

| Từ | Event | Sang | Điều kiện |
|---|---|---|---|
| (chưa có) | `RESERVE` | `RESERVED` | `startsAt <= now < endsAt` và `available > 0`; đặt `expiresAt = now + HOLD_MS` |
| `RESERVED` | `BEGIN_CHECKOUT` | `CHECKOUT` | chưa quá `expiresAt`; đặt `expiresAt = now + CHECKOUT_MS` |
| `RESERVED` | `EXTEND` | `RESERVED` | chưa quá `expiresAt`, `extensions < MAX_EXTENSIONS`; `expiresAt += EXTEND_MS` |
| `CHECKOUT` | `PAY_SUCCESS` | `SOLD` | chưa quá `expiresAt`; `sold += 1` |
| `CHECKOUT` | `PAY_FAIL` | `CANCELLED` | hàng trả về kho (suy ra, không cần cộng trả) |
| `RESERVED`, `CHECKOUT` | `CANCEL` | `CANCELLED` | |
| `RESERVED`, `CHECKOUT` | `EXPIRE_DUE` | `EXPIRED` | `now >= expiresAt` (biên **bao gồm**) |
| `SOLD`, `CANCELLED` | mọi event | từ chối `INVALID_TRANSITION` | trạng thái kết thúc |
| `EXPIRED` | mọi event | từ chối `HOLD_EXPIRED` | trạng thái kết thúc; báo lý do rõ hơn cho người dùng |

Hằng số mặc định (một chỗ, `types.js`): `HOLD_MS = 120_000`, `CHECKOUT_MS = 60_000`, `EXTEND_MS = 60_000`, `MAX_EXTENSIONS = 2`.

Quy tắc áp dụng cho **mọi** event: reducer chạy `EXPIRE_DUE(now)` trước, rồi mới xử lý event. Nhờ đó lượt giữ đã quá hạn không thể thanh toán dù timer giao diện chưa kịp chạy (lazy expiry).

Bất biến, kiểm bằng `verifyInvariants(state)`:

1. `sold + (số lượt RESERVED hoặc CHECKOUT) <= total` ở mọi thời điểm.
2. `sold` đúng bằng số lượt ở trạng thái `SOLD`.
3. `id` của lượt giữ duy nhất; trạng thái kết thúc không bao giờ đổi.
4. `version` không giảm; tăng 1 khi state thật sự đổi (event được chấp nhận, hoặc việc quét hết hạn làm đổi state). Event bị từ chối mà không đổi gì thì `version` giữ nguyên.

### 3.3 Hợp đồng timer và clock

```js
/**
 * @typedef {Object} TimerDeps
 * @property {() => number} [now]                 mặc định Date.now
 * @property {(cb: () => void) => number} [raf]   mặc định requestAnimationFrame
 * @property {(id: number) => void} [caf]         mặc định cancelAnimationFrame
 */

/** @returns {() => void} hàm hủy; idempotent */
// createCountdown(targetTime, onTick, deps)
// createAntiDriftTimer(durationMs, onTick, deps)
```

Bất biến của timer:

1. `onTick(remaining)` luôn nhận `remaining >= 0`, tính từ `targetTime - now()`, không cộng dồn.
2. `onTick(0)` được gọi **đúng một lần** rồi dừng lên lịch; nếu `targetTime` đã qua ngay từ đầu vẫn gọi `onTick(0)` đúng một lần.
3. Gọi hàm hủy trước khi hết giờ thì không còn `onTick` nào nữa (kể cả `onTick(0)`); gọi hủy nhiều lần không lỗi.
4. Khung mẫu của đề **gán `rafId` sau khi định nghĩa `tick`** và không bảo vệ lúc hủy giữa chừng; bản của mình giữ cờ `stopped` để callback đã lên lịch không chạy sau khi hủy.

`createServerClock`:

| Thành phần | Việc |
|---|---|
| `sync()` | Gọi `serverNow()` một lần, trừ nửa thời gian khứ hồi (Cristian), lưu `serverAnchor` và `monoAnchor = performance.now()` |
| `now()` | `serverAnchor + (mono() - monoAnchor)`; đơn điệu, không phụ thuộc đồng hồ hệ thống sau lần sync |
| `offset()` | `serverAnchor - Date.now()` lúc sync, hiện ra giao diện để chứng minh máy khách lệch giờ vẫn đúng |

## 4. WBS

### Nhóm A — Nền

- [x] A1 Viết `src/inventory/types.js` (typedef mục 3.1, hằng số mục 3.2) và test khẳng định hằng số hợp lệ. Commit: `docs(hw3): add contracts and wbs`

### Nhóm B — Đồng hồ và timer

- [x] B1 `src/clock/server-clock.js` + test: `now()` đơn điệu khi `Date.now()` bị đổi; `sync` bù nửa khứ hồi; trước `sync` thì ném lỗi rõ ràng. Commit: `feat(clock): add monotonic server clock`
- [x] B2 `src/timer/countdown.js` + `anti-drift-timer.js`. Commit: `feat(timer): add deadline countdown and anti-drift timer`
- [x] B3 Test timer bằng `now`/`raf` giả: không trôi khi mỗi frame trễ ngẫu nhiên; `onTick(0)` đúng một lần; hủy giữa chừng; mốc đã qua; `remaining` không âm; nhảy thời gian lớn (tab ẩn rồi quay lại) cho ra giá trị đúng ngay tick đầu. Commit: `test(timer): cover drift, single final tick, cancel`
- [x] B4 `drift-demo.html`: chạy song song `setInterval` kiểu cộng dồn và `createAntiDriftTimer` trong 60 giây, in sai lệch mỗi 5 giây vào bảng. Dùng làm bằng chứng cho báo cáo. Commit: `feat(timer): add drift comparison demo`

### Nhóm C — Máy trạng thái

- [x] C1 `src/inventory/inventory-fsm.js`: `createInventory`, `transition`, bảng mục 3.2 (chưa có hết hạn). Commit: `feat(inventory): add reservation state machine`
- [x] C2 Thêm lazy expiry (`EXPIRE_DUE`, chạy trước mọi event), `EXTEND`, `verifyInvariants`. Commit: `feat(inventory): add lazy expiry, extension and invariants`
- [x] C3 Test FSM: mọi cạnh hợp lệ; mọi cạnh không hợp lệ bị từ chối và `version` không đổi; biên `now === expiresAt` là hết hạn; thanh toán lượt đã quá hạn bị từ chối `HOLD_EXPIRED`; ngoài `saleWindow` bị `SALE_NOT_LIVE`; `EXTEND` quá giới hạn; hết hàng; state trả về bị `Object.freeze`, state cũ không bị sửa. Commit: `test(inventory): cover transitions, expiry and invariants`

### Nhóm D — Khóa lạc quan và đồng thời

- [x] D1 `src/inventory/inventory-store.js`: `read()` trả bản chụp (có `version`), `commit(expectedVersion, event)` đồng bộ trong thân hàm; lệch `version` trả `CONFLICT`. Có `delay` cấu hình được để mô phỏng độ trễ mạng. Commit: `feat(inventory): add optimistic versioned store`
- [x] D2 `src/inventory/reserve-with-retry.js`: đọc, chờ, `commit`; gặp `CONFLICT` thì đọc lại và thử lại tối đa `maxRetries`; thấy `available === 0` thì trả `SOLD_OUT` ngay, không thử. Commit: `feat(inventory): add reserve with bounded retry`
- [x] D3 `src/sim/buyers.js` + test đồng thời: tồn 10, 200 người mua cùng lúc với độ trễ ngẫu nhiên cố định seed. Khẳng định đúng 10 lượt giữ thành công, tổng kết quả bằng 200, `verifyInvariants` đúng. Thêm test bản ngây thơ (không kiểm version) **bán quá** để chứng minh race có thật. Thêm test: mọi người cùng thanh toán, `sold === total`, không vượt. Commit: `test(inventory): simulate concurrent buyers without oversell`

### Nhóm E — Giao diện

- [x] E1 `index.html` + `style.css` + `src/app/format-time.js` (+ test: `mm:ss.mmm`, 0, giá trị lớn). Thẻ ngữ nghĩa, `<time>`, trạng thái bằng chữ. Commit: `feat(ui): add flash-sale page and styles`
- [x] E2 `src/app/flash-sale-app.js` + `main.js`: nối clock, store, timer; một hub sự kiện (event delegation, `keydown` + `e.key`); render bằng DOM API; hiển thị `offset` giờ máy chủ. Có test jsdom. Commit: `feat(ui): wire clock, store and countdown`
- [x] E3 `src/app/milestones.js` + trợ năng: thông báo mốc còn 60 giây, còn 10 giây, đã hết qua `role="status"` (mốc 10 giây và hết dùng `role="alert"`); nút "Gia hạn"; không đặt `aria-live` trên đồng hồ; `prefers-reduced-motion` ẩn phần mili giây. Test mốc chỉ thông báo một lần. Commit: `feat(a11y): add milestone announcements and hold extension`
- [x] E4 `src/sim/fake-server.js` + nút "Mô phỏng người mua" chạy D3 trên giao diện, hiện số thành công, xung đột, hết hàng. Commit: `feat(ui): add buyer simulation control`

### Nhóm F — Kiểm chứng và tài liệu

Phần đo do AI chạy bằng Edge headless qua Chrome DevTools Protocol (script đặt ngoài repo, không cài gì vào repo) và Lighthouse CLI cài trong thư mục tạm. Kết quả chi tiết ở mục 11.

- [x] F1 Đo drift 60 giây bằng `drift-demo.html` trong Edge, kèm ba lần làm bận luồng chính 300 ms: [drift-measurement.json](evidence/drift-measurement.json), [edge-drift-table.png](evidence/edge-drift-table.png). Long task chỉ là ba lần chặn có chủ ý. Chưa mở Performance panel bằng tay.
- [x] F2 Kiểm tab ẩn trong Edge (tab thật sự `hidden`, `rAF` 0 khung trong 30 giây): giá trị sau khi quay lại đúng, hàng nhả đúng khi hết hạn lúc tab ẩn, thông báo đúng một lần. **Có một chỉ số không đạt ngưỡng đặt trước:** hết hạn khi ẩn trễ 3021 ms so với ngưỡng 2000 ms (mục 11.2). Bằng chứng: [edge-hidden-tab.json](evidence/edge-hidden-tab.json), [edge-hidden-timer-throttle.json](evidence/edge-hidden-timer-throttle.json).
- [ ] F3 Bàn phím: **đã kiểm** bằng phím Tab, Enter, Space thật qua CDP (41 kiểm tra, [edge-a11y-audit.json](evidence/edge-a11y-audit.json)). Trình đọc màn hình (NVDA hoặc Narrator): **chưa làm, cần bạn nghe và ghi lại**.
- [x] F4 Lighthouse CLI 13.6.0 trên Edge, trang `index.html` ở trạng thái vừa tải: Performance, Accessibility, Best Practices, SEO đều 100, cả desktop và mobile ([lighthouse-hw3.json](evidence/lighthouse-hw3.json), báo cáo HTML cùng thư mục). Không có ảnh `lighthouse.png` chụp tay trong DevTools; bạn có thể chụp thêm nếu thầy cần ảnh.
- [x] F5 Mục "Homework 3" trong [AI_FAILURE_AUDIT.md](../docs/AI_FAILURE_AUDIT.md): 3 lỗi chính và 2 lỗi phụ, mỗi lỗi có output thật. **AI viết từ phiên làm, bạn cần đọc lại và xác nhận** (xem ghi chú đầu mục).
- [x] F6 Cập nhật bảng WCAG (mục 8) bằng kết quả thật. Commit: `docs(hw3): record edge measurements and wcag status`
- [x] F7 Prompt log: [promt_log_init_hm3.txt](../docs/prompt_logs/promt_log_init_hm3.txt), sinh từ transcript thật của phiên, không phải bản `/export` của giao diện (xem mục 11.6).
- [x] F8 `AI_FAILURE_AUDIT.md` có mục HW3. Commit: `docs(hw3): add AI failure audit`

## 5. Ánh xạ commit (≥ 8 theo đề)

| # | Commit | Task |
|---|---|---|
| 1 | `docs(hw3): add contracts and wbs` | A1 |
| 2 | `feat(clock): add monotonic server clock` | B1 |
| 3 | `feat(timer): add deadline countdown and anti-drift timer` | B2 |
| 4 | `test(timer): cover drift, single final tick, cancel` | B3 |
| 5 | `feat(timer): add drift comparison demo` | B4 |
| 6 | `feat(inventory): add reservation state machine` | C1 |
| 7 | `feat(inventory): add lazy expiry, extension and invariants` | C2 |
| 8 | `test(inventory): cover transitions, expiry and invariants` | C3 |
| 9 | `feat(inventory): add optimistic versioned store` | D1 |
| 10 | `feat(inventory): add reserve with bounded retry` | D2 |
| 11 | `test(inventory): simulate concurrent buyers without oversell` | D3 |
| 12 | `feat(ui): add flash-sale page and styles` | E1 |
| 13 | `feat(ui): wire clock, store and countdown` | E2 |
| 14 | `feat(a11y): add milestone announcements and hold extension` | E3 |
| 15 | `feat(ui): add buyer simulation control` | E4 |
| 16 | `docs(hw3): record drift measurement and wcag status` | F6 |
| 17 | `docs(hw3): add AI failure audit` | F8 |

Con số 17 vượt mức tối thiểu 8; có thể gộp B4 với B2 hoặc E4 với E2 nếu thấy quá vụn, miễn mỗi commit vẫn là một ý.

## 6. Kiểm chứng

Trước khi tick một task: chạy `npx vitest run Homework3_Lab02` (và toàn repo `npm test` ở cuối mỗi nhóm), xem `git diff`, dán kết quả thật. Chưa có typecheck chạy tự động; `// @ts-check` chỉ có tác dụng trong editor. Nếu muốn typecheck bằng lệnh phải cài TypeScript (cài dependency, cần hỏi trước).

## 7. Chuẩn bị bảo vệ trực tiếp (3 phút)

Mỗi quyết định nằm ở một chỗ để sửa nhanh. Các đột biến giảng viên có thể đưa ra và nơi sửa:

| Đột biến có thể gặp | Nơi sửa | Cách kiểm chứng |
|---|---|---|
| Đổi biên hết hạn `>=` thành `>` | `inventory-fsm.js`, hàm hết hạn | test biên `now === expiresAt` |
| `PAY_FAIL` quay về `RESERVED` thay vì `CANCELLED` | bảng chuyển trong `inventory-fsm.js` | test cạnh `CHECKOUT` |
| Đổi `HOLD_MS` hoặc giới hạn gia hạn | `types.js` | đọc hằng số trong test |
| Bỏ kiểm `version` ở `commit` | `inventory-store.js` | test CONFLICT trong `inventory-store.test.js` và `buyers.test.js` đỏ (đã thử: 5 test đỏ). Lưu ý: test "không bán quá" vẫn xanh vì `transition` cũng chặn `SOLD_OUT`; chỉ bản ngây thơ trong `simulateNaiveBuyers` mới bán quá |
| Đổi timer từ deadline sang đếm lùi cộng dồn | `countdown.js` | test drift phải đỏ |
| Hết hạn do timer thay vì lazy expiry | `inventory-fsm.js` | test thanh toán lượt quá hạn khi timer chưa chạy |
| Gọi `onTick(0)` hai lần hoặc không gọi | `countdown.js` | test `onTick(0)` đúng một lần |

## 8. Ghi chú WCAG 2.2 AA

Cột "Trạng thái" chỉ ghi điều đã kiểm thật. "Một phần" nghĩa là còn việc chưa làm, nêu rõ ở cột đó. Không có mục nào được khẳng định "đạt WCAG".

| Tiêu chí | Cách đáp ứng | Cách kiểm | Trạng thái |
|---|---|---|---|
| 2.2.1 Timing Adjustable | Cảnh báo ở còn 1 phút (`role="status"`) và 10 giây (`role="alert"`), nút "Gia hạn thêm 1 phút" | Edge 130 giây: mốc đúng một lần, cách mốc hết giờ 59997 và 9997 ms; Space trên "Gia hạn" hoạt động | Một phần: `MAX_EXTENSIONS = 2`, trong khi 2.2.1 (tùy chọn Extend) nói gia hạn được ít nhất 10 lần. Khóa giữ hàng có thể coi là giới hạn thiết yếu, nhưng đây là cách hiểu của mình, **chưa được thầy xác nhận**. Nút Gia hạn chỉ có ở bước giữ hàng, không có ở bước thanh toán |
| 2.2.2 Pause, Stop, Hide | Đồng hồ đếm ngược là thông tin thời gian thực; phần mili giây ẩn khi `prefers-reduced-motion: reduce` | Edge: giả lập reduced-motion thì `.ms` có `display: none`, bỏ giả lập thì hiện lại | Một phần: không có nút tạm dừng riêng; dựa vào cách hiểu "thông tin thiết yếu" (mục 10.2) |
| 2.3.1 Three Flashes | Không có hiệu ứng nhấp nháy; chỉ đổi văn bản | Đọc mã CSS, không có animation hay transition | Đã kiểm bằng đọc mã |
| 2.4.3 Focus Order | Sau thao tác làm nút bị ẩn hoặc vô hiệu, focus chuyển về tiêu đề panel (`keepFocus`) | Edge, phím thật: trước khi sửa focus rơi về body (lỗi H3-2), sau khi sửa là `h2#hold-title` sau Giữ hàng, Tiến hành thanh toán, Xác nhận thanh toán | Đã kiểm trong Edge, 3 thao tác |
| 4.1.3 Status Messages | `#status role="status"` và `#alert role="alert"` rỗng lúc tải; mỗi thông báo thay bằng một `<p>` mới; không `aria-live` trên `<time>` | Edge: cây accessibility có vùng status; mốc thông báo đúng một lần (đo bằng MutationObserver) | Một phần: **chưa nghe bằng NVDA hoặc Narrator** nên chưa biết trình đọc màn hình có đọc đúng |
| 1.4.1 Use of Color | Trạng thái bằng chữ ("Đang mở bán", "Đang giữ hàng", "Đã mua", "Hết hạn giữ hàng") | Đọc DOM và ảnh chụp trong Edge | Đã kiểm |
| 1.4.3 Contrast | Chữ tối trên nền trắng, nút xanh `#0b57d0` chữ trắng | Edge, tính tỉ lệ từ `getComputedStyle`: 13 đoạn chữ ở trạng thái vừa tải (thấp nhất 6,39:1) và 23 đoạn khi đang giữ hàng (thấp nhất 6,39:1); loại chữ của nút bị vô hiệu hóa (được miễn). Lighthouse Accessibility 100 | Một phần: chưa đo trạng thái hover |
| 1.4.10 Reflow | Bố cục một cột, nút full-width dưới 30rem | Edge ở 320 px: `scrollWidth` bằng `clientWidth` (không cuộn ngang) | Một phần: chưa thử zoom 400% bằng tay |
| 2.1.1 Keyboard | Mọi điều khiển là `<button>`; skip link | Edge, phím thật: Tab theo thứ tự skip link, Giữ hàng, Tiến hành thanh toán, Gia hạn; Enter và Space kích hoạt; luồng giữ hàng, gia hạn, thanh toán, mô phỏng hoàn tất bằng bàn phím | Đã kiểm bằng phím gửi qua CDP; chưa thử bàn phím vật lý hay trình duyệt khác |
| 2.4.7 Focus Visible | Viền 3 px khi `:focus-visible` | Edge: mọi phần tử nhận focus có `outline-style: solid` và độ rộng 3 px | Đã kiểm |
| 2.5.8 Target Size | Nút cao tối thiểu 44 px, rộng tối thiểu 24 px | Edge ở 1280 px và 320 px: mọi nút và skip link ≥ 24×24 | Đã kiểm |
| 3.3.7 Redundant Entry | Trang không có ô nhập liệu | Đọc `index.html` | Không áp dụng |

## 9. Nơi AI hay sai ở bài này (để chú ý khi review, không phải kết quả)

Đây là các điểm cần **soi kỹ**, không phải lỗi đã xảy ra. Mục F5 chỉ được ghi những lỗi **thật sự xuất hiện** trong lúc làm, có bằng chứng DevTools của chính bạn.

- Dùng `rAF` hoặc `setTimeout` để quyết định hết hạn thay vì so với `now`.
- Gọi `onTick(0)` hai lần, hoặc không bao giờ gọi khi `targetTime` đã qua.
- Dùng `Date.now()` mỗi tick rồi cộng dồn sai số.
- Đọc `version`, `await`, rồi ghi không kiểm lại (race đọc-ghi).
- Đặt `aria-live` trên đồng hồ chạy từng mili giây.
- `innerHTML` cho nội dung động trên giao diện.
- Dùng `setInterval` "chỉ để tạm" trong mô phỏng.

## 10. Câu hỏi còn mở

1. `AI_FAILURE_AUDIT.md` dùng chung `docs/AI_FAILURE_AUDIT.md` cho cả lab hay làm riêng cho HW3? Đề lab nói 3 lỗi, đề HW3 nói "ít nhất 3". Cần hỏi thầy. Tạm thời: thêm mục HW3 vào file chung.
2. 2.2.2 (Pause, Stop, Hide) có chấp nhận lý do "đồng hồ là thông tin thời gian thực cần thiết" không, hay cần nút tắt hiển thị mili giây? Tạm thời: ẩn mili giây khi `prefers-reduced-motion`.
3. Hằng số `HOLD_MS` 120 giây, `CHECKOUT_MS` 60 giây, `MAX_EXTENSIONS` 2 là giá trị mình chọn để demo, đề không nêu. Đổi được ở một chỗ.
4. Khi `PAY_FAIL` mình chọn `CANCELLED` (trả hàng) thay vì quay về `RESERVED` như bảng phác thảo của đề; lý do: tránh giữ hàng vô hạn sau nhiều lần thất bại. Cần bạn xác nhận.

## 11. Kết quả kiểm chứng (đo ngày 2026-10-29)

Môi trường: Edge 156.0.4314.50 chạy headless, viewport 1280×900 (320×640 cho reflow), điều khiển bằng Chrome DevTools Protocol. Script đo nằm ngoài repo; kết quả thô nằm trong [evidence/](evidence/). Trang được phục vụ bằng static server cục bộ. Giờ máy chủ là giả lập (mục 1).

### 11.1 Drift (F1)

Ba lần bấm "Làm bận luồng chính 300 ms" ở khoảng giây 10, 25, 40. Hai lần chạy 60 giây cho cùng xu hướng; bảng dưới là lần chạy cuối ([drift-measurement.json](evidence/drift-measurement.json)).

| Đã trôi (s) | Sai lệch `setInterval` cộng dồn (ms) | Sai lệch deadline (ms) |
|---|---|---|
| 5 | 3,8 | 0,8 |
| 10 | 312,1 | 0,1 |
| 25 | 519,4 | 0,4 |
| 40 | 623,5 | 0,5 |
| 60 | 703,6 | 3,6 |

- Bộ cộng dồn lệch tới khoảng 0,7 giây sau 60 giây và không tự hồi phục; bộ deadline dưới 1 ms ở mọi hàng, trừ hàng cuối (3,6 ms) vì đo đúng lúc khung hình cuối và giá trị bị chặn ở 0.
- Lần chạy đầu cho 100,2 ms ở giây 5 dù chưa có lần chặn nào: đó là sai số lượng tử hóa của `setInterval` 100 ms (đọc ngay trước một nhịp), không phải drift. Vì vậy các hàng đầu khác nhau giữa hai lần chạy.
- `PerformanceObserver` ghi đúng 3 long task (301, 300, 300 ms), trùng thời điểm các lần bấm chặn; không có long task nào khác do timer.

### 11.2 Tab ẩn (F2)

Tab A bị ẩn bằng cách đưa tab B lên trước (`visibilityState` là `hidden`, đã kiểm).

| Phép đo | Kết quả | Đạt |
|---|---|---|
| Số khung `rAF` trong 30 giây ẩn | 0 | có (xác nhận `rAF` dừng) |
| Giá trị còn lại ngay sau khi quay lại | hiển thị 83890 ms, dự kiến 84015 ms, lệch −125 ms (gồm độ trễ giữ hàng giả lập) | có (ngưỡng ±400 ms) |
| Hết hạn khi tab đang ẩn: hàng đã nhả, trạng thái "Hết hạn giữ hàng", tồn kho 10/10 | có, không cần quay lại tab | có |
| Thông báo hết hạn qua `role="alert"` | đúng 1 lần, kể cả sau khi quay lại | có |
| Độ trễ cập nhật giao diện so với mốc hết hạn khi ẩn | **3021 ms** | **không** (ngưỡng đặt trước 2000 ms) |

Giải thích độ trễ 3021 ms: khi tab ẩn, Edge giãn `setTimeout` thành khoảng 1 giây ([edge-hidden-timer-throttle.json](evidence/edge-hidden-timer-throttle.json): ba `setTimeout(40 ms)` nối tiếp mất 1751, 249 và 991 ms ở trạng thái `hidden`, so với 42, 46, 41 ms khi hiện). Luồng hết hạn gồm ba bước dùng độ trễ mạng giả lập bằng `setTimeout` (đọc, commit, đọc lại), nên cộng lại cỡ 3 giây. Đây là **suy luận khớp với số đo, chưa thử bằng cách bỏ độ trễ giả lập**. Đây chỉ là độ trễ hiển thị: tính đúng đắn do `transition` quyết định theo `now >= expiresAt` ở mỗi lần commit, nên người khác vẫn mua được hàng đúng mốc hết hạn và thanh toán quá hạn vẫn bị từ chối (có test).

### 11.3 Mốc thông báo và độ chính xác đồng hồ (F2, F3)

Giữ hàng rồi chờ hết 120 giây trong Edge, ghi MutationObserver trên `#status` và `#alert` ([edge-milestones.json](evidence/edge-milestones.json), 9 kiểm tra pass):

- Mốc 1 phút: đúng 1 lần, vùng `role="status"`, cách mốc hết giờ 59997 ms.
- Mốc 10 giây: đúng 1 lần, vùng `role="alert"`, cách mốc hết giờ 9997 ms.
- Hết giờ: đúng 1 lần, vùng `role="alert"`; hàng trả về kho (còn 10 / 10).
- 11 mẫu giá trị đồng hồ hiển thị so với mốc hết hạn trong 110 giây: sai lệch từ −6 đến +1 ms, không có xu hướng tăng.

Hạn chế: các chỉ số "cách mốc" so với mốc hết giờ do chính giao diện ghi nhận (cùng một đồng hồ), nên chúng chứng minh các mốc đúng khoảng cách và không trôi, không chứng minh so với đồng hồ ngoài.

### 11.4 Bàn phím, trợ năng, reflow (F3)

41 kiểm tra pass, 0 fail, chạy riêng lẻ 3 lần liên tiếp đều như vậy ([edge-a11y-audit.json](evidence/edge-a11y-audit.json); ảnh `edge-01` đến `edge-05` cùng thư mục). Nội dung: heading phân cấp, mọi button có tên truy cập trong cây accessibility, `<time>` không nằm trong vùng live, Tab đúng thứ tự, Enter và Space, focus không rơi về body, viền focus 3 px, tương phản, vùng bấm, reduced-motion, reflow 320 px, `?skew=5000` hiển thị chênh lệch +5004 ms và đồng hồ mở bán vẫn đúng giờ máy chủ, mô phỏng 200 người mua trong Edge (10 thành công, 190 báo hết hàng, 508 lần CONFLICT, không bán quá, bất biến đạt; bản ngây thơ báo thành công cho 200 người).

Các lần chạy trước của script này có kiểm tra fail: một lỗi thật của trang (focus rơi về body, đã sửa, xem lỗi H3-2) và vài lỗi của script đo (vùng status rỗng không vào cây accessibility, ghi nhận cả mục `BODY` khi Tab ra khỏi tài liệu, đếm cả mẫu lấy sau khi hết hạn). Một lần chạy lúc đang có hai Edge khác chạy song song còn chập chờn ở bước "Tiến hành thanh toán" (hết giờ chờ 5 giây); chưa xác định nguyên nhân chắc chắn, giả thuyết là phím Enter bị cờ `busy` chặn khi thao tác trước chưa xong. Chạy riêng lẻ thì không tái hiện.

### 11.5 Lighthouse (F4)

Lighthouse 13.6.0 trên Edge headless, `index.html` ở trạng thái vừa tải, cấu hình mặc định của Lighthouse.

| Cấu hình | Performance | Accessibility | Best Practices | SEO |
|---|---|---|---|---|
| Desktop | 100 | 100 | 100 | 100 |
| Mobile | 100 | 100 | 100 | 100 |

Điểm chưa tối đa ở mức audit (không làm giảm điểm tổng): CLS 0,06 trên mobile; gợi ý minify JavaScript, cache lifetimes, render-blocking (do static server cục bộ không nén và không đặt cache). Lighthouse chỉ kiểm DOM ở trạng thái vừa tải, không kiểm trạng thái đang giữ hàng hay kết quả mô phỏng.

### 11.6 Prompt log (F7)

[promt_log_init_hm3.txt](../docs/prompt_logs/promt_log_init_hm3.txt) được sinh bằng script từ file transcript của phiên (lời nhắn của bạn, câu trả lời của AI, tên và mô tả lệnh đã gọi; bỏ output dài của công cụ và khối suy nghĩ). Định dạng khác bản `/export` của giao diện dùng cho các bài trước; nếu thầy yêu cầu đúng định dạng đó, hãy chạy `/export` rồi thay file.

## 12. Checklist nghiệm thu

- [x] Đồng hồ đếm ngược đến mili giây, không trôi khi đo dài (11.1, 11.3) và khi tab bị ẩn (11.2, giá trị đúng sau khi quay lại)
- [x] Máy trạng thái tồn kho có giữ hàng, hết hạn khóa, thanh toán; chuyển trạng thái hợp lệ (C3, 114 test)
- [x] Không bán quá khi nhiều yêu cầu đồng thời (D3 và 11.4); có test tái hiện race bằng bản ngây thơ
- [x] `AI_FAILURE_AUDIT.md` có mục HW3, 3 lỗi chính có bằng chứng và bản sửa (chờ bạn xác nhận; bằng chứng từ CDP, không phải ảnh chụp DevTools bằng tay)
- [ ] Tối thiểu 8 commit riêng biệt đúng Conventional Commits: các commit A đến E đã có; còn các commit cho nhóm F và các sửa sau phép đo
- [ ] Kiểm tra WCAG 2.2 AA (mục 8): nhiều tiêu chí "Đã kiểm", nhưng 2.2.1, 2.2.2, 4.1.3, 1.4.3, 1.4.10 còn "Một phần"; chưa nghe bằng trình đọc màn hình
- [x] Prompt log đã có trong `docs/prompt_logs/` (sinh từ transcript, xem 11.6)
