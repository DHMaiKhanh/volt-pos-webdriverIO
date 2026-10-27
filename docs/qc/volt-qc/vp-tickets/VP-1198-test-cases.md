# VP-1198 — POS Portal: Device Management — Test Cases

> Nguồn: tài liệu thật (Device Management spec).
> Phạm vi: quản lý Device theo Merchant — List POS, POS Detail, Remote POS, Disconnect, Audit Log, Permission.
> Loại: Functional / UI / Permission — thực hiện thủ công.
>
> ⚠️ Lưu ý: docs thật **CÓ action** (Remote View, Disconnect, Credential update) — khác với mô tả "read-only" trong phần Acceptance Criteria gốc của ticket. Bộ test này bám theo docs thật.

---

## A. List POS theo Merchant

### TC-01 — List POS hiển thị đúng theo Merchant

**Tiền điều kiện:** User có quyền; merchant có ≥1 POS.
**Bước:** Mở Device Page của một merchant.
**Mong đợi:**

- Chỉ hiển thị POS thuộc đúng merchant đang chọn (không lẫn merchant khác).
- Mỗi POS hiển thị: Device ID, App version, POS status, Last connected, Last disconnected, Offline since (last seen), Last payment (nếu có).
- Hiển thị 3 action: **Remote View**, **Disconnect**, **View Detail**.

### TC-02 — Hiển thị POS status Online / Offline

**Tiền điều kiện:** Có ≥1 POS Online và ≥1 POS Offline.
**Bước:** Quan sát cột POS status.
**Mong đợi:**

- POS đang kết nối → **Online**.
- POS mất kết nối → **Offline**, kèm "Offline since (last seen)".

### TC-03 — Hiển thị Connection status của Terminal & Printer (nhiều thiết bị)

**Tiền điều kiện:** POS gắn nhiều Terminal/Card reader và Printer.
**Bước:** Xem connection status của POS trong list.
**Mong đợi:**

- Terminal: hiển thị **SN** + status **Active / Inactive** cho từng terminal.
- Printer: status **Ready / Not connected**.
- Hỗ trợ POS gắn **nhiều** Terminal và Printer (không chỉ 1).

### TC-04 — Cập nhật trạng thái theo chu kỳ (~mỗi giờ)

**Tiền điều kiện:** Thay đổi trạng thái thật của một POS (online↔offline).
**Bước:** Theo dõi trang sau chu kỳ cập nhật (~1 giờ, polling/push do BE quyết định).
**Mong đợi:**

- Status (POS/Terminal/Printer) cập nhật khớp trạng thái thực sau chu kỳ.
- Không yêu cầu realtime tức thì; chấp nhận độ trễ theo chu kỳ BE định nghĩa.

---

## B. Last connected / Last disconnected (triggers)

### TC-05 — "Last connected" cập nhật đúng các trigger

**Tiền điều kiện:** POS sẵn sàng để thao tác kết nối.
**Bước (mỗi case kiểm tra riêng):**

1. Device login thành công.
2. Device reconnect sau khi mất mạng.
3. App reopen / active trở lại.
4. Heartbeat reconnect thành công.
   **Mong đợi:**

- Mỗi trigger trên đều cập nhật **Last connected** = thời điểm thiết bị kết nối thành công và chuyển **Online**.
- Giá trị đúng timestamp của lần kết nối gần nhất.

### TC-06 — "Last disconnected" cập nhật đúng các trigger

**Tiền điều kiện:** POS đang Online.
**Bước (mỗi case kiểm tra riêng):**

1. Device logout.
2. App closed.
3. Heartbeat timeout.
4. Internet disconnected.
5. Token/session invalidated.
   **Mong đợi:**

- Mỗi trigger đều cập nhật **Last disconnected** = thời điểm mất kết nối / chuyển **Offline**.
- POS chuyển trạng thái Offline tương ứng.

---

## C. POS Detail Page

### TC-07 — Mở Detail Page và hiển thị thông tin POS

**Bước:** Từ list, click **View Detail** (hoặc click vào POS).
**Mong đợi:**

- Điều hướng tới detail của đúng device.
- Hiển thị: Device ID, Last connected/disconnected, **Uptime (7 ngày)**, Current status.

### TC-08 — Connection History 7 ngày

**Tiền điều kiện:** Device có dữ liệu trong 7 ngày gần nhất.
**Bước:** Xem mục Connection History.
**Mong đợi:**

- Hiển thị theo từng ngày: **Uptime % theo ngày** và **Status theo ngày (Online/Offline)**.
- Không hiển thị dữ liệu ngoài khoảng 7 ngày.

### TC-09 — Terminal List trong Detail (không có remote ở Terminal)

**Tiền điều kiện:** POS có ≥1 Terminal.
**Bước:** Xem Terminal List trong detail.
**Mong đợi:**

- Mỗi terminal: SN, Status, Last connected, Last disconnected (optional: uptime/history).
- **Không có action remote** ở cấp Terminal.

---

## D. Remote POS

### TC-10 — Remote View thành công (không cần nhập lại credential)

**Tiền điều kiện:** User có permission remote; POS Online; credential hợp lệ lưu trên device.
**Bước:** Click **Remote View** trên một POS.
**Mong đợi:**

- Vào remote ngay, không yêu cầu nhập credential (dùng credential lưu sẵn trên device).
- Trải nghiệm như đang dùng app trên POS.
- Ghi audit log: action **Remote View**, result **success**.

### TC-11 — Remote khi POS Offline → vẫn click được, hiển thị lý do

**Tiền điều kiện:** POS đang Offline; user có permission.
**Bước:** Click **Remote View**.
**Mong đợi:**

- Nút Remote **vẫn cho click** (không bị disable).
- Sau khi thử → hiển thị lỗi cụ thể: **"POS offline"**.
- Ghi audit log: **Remote fail**, failure reason = POS offline.

### TC-12 — Remote fail với từng lý do cụ thể

**Tiền điều kiện:** Tạo điều kiện cho mỗi loại lỗi.
**Bước (mỗi case riêng):** Click Remote khi:

1. Sai credential.
2. Timeout.
3. Remote service unavailable.
4. Session conflict.
   **Mong đợi:**

- Mỗi trường hợp hiển thị **đúng lý do tương ứng** (credential sai / timeout / remote app unavailable / session conflict).
- Mỗi lần fail đều ghi audit log kèm failure reason chính xác.

### TC-13 — Không chặn action nhạy cảm trong remote

**Tiền điều kiện:** Đang trong phiên remote thành công.
**Bước:** Thực hiện action payment/refund trong app qua remote.
**Mong đợi:**

- Không bị chặn ở tầng remote; các action nhạy cảm vẫn được bảo vệ bằng **passcode riêng** của app.

---

## E. Disconnect

### TC-14 — Disconnect một POS

**Tiền điều kiện:** POS đang Online; user có permission.
**Bước:** Click **Disconnect** trên POS.
**Mong đợi:**

- POS chuyển sang Offline; **Last disconnected** cập nhật.
- Ghi audit log: action **Disconnect**, user thực hiện, result, timestamp.

---

## F. Permission & Credential

### TC-15 — User không có permission không thể xem/dùng credential & remote

**Tiền điều kiện:** User KHÔNG có permission remote/credential.
**Bước:** Vào Device Page, thử xem credential và Remote.
**Mong đợi:**

- Không xem được remote credential.
- Không thực hiện được Remote (bị ẩn/disable/chặn theo config permission).

### TC-16 — User có permission xem/sử dụng credential & remote

**Tiền điều kiện:** User có permission (được config cho phép).
**Bước:** Vào Device Page, dùng Remote.
**Mong đợi:**

- Truy cập được credential và thực hiện Remote bình thường.
- Credential được lấy trực tiếp từ POS device tương ứng.

---

## G. Audit Log / Device History

### TC-17 — Ghi log đầy đủ tất cả action từ page

**Bước:** Lần lượt thực hiện Remote View (success), Remote fail, Disconnect, Credential update.
**Mong đợi:**

- Mỗi action tạo một bản ghi gồm: Device ID, Terminal SN (nếu liên quan), Action type, User thực hiện, **Result success/fail**, Timestamp, **Failure reason** (nếu fail).
- Tất cả action đều được lưu (chưa giới hạn retention).

### TC-18 — Filter Audit Log

**Tiền điều kiện:** Log có nhiều bản ghi đa dạng.
**Bước:** Áp dụng từng filter và kết hợp: Device ID, Terminal SN, Action type, User, **Result/status**, Time range.
**Mong đợi:**

- Mỗi filter (và tổ hợp) trả về đúng các bản ghi khớp điều kiện.
- Filter theo Result lọc đúng success/fail; Time range lọc đúng khoảng thời gian.

---

### Coverage map

| Khu vực docs                                               | Test case                  |
| ---------------------------------------------------------- | -------------------------- |
| List POS + thông tin cơ bản                                | TC-01, TC-02, TC-03        |
| Cập nhật trạng thái ~mỗi giờ                               | TC-04                      |
| Last connected/disconnected triggers                       | TC-05, TC-06               |
| POS Detail + Connection history 7 ngày + Terminal list     | TC-07, TC-08, TC-09        |
| Remote POS (success/offline/fail reasons/sensitive action) | TC-10, TC-11, TC-12, TC-13 |
| Disconnect                                                 | TC-14                      |
| Permission & Credential                                    | TC-15, TC-16               |
| Audit log + filter                                         | TC-17, TC-18               |
