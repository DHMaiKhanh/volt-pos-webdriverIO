---
title: 'Device Management'
source: https://linear.app/fastboy/document/device-management-75de848ac60a
linear_id: 9c98d8a6-9baf-4b3d-9d2c-03751397d5c8
team: VOLT
updated: 2026-06-11T09:59:26.118Z
---

# Device Management

> 📌 **Source of truth: Linear** (từ 2026-06-11). PO viết & sửa spec trực tiếp tại đây — bản Google Docs gốc đã freeze, chỉ để tham khảo lịch sử.

**Device Management**

- Mỗi merchant có một page quản lý device riêng.
- Device chính là **POS**.
- Mỗi POS có thể gắn với nhiều **Terminal/Card Reader** và **Printer**.
- Quản lý POS theo **Device ID**.
- Quản lý Terminal theo **Serial Number**.
- Version cần hiển thị là **App version**.
- Status cập nhật theo chu kỳ khoảng **mỗi giờ**, cơ chế polling/push để BE quyết định.

**Thông tin hiển thị trên POS**

- POS status: Online / Offline.
- Terminal status: Active / Inactive
- Printer status: Ready / Not connected.
- Last connected:
  - **Definition:** Thời điểm gần nhất thiết bị:
- Kết nối thành công với server
- Và chuyển sang trạng thái Online
  - **Trigger update khi:**
- Device login thành công
- Device reconnect sau mất mạng
- App reopen / app active lại
- Heartbeat reconnect thành công
- Last disconnected:
  - **Definition:** Thời điểm gần nhất thiết bị:
- Mất kết nối với server
- Hoặc chuyển sang trạng thái Offline
  - **Trigger update khi:**
- Device logout
- App closed
- Heartbeat timeout
- Internet disconnected
- Token/session invalidated
- Last seen/offline since.
- Uptime trong 7 ngày.
- Last payment nếu có.
- App version.
- Terminal SN đi kèm POS.

**Remote POS**

- Remote action theo từng POS device.
- Remote credential lưu trực tiếp trên từng POS device.
- Chỉ user có permission mới được xem/sử dụng credential và remote.
- Click remote nếu thành công thì vào được ngay.
- Nếu không remote được thì hiển thị lý do cụ thể: POS offline, credential sai, timeout, remote app unavailable, session conflict, v.v.
- Không cần chặn payment/refund/action nhạy cảm vì các action đó đã được bảo vệ bằng passcode riêng.

**Audit log / Device History**

- Cần lưu log tất cả action thực hiện từ page này.
- Ví dụ: Disconnect, Remote View, Remote failed, credential updated.
- History filter theo:
  - Device ID
  - Terminal SN
  - event/action type
  - user thực hiện
  - status/result
  - time range
- Lưu toàn bộ history, chưa cần giới hạn retention.
- Chưa cần export.
- Chưa cần remote session recording.

---

### 1\. Scope tổng thể

- Quản lý **Device theo từng Merchant**.
- Device chính: **POS**.
- Mỗi POS có thể gắn:
  - **Terminal (Card reader)** → quản lý theo SN
  - **Printer**
- Cập nhật trạng thái **~ mỗi giờ** (BE quyết định polling/push).

---

### 2\. Merchant Device Page (List POS)

Hiển thị dạng list POS

Mỗi POS bao gồm:

Thông tin cơ bản

- Device ID
- App version
- POS status: **Online / Offline**
- Last connected
- Last disconnected
- Offline since (last seen)

Connection status

- Terminal:
  - SN
  - Status: Active / Inactive
- Printer:
  - Ready / Not connected
- Last payment (nếu có)

Action

- **Remote View**
- **Disconnect**
- **View Detail**

---

### 3\. POS Device Detail Page

Thông tin POS

- Device ID
- Last connected / disconnected
- Uptime (7 ngày)
- Current status

Connection History (7 ngày)

- Uptime theo ngày
- Status theo ngày (Online / Offline)

Terminal List (thuộc POS)

Hiển thị list Terminal:

- Terminal SN
- Status
- Last connected
- Last disconnected
- (Optional) uptime/history

Không có remote action ở Terminal

### \---

**4. Remote POS**

Nguyên tắc

- Remote theo **từng POS**
- Remote credential:
  - Lưu **trực tiếp trên POS device**
  - Chỉ user có permission mới xem/sử dụng

Hành vi

- Click → remote ngay (không cần nhập lại credential)
- Remote giống như user đang dùng app

Khi fail

Hiển thị rõ lý do:

- POS offline
- Sai credential
- Timeout
- Remote service unavailable
- Session conflict
- ...

UX khi POS offline

- Vẫn cho click Remote
- Sau đó show lỗi tương ứng

---

### 5\. Device History / Audit Log

Scope

Log tất cả action từ page này:

- Remote View
- Remote fail
- Disconnect
- Credential update
- (Các action khác trong tương lai)

Thông tin log

- Device ID
- Terminal SN (nếu liên quan)
- Action type
- User thực hiện
- Result: success / fail
- Timestamp
- Failure reason (nếu có)

Filter

- Device ID
- Terminal SN
- Action type
- User
- Time range

**Retention:** Lưu toàn bộ (không giới hạn)

---

### 6\. Permission

- Remote và xem credential: Phụ thuộc permission user
- Hiện tại: Cho phép tất cả nếu được config

### \---

**7. UI Flow tổng**

1. Merchant vào **Device Page**
2. Xem list POS
3. Click vào POS → Xem detail + terminal list + history
4. Tại list: Có thể remote trực tiếp
5. Mọi action → ghi log

---

_Source: Google Docs — "Device Management" tab in [Volt Pos Documents](https://docs.google.com/document/d/1cwBOliobcnSqxDpH0ZcjKXiHxvGAYlrO7wM95jNKTl4/edit)._
