# Homework 2 — Task Decomposition (bản nháp ghi chú)

> Trạng thái: **mới ghi lại thông tin đề bài**. Chưa chia WBS. Khi bắt đầu làm, chia task theo [project-rules](../docs/project-rules.md).
> Quy tắc WCAG: xem [project-rules, mục 8](../docs/project-rules.md).

## 1. Thông tin chung

| Mục | Nội dung |
|---|---|
| Tên bài | Concurrent FIFO Audio Visualizer Queue Engine |
| Thời hạn | 1 tuần |
| Mục tiêu | Xử lý bất đồng bộ đồng thời, phân tích tần số âm thanh, không rò rỉ bộ nhớ |

## 2. Yêu cầu

1. **Engine:** tích hợp Web Audio API với `AnalyserNode` (FFT 256 hoặc 512 bin).
2. **Bộ điều khiển đồng thời:** hàng đợi FIFO xử lý việc tải nhiều bản nhạc cùng lúc và giải mã `AudioBuffer`.
3. **An toàn bộ nhớ:** dọn dẹp rõ ràng `AudioBufferSourceNode`; hủy tác vụ bằng `AbortController` (cancellation token).
4. **Hiệu năng:** bộ hiển thị Canvas hoặc SVG chạy 60 fps bằng `requestAnimationFrame`, không gây "state thrashing" (không đẩy dữ liệu từng khung hình vào state của framework).

## 3. Khung mã mẫu (slide gốc bị vỡ, mới là phác thảo)

```ts
// audio-queue-controller.ts
export class AudioTaskQueue {
  private queue: AudioTask[] = [];
  private isProcessing = false;
  private activeController: AbortController | null = null;

  async enqueue(trackUrl: string): Promise<AudioBuffer> {
    // Điều khiển đồng thời với hủy bằng AbortSignal
    const controller = new AbortController();
    return new Promise((resolve, reject) => {
      this.queue.push({ trackUrl, controller, resolve, reject });
      this.processNext();
    });
  }
}
```

Chưa có trong khung: `AudioTask`, `processNext`, hàm hủy, dọn dẹp.

## 4. Điểm cần cân nhắc khi thiết kế

- **Hợp đồng kiểu trước:** định nghĩa `AudioTask` và các trạng thái của tác vụ (ví dụ chờ, đang tải, đang giải mã, xong, bị hủy, lỗi) trước khi viết `processNext`.
- **Thứ tự FIFO** và **mức đồng thời** là hai ý khác nhau: FIFO là thứ tự lấy ra; "tải đồng thời" nghĩa là có thể chạy nhiều tác vụ song song. Cần quyết định giới hạn song song (ví dụ 2 hay 3 tác vụ) và ghi lại.
- Mọi `fetch` nhận `signal` của `AbortController`; khi hủy phải dọn hàng đợi và từ chối (reject) Promise bằng lỗi hủy, không nuốt lỗi.
- Gọi `source.stop()` và `source.disconnect()` khi phát xong hoặc bị hủy; không giữ tham chiếu cũ.
- Trình duyệt chặn `AudioContext` tự phát: phải `resume()` sau tương tác của người dùng.
- Vòng lặp vẽ đọc `getByteFrequencyData` vào một `Uint8Array` dùng lại, không cấp phát mới mỗi khung hình. Dừng `requestAnimationFrame` khi không phát hoặc khi trang bị ẩn.
- Tránh `setState` mỗi khung hình; vẽ thẳng lên `<canvas>`.

## 5. Ghi chú WCAG 2.2 AA

- Bộ hiển thị chỉ là trang trí: cung cấp phương án văn bản thay thế (tên bài, trạng thái "đang phát", thời gian) qua vùng `role="status"`.
- Điều khiển phát/tạm dừng/hủy là `<button>` có nhãn, bàn phím dùng được, vùng bấm tối thiểu 24×24 CSS px.
- Âm thanh tự phát hơn 3 giây phải có cách dừng hoặc chỉnh âm lượng riêng (1.4.2); không tự phát khi chưa có tương tác.
- Hiệu ứng chuyển động nhiều: không nhấp nháy quá 3 lần mỗi giây (2.3.1); tôn trọng `prefers-reduced-motion`; cho phép tạm dừng hiệu ứng (2.2.2).
- Màu thanh phổ không là cách duy nhất truyền đạt thông tin; độ tương phản thành phần 3:1.

## 6. Điều kiện hoàn thành (checklist nghiệm thu)

- [ ] `AudioTaskQueue` hoạt động đúng FIFO, có giới hạn song song rõ ràng
- [ ] Hủy tác vụ bằng `AbortController` hoạt động cả khi đang tải và đang giải mã
- [ ] Không rò rỉ: nút nguồn được `stop()`/`disconnect()`; heap snapshot hoặc Performance Monitor cho thấy không tăng bất thường sau nhiều lần phát và hủy
- [ ] `AnalyserNode` dùng FFT 256 hoặc 512 bin
- [ ] Bộ hiển thị chạy mượt (khoảng 60 fps trong Performance panel), không đẩy state mỗi khung hình
- [ ] Kiểm tra WCAG 2.2 AA như mục 5
- [ ] Commit atomic, theo Conventional Commits
- [ ] Prompt log đã export vào `docs/prompt_logs/`

## 7. Câu hỏi còn mở

- Giới hạn số tác vụ chạy song song là bao nhiêu? Đề chỉ nói "simultaneous".
- Nguồn nhạc: file cục bộ, URL công khai, hay tệp do người dùng chọn? Vấn đề CORS.
- Có dùng Mini-React tự viết cho giao diện không, hay JS/TS thuần?
- Số commit tối thiểu và có cần `AI_FAILURE_AUDIT.md` riêng cho bài này không?
