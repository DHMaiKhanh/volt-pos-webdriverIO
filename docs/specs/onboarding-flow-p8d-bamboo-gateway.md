---
title: 'Onboarding Flow - Support for P8D (Bamboo Gateway)'
source: https://linear.app/fastboy/document/onboarding-flow-support-for-p8d-bamboo-gateway-d454fb25064f
linear_id: ddd7c573-e51e-4501-adc0-1694aa3206df
team: VOLT
updated: 2026-08-06T03:48:09.159Z
---

# Onboarding Flow - Support for P8D (Bamboo Gateway)

## 1. Mục tiêu

Cập nhật luồng onboarding và quản lý merchant để hỗ trợ đồng thời hai payment gateway:

- **Magensa** cho Windows POS/P24
- **Bamboo** cho Android POS/P8D

Hệ thống cần hỗ trợ cả merchant onboarding mới và merchant đã onboard nhưng được tích hợp thêm gateway sau đó.

---

## 2. Onboarding Merchant mới

Tại bước **Verify FastboyPay**, Portal hiển thị trạng thái của:

- Magensa Integration
- Bamboo Integration

Merchant được phép tiếp tục onboarding khi có ít nhất một gateway ở trạng thái **Integrated**.

Nếu cả hai gateway đều **Not Integrated**, hệ thống không cho phép tiếp tục.

Bước này chỉ dùng để kiểm tra trạng thái từ FastboyPay. User không được chọn hoặc thay đổi gateway.

### Mapping thiết bị

- Magensa → Windows POS/P24
- Bamboo → Android POS/P8D

---

## 3. Verify Gateway sau Onboarding

Trường hợp merchant đã onboard với một gateway và được tích hợp thêm gateway khác sau đó, hệ thống **không tự động kích hoạt gateway mới**.

Tại:

**Admin Menu → Merchant**

bổ sung action: **Verify Gateway**

Action này chỉ dành cho Admin/Internal User.

### Flow xử lý

1. Hệ thống phát hiện merchant có gateway mới trên FastboyPay.
2. Admin chọn **Verify Gateway**.
3. Portal lấy thông tin gateway mới để Admin kiểm tra.
4. Admin xác nhận thông tin Batch Time/Capture Time.
5. Portal gửi thông tin đã xác nhận lên BE.
6. Sau khi Verify thành công, hệ thống cập nhật khả năng sử dụng thiết bị tương ứng.

Gateway đang hoạt động trước đó không bị ảnh hưởng.

Nếu Verify thất bại, gateway mới chưa được kích hoạt và trạng thái hiện tại của merchant được giữ nguyên.

---

## 4. Merchant Overview

Merchant Overview hiển thị khả năng sử dụng POS dựa trên các gateway đã được Verify thành công.

### POS Availability

- **Windows POS:** Available / Not Available
- **Android POS:** Available / Not Available

Đối với merchant login, không hiển thị tên kỹ thuật Bamboo hoặc Magensa.

Gateway mới chỉ được tích hợp trên FastboyPay nhưng chưa Verify trên Portal Admin sẽ chưa làm thay đổi POS Availability.

Sau khi Admin Verify thành công:

- Magensa → Windows POS chuyển thành Available
- Bamboo → Android POS/P8D chuyển thành Available

Merchant không cần thực hiện thao tác Verify. Trạng thái mới được hiển thị sau khi reload hoặc đồng bộ dữ liệu.

---

## 5. Business Rules

- Chỉ cần một gateway Integrated để hoàn tất onboarding ban đầu.
- Gateway được tích hợp thêm sau onboarding phải được Admin Verify.
- Không tự động kích hoạt gateway mới từ FastboyPay.
- Batch Time/Capture Time phải được xác nhận trước khi gửi lên BE.
- Không tạo duplicate gateway record.
- Không ảnh hưởng gateway hoặc payment flow đang hoạt động.
- Merchant login chỉ xem POS Availability, không xem tên gateway.

---

## 6. Acceptance Criteria

### Onboarding

- Hiển thị trạng thái Magensa và Bamboo.
- Có ít nhất một gateway Integrated thì được tiếp tục.
- Cả hai Not Integrated thì block onboarding.
- Không cho user chỉnh sửa gateway tại bước Verify.

### Recheck Gateway

- Admin Menu > Merchant có action **Verify Gateway**.
- Gateway mới không tự động kích hoạt.
- Admin kiểm tra được gateway và Batch/Capture Time.
- Verify thành công thì cập nhật dữ liệu lên BE.
- Verify thất bại thì giữ nguyên trạng thái hiện tại.
- Không ảnh hưởng gateway đã hoạt động.

### Merchant Overview

- Hiển thị Windows POS và Android POS theo trạng thái Available/Not Available.
- Merchant login không thấy tên Bamboo/Magensa.
- Chỉ cập nhật Availability sau khi Verify thành công.
- Gateway chưa Verify vẫn hiển thị Not Available.

---

**Vấn đề gặp phải: **
Để onboarding một 1 merchant thành công, phải setting **Capture Time** cho merchant trong hệ thống POS. Lúc này, buộc phải lựa chọn (capture_time của Magensa)/(batch_close_time của Bamboo) để setting _**Capture Time**_ cho merchant trong POS

**Hướng giải quyết**:
_Trường hợp chưa có gateway nào integrate_ => Sẽ không thể onboard (CLEAR)
_Chỉ có 1 gateway được integrate_ => Lấy thời gian và timezone của gateway để setting **Capture Time** cho merchant onboard.
_Trường hợp có cả 2 gateway đã integrate_ => Quy đổi capture_time/batch_close_time về cùng timezone, sau đó lấy field có giá trị sớm nhất (Ví dụ: 07:00 PM/ 08:00 PM => Chọn 07:00 PM).

_Đối với các merchant đã onboard trước đó với magensa, sau đó integrate Bamboo Pay:_
**Thống nhất:** vào Merchant, buộc phải confirm để hoàn thành quá trình integrate với Bamboo Pay, *trường hợp không thực hiện confirm, mọi sai sót về thời gian settle đối với các Order thanh toán bằng Bamboo Pay sẽ phải chịu trách nhiệm. *
=> Mục đích để kiểm tra và cập nhật lại thời gian **Capture Time** của merchant trong POS khi có cả 2 gateway được integrate vào hệ thống.
