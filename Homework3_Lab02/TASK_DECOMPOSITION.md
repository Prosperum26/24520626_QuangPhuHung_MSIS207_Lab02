# Homework 3 — Task Decomposition

> Bối cảnh: [Context](../docs/Context.md). Quy tắc: [project-rules](../docs/project-rules.md) và [Agents](../Agents.md). Mẫu WBS: [Homework 2](../Homework2_Lab02/TASK_DECOMPOSITION.md).
> Trạng thái (2026-10-29): **nhóm A, B, C đã làm và verify (45 test của HW3, 739 test toàn repo), chưa commit**. B4 (`drift-demo.html`) mới kiểm bằng đọc mã, chưa chạy trên trình duyệt (việc F1 của bạn). Chưa làm nhóm D, E, F.
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
4. `version` không giảm; chỉ tăng khi event được chấp nhận (event bị từ chối không đổi `version`).

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

- [ ] D1 `src/inventory/inventory-store.js`: `read()` trả bản chụp (có `version`), `commit(expectedVersion, event)` đồng bộ trong thân hàm; lệch `version` trả `CONFLICT`. Có `delay` cấu hình được để mô phỏng độ trễ mạng. Commit: `feat(inventory): add optimistic versioned store`
- [ ] D2 `src/inventory/reserve-with-retry.js`: đọc, chờ, `commit`; gặp `CONFLICT` thì đọc lại và thử lại tối đa `maxRetries`; thấy `available === 0` thì trả `SOLD_OUT` ngay, không thử. Commit: `feat(inventory): add reserve with bounded retry`
- [ ] D3 `src/sim/buyers.js` + test đồng thời: tồn 10, 200 người mua cùng lúc với độ trễ ngẫu nhiên cố định seed. Khẳng định đúng 10 lượt giữ thành công, tổng kết quả bằng 200, `verifyInvariants` đúng. Thêm test bản ngây thơ (không kiểm version) **bán quá** để chứng minh race có thật. Thêm test: mọi người cùng thanh toán, `sold === total`, không vượt. Commit: `test(inventory): simulate concurrent buyers without oversell`

### Nhóm E — Giao diện

- [ ] E1 `index.html` + `style.css` + `src/app/format-time.js` (+ test: `mm:ss.mmm`, 0, giá trị lớn). Thẻ ngữ nghĩa, `<time>`, trạng thái bằng chữ. Commit: `feat(ui): add flash-sale page and styles`
- [ ] E2 `src/app/flash-sale-app.js` + `main.js`: nối clock, store, timer; một hub sự kiện (event delegation, `keydown` + `e.key`); render bằng DOM API; hiển thị `offset` giờ máy chủ. Có test jsdom. Commit: `feat(ui): wire clock, store and countdown`
- [ ] E3 `src/app/milestones.js` + trợ năng: thông báo mốc còn 60 giây, còn 10 giây, đã hết qua `role="status"` (mốc 10 giây và hết dùng `role="alert"`); nút "Gia hạn"; không đặt `aria-live` trên đồng hồ; `prefers-reduced-motion` ẩn phần mili giây. Test mốc chỉ thông báo một lần. Commit: `feat(a11y): add milestone announcements and hold extension`
- [ ] E4 `src/sim/fake-server.js` + nút "Mô phỏng người mua" chạy D3 trên giao diện, hiện số thành công, xung đột, hết hàng. Commit: `feat(ui): add buyer simulation control`

### Nhóm F — Kiểm chứng và tài liệu (việc của người dùng, trừ khi ghi khác)

- [ ] F1 Chạy `drift-demo.html` 60 giây, chụp bảng kết quả vào `evidence/`; mở Performance panel xác nhận không có task dài do timer
- [ ] F2 Kiểm tra tab ẩn: bắt đầu giữ hàng, chuyển tab 30 giây, quay lại, giá trị còn lại đúng và khóa hết hạn đúng lúc (kể cả khi tab ẩn lúc hết hạn)
- [ ] F3 Kiểm tra bàn phím và trình đọc màn hình (NVDA hoặc Narrator): Tab tới mọi nút, thông báo mốc đọc đúng một lần, đồng hồ không bị đọc từng khung
- [ ] F4 Lighthouse accessibility, lưu `evidence/lighthouse.png`
- [ ] F5 `AI_FAILURE_AUDIT.md`: người dùng viết ≥ 3 lỗi AI có bằng chứng DevTools và bản sửa; AI chỉ chỉnh câu chữ. Gợi ý nơi AI hay sai ở mục 9
- [ ] F6 Cập nhật bảng WCAG (mục 8) bằng kết quả thật, ghi rõ đã kiểm cách nào. Commit: `docs(hw3): record drift measurement and wcag status`
- [ ] F7 Export prompt log vào `docs/prompt_logs/`
- [ ] F8 `AI_FAILURE_AUDIT.md` hoàn chỉnh. Commit: `docs(hw3): add AI failure audit`

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
| Bỏ kiểm `version` ở `commit` | `inventory-store.js` | test đồng thời phải đỏ (bán quá) |
| Đổi timer từ deadline sang đếm lùi cộng dồn | `countdown.js` | test drift phải đỏ |
| Hết hạn do timer thay vì lazy expiry | `inventory-fsm.js` | test thanh toán lượt quá hạn khi timer chưa chạy |
| Gọi `onTick(0)` hai lần hoặc không gọi | `countdown.js` | test `onTick(0)` đúng một lần |

## 8. Ghi chú WCAG 2.2 AA

Cột "Trạng thái" chỉ điền sau khi đã kiểm tra thật (mục F6).

| Tiêu chí | Cách đáp ứng | Cách kiểm | Trạng thái |
|---|---|---|---|
| 2.2.1 Timing Adjustable | Cảnh báo trước khi hết hạn, nút "Gia hạn" (tối đa `MAX_EXTENSIONS`) | thủ công + test milestones | chưa kiểm |
| 2.2.2 Pause, Stop, Hide | Đồng hồ đếm ngược là thông tin thời gian thực cần thiết; phần mili giây ẩn khi `prefers-reduced-motion`. **Cần xác nhận cách hiểu** | thủ công | chưa kiểm |
| 4.1.3 Status Messages | Mốc quan trọng qua `role="status"`/`role="alert"`, không `aria-live` trên đồng hồ | Narrator hoặc NVDA | chưa kiểm |
| 1.4.1 Use of Color | Trạng thái hàng bằng chữ ("Còn hàng", "Đang giữ", "Đã hết") | xem thủ công | chưa kiểm |
| 1.4.3 Contrast | Chữ thường tương phản ≥ 4.5:1 | Lighthouse + công cụ đo | chưa kiểm |
| 2.1.1 / 2.4.7 Keyboard, Focus Visible | Mọi điều khiển là `<button>`, focus rõ | thủ công bằng Tab | chưa kiểm |
| 2.5.8 Target Size | Vùng bấm ≥ 24×24 CSS px | thủ công + CSS | chưa kiểm |
| 3.3.7 Redundant Entry | Không bắt nhập lại thông tin giữa giữ hàng và thanh toán | thủ công | chưa kiểm |
| 2.3.1 Three Flashes | Không nhấp nháy | xem thủ công | chưa kiểm |

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
