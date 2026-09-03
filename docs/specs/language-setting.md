---
title: 'Language Setting'
source: https://linear.app/fastboy/document/language-setting-5f8e21caa7ee
linear_id: 6632232c-75e9-4412-98b9-8e70d095eccc
team: VOLT
updated: 2026-06-22T08:56:18.521Z
---

# Language Setting

> 📌 **Source of truth: Linear** (từ 2026-06-11). PO viết & sửa spec trực tiếp tại đây — bản Google Docs gốc đã freeze, chỉ để tham khảo lịch sử.

**Language Setting for POS**  
**1. Objective**

Cho phép merchant thay đổi ngôn ngữ hiển thị trên ứng dụng POS nhằm cải thiện trải nghiệm sử dụng theo ngôn ngữ địa phương.

---

**2. Scope**

2.1 Supported Languages

- English (default)
- Tiếng Việt
- Không hỗ trợ RTL

---

2.2 Phạm vi áp dụng

- Áp dụng cho **toàn bộ POS app**
- Áp dụng cho **tất cả device thuộc cùng một merchant**

---

2.3 Nội dung được dịch (In scope)

Chỉ bao gồm **static UI text**:

- Button (Pay, Save, Cancel…)
- Label (Customer, Service…)
- Menu / Navigation
- Popup / Modal
- Toast / Snackbar
- Validation message
- Error message
- Empty state
- System message

---

2.4 Không bao gồm (Out of scope)

- Dữ liệu từ database:
  - Service name
  - Category name
  - Item name
  - Gift card
  - Customer / Staff name
- Receipt / Printer
- Report / Export
- Currency format
- Date / Time format
- Number format
- Customer-facing

---

**3. Default Behavior**

- Ngôn ngữ mặc định khi mở app lần đầu: **English**

---

**4. User Flow**

4.1 Vị trí setting

- POS App  
  General Settings > Language Setting

---

4.2 Thay đổi ngôn ngữ

**Step:**

1. User vào Language Setting
2. Chọn ngôn ngữ (English / Tiếng Việt)
3. Nhấn Apply

**Hiển thị confirm:**

Changing language will apply to all POS devices in this merchant.

---

**5. Behavior**

5.1 Apply scope

- Khi thay đổi ngôn ngữ:
  - Áp dụng cho **tất cả devices thuộc merchant**
  - Không chỉ device hiện tại

---

5.2 Sync

- Language được lưu ở **merchant-level setting (backend)**
- Khi thay đổi:
  - Gọi API update setting
  - Các device khác:
    - Sync theo cơ chế hiện tại (polling/websocket)
    - Tự động apply language mới

---

5.3 UI Update

- UI **update ngay lập tức**
- Không cần restart app
- System sẽ **force reload toàn bộ UI tree**

---

5.4 Offline behavior

- Device offline:
  - Không nhận thay đổi ngay
- Khi online lại:
  - Sync setting từ server
  - Tự động apply language mới

---

**6. Permission**

- Việc thay đổi language phụ thuộc vào **permission**
- (TBD: Owner / Admin / Manager)

---

**7. Fallback Strategy**

- Nếu thiếu translation:
  - Fallback về **English**
- Không hiển thị key raw (ví dụ: pos.checkout.pay)

---

8. Technical Notes (for Dev)

8.1 Storage

```
merchant.settings.language = "en" | "vi"
```

---

8.2 Translation source

- Giai đoạn đầu: Dev tự translate
- Có thể cải tiến sau (external translation / CMS)

---

_Source: Google Docs — "Language Setting" tab in [Volt Pos Documents](https://docs.google.com/document/d/1cwBOliobcnSqxDpH0ZcjKXiHxvGAYlrO7wM95jNKTl4/edit)._
