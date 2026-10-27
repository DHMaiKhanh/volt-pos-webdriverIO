# VP-1615 — [POS] Create & Edit Appointment (form + Confirm/Cancel)

Link: https://linear.app/fastboy/issue/VP-1615/pos-create-and-edit-appointment-form-confirmcancel
Parent: VP-1498 (POS Book Appointment from POS)
Status: Ready to Review · PR: FastboyMarketing/volt-pos#1846
Reference doc: [Book Appointment from POS](https://docs.google.com/document/d/1cwBOliobcnSqxDpH0ZcjKXiHxvGAYlrO7wM95jNKTl4/edit?tab=t.s126uwv02ho) — sections C, D.1–D.3

**Scope**: Form tạo lịch hẹn trên POS Calendar + vòng đời Edit / Confirm / Cancel (dùng chung 1 form).
**Out of scope**: Checkout (task riêng).

---

## 1. Mở form Create

| Trigger                         | Behavior                                                                                     |
| ------------------------------- | -------------------------------------------------------------------------------------------- |
| Click "New Appointment"         | Mở form Create                                                                               |
| Click thẳng vào slot (calendar) | Mở form Create, prefill theo slot                                                            |
| Click slot quá khứ              | Không có hiệu ứng gì (no-op)                                                                 |
| Click Block Time                | Popup Information: _"Can not schedule appointment outside your normal business hours!"_ → OK |

**Điểm cần làm rõ / test kỹ:**

- "Slot quá khứ → no effect" — cần xác định ranh giới chính xác giữa quá khứ và hiện tại (ví dụ slot đang diễn ra ngay lúc test có tính là quá khứ không).
- Block Time có thể nằm trong giờ làm việc (business hours) nhưng vẫn bị block riêng — cần phân biệt case này với case ngoài giờ làm việc thực sự, xem message có dùng chung không.

---

## 2. Customer (required)

- Search theo name / phone.
- Kết quả: existing client hiển thị name + phone đã mask, ví dụ `(***) ***-2619`.
- Có action "+ Create new client".

**Điểm cần làm rõ:**

- Format mask áp dụng cho mọi loại số điện thoại (nội địa/quốc tế, độ dài khác nhau) chưa được đặc tả rõ.
- Hành vi khi tạo "new client" ngay trong form: có back về form appointment với client vừa tạo được auto-select không, các field bắt buộc của client mới là gì.
- Trường hợp không tìm thấy kết quả search — có gợi ý "+ Create new client" ngay không.

---

## 3. Date & Appointment line

- Date: default = ngày đang chọn trên calendar; cho phép chọn hiện tại hoặc tương lai.
- **Không** cho tạo trực tiếp ngày quá khứ — **trừ** trường hợp drag-drop (ngoại lệ cần lưu ý khi test).
- Line (≥1 dòng), mỗi line gồm: Start time / Duration / Staff / Service.
  - Start time: nếu mở từ slot → lấy giờ slot; nếu mở từ header (New Appointment) → giờ hiện tại làm tròn lên 15 phút.
  - Duration: default theo service đã chọn, cho phép sửa tay.
  - Staff: chọn cụ thể / "Any Staffs" / "Unassigned" (Unassigned sẽ tự chuyển thành "Any Staffs" khi save). Có filter All / Available / Busy. Chọn staff đang busy → _"This Staff is not available for this time."_
  - Service (optional): chọn theo Category (hiển thị name/duration/price). Nếu service không khả dụng với staff đã chọn → _"Service unavailable for [Staff]"_. Nếu Staff = Any Staffs → hiển thị tất cả service khả dụng.
  - "Add More": thêm line mới có start = end time của line trước; line mới cho phép khác staff/service/duration so với line trước.

**Điểm cần làm rõ / rủi ro cao:**

- "Unassigned → Any Staffs khi save" — cần test rõ: trong lúc đang edit, UI hiển thị "Unassigned" hay đã đổi hiển thị ngay? Giá trị lưu ở DB là gì?
- Ngoại lệ drag-drop cho quá khứ: cần case test riêng (kéo thả từ đâu, tới slot quá khứ, có xác nhận không).
- Không thấy đề cập giới hạn số lượng line tối đa (Add More) — nên hỏi lại business hoặc test biên (add rất nhiều line).
- Chưa rõ hành vi xóa một line đã thêm (Remove line) — cần bổ sung nếu có trong doc gốc.
- "Any Staffs" khi có warning busy cho TẤT CẢ staff — hành vi có khác so với chọn staff cụ thể busy không.

---

## 4. Tags & Note

- Tags: Requested / Highlight / No-show / Repeat.
  - Repeat chỉ hiện khi setting Repeat đang ON ở nơi khác (setting nền) → khi bật cần thêm Repeat Setting (tần suất) + End date.
  - Cancel Repeat sẽ hủy luôn appointment gốc + toàn bộ occurrence lặp lại.
  - Tag Repeat **ẩn** khi đang ở luồng Update (edit) — chỉ xuất hiện lúc Create.
- Note: tối đa 255 ký tự; hiển thị ở appointment detail, card, và khi hover.

**Điểm cần làm rõ:**

- Repeat Setting cụ thể gồm những tuỳ chọn gì (daily/weekly/custom?) — không có trong mô tả, cần xem doc gốc mục C.
- "Cancel Repeat hủy cả gốc + repeat" — nhưng mục 6 lại nói Cancel (Confirmed/Scheduled) chỉ hỏi confirm 1 appointment; cần làm rõ Cancel Repeat là 1 action riêng biệt hay là Cancel áp dụng lên appointment có tag Repeat.
- Note 255 ký tự — cần test biên chính xác 255/256, và test với ký tự đặc biệt/emoji/multi-byte.
- Nhiều tag có thể chọn đồng thời không (multi-select) hay chỉ 1 tag/lần.

---

## 5. Validation & Save (Book)

- Customer bắt buộc.
- Validate: staff availability, Staff/Booking/Business Hours, duration, overlap.
- Nếu có warning (nhưng không chặn cứng) → popup Confirmation _"There are warnings about these appointments, please check again."_ (nút Accept) — **quan trọng: dù nhấn Accept, appointment vẫn KHÔNG được tạo** ("không tạo được").
- Nếu Save thành công: source = POS, status = Confirmed, render lên Calendar, cập nhật "Appointment Today" nếu ngày = hôm nay, recalculate count, toast _"Appointment created successfully"_.

**Điểm cần làm rõ — đây là phần dễ hiểu sai nhất:**

- Câu "Warning booking → popup ... (Confirmation, Accept), không tạo được" nghĩa là bấm Accept cũng KHÔNG lưu, hay Accept để tiếp tục lưu bất chấp warning? Cách viết hiện tại mơ hồ — nên hỏi lại PM/BA hoặc đối chiếu doc gốc mục C trước khi viết test case, vì đây là hành vi khác biệt lớn giữa "warning = block" và "warning = soft-confirm".
- Phân biệt rõ Validation error (chặn cứng, không có nút bypass) vs Warning (có popup Accept) — mỗi loại lỗi (availability/hours/overlap/duration) rơi vào nhóm nào?
- "Recalculate count" — count nào (số lượng appointment trong ngày, badge trên calendar...)?

---

## 6. Edit / Confirm / Cancel

Ma trận theo status:

| Status          | Actions khả dụng                           |
| --------------- | ------------------------------------------ |
| Scheduled       | Update / Confirm / Cancel                  |
| Confirmed       | Update / Cancel                            |
| Canceled / Done | Không có action (Checkout tách task riêng) |

- **Edit** (áp dụng cho Confirmed & Scheduled): sửa được mọi field; khi Save → popup _"Do you want to send a message to [Customer name]…"_ (Don't Send / Send); **status không đổi** sau khi edit.
- **Confirm** (chỉ Scheduled): popup xác nhận _"Are you sure to confirm this appointment?"_ → gửi SMS confirm + notification trên POS.
- **Cancel** (Confirmed & Scheduled): popup xác nhận _"Are you sure to cancel this appointment?"_ → gửi SMS cancel + notification trên POS.
- Áp dụng guard passcode / staff-code (kế thừa từ task nền khác) cho các action trên.

**Điểm cần làm rõ:**

- Trạng thái "Done" không có trong bảng nguồn dữ liệu status thường thấy (Scheduled/Confirmed/Canceled/Done) — cần xác nhận "Done" được set khi nào (sau Checkout ở task khác) và test rằng UI đúng là "no action" ở đây.
- Guard passcode/staff-code: task nền là task nào? Cần liên kết để biết điều kiện bật/tắt guard, ai được bypass (admin?).
- Khi Edit thay đổi Staff/Service dẫn tới overlap/warning mới — có chạy lại validate giống lúc Create không, hay chỉ hỏi gửi SMS?
- Nếu Edit một appointment có tag Repeat: áp dụng cho occurrence này hay toàn bộ chuỗi lặp?

---

## Tổng hợp câu hỏi cần confirm trước khi viết test case đầy đủ

1. Khi có warning booking, bấm "Accept" thì cuối cùng có tạo được appointment hay không? (mục 5)
2. Repeat Setting gồm những option cụ thể nào (tần suất, số lần lặp, end date rule)?
3. Cancel Repeat là action riêng hay là Cancel bình thường áp dụng lên appointment có Repeat?
4. "Unassigned" hiển thị và lưu trữ như thế nào trước/sau khi save?
5. Giới hạn số line tối đa khi Add More, và có action xóa line không?
6. Trạng thái "Done" được set ở đâu (liên hệ task Checkout) để test được ma trận no-action đầy đủ.
7. Guard passcode/staff-code lấy điều kiện từ task nền nào (cần link cụ thể để test).
8. Edit ảnh hưởng đến toàn chuỗi Repeat hay chỉ 1 occurrence.

---

## Đề xuất nhóm test case (để triển khai viết chi tiết sau khi câu hỏi trên được confirm)

1. Mở form Create: từ New Appointment / từ slot / slot quá khứ / Block Time.
2. Customer: search có/không kết quả, mask phone, tạo mới client.
3. Date & Line: default date, giới hạn quá khứ, ngoại lệ drag-drop, start-time theo slot/header, duration default & edit, staff Any/Unassigned/cụ thể + filter + busy warning, service theo category + unavailable message, Add More.
4. Tags & Note: từng tag, Repeat flow đầy đủ (bật/tắt setting, End date, Cancel Repeat), Note giới hạn 255 ký tự.
5. Validation & Save: từng loại lỗi cứng, warning popup + Accept, happy path tạo thành công (toast, calendar render, Appointment Today, count).
6. Edit/Confirm/Cancel theo từng status, popup gửi SMS đúng nội dung, status không đổi sau Edit, guard passcode/staff-code cho từng action.
