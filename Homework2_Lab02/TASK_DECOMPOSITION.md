# Homework 2 — Task Decomposition

> Bối cảnh: [Context](../docs/Context.md). Quy tắc: [project-rules](../docs/project-rules.md) và [Agents](../Agents.md). Mẫu WBS: [Homework 1](../Homework1_Lab02/TASK_DECOMPOSITION.md).
> Trạng thái (2026-10-28): **nhóm A đến E đã làm và verify bằng test (178 test của HW2, 694 test toàn repo); F1 và F6 đã chạy**. Chưa xong: **F2 (heap snapshot), F3 (60 fps), F4 (Lighthouse), F5 (bàn phím và trình đọc màn hình), prompt log là việc của bạn**, hướng dẫn ở mục 10. Nhóm E (file mới) chưa commit.
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

- [x] **E1 `index.html` và `style.css`.** `<html lang="en">`, `<title>`, `<main>` với `<h1>`; nhóm điều khiển bằng `<button>`, `<input type="file" multiple accept="audio/*,video/mp4">` có `<label for>`, và `<input type="range">` âm lượng có `<label for>` (task C4); `<canvas aria-hidden="true">`; danh sách tác vụ `<ul>`; `#status` với `role="status"`.
  - Test (`main.test.js`): HTML chứa các phần tử trên; CSS chứa `:focus-visible`, `prefers-reduced-motion`, kích thước tối thiểu 24 px; **không** có `innerHTML`, `onclick`, `keypress`, `var` trong mã.
  - Commit: `feat(ui): add audio visualizer page and styles`.
  - Kiểm chứng: `main.test.js` kiểm `index.html` (lang, title, một `h1`, thứ bậc heading, `label for`, `role="status"` ngoài danh sách, canvas `aria-hidden`, mọi `button` có `type="button"`, id không trùng, không có handler nội tuyến), `style.css` (`:focus-visible`, `prefers-reduced-motion`, `min-height: 2.5rem`, dấu tích cho nút bật, tên file dài tự xuống dòng) và quét từ cấm trên mọi file nguồn.
  - Lệch plan: nút bật/tắt hiệu ứng tên **"Animate spectrum"** với `aria-pressed` (tên cố định, trạng thái nằm ở `aria-pressed`), không phải "Pause visual effect"; thêm một `<h2 tabindex="-1">` cho mỗi vùng để làm nơi trả focus; thêm `<span id="volume-value">` hiển thị phần trăm (cố ý không dùng `<output>` vì nó có role `status` ngầm và sẽ đọc mỗi lần kéo thanh trượt).
- [x] **E2 Nối các module.** Tách thành hai file thay vì dồn vào `main.js`: `src/app/audio-app.js` (toàn bộ logic giao diện, nhận phụ thuộc qua tham số nên test được bằng đối tượng giả) và `main.js` (chỉ tạo đối tượng thật và nối dây).
  - Giữ đúng plan: `AudioContext` tạo lười ở lần thêm file hoặc Play đầu tiên; ghi `#status` chỉ từ handler; thu hồi object URL khi tác vụ kết thúc (qua `subscribe`, đúng một lần); render bằng `createElement` + `replaceChildren`, chuỗi đi qua `append` nên luôn là text node.
  - Lệch plan: hub là **một hàm `dispatch` đăng ký cho ba loại sự kiện** (`click`, `change`, `input`) ở gốc, không chỉ `click` và `change`, vì thanh trượt cần `input`. Thêm: sau mỗi lần render lại, nếu nút đang focus bị xóa thì trả focus về nút tương ứng, rồi về dòng, rồi về `h2` của vùng (WCAG 2.4.3); thanh âm lượng nhớ giá trị trước khi engine tồn tại và áp dụng ở lần Play đầu.
  - Kiểm chứng: `audio-app.test.js` 39 test (dùng `AudioTaskQueue` thật với `load` giả). Phá cố ý 11 lỗi, 9 bị bắt ngay; 2 lọt qua: (1) báo lỗi hủy như lỗi tải, vì test kiểm `#status` trước khi microtask của promise bị reject chạy (đã sửa test, mutant bị bắt); (2) kiểm `root.contains` trong hub là mã thừa vì listener gắn ở `root` (đã xóa khỏi mã). Còn một guard phòng thủ (`objectUrl === null` trong `revokeUrl`) mà không test nào chạm tới vì queue chỉ phát trạng thái kết thúc một lần; giữ lại cho kiểu `string | null`, **không** coi là đã được kiểm.
  - Commit: `feat(ui): wire queue, player and visualizer`.

### Nhóm F — Kiểm chứng và bằng chứng

- [x] **F1 Chạy trong Edge thật (AI làm, như F1 của Homework 1).** Edge headless qua Chrome DevTools Protocol, không cài gì: 55 kiểm tra pass, 0 fail, console không có lỗi hay cảnh báo. Kết quả ở mục 6.1; báo cáo thô ở [evidence/browser-audit.json](evidence/browser-audit.json). Script chạy từ thư mục tạm, không lưu vào repo. Dùng hai file nhạc thật của bạn (60 giây và 162 giây), một WAV 5 giây tự sinh và một file `.mp3` hỏng để thử đường lỗi.
  - Lệch plan: lần chạy đầu có 1 fail (S9, số node DOM +13 sau 25 vòng) và 2 kiểm tra do mình viết sai (một cái truyền thẳng `true`, một cái luôn đúng). Đã đo lại: sau 725 vòng play/stop với GC hai lần, số node DOM đứng yên ở 122 và listener ở 5, nên +13 chỉ là node tách rời chờ GC; hai kiểm tra vô nghĩa đã thay bằng kiểm tra thật.
  - Giới hạn: headless không cho nghe âm thanh; con số fps của headless chỉ mang tính tham khảo; chưa thử tab ẩn, Firefox, Safari. Việc cần trình duyệt có màn hình là F2 đến F5.
- [ ] **F2 Kiểm rò rỉ bộ nhớ.** **Việc của bạn** (mục 10.1): heap snapshot trước và sau nhiều lần phát và hủy; Performance Monitor xem JS heap và DOM nodes.
- [ ] **F3 Đo 60 fps.** **Việc của bạn** (mục 10.2): Performance panel ghi 5 đến 10 giây khi đang phát, không có long task do mã của bài, số khung hình trên giây.
- [ ] **F4 Lighthouse.** **Việc của bạn** (mục 10.3): Accessibility và Best Practices, ba trạng thái.
- [ ] **F5 Kiểm tay bàn phím và trình đọc màn hình.** **Việc của bạn** (mục 10.4).
- [x] **F6 Bảng kiểm WCAG 2.2 AA.** Đã điền mục 7 đúng mức đã kiểm. **Không ghi "đạt WCAG"**: còn nhiều dòng "Một phần".
- [ ] **F7 Verify cuối và prompt log.**
  - [x] Verify: `npm test` toàn repo 35 file, 694 test pass (riêng HW2: 10 file, 178 test); `grep` các từ cấm (`var`, `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `keypress`, `keyCode`, `onclick=`, `Math.random`, `Date.now`) trong mã và HTML của HW2 không có kết quả; `addEventListener` chỉ ở hub của `audio-app.js` và hai listener của `motion-policy.js` (có `dispose`); `git diff --stat -- Exercise1_Lab02 Exercise2_Lab02 Exercise3_Lab02 Homework1_Lab02` rỗng.
  - [ ] Prompt log: **việc của bạn**, export vào `docs/prompt_logs/` (AI không xuất được phiên làm việc của chính nó).

Thứ tự đề xuất: A1, B1 đến B6, C1 đến C3, D1 đến D3, E1, E2, rồi F. Nhóm B làm trước hết vì là phần được hỏi nhiều nhất khi bảo vệ và không phụ thuộc trình duyệt.

## 6. Điều kiện hoàn thành (checklist nghiệm thu)

- [x] `AudioTaskQueue` đúng FIFO, một tác vụ mỗi lần (B1; Edge: S2, tối đa một lần tải tại một lúc)
- [x] Hủy bằng `AbortController` đúng cả khi chờ, đang tải, đang giải mã (B3, B4; Edge: S3, S4)
- [x] Mọi `AudioBufferSourceNode` được `stop()` và `disconnect()`; object URL được thu hồi (C3, E2; Edge: S5, S2, S3). Chưa có heap snapshot thật (F2)
- [x] `AnalyserNode` dùng FFT 256 (128 bin) (C2; Edge: S2)
- [ ] Bộ hiển thị chạy 60 fps trong Performance panel, không state theo khung hình (D2; Edge headless có số tham khảo, chờ F3 của bạn)
- [ ] Heap snapshot không tăng bất thường sau nhiều lần phát và hủy (F2, chờ bạn; Edge: số node DOM và listener phẳng sau 300 vòng)
- [ ] Kiểm WCAG 2.2 AA như mục 7 (F6 đã điền; còn nhiều dòng "Một phần", cần F4 và F5)
- [ ] Lighthouse Accessibility và Best Practices 100, có ảnh (F4, chờ bạn)
- [x] `npm test` pass, không sửa bài khác (F7)
- [ ] Mỗi commit atomic, Conventional Commits (còn nhóm E chưa commit)
- [ ] Prompt log đã export (F7, chờ bạn)

### 6.1 Kết quả chạy trong Edge thật (F1)

Môi trường: Edge headless (xem `edge` trong [evidence/browser-audit.json](evidence/browser-audit.json)), viewport 1280×900 (và 320×640 cho reflow), `--mute-audio`, nhấp chuột thật qua `Input.dispatchMouseEvent`, phím thật qua `Input.dispatchKeyEvent`. Để quan sát được các pha ngắn, script chèn độ trễ giả vào `fetch` (2,5 giây, có tôn trọng `signal`) hoặc `decodeAudioData` (3 giây); độ trễ này chỉ có trong script đo, không có trong mã của bài.

| Nhóm | Kiểm tra | Kết quả |
|---|---|---|
| Tải trang | Không lỗi hay cảnh báo console; chưa tạo `AudioContext`; vùng `#status` rỗng | Đúng |
| FIFO | Ba file (60 s, 5 s, 162 s) thành "ready" theo đúng thứ tự thêm, độ dài giải mã đúng (1:00, 0:05, 2:42) | Đúng |
| FIFO | Thứ tự `fetch` bằng thứ tự tạo object URL; tối đa một lần tải (từ `fetch` đến hết `decode`) tại một lúc; không bao giờ có hai dòng "Loading" hoặc "Decoding" trong DOM (28 lần lấy mẫu) | Đúng |
| Bộ nhớ | Mỗi object URL được thu hồi đúng một lần (ở cả ba tình huống: xong, lỗi, hủy) | Đúng |
| Analyser | `fftSize` 256, 128 bin | Đúng |
| File hỏng | Dòng "Status: Error. Unable to decode audio data" kèm nút Dismiss; file kế tiếp vẫn tải xong | Đúng |
| Hủy lúc tải | Hiện "Cancelled" ngay; track kế tiếp bắt đầu tải; hủy được track đang chờ; "Cancel all loading" hủy hết; track đang chờ bị hủy **không bao giờ được fetch** | Đúng |
| Hủy lúc giải mã | Hiện "Cancelled" ngay nhưng track kế tiếp vẫn "Queued" và chưa fetch trong lúc giải mã bị hủy còn chạy (số lần `fetch` 1 → 1); chỉ bắt đầu sau khi giải mã xong; track bị hủy không xuất hiện ở "Ready" | Đúng, đúng như quyết định ở B4 |
| Phát | `AudioContext` ở trạng thái `running` sau cú nhấp chuột vào Play; `#status` "Playing tone-5s.wav" | Đúng |
| Vẽ | 4134 pixel không trong suốt trên canvas khi đang phát (cột phổ có thật) | Đúng |
| Hiệu ứng | Tắt: 0 lần gọi `requestAnimationFrame` trong 600 ms và canvas trống; bật lại: vòng chạy lại; khi không phát: vòng không chạy | Đúng |
| Dọn node | 31 `AudioBufferSourceNode` tạo ra qua nhiều lần Play, Stop và Play thay nhau: mỗi node `start`, `stop`, `disconnect` đúng một lần | Đúng |
| Hết bản nhạc | Bản WAV 5 giây tự dừng: "Finished tone-5s.wav", node được dọn, "Nothing is playing." | Đúng |
| Âm lượng | 10 lần phím ←: 90, `aria-valuetext` "90%", `GainNode` 0,9; Home: 0, `GainNode` 0 | Đúng |
| Giảm chuyển động | Giả lập `prefers-reduced-motion: reduce`: hiệu ứng mặc định tắt, âm thanh vẫn phát, 0 khung hình được yêu cầu; bật bằng nút thì chạy | Đúng |
| Sau 300 vòng play/stop (GC hai lần) | Số node DOM 122 → 122; listener 5 → 5 | Phẳng |
| Console | Không lỗi, không cảnh báo trong cả phiên | Đúng |

Đo tương phản và kích thước (từ `getComputedStyle` và `getBoundingClientRect`, công thức WCAG):

| Hạng mục | Kết quả |
|---|---|
| Chữ: 21 phần tử (h1, h2, gợi ý, `#status`, nhãn, tên và trạng thái track, nút) | Thấp nhất 8,86:1 (dòng gợi ý), yêu cầu 4,5:1 |
| Viền control: 8 control | Thấp nhất 6,69:1, yêu cầu 3:1 |
| Kích thước: 8 control | Nhỏ nhất 153×40 px ("Cancel all loading"), yêu cầu 24×24 |
| Tab | Đi qua 8 control (ô chọn file, Cancel all, nút của dòng, Stop, Animate spectrum, Volume) rồi ra khỏi trang và quay lại từ đầu; mọi control khớp `:focus-visible` với viền ít nhất 2 px; không bị kẹt |
| Cây accessibility | Mọi nút có tên; tên nút luôn chứa chữ nhìn thấy (2.5.3); có `slider "Volume"`, vùng `status`, nút "Animate spectrum" `pressed=true` |
| Reflow 320 px | Không cuộn ngang (305 so với 305; chênh do thanh cuộn dọc) |

Con số fps (chỉ tham khảo): trong 2 giây phát, 289 khung hình, trung bình khoảng 144 fps (headless chạy theo tần số quét màn hình giả), không có khoảng cách nào trên 33 ms. Con số này **không thay** cho F3 vì không đo trên màn hình thật và không có Performance panel.

Ảnh do script chụp để mình tự kiểm tra giao diện: [evidence/queue-ready.png](evidence/queue-ready.png), [evidence/playing.png](evidence/playing.png), [evidence/rows-error.png](evidence/rows-error.png), [evidence/320px.png](evidence/320px.png). Ảnh nộp bài (Lighthouse, heap snapshot, Performance) bạn tự chụp.

## 7. Kiểm tra WCAG 2.2 AA (F6)

Cột "Cách đã kiểm" ghi đúng việc đã làm. "Đã kiểm" nghĩa là đã có bằng chứng đủ cho tiêu chí đó ở mức công cụ cho phép; "Một phần" nghĩa là còn thiếu bước ghi trong cột.

| Tiêu chí | Cách đã kiểm | Trạng thái |
|---|---|---|
| 1.1.1 Nội dung không phải chữ | Canvas `aria-hidden="true"` (test `main.test.js`); thông tin tương đương nằm ở `#now-playing`, `#status` và danh sách track | Một phần: chưa nghe bằng trình đọc màn hình (F5) |
| 1.3.1 Thông tin và quan hệ | Test cấu trúc: một `h1`, heading theo thứ bậc, `section aria-labelledby`, `label for`, `ul`, `button type="button"`; cây accessibility trong Edge (slider "Volume", vùng `status`, nút có tên) | Một phần: chưa nghe bằng trình đọc màn hình |
| 1.4.1 Không chỉ dùng màu | Trạng thái track luôn có chữ ("Status: Loading", "Cancelled", "Error..."); nút bật có dấu tích và chữ đậm ngoài màu; đã xem `playing.png` | Một phần: mình tự xem ảnh, cần bạn xác nhận bằng mắt |
| 1.4.2 Điều khiển âm thanh | Không tự phát (chỉ phát khi bấm Play); có Stop; thanh trượt âm lượng có nhãn, điều khiển được bằng phím và `GainNode` đổi theo trong Edge | Đã kiểm |
| 1.4.3 Tương phản tối thiểu | `getComputedStyle` trong Edge: 21 phần tử chữ, thấp nhất 8,86:1 | Một phần: chưa đo trạng thái hover; chưa có Lighthouse (F4) |
| 1.4.10 Reflow | Đo ở 320 px trong Edge: không cuộn ngang | Một phần: chưa thử zoom 400% bằng tay |
| 1.4.11 Tương phản phi văn bản | Viền control thấp nhất 6,69:1; vòng focus rộng ít nhất 2 px (màu `#1a3d8f` so với nền trắng khoảng 9,96:1 theo HW1) | Một phần: chưa đo màu cột phổ `#1a3d8f` trên nền canvas `#eef0f4` bằng `getComputedStyle` (từ CSS, ước tính trên 8:1); thanh trượt dùng giao diện gốc của trình duyệt (`accent-color`) và chưa đo |
| 2.1.1 Bàn phím | Tab đi qua mọi control và không bị kẹt; phím mũi tên và Home điều khiển thanh trượt (phím thật trong Edge) | Một phần: Enter và Space trên nút do trình duyệt xử lý gốc nhưng chưa thử từng nút bằng phím; chờ F5 |
| 2.2.2 Tạm dừng, dừng, ẩn | Nút "Animate spectrum" tắt được vòng vẽ (0 khung hình sau khi tắt); `prefers-reduced-motion` mặc định tắt và bật lại được (giả lập trong Edge) | Đã kiểm |
| 2.3.1 Không quá ba lần nháy | Chỉ có cột đổi chiều cao, không có vùng lớn đổi sáng tối; `smoothingTimeConstant` 0,8 làm mượt | Một phần: đánh giá bằng lập luận, chưa dùng công cụ đo nháy (Harding) |
| 2.4.3 Thứ tự focus | Thứ tự Tab theo thứ tự trên trang; khi nút đang focus bị xóa (Cancel, Dismiss, Remove) focus được trả về nút tương ứng, dòng hoặc tiêu đề của vùng (test jsdom) | Một phần: kiểm bằng jsdom, chưa thử tay trong trình duyệt có màn hình |
| 2.4.7 Focus nhìn thấy | Mọi control khớp `:focus-visible`, viền ít nhất 2 px (Edge); thấy trong `320px.png` | Một phần: chưa kiểm sau khi Tab từ thanh địa chỉ vào |
| 2.5.3 Nhãn trong tên | Mọi nút có `aria-label` bắt đầu bằng chữ nhìn thấy (Edge) | Đã kiểm |
| 2.5.8 Vùng bấm 24×24 | `getBoundingClientRect`: nhỏ nhất 153×40 px trên 8 control | Đã kiểm cho các control đo |
| 3.3.2 Nhãn hoặc hướng dẫn | `<label for>` cho ô chọn file và thanh trượt (test) | Đã kiểm |
| 4.1.2 Tên, vai trò, giá trị | Cây accessibility: mọi nút có tên, nút Cancel, Play, Remove, Dismiss ghi tên bản nhạc, `aria-pressed` ở nút bật, `aria-valuetext` ở thanh trượt | Một phần: chưa xem bằng trình đọc màn hình |
| 4.1.3 Thông báo trạng thái | `#status role="status"` ngoài mọi danh sách; ghi từ handler; rỗng lúc tải trang; nội dung đúng ("Playing...", "Finished...", "... cancelled") đọc từ DOM trong Edge | Một phần: chưa nghe bằng NVDA hoặc Narrator; thông báo trùng hệt lần trước có thể không được đọc lại |

Chưa làm: Lighthouse (F4), trình đọc màn hình (F5), thử bằng tay trong trình duyệt có màn hình, tab ẩn trong trình duyệt thật, Firefox và Safari (cú pháp `content: '...' / ''` có dòng dự phòng), zoom 400%.

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
| 4 | Nút "Animate spectrum" (bấm để tắt, bấm lại để bật) | Cột ngừng chuyển động và canvas được xóa, âm thanh vẫn phát; nút đổi trạng thái `pressed` |
| 5 | Bật "reduce motion" của hệ điều hành rồi tải lại | Hiệu ứng không tự chạy |

NVDA hoặc Narrator: ghi lại **câu được đọc** khi thêm file, khi một bản "ready", khi hủy, khi bắt đầu phát, kể cả khi đọc sai hoặc không đọc.

## 11. Ghi chú nguồn

Đề gốc: slide Homework 2 (xem [Context mục 7](../docs/Context.md) về chỗ khung mã bị thiếu). Chuẩn WCAG: [project-rules mục 8](../docs/project-rules.md). API: MDN cho `AbortController`, `AudioContext.decodeAudioData`, `AnalyserNode.getByteFrequencyData`, `AudioBufferSourceNode`; chưa tra lại bản mới nhất, đối chiếu khi cần giải thích lúc bảo vệ.
