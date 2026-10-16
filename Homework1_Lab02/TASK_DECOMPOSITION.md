# Homework 1 — Task Decomposition (bản nháp ghi chú)

> Trạng thái: **mới ghi lại thông tin đề bài**. Chưa chia WBS. Khi bắt đầu làm, chia task theo [project-rules](../docs/project-rules.md).
> Quy tắc WCAG: xem [project-rules, mục 8](../docs/project-rules.md).

## 1. Thông tin chung

| Mục | Nội dung |
|---|---|
| Tên bài | Production Enterprise Data-Grid (WCAG 2.2 AA) |
| Thời hạn | 1 tuần |
| Mục tiêu | Hệ thống component truy cập được ở mức công nghiệp, đạt Lighthouse 100 điểm |
| Thành phần | Data-Grid đầy đủ: sắp xếp (sort), lọc (filter), phân trang (pagination) |

## 2. Yêu cầu

1. **Truy cập được:** tuân thủ WCAG 2.2 mức AA, tương phản tối thiểu 4.5:1, hỗ trợ trình đọc màn hình đầy đủ.
2. **Điều hướng bàn phím:**
   - Phím mũi tên Lên/Xuống/Trái/Phải di chuyển giữa các ô.
   - `Enter` chọn (select), `Space` bật/tắt (toggle).
3. **Lighthouse:** đạt **100/100** cho cả Accessibility và Best Practices (có bằng chứng).
4. **Không div-soup:** dùng `<table>`, `<thead>`, `<tbody>`, `<th scope="col">`, `<button>` gốc.

## 3. Hợp đồng kiểu

```ts
export interface ColumnDef<T> {
  header: string;
  accessorKey: keyof T;
  sortable?: boolean;
}

export interface DataGridProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  onRowSelect?: (item: T) => void;
  ariaLabel: string;
}
// Bất biến: đầy đủ ngữ nghĩa ARIA grid (role="grid", role="row", role="gridcell")
```

## 4. Điểm cần cân nhắc khi thiết kế

- **Bảng gốc và role ARIA:** `<table>` mang role ngầm là `table`. Muốn có điều hướng bằng mũi tên theo mẫu grid thì gắn `role="grid"` lên `<table>`, và các `<tr>`, `<td>` nằm trong grid sẽ hiểu là `row`, `gridcell`. Quy tắc "không dùng role thừa" cần cân với bất biến của đề; ghi lại quyết định cuối cùng và lý do.
- **Điều hướng mũi tên:** dùng "roving tabindex" (một ô duy nhất có `tabindex="0"`, các ô còn lại `-1`) để bàn phím vào và ra bảng chỉ bằng một lần `Tab`.
- **Sắp xếp:** tiêu đề cột sắp xếp được là `<button>` trong `<th>`; trạng thái bằng `aria-sort` (`ascending`, `descending`, `none`), không chỉ mũi tên bằng màu hay biểu tượng.
- **Lọc:** ô lọc có `<label>` hiển thị; kết quả thay đổi thông báo bằng `role="status"` (ví dụ "Hiển thị 12 trên 240 dòng").
- **Phân trang:** đặt trong `<nav aria-label="...">`; trang hiện tại có `aria-current="page"`.
- **Dữ liệu lớn:** nếu chỉ hiển thị một phần dòng thì khai báo `aria-rowcount` và `aria-rowindex` để trình đọc màn hình hiểu tổng số dòng.
- **Vùng bấm** tối thiểu 24×24 CSS px (2.5.8); focus luôn thấy rõ và không bị che (2.4.11).
- Lighthouse chỉ kiểm được một phần tiêu chí tự động. 100 điểm **không** đồng nghĩa với đạt WCAG; vẫn phải kiểm tra tay bằng bàn phím và trình đọc màn hình (ví dụ NVDA).

## 5. Điều kiện hoàn thành (checklist nghiệm thu)

- [ ] Dùng `<table>`, `<thead>`, `<tbody>`, `<th scope="col">`, `<button>` đúng chỗ
- [ ] Mũi tên di chuyển giữa ô; `Enter` chọn; `Space` bật/tắt
- [ ] Sắp xếp, lọc, phân trang hoạt động và có `aria-sort`, `aria-current`, thông báo trạng thái
- [ ] Tương phản đạt 4.5:1 (chữ) và 3:1 (viền, focus)
- [ ] Lighthouse Accessibility = 100 và Best Practices = 100, có ảnh chụp
- [ ] Kiểm tra tay: chỉ dùng bàn phím và ít nhất một trình đọc màn hình
- [ ] Commit atomic, theo Conventional Commits
- [ ] Prompt log đã export vào `docs/prompt_logs/`

## 6. Câu hỏi còn mở

- Dùng engine Mini-React tự viết hay framework thật cho bài này? Đề không nói.
- Dữ liệu mẫu từ đâu (file tĩnh, mock API)? Bao nhiêu dòng?
- Số commit tối thiểu? Đề HW3 yêu cầu ít nhất 8, HW1 chưa nói.
- `AI_FAILURE_AUDIT.md` có cần cho bài này không, hay chỉ HW3?
