---
title: settings-services — Tài liệu hợp nhất (i18n; feature/testcase bổ sung sau)
screen: settings-services
route: /settings/services
scanned-at: 2026-07-06
source: compare.json + compare.html (TC-i18n-screen-compare, quét sau khi cuộn hết trang)
---

# Dịch vụ & Sản phẩm — Quét Tiếng Việt / UI vỡ / dịch đúng chuẩn

> **Tài liệu hợp nhất (1 file/màn).** Hiện mới có **PHẦN i18n** (quét Tiếng Việt + nghĩa). Đặc tả tính năng & test case sẽ bổ sung vào chính file này khi chạy skill 1/2. Luồng code-gen (nếu có) giữ riêng ở codegen-flow/ + codegen-detail/. Kết quả HTML: reports/settings-services/settings-services.html.

## Tổng quan

> **Chuỗi UI đối chiếu 30** · ❌ chưa dịch **0** · ⚠️ sai chuẩn **0** · 📐 UI vỡ **1** · ✅ thuật ngữ đúng **30** · (data bỏ qua: 2 · tổng pair 37)
> Quét EN↔VI **sau khi cuộn hết trang** (`scrollThroughPage`). 🎉 **Không còn tiếng Anh & không sai chuẩn** trên view mặc định.
> Report trực quan: `reports/settings-services/compare.html`

## 1. ❌ Chưa dịch (còn tiếng Anh)

> Không có.

## 2. ⚠️ Dịch chưa đúng chuẩn

> Không có. 30/30 thuật ngữ khớp glossary (view mặc định).

## 3. 📐 Vỡ giao diện (chỉ báo cáo)

> ⚠️ Có **1** chuỗi bị cắt nhẹ (ellipsis, chỉ báo cáo): `Cập nhật`. `xOverflow = 0px` (không tràn ngang).

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

- HTML: `reports/settings-services/compare.html` · JSON: `reports/settings-services/compare.json`
- Glossary/registry: [src/utils/i18nCompare.ts](../../src/utils/i18nCompare.ts) (`SCREENS['settings-services']`)
