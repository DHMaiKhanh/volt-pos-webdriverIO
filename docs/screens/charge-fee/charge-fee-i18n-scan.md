---
title: charge-fee — Tài liệu hợp nhất (i18n; feature/testcase bổ sung sau)
screen: charge-fee
route: /settings/charge-fee
scanned-at: 2026-07-06
source: compare.json + compare.html (TC-i18n-screen-compare, quét sau khi cuộn hết trang)
---

# Phí & Phụ thu — Quét Tiếng Việt / UI vỡ / dịch đúng chuẩn

> **Tài liệu hợp nhất (1 file/màn).** Hiện mới có **PHẦN i18n** (quét Tiếng Việt + nghĩa). Đặc tả tính năng & test case sẽ bổ sung vào chính file này khi chạy skill 1/2. Luồng code-gen (nếu có) giữ riêng ở codegen-flow/ + codegen-detail/. Kết quả HTML: reports/charge-fee/charge-fee.html.

## Tổng quan

> **Chuỗi UI đối chiếu 70** · ❌ chưa dịch **0** · ⚠️ sai chuẩn **0** · 📐 UI vỡ **2** · ✅ thuật ngữ đúng **70** · (data bỏ qua: 7 · tổng pair 83)
> Quét EN↔VI **sau khi cuộn hết trang** (`scrollThroughPage`). 🎉 **Không còn tiếng Anh & không sai chuẩn** trên view mặc định.
> Report trực quan: `reports/charge-fee/compare.html`

## 1. ❌ Chưa dịch (còn tiếng Anh)

> Không có.

## 2. ⚠️ Dịch chưa đúng chuẩn

> Không có. 70/70 thuật ngữ khớp glossary (view mặc định).

## 3. 📐 Vỡ giao diện (chỉ báo cáo)

> ⚠️ Có **2** chuỗi bị cắt nhẹ (ellipsis, chỉ báo cáo): `Sửa tuỳ chọn tip`, `Xoá tuỳ chọn tip`. `xOverflow = 0px` (không tràn ngang).

## 4. ✅ Đã dịch đúng (mẫu)

| EN                            | VI                           |
| ----------------------------- | ---------------------------- |
| Pending Orders                | Đơn đang chờ                 |
| Order History                 | Lịch sử đơn hàng             |
| Appointment                   | Lịch hẹn                     |
| Scanner                       | Quét mã                      |
| Internet connection restored. | Đã kết nối internet trở lại. |
| Setting                       | Cài đặt                      |
| Store & Account               | Cửa hàng & Tài khoản         |
| Business Info                 | Thông tin doanh nghiệp       |

## 5. Ghi chú / đề xuất bổ sung glossary

- View mặc định sạch. Nếu màn có **popup / dialog / form con** (thêm/sửa) → cần deep-scan bổ sung (mở dialog rồi quét) để phủ 100%.
- Chưa có sub-task Linear nào (VP-2252) chỉ đích danh màn này.

## 6. Nguồn tham chiếu

- HTML: `reports/charge-fee/compare.html` · JSON: `reports/charge-fee/compare.json`
- Glossary/registry: [src/utils/i18nCompare.ts](../../src/utils/i18nCompare.ts) (`SCREENS['charge-fee']`)
