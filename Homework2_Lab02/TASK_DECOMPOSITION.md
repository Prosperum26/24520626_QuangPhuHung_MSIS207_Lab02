# Homework 2 — Task Decomposition

> Bối cảnh: [Context](../docs/Context.md). Quy tắc: [project-rules](../docs/project-rules.md) và [Agents](../Agents.md). Mẫu WBS: [Homework 1](../Homework1_Lab02/TASK_DECOMPOSITION.md).
> Trạng thái (2026-10-28): **nhóm A, B, C, D đã làm và verify bằng test** (A và B đã commit; C và D mới viết, chưa commit; HW2 hiện 109 + 32 = 141 test). Nhóm E và F chưa làm. Plan đã được bạn duyệt; thanh trượt âm lượng đã chốt (task C4).
> Quy ước: tick `[x]` chỉ khi đã chạy lệnh kiểm chứng và thấy output thật. Mỗi lượt làm đúng một task.

## 1. Thông tin chung

| Mục | Nội dung |
|---|---|
| Tên bài | Concurrent FIFO Audio Visualizer Queue Engine |
| Thời hạn | 1 tuần |
| Mục tiêu | Hàng đợi FIFO tải và giải mã nhạc, hủy được bằng `AbortController`, dọn sạch node âm thanh, bộ hiển thị phổ tần 60 fps không đẩy state theo khung hình |
| Ngôn ngữ | JavaScript thuần, contract bằng JSDoc, `// @ts-check` (như Homework 1) |
| Engine Mini-React | **Không dùng.** UI chỉ có vài nút và một vùng trạng thái; dựng bằng DOM API |
| Test | Vitest + jsdom, mỗi module một file `*.test.js` cạnh nó |
| Chạy thử | `python -m http.server 8765` từ gốc repo, mở `http://127.0.0.1:8765/Homework2_Lab02/index.html` |

### 1.1 Cấu trúc thư mục

```text
Homework2_Lab02/
  index.html            trang demo (lang, title, main > h1, điều khiển, canvas, #status)
  main.js               điểm vào: nối queue, player, visualizer, UI; một hub sự kiện
  main.test.js          test điểm vào, index.html, style.css
  style.css
  TASK_DECOMPOSITION.md
  evidence/             ảnh chụp, heap snapshot, báo cáo đo
  src/
    queue/              audio-task.js, audio-task-queue.js
    audio/              track-loader.js, audio-player.js, analyser-reader.js
    visual/             bars.js (tính chiều cao cột), visualizer.js (vòng rAF), motion-policy.js (khi nào chạy hiệu ứng)
```

Quy tắc phụ thuộc:

- `queue` không biết Web Audio, DOM hay `fetch`. Nó nhận một hàm `load` từ bên ngoài.
- `audio` chỉ biết Web Audio và `fetch`, không biết `queue` và `visual`.
- `visual` chỉ biết canvas và `Uint8Array`, không biết `audio`.
- Chỉ `main.js` biết cả ba và đụng DOM của trang.

Nhờ vậy `queue` và `bars` test được không cần trình duyệt; `audio` và `visualizer` test bằng đối tượng giả, vì jsdom không có Web Audio và không có `requestAnimationFrame` mặc định.

## 2. Ràng buộc từ đề

1. Web Audio API với `AnalyserNode`, FFT 256 hoặc 512 (số bin là 128 hoặc 256).
2. Hàng đợi FIFO xử lý việc tải bản nhạc và giải mã `AudioBuffer`.
3. Dọn dẹp rõ ràng `AudioBufferSourceNode`; hủy tác vụ bằng `AbortController`.
4. Canvas hoặc SVG chạy 60 fps bằng `requestAnimationFrame`, không state thrashing.
5. WCAG 2.2 AA cho UI (project-rules mục 8), thêm 1.4.2, 2.2.2, 2.3.1 như mục 7.

## 3. Hợp đồng kiểu

```js
/** @typedef {'queued'|'loading'|'decoding'|'ready'|'cancelled'|'error'} TaskStatus */

/**
 * @typedef {Object} AudioTask
 * @property {number} id                      tăng dần, duy nhất trong một queue
 * @property {string} trackUrl
 * @property {TaskStatus} status
 * @property {AbortController} controller
 * @property {(buffer: AudioBuffer) => void} resolve
 * @property {(reason: unknown) => void} reject
 */

/**
 * Hàm tải được inject vào queue. Gọi onPhase('decoding') khi bắt đầu giải mã.
 * @typedef {(trackUrl: string, options: { signal: AbortSignal, onPhase: (phase: 'decoding') => void }) => Promise<AudioBuffer>} LoadTrack
 */

/** @typedef {{ id: number, promise: Promise<AudioBuffer> }} EnqueueHandle */
```

Giao diện công khai của `AudioTaskQueue`:

| Phương thức | Việc |
|---|---|
| `constructor(load)` | Nhận `LoadTrack` |
| `enqueue(trackUrl)` | Thêm vào cuối hàng, trả `EnqueueHandle` |
| `cancel(id)` | Hủy một tác vụ ở bất kỳ trạng thái chưa kết thúc; trả `true` nếu có hủy |
| `cancelAll()` | Hủy mọi tác vụ chưa kết thúc |
| `subscribe(listener)` | Nhận `(task)` mỗi khi `status` đổi; trả hàm hủy đăng ký |

Bất biến:

1. Tại mọi thời điểm có **tối đa một** tác vụ ở `loading` hoặc `decoding`.
2. Tác vụ được lấy ra theo thứ tự `id` tăng dần (FIFO).
3. Mỗi tác vụ kết thúc đúng một lần: `resolve` (`ready`) hoặc `reject` (`cancelled`, `error`). Trạng thái kết thúc không đổi nữa.
4. Hủy luôn reject bằng lỗi có `name === 'AbortError'`; không nuốt lỗi.
5. Một tác vụ lỗi hoặc bị hủy không làm kẹt hàng: tác vụ kế tiếp vẫn chạy.

## 4. Quyết định thiết kế (mỗi quyết định ở một chỗ)

| Quyết định | Chốt | Lý do |
|---|---|---|
| FIFO | Tuần tự, một tác vụ mỗi lần; toàn bộ logic chọn tác vụ nằm trong `processNext` | Bạn đã chốt. Nếu thầy đổi thành song song, chỉ sửa một hàm |
| `enqueue` trả về | `{ id, promise }` thay vì chỉ `Promise` như khung mã mẫu | Cần `id` để UI hủy đúng tác vụ; khung mẫu chỉ để tham khảo |
| Queue không biết Web Audio | Nhận `load` qua constructor | Test bằng hàm giả; đổi nguồn tải không đụng queue |
| Pha `loading` và `decoding` | Queue đặt `loading` khi bắt đầu; `load` gọi `onPhase('decoding')` | Queue không cần biết khi nào fetch xong |
| Hủy khi đang tải | `fetch(url, { signal })`; `abort()` làm `fetch` reject `AbortError` | Cơ chế chuẩn |
| Hủy khi đang giải mã | `decodeAudioData` **không nhận signal**, không dừng được. Sau `await` kiểm `signal.aborted` rồi throw `AbortError`, bỏ kết quả | Giới hạn của API, phải ghi rõ khi bảo vệ |
| Lỗi hủy | `new DOMException('Aborted', 'AbortError')` tạo ở một hàm `createAbortError` | Một chỗ; `isAbortError` dùng lại ở UI |
| Dọn node | `audio-player` giữ đúng một `AudioBufferSourceNode`; `stop()`, `disconnect()`, gán `null`, gỡ `onended` | Một chỗ quản lý vòng đời, test đếm số lần gọi |
| `stop()` lặp lại | An toàn (idempotent): gọi hai lần không ném lỗi | `onended` và nút Stop có thể cùng chạy |
| Một nguồn phát tại một lúc | `play()` mới tự dừng nguồn cũ trước | Tránh hai node song song giữ bộ nhớ |
| `AudioContext` | Tạo lười, `resume()` trong handler của nút bấm | Trình duyệt chặn tự phát; không phát khi chưa tương tác |
| Phân tích | `fftSize` chỉ nhận 256 hoặc 512, ném lỗi với giá trị khác; `smoothingTimeConstant` 0.8 | Đề ràng buộc; một hằng ở một chỗ |
| Đọc dữ liệu | Một `Uint8Array(frequencyBinCount)` tạo một lần, dùng lại mọi khung hình | Không cấp phát mỗi frame, tránh áp lực GC |
| Vòng vẽ | `requestAnimationFrame` tự gọi lại; dừng bằng `cancelAnimationFrame` khi không phát, khi tab ẩn (`visibilitychange`), khi người dùng tạm dừng hiệu ứng | Đề yêu cầu; tiết kiệm CPU |
| Không state thrashing | Dữ liệu phổ đi từ analyser thẳng vào canvas, không qua object state nào | Đề cấm |
| Inject scheduler | `createVisualizer({ raf, caf })` | jsdom không có rAF; test điều khiển từng khung hình |
| Object URL | `main.js` tạo `URL.createObjectURL` cho file chọn, gọi `URL.revokeObjectURL` khi tác vụ kết thúc (kể cả hủy và lỗi) | Không revoke là rò rỉ bộ nhớ thật; dễ bị bỏ sót |
| Giữ `AudioBuffer` | Danh sách bản đã sẵn sàng giữ buffer; nút Remove xóa tham chiếu | Cho phép heap giảm; kiểm bằng heap snapshot |
| Sự kiện UI | Một listener `click` và một `change` ở gốc, tra `data-action` của `event.target.closest` | Theo luật hub tập trung; không inline handler |
| Dựng DOM | `createElement`, `textContent`, `replaceChildren`; không `innerHTML` | Luật cấm; tên file người dùng chọn là dữ liệu động |
| Nguồn nhạc | `trackUrl` bất kỳ; file người dùng chọn đi qua object URL | Bạn đã đồng ý |
| Phát tiếp tự động | **Không làm.** Mỗi bản sẵn sàng có nút Play riêng | YAGNI; FIFO áp cho việc tải, không cho việc phát |

## 5. WBS và kế hoạch commit

Mỗi task là một commit atomic, trừ khi ghi chú khác. Test viết trước hoặc cùng commit với mã.

### Nhóm A — Nền

- [x] **A1 Contract.** `src/queue/audio-task.js`: JSDoc các kiểu ở mục 3; hằng `TASK_STATUS`; `isTerminal(status)`; `createAbortError()`, `isAbortError(error)`.
  - Test: `isTerminal` đúng cho `ready`, `cancelled`, `error` và sai cho ba trạng thái còn lại; `createAbortError().name === 'AbortError'`; `isAbortError` nhận lỗi tự tạo và `signal.reason`, từ chối `new Error('x')`.
  - Kiểm chứng: 7 test pass (`audio-task.test.js`), chạy đỏ trước khi có mã.
  - Lệch plan: thêm kiểu `TaskSnapshot` (bản chỉ đọc gửi cho `subscribe`). Bỏ assertion `instanceof Error` ở test vì `DOMException` của jsdom không phải con của `Error` của Node; trình duyệt thật thì đúng. Đây cũng là lý do `isAbortError` kiểm theo `name`.
  - Commit dự kiến: `feat(queue): add audio task contract and abort error`.

### Nhóm B — Hàng đợi (logic thuần, test bằng `load` giả)

> Kiểm chứng chung nhóm B: `audio-task-queue.test.js` 25 test pass. Thứ tự làm: viết hết test B1 đến B6 trước; cài B1 tối thiểu thì 6 pass và 19 fail; cài đủ thì 25 pass. Sau đó phá cố ý 8 lỗi (LIFO thay FIFO; bỏ guard `#active`; bỏ `controller.abort()`; bỏ `processNext` sau khi settle; không bỏ kết quả của tác vụ đã hủy; bỏ pha `decoding`; `cancel` không reject; để lỗi listener thoát ra ngoài), cả 8 đều bị ít nhất một test bắt, rồi khôi phục (`cmp` khớp). Chạy lại toàn repo: 548 test pass. Chưa commit nên chưa tách được thành 6 commit; B1 đến B6 cùng nằm trong một file nên không tách sạch bằng `git add`, đề xuất gộp thành một commit.

- [x] **B1 FIFO tuần tự.** `AudioTaskQueue` với `enqueue`, `processNext`; `load` giả trả Promise do test điều khiển.
  - Test: ba tác vụ vào theo thứ tự A, B, C thì `load` được gọi đúng thứ tự A, B, C; B chưa được gọi khi A chưa xong; `promise` resolve đúng buffer của chính nó; **không bao giờ** có hai `load` chạy cùng lúc (đếm đồng thời tối đa bằng 1).
  - Commit: `feat(queue): implement sequential fifo queue`.
- [x] **B2 Trạng thái và `subscribe`.** Chuyển `queued → loading → decoding → ready`; `onPhase('decoding')` đổi trạng thái; `listener` nhận từng lần đổi theo đúng thứ tự.
  - Test: chuỗi trạng thái đúng; hủy đăng ký rồi không nhận nữa; lỗi ném trong `listener` không làm hỏng queue.
  - Commit: `feat(queue): publish task status changes`.
- [x] **B3 Hủy tác vụ đang chờ.** `cancel(id)` với `queued`: bỏ khỏi mảng, reject `AbortError`, trạng thái `cancelled`, không gọi `load` cho nó.
  - Test: hủy tác vụ giữa hàng thì A và C vẫn chạy đúng thứ tự; `cancel` id không tồn tại trả `false`; hủy hai lần chỉ reject một lần.
  - Commit: `feat(queue): cancel queued tasks`.
- [x] **B4 Hủy tác vụ đang chạy.** `cancel(id)` với `loading`/`decoding`: gọi `controller.abort()`; `load` giả tôn trọng `signal` và reject `AbortError`; queue sang tác vụ kế.
  - Quyết định thêm (đã có test): `status = 'cancelled'` và promise reject **ngay** khi gọi `cancel` để UI phản hồi tức thì, nhưng tác vụ kế **chỉ bắt đầu sau khi `load` của tác vụ bị hủy settle** (`#active` nhả trong `finally`). Vì `decodeAudioData` không hủy được, cho tác vụ kế chạy sớm sẽ làm hai lần giải mã chồng nhau. Nếu `load` của tác vụ đã hủy ném lỗi khác (mạng chết), tác vụ vẫn là `cancelled`, không thành `error`.
  - Test: hủy lúc `loading` và lúc `decoding` (hai test riêng); `signal.aborted === true`; tác vụ kế vẫn chạy; nếu `load` bỏ qua signal và vẫn resolve sau khi hủy, kết quả **bị bỏ** và promise vẫn reject `AbortError`.
  - Commit: `feat(queue): cancel running tasks with abort signal`.
- [x] **B5 Lỗi không làm kẹt hàng.** `load` reject lỗi khác `AbortError` thì `status = 'error'`, reject nguyên lỗi, tác vụ kế vẫn chạy.
  - Test: lỗi ở tác vụ đầu, tác vụ thứ hai vẫn `ready`; `processNext` không chạy hai lần song song khi `enqueue` được gọi trong lúc đang xử lý.
  - Commit: `fix(queue): keep processing after a failed task` hoặc gộp vào B4 nếu không tách sạch được.
- [x] **B6 `cancelAll`.** Hủy mọi tác vụ chưa kết thúc, đang chạy trước hay sau không quan trọng; hàng rỗng sau đó.
  - Test: sau `cancelAll` không còn `load` nào được gọi; mọi promise reject `AbortError`; `enqueue` sau đó vẫn chạy bình thường.
  - Commit: `feat(queue): add cancelAll`.

### Nhóm C — Âm thanh (test bằng đối tượng giả)

> Kiểm chứng chung nhóm C và D: 6 file test mới, viết trước (6 file đỏ vì thiếu module), rồi cài; lần đầu 108 pass. Sau đó phá cố ý 22 lỗi, **2 lỗi lọt** (loader bỏ kiểm abort sau `fetch`; `computeBars` để nhóm rỗng, vì `NaN` bị `Uint16Array` đổi thầm lặng thành 0). Đã bổ sung 2 test, chạy lại cả 2 lỗi thì bị bắt, rồi khôi phục. Kết quả cuối: HW2 109 test pass (nhóm C và D), toàn repo 625 test pass, quét từ cấm (`var`, `innerHTML`, `keypress`, `onclick=`, `Math.random`, `Date.now`) không có kết quả. Chưa chạy typecheck TypeScript; chưa chạy thứ gì trong trình duyệt thật (Web Audio, rAF, canvas) nên **chưa biết** mã chạy đúng với `AudioContext` thật, việc đó thuộc F1.

- [x] **C1 `track-loader`.** `createTrackLoader({ audioContext, fetchImpl })` trả `LoadTrack`: `fetch(url, { signal })`; ném nếu `!response.ok`; `arrayBuffer()`; gọi `onPhase('decoding')`; `decodeAudioData`; kiểm `signal.aborted` ngay sau mỗi `await`.
  - Test: fake `fetch` và fake context; hủy trước `fetch` xong; hủy giữa `arrayBuffer` và `decode`; hủy sau `decode` xong (kết quả bị bỏ, throw `AbortError`); HTTP 404 ném lỗi thường; `onPhase` được gọi đúng một lần.
  - Commit: `feat(audio): load and decode tracks with abort support`.
  - Lệch plan: dùng `signal.throwIfAborted()` thay vì tự ném lỗi (jsdom hỗ trợ, test chạy được). Thêm test "phản hồi đến sau khi đã hủy thì không đọc body". Test "hủy sau khi decode xong" kiểm kết quả bị bỏ (loader ném `AbortError`, không trả buffer).
- [x] **C2 `analyser-reader`.** `createAnalyser(audioContext, fftSize)` kiểm 256 hoặc 512; `createFrequencyReader(analyser)` trả `{ read(): Uint8Array, binCount }` với một mảng dùng lại.
  - Test: `fftSize` 128 hoặc 1024 ném lỗi; `read()` trả **cùng một tham chiếu** `Uint8Array` ở hai lần gọi; `binCount === fftSize / 2`; mỗi lần `read` gọi `getByteFrequencyData` đúng một lần.
  - Commit: `feat(audio): add analyser with reusable frequency buffer`.
- [x] **C3 `audio-player`.** `createPlayer({ audioContext, analyser })` có `play(buffer, { onEnded })` và `stop()`; nối `source → analyser → destination`; `resume()` nếu context `suspended`.
  - Test (node giả đếm lời gọi): `stop()` gọi `source.stop` và `source.disconnect` đúng một lần; `stop()` lần hai không ném lỗi và không gọi thêm; `onended` tự dọn và gọi `onEnded`; `play()` thứ hai dừng nguồn đầu; sau `stop`, `source.onended === null`; **vòng 200 lần** `play`/`stop` thì số node tạo ra bằng số node đã `stop` và `disconnect` (kiểm rò rỉ ở mức mã).
  - Commit: `feat(audio): implement player with explicit node cleanup`.
  - Quyết định đã có test: `play()` là hàm `async`; `resume()` được gọi **trước mọi `await`** để còn nằm trong cử chỉ của người dùng. `onEnded` chỉ chạy khi bản nhạc tự hết, không chạy khi `stop()` hay khi `play()` khác thay thế (người gọi đã biết mình vừa dừng). Hai `play()` gọi sát nhau vẫn chỉ để lại một node sống. Vòng 200 lần `play`/`stop` và 200 lần `play` thay nhau rồi một lần `stop`: mọi node đều `stop` và `disconnect` đúng một lần (kiểm bằng node giả, **chưa phải** heap snapshot thật, việc đó là F2).
- [x] **C4 Âm lượng (1.4.2).** `audio-player` nối `source → analyser → gain → destination` (analyser đứng **trước** gain để phổ không phụ thuộc âm lượng); `setVolume(value)` kẹp trong `[0, 1]`, đổi bằng `gain.setTargetAtTime` để không nghe tiếng lách tách; giá trị ban đầu 1.
  - Test (node giả): `setVolume(2)` thành 1, `setVolume(-1)` thành 0, `NaN` ném lỗi; thứ tự nối đúng; âm lượng giữ nguyên qua các lần `play` liên tiếp; `stop()` không đổi âm lượng.
  - Commit: `feat(audio): add volume control through a gain node`.

### Nhóm D — Bộ hiển thị

- [x] **D1 `bars.js` (hàm thuần).** `computeBars(frequencyData, barCount, height)` gộp bin thành `barCount` cột (lấy trung bình mỗi nhóm), trả mảng chiều cao nguyên trong `[0, height]`; ghi vào mảng cho sẵn để không cấp phát mỗi khung hình.
  - Test: đầu vào toàn 0 cho toàn 0; toàn 255 cho `height`; `barCount` không chia hết số bin vẫn phủ hết bin, không chỉ số ngoài mảng; không sửa `frequencyData`; dùng lại mảng đầu ra.
  - Commit: `feat(visual): compute bar heights from frequency data`.
- [x] **D2 `visualizer.js` vòng rAF.** `createVisualizer({ canvas, read, raf, caf, onFrame? })` có `start()`, `stop()`, `isRunning`; `start()` hai lần chỉ có một vòng; `stop()` gọi `caf` với id hiện tại; vẽ bằng `fillRect`.
  - Test (rAF giả chạy tay từng khung): `start` rồi n khung thì `read` gọi n lần; `stop` rồi không còn khung nào; `start` hai lần chỉ lên lịch một khung; không tạo object mới mỗi khung (kiểm `read` trả cùng tham chiếu và hàm vẽ không nhận mảng mới).
  - Commit: `feat(visual): add requestAnimationFrame visualizer loop`.
  - Lệch plan (D2): thêm `clear()` để xóa canvas khi bản nhạc hết. Nếu việc đọc dữ liệu ném lỗi thì vòng dừng hẳn và lỗi được ném ra, thay vì lặp lỗi 60 lần mỗi giây. Bỏ qua cột cao 0 (không gọi `fillRect`). Lời hứa "không tạo object mới mỗi khung" **chỉ được kiểm một phần**: test chứng minh `read` dùng lại cùng mảng (C2), còn việc không cấp phát trong `draw` chưa có test tự động; chứng cứ phải lấy từ Performance panel (F3).
- [x] **D3 Tạm dừng theo tab ẩn và `prefers-reduced-motion`.** Khi `document.hidden` thì `stop()`; khi hiện lại và đang phát thì `start()`. Khi `reduced-motion: reduce` thì không tự chạy hiệu ứng; người dùng vẫn bật được bằng nút.
  - Test: `visibilitychange` giả; `matchMedia` giả trả `matches: true` và `false`.
  - Commit: `feat(visual): pause on hidden tab and respect reduced motion`.
  - Lệch plan: tách thành module riêng `motion-policy.js` (`visualizer.js` không biết `document`). API: `sync()`, `setEffectEnabled(bool)`, `effectEnabled`, `dispose()`. Hệ thống đổi cài đặt "giảm chuyển động" giữa phiên thì hiệu ứng theo cài đặt mới (ghi đè lựa chọn trước đó của người dùng). `main.js` phải gọi `sync()` mỗi khi bắt đầu hoặc kết thúc phát.

### Nhóm E — Trang và kiểu dáng

- [ ] **E1 `index.html` và `style.css`.** `<html lang="en">`, `<title>`, `<main>` với `<h1>`; nhóm điều khiển bằng `<button>`, `<input type="file" multiple accept="audio/*,video/mp4">` có `<label for>`, và `<input type="range">` âm lượng có `<label for>` (task C4); `<canvas aria-hidden="true">`; danh sách tác vụ `<ul>`; `#status` với `role="status"`.
  - Test (`main.test.js`): HTML chứa các phần tử trên; CSS chứa `:focus-visible`, `prefers-reduced-motion`, kích thước tối thiểu 24 px; **không** có `innerHTML`, `onclick`, `keypress`, `var` trong mã.
  - Commit: `feat(ui): add audio visualizer page and styles`.
- [ ] **E2 `main.js` nối các module.** Tạo một `AudioContext` lười; một `AudioTaskQueue` với loader thật; một hub `click` và `change` ở gốc theo `data-action` (`add-files`, `cancel`, `cancel-all`, `play`, `stop`, `remove`, `toggle-effect`); render danh sách tác vụ và danh sách bản sẵn sàng bằng `replaceChildren`; ghi `#status` từ handler, không ghi lúc render; thu hồi object URL khi tác vụ kết thúc.
  - Test (jsdom, queue/player/visualizer giả): chọn hai file thì hai tác vụ vào hàng đúng thứ tự; bấm Cancel gọi `cancel(id)`; tác vụ `cancelled` và `error` đều `revokeObjectURL` đúng một lần; tên file chứa `<img onerror=...>` hiện như chữ, không tạo `<img>`; một listener `click` duy nhất ở gốc.
  - Commit: `feat(ui): wire queue, player and visualizer`.

### Nhóm F — Kiểm chứng và bằng chứng

- [ ] **F1 Chạy trong Edge thật (AI làm, như F1 của Homework 1).** Edge headless qua Chrome DevTools Protocol, không cài gì: nạp trang, tạo file âm thanh giả lập, kiểm FIFO, hủy lúc tải và lúc giải mã, `AudioContext` cần `resume`, đo tương phản và kích thước control, console sạch. Báo cáo thô vào `evidence/browser-audit.json`.
  - Giới hạn: headless không cho nghe âm thanh và đo fps thật; những phần đó là F2, F3.
- [ ] **F2 Kiểm rò rỉ bộ nhớ.** **Việc của bạn** (mục 10.1): heap snapshot trước và sau nhiều lần phát và hủy; Performance Monitor xem JS heap và DOM nodes.
- [ ] **F3 Đo 60 fps.** **Việc của bạn** (mục 10.2): Performance panel ghi 5 đến 10 giây khi đang phát, không có long task do mã của bài, số khung hình trên giây.
- [ ] **F4 Lighthouse.** **Việc của bạn** (mục 10.3): Accessibility và Best Practices, ba trạng thái.
- [ ] **F5 Kiểm tay bàn phím và trình đọc màn hình.** **Việc của bạn** (mục 10.4).
- [ ] **F6 Bảng kiểm WCAG 2.2 AA.** Điền mục 7 đúng mức đã kiểm; **không** ghi "đạt WCAG" khi còn "Một phần".
- [ ] **F7 Verify cuối và prompt log.** `npm test` toàn repo; `grep` từ cấm; `git diff --stat -- Exercise1_Lab02 Exercise2_Lab02 Exercise3_Lab02 Homework1_Lab02` rỗng. Prompt log: **việc của bạn**, export vào `docs/prompt_logs/`.

Thứ tự đề xuất: A1, B1 đến B6, C1 đến C3, D1 đến D3, E1, E2, rồi F. Nhóm B làm trước hết vì là phần được hỏi nhiều nhất khi bảo vệ và không phụ thuộc trình duyệt.

## 6. Điều kiện hoàn thành (checklist nghiệm thu)

- [ ] `AudioTaskQueue` đúng FIFO, một tác vụ mỗi lần (B1)
- [ ] Hủy bằng `AbortController` đúng cả khi chờ, đang tải, đang giải mã (B3, B4)
- [ ] Mọi `AudioBufferSourceNode` được `stop()` và `disconnect()`; object URL được thu hồi (C3, E2)
- [ ] `AnalyserNode` dùng FFT 256 hoặc 512 (C2)
- [ ] Bộ hiển thị chạy 60 fps trong Performance panel, không state theo khung hình (D2, F3)
- [ ] Heap snapshot không tăng bất thường sau nhiều lần phát và hủy (F2)
- [ ] Kiểm WCAG 2.2 AA như mục 7 (F6)
- [ ] Lighthouse Accessibility và Best Practices 100, có ảnh (F4)
- [ ] `npm test` pass, không sửa bài khác (F7)
- [ ] Mỗi commit atomic, Conventional Commits
- [ ] Prompt log đã export (F7)

## 7. Kiểm tra WCAG 2.2 AA (kế hoạch, chưa kiểm)

| Tiêu chí | Cách sẽ kiểm | Trạng thái |
|---|---|---|
| 1.1.1 Nội dung không phải chữ | Canvas đánh dấu `aria-hidden`; thông tin tương đương nằm ở `#status` và danh sách tác vụ | Chưa kiểm |
| 1.3.1 Thông tin và quan hệ | Test cấu trúc (`main`, `h1`, `ul`, `label for`, `button`); cây accessibility trong Edge | Chưa kiểm |
| 1.4.1 Không chỉ dùng màu | Trạng thái tác vụ luôn có chữ ("Queued", "Loading", "Decoding", "Ready", "Cancelled", "Error") | Chưa kiểm |
| 1.4.2 Điều khiển âm thanh | Không tự phát; có nút Stop và `<input type="range">` có `<label>` điều khiển `GainNode` (task C4, E1); `aria-valuetext` đọc phần trăm | Chưa kiểm |
| 1.4.3 Tương phản tối thiểu | `getComputedStyle` trong Edge, công thức WCAG | Chưa kiểm |
| 1.4.10 Reflow | Đo ở 320 px | Chưa kiểm |
| 1.4.11 Tương phản phi văn bản | Viền nút, vòng focus, màu cột phổ so với nền ít nhất 3:1 | Chưa kiểm |
| 2.1.1 Bàn phím | Mọi nút dùng được bằng Tab, Enter, Space | Chưa kiểm |
| 2.2.2 Tạm dừng, dừng, ẩn | Nút "Pause visual effect" dừng vòng vẽ; `prefers-reduced-motion` mặc định tắt | Chưa kiểm |
| 2.3.1 Không quá ba lần nháy | Cột thay đổi chiều cao, không có vùng lớn nháy sáng tối; làm mượt `smoothingTimeConstant` 0.8 | Chưa kiểm; cần xem lại khi đo bằng mắt |
| 2.4.7 Focus nhìn thấy | `:focus-visible` | Chưa kiểm |
| 2.5.8 Vùng bấm 24×24 | `getBoundingClientRect` | Chưa kiểm |
| 3.3.2 Nhãn hoặc hướng dẫn | `<label for>` cho ô chọn file | Chưa kiểm |
| 4.1.2 Tên, vai trò, giá trị | Nút có tên truy cập được; nút Cancel ghi tên bản nhạc (`aria-label="Cancel track-name.mp3"`) | Chưa kiểm |
| 4.1.3 Thông báo trạng thái | `#status role="status"`, ghi từ handler: "track.mp3 is ready", "track.mp3 cancelled" | Chưa kiểm |

## 8. Rủi ro và điểm cần giải thích khi bảo vệ

Các "đột biến" thầy có thể yêu cầu, và nơi sửa:

| Thầy đổi | Chỉ sửa ở | Cách kiểm chứng |
|---|---|---|
| FIFO thành chạy N tác vụ song song | `processNext` trong `audio-task-queue.js` | Test B1 đếm đồng thời tối đa |
| `fftSize` 256 thành 512 | Hằng `FFT_SIZE` trong `analyser-reader.js` | `binCount` và số cột đổi; test C2 |
| Bỏ `disconnect()` | `audio-player.js` | Test C3 đếm lời gọi sẽ fail; heap snapshot tăng |
| Quên `revokeObjectURL` | `main.js` | Test E2; heap/Blob tăng |
| Bỏ `cancelAnimationFrame` | `visualizer.js` | Test D2; vòng vẽ vẫn chạy khi đã dừng |
| Thêm giới hạn độ dài hàng | `enqueue` | Test mới |

Điểm kỹ thuật cần nhớ:

- **`decodeAudioData` không hủy được.** "Hủy khi đang giải mã" nghĩa là bỏ kết quả. CPU vẫn tốn cho đến khi giải mã xong. Nói thẳng điều này khi bảo vệ.
- **`fetch` với `signal`** reject `AbortError` ngay cả khi đang đọc thân phản hồi (`arrayBuffer`). Vẫn kiểm `signal.aborted` sau mỗi `await` để chắc.
- **Hủy xong promise phải reject.** Nếu `cancel` chỉ đổi trạng thái mà promise treo mãi thì mã chờ `await` bị rò. Có test B3, B4.
- **`AudioBufferSourceNode` dùng một lần.** Không phát lại được sau `stop()`; mỗi lần Play tạo node mới.
- **`onended` cũng chạy sau `stop()`.** Cần chống dọn hai lần (idempotent).
- **`Date.now` không dùng** trong bài này; nếu cần đo thời gian dùng `performance.now()`.
- **Hoạt ảnh liên tục tốn pin.** Dừng vòng rAF khi không phát là yêu cầu, không phải tối ưu sớm.
- **Headless không chứng minh được 60 fps thật.** Con số fps lấy từ Performance panel của bạn (F3).

## 9. Câu hỏi còn mở và giả định

| Câu hỏi | Mặc định đang dùng | Trạng thái |
|---|---|---|
| `enqueue` trả `{ id, promise }` thay vì `Promise` | Có, để hủy theo `id` | Đã chốt, đã cài (B1) |
| Mẫu nhạc để demo | Bạn có sẵn file trong `C:\Dev\Project\remotion-video\my-video\public\sounds` và video `out\NestFairPromo_Pro_v2.mp4` (trình duyệt giải mã được âm thanh của mp4). Chưa chép vào repo; chọn file bằng ô chọn file khi demo. Nếu muốn nộp kèm, hỏi lại trước khi chép (kích thước, bản quyền) | Đã chốt hướng; chưa xem nội dung thư mục |
| Tự phát bản kế tiếp | Không; mỗi bản có nút Play | Giả định |
| Âm lượng (1.4.2) | Có thanh trượt điều khiển `GainNode` (task C4) | Đã chốt |
| Số cột phổ | 64 cột | Giả định |
| Số commit tối thiểu | Một commit mỗi task | Đề chưa nói |
| `AI_FAILURE_AUDIT.md` cho bài này | Không bắt buộc riêng; ghi lỗi AI gặp nếu có | Chờ bạn xác nhận |
| Lệnh typecheck | Chỉ VS Code diagnostics, như Homework 1 | Giả định |
| Throttling để thấy hàng đợi chạy chậm | Dùng DevTools Network throttling (Slow 3G) khi demo | Đề xuất |

## 10. Hướng dẫn kiểm tra tay (F2 đến F5)

Làm sau khi E2 xong. Chạy trang bằng `python -m http.server 8765`, mở trong **cửa sổ ẩn danh**, có 3 file nhạc để chọn.

### 10.1 F2 — Rò rỉ bộ nhớ

1. DevTools, tab Memory, chọn Heap snapshot, chụp **Snapshot 1** sau khi tải trang.
2. Thêm 3 file, phát từng bản và dừng, hủy một tác vụ lúc đang tải (bật throttling Slow 3G để kịp bấm), lặp lại 20 lần. Xóa hết các bản sẵn sàng.
3. Bấm biểu tượng thùng rác (Collect garbage), chụp **Snapshot 2**.
4. So sánh hai snapshot bằng chế độ Comparison; lọc `AudioBufferSourceNode`, `AudioBuffer`, `ArrayBuffer`, `Blob`. Số lượng không nên tăng theo số lần lặp.
5. Tab Performance monitor: theo dõi JS heap size và DOM Nodes trong lúc lặp.
6. Lưu ảnh vào `evidence/` (ví dụ `heap-compare.png`).

### 10.2 F3 — 60 fps

1. Tab Performance, bật Screenshots, ghi 5 đến 10 giây khi đang phát.
2. Xem hàng Frames: các khung nên xanh, không có khung đỏ kéo dài; hàng Main không có long task (thanh có góc đỏ) do `visualizer.js`.
3. Xem Summary: số khung hình trên giây. Lưu ảnh vào `evidence/`.

### 10.3 F4 — Lighthouse

Accessibility và Best Practices, Desktop và Mobile, ở ba trạng thái: vừa tải; đã thêm file và đang có danh sách; đang phát. Lưu ảnh vào `evidence/`. Mục không đạt thì chụp mô tả gửi mình để sửa bằng commit riêng.

### 10.4 F5 — Bàn phím và trình đọc màn hình

| # | Thao tác | Kết quả đúng |
|---|---|---|
| 1 | Tab qua toàn bộ trang | Thứ tự hợp lý, vòng focus luôn thấy, không có bẫy bàn phím |
| 2 | Chọn file bằng bàn phím, Enter trên Play | Phát; `AudioContext` chạy sau tương tác |
| 3 | Cancel một tác vụ bằng Enter | Tác vụ `Cancelled`, danh sách còn lại giữ nguyên thứ tự |
| 4 | Nút tạm dừng hiệu ứng | Cột ngừng chuyển động, âm thanh vẫn phát |
| 5 | Bật "reduce motion" của hệ điều hành rồi tải lại | Hiệu ứng không tự chạy |

NVDA hoặc Narrator: ghi lại **câu được đọc** khi thêm file, khi một bản "ready", khi hủy, khi bắt đầu phát, kể cả khi đọc sai hoặc không đọc.

## 11. Ghi chú nguồn

Đề gốc: slide Homework 2 (xem [Context mục 7](../docs/Context.md) về chỗ khung mã bị thiếu). Chuẩn WCAG: [project-rules mục 8](../docs/project-rules.md). API: MDN cho `AbortController`, `AudioContext.decodeAudioData`, `AnalyserNode.getByteFrequencyData`, `AudioBufferSourceNode`; chưa tra lại bản mới nhất, đối chiếu khi cần giải thích lúc bảo vệ.
