# Exercise 3 — Task Decomposition (bản nháp ghi chú)

> Trạng thái: **mới ghi lại thông tin đề bài**. Chưa chia WBS. Khi bắt đầu làm, chia task theo [project-rules](../docs/project-rules.md): mỗi task một sub-task, có bước verify.
> Kiến thức nền xem [Context](../docs/Context.md).

## 1. Thông tin chung

| Mục | Nội dung |
|---|---|
| Tên bài | Resilient State Machine & Skeleton Loader |
| Hình thức | In-class Sprint 3, 35 phút |
| Mục tiêu | Loại bỏ race condition và trạng thái UI không nhất quán khi tải dữ liệu bất đồng bộ |
| Deliverable | Vòng đời 4 trạng thái bền vững: `IDLE`, `LOADING`, `SUCCESS`, `ERROR` |

## 2. Ràng buộc

1. **Máy trạng thái hữu hạn (FSM):** state của component chỉ được là `'IDLE' | 'LOADING' | 'SUCCESS' | 'ERROR'`.
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

function DataFeed() {
  const [state, setState] = useState<ViewState<Item[]>>({ status: 'IDLE' });

  const loadData = async () => {
    setState({ status: 'LOADING' });
    try {
      const items = await fetchFeed();
      setState({ status: 'SUCCESS', data: items });
    } catch (err) {
      setState({ status: 'ERROR', error: err.message });
    }
  };
  // Render: Skeleton khi LOADING, dữ liệu khi SUCCESS, cảnh báo khi ERROR
}
```

Điểm cần xử lý thêm (slide chưa làm):
- **Race condition:** mẫu chưa chặn. Nếu bấm tải liên tiếp, phản hồi cũ đến muộn có thể ghi đè phản hồi mới. Cần `AbortController` hoặc mã số yêu cầu (request id) để bỏ qua phản hồi lỗi thời.
- Trong TypeScript, `err` trong `catch` có kiểu `unknown`; phải kiểm `err instanceof Error` trước khi đọc `message`.
- Chuyển trạng thái hợp lệ nên được kiểm soát (ví dụ không nhận `SUCCESS` khi đang `IDLE`).
- Retry quay lại `LOADING`, không nhảy thẳng sang `SUCCESS`.

## 4. Điều kiện hoàn thành (checklist nghiệm thu)

- [ ] Kiểu `ViewState` đúng như hợp đồng, không có trạng thái thứ năm
- [ ] `IDLE`: có điểm khởi đầu rõ ràng (nút hoặc tự tải)
- [ ] `LOADING`: hiện skeleton, không hiện dữ liệu cũ lẫn lộn
- [ ] `SUCCESS`: hiện dữ liệu
- [ ] `ERROR`: hiện thông báo dễ hiểu và nút **Retry Connection** hoạt động
- [ ] Bấm tải nhiều lần liên tiếp không tạo race condition (chứng minh bằng test hoặc DevTools Network)
- [ ] 1 commit mốc đúng message
- [ ] Prompt log của bài đã export vào `docs/prompt_logs/`

## 5. Ghi chú WCAG 2.2 AA

- Khi `LOADING`, đặt `aria-busy="true"` trên vùng nội dung và thông báo "Đang tải" qua `role="status"`.
- Khi `ERROR`, dùng `role="alert"` để trình đọc màn hình đọc ngay; nút Retry là `<button>`, dùng được bằng bàn phím, sau khi bấm focus không bị mất.
- Skeleton nhấp nháy: tôn trọng `prefers-reduced-motion` (tắt hoặc giảm hiệu ứng); không nhấp nháy quá 3 lần mỗi giây (2.3.1).
- Màu và độ tương phản của khung xương, thông báo lỗi phải đạt 4.5:1 cho chữ, 3:1 cho thành phần giao diện; lỗi không chỉ dựa vào màu đỏ.
- Skeleton là trang trí thuần túy: ẩn khỏi trình đọc màn hình (`aria-hidden="true"`).

## 6. Câu hỏi còn mở

- `fetchFeed` là API thật hay hàm giả lập (mock có độ trễ, có thể lỗi ngẫu nhiên)? Slide chưa nói.
- Dùng engine từ Exercise 2 hay `useState` của React? Slide dùng cú pháp TypeScript, có thể là bản `.tsx`.
- Cách chứng minh "không race condition" mà thầy chấp nhận là gì?
