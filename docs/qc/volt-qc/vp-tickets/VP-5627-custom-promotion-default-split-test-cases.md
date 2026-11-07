---
title: Discount Setting — tỉ lệ Owner/Staff mặc định cho Custom Promotion — test cases
ticket: VP-5627 — https://linear.app/fastboy/issue/VP-5627/posandportal-discount-setting-them-ti-le-ownerstaff-mac-djinh-cho
sub-issues: —
spec-files: tests/regression/settings/vp-5627-custom-promo-split.spec.ts, tests/web/portal-vp-5627-custom-promo-split.spec.ts
imported-at: 2026-11-06
updated-at: 2026-11-06
---

# Test Cases – [POS&Portal] Discount Setting: thêm tỉ lệ Owner/Staff mặc định cho Custom Promotion

**Ticket:** [VP-5627](https://linear.app/fastboy/issue/VP-5627/posandportal-discount-setting-them-ti-le-ownerstaff-mac-djinh-cho) · project Maintenance 2026-Q4-M11-W1
**Dev:** Ngan Huynh (`ngan_huynh`) · PR FastboyMarketing/volt-pos#3320, fastboy-portal#953, volt-pos-api#1623
**Trạng thái:** QC Completed (06/11/2026). Test tay: Portal 10/10 PASS (05/11), POS 1.1.101 (06/11) và 1.1.107 (06/11) 12/12 PASS.
**Tự động (06/11/2026, dev 1.1.107, attach):** spec POS 12/12 PASS (TC-15 PASS ở lượt chạy lại; TC-18 tự động: spec POS mở thêm Edge Portal qua CDP trong cùng lượt). `.portal-profile` đăng nhập lại 06/11 16:37.

## Hành vi mong đợi (PO chốt 04/11)

1. Thẻ **Discount Setting** (Portal › Store Settings › Payment & transactions, POS › Setting › Charge & Fee) chia 2 phần: **Available promotions** (giữ nguyên) và **Custom promotion** (mới). Dòng phụ: "Split of a promotion discount between the owner and the staff."
2. Custom promotion mặc định **100 / 0** cho mọi tiệm; không chép từ Available. Kiểm tra: mỗi ô 0–100, tổng = 100.
3. Popup **Promo & Rewards › Custom Discount**: ô "Order promotion discount setting" điền sẵn tỉ lệ Custom của tiệm; thu ngân sửa chỉ áp cho order đó. Không mở ô chia thì order lưu tỉ lệ mặc định Custom.
4. Order đã áp / đã complete giữ tỉ lệ của nó khi setting đổi. Available promotion, Reward, Item Discount không đổi cách chia.
5. Đồng bộ 2 chiều Portal ↔ POS, không cần mở lại app. (TC mất mạng — số 19 — đã bỏ theo yêu cầu 06/11, không đánh số lại.)

## Điều kiện chung

- Môi trường DEV, merchant #14 "Volt POS tiem test 14 v1", POS Windows **≥ 1.1.101** (đã test 1.1.107), attach CDP 9222 (`npm run app:launch`).
- Setting gốc tiệm 14: Available 61/39, Custom 100/0. Spec đọc giá trị gốc lúc đầu và trả lại ở cuối.
- Thợ / dịch vụ: `VOLT_TEST_STAFF` (Pamela), `VP5627_SERVICE` (mặc định "Tropical Deluxe" $54), `VP5627_SERVICE_2` (mặc định "Express Pedicure" $30).
- Available promotion / Reward chỉ hiện khi order **có khách**: `VP5627_CUSTOMER` (mặc định "QC Camp Oxcqwp", tìm bằng `VP5627_CUSTOMER_SEARCH` = "QC Camp"), `VP5627_PROMOTION` ("New Client"), `VP5627_REWARD` ("test redeem").
- Passcode staff 8888 cho Setting (POS Settings passcode).
- Dữ liệu đọc qua GraphQL máy: `sysSettingList(where:{key:{like:"%promotion%"}}){key value}`, `orderList(where:{orderCode:{eq}}){merchantPromotionPercent staffPromotionPercent campaignId redeemId orderItemListById{staffPromotionFeeAmount discountType discountRate}}`.

Chú thích trạng thái: ✅ tự động được trên POS Windows · ⚠️ tự động được, có điều kiện · 🧱 chưa tự động được ở đây · 📄 chỉ tài liệu · 🐞 đang FAIL do bug đã log.

## 1. Portal — thẻ Discount setting (web lane)

| TC ID        | Title                                               | Priority | Precondition                            | Test Data                 | Steps                                                                        | Expected Result                                                                                                                      | Status |
| ------------ | --------------------------------------------------- | -------- | --------------------------------------- | ------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| TC-VP5627-01 | Portal: thẻ có dòng phụ mới + 2 phần                | High     | `.portal-profile` đã đăng nhập          | —                         | 1. Portal › Store Settings › Payment & transactions. 2. Xem Discount setting | Dòng phụ "Split of a promotion discount between the owner and the staff."; 2 phần Available / Custom, mỗi phần Owner/Staff share (%) | ⚠️     |
| TC-VP5627-02 | Portal: Custom mặc định 100/0, không chép Available | High     | Tiệm chưa chỉnh Custom; Available 61/39 | —                         | Đọc giá trị Custom                                                           | Custom 100 / 0                                                                                                                       | ⚠️     |
| TC-VP5627-03 | Portal: tổng khác 100 không lưu được                | High     | Như TC-01                               | 60 / 30                   | Nhập 60 / 30 → Save                                                          | Báo "must total 100%", không gửi request lưu                                                                                         | 🧱     |
| TC-VP5627-04 | Portal: ô ngoài 0–100 báo lỗi                       | Medium   | Như TC-01                               | 150, -50                  | Nhập 150 / -50                                                               | "Must be at most 100" / "Must be at least 0", không lưu                                                                              | 🧱     |
| TC-VP5627-05 | Portal: biên 0/100 và số lẻ 33.5/66.5 lưu được      | Medium   | Như TC-01                               | 0/100, 33.5/66.5          | Save → reload                                                                | Reload giữ đúng số                                                                                                                   | 🧱     |
| TC-VP5627-06 | Portal: lưu 60/40 + reload                          | High     | Như TC-01                               | `VP5627_SET_CUSTOM=60/40` | Save → reload                                                                | Toast lưu thành công, reload vẫn 60/40, Available không đổi                                                                          | ⚠️     |
| TC-VP5627-07 | Portal: Discard trả về giá trị đã lưu               | Medium   | Như TC-01                               | Sửa 70/30                 | Discard                                                                      | Về giá trị đã lưu, không gửi request                                                                                                 | 🧱     |

## 2. POS — Setting › Charge & Fee

| TC ID        | Title                                          | Priority | Precondition     | Test Data | Steps                                                      | Expected Result                                                                                                       | Status |
| ------------ | ---------------------------------------------- | -------- | ---------------- | --------- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------ |
| TC-VP5627-08 | POS: Discount Setting có 2 phần + dòng phụ mới | High     | Passcode Setting | —         | 1. ≡ › Setting › Charge & Fee. 2. Xem thẻ Discount Setting | Dòng phụ mới; heading "Available promotions" + "Custom promotion", mỗi phần Owner share / Staff share; số khớp DB máy | ✅     |
| TC-VP5627-09 | POS: tổng khác 100 báo lỗi, Save bị khoá       | High     | Như TC-08        | 60 / 30   | Nhập Custom Owner 60, Staff 30                             | Báo "must total 100%", nút Save của thẻ bị disable; DB không đổi                                                      | ✅     |
| TC-VP5627-10 | POS: lưu Custom 60/40                          | High     | Như TC-08        | 60 / 40   | Nhập 60 / 40 → Save → mở lại trang                         | Trang hiện 60/40; DB `merchant_custom_promotion_discount` = 60; Available không đổi                                   | ✅     |

## 3. POS — Popup Promo & Rewards / order

| TC ID        | Title                                                               | Priority | Precondition                          | Test Data                       | Steps                                                                         | Expected Result                                                                                      | Status |
| ------------ | ------------------------------------------------------------------- | -------- | ------------------------------------- | ------------------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------ |
| TC-VP5627-11 | Popup điền sẵn tỉ lệ Custom (DC-04)                                 | High     | Custom 60/40                          | Order: Pamela + Tropical Deluxe | Promo & Rewards › Custom Discount › mở "Order promotion discount setting"     | Percent for owner 60, Percent for staff 40                                                           | ✅     |
| TC-VP5627-12 | Không mở ô chia → order lưu mặc định Custom (DC-06)                 | Critical | Custom 60/40                          | Custom 10%                      | Nhập 10% (không mở ô chia) → Apply → đọc DB order                             | `merchantPromotionPercent` 60, `staffPromotionPercent` 40; phần thợ = 40% tiền giảm của từng dòng    | ✅     |
| TC-VP5627-13 | Mở lại popup hiện tỉ lệ đã lưu, sửa chỉ đổi order đó (DC-05, DC-07) | Critical | Order TC-12                           | Sửa 70/30                       | Mở lại popup → ô chia = 60/40 → sửa Owner 70 → Apply → đọc DB order + setting | Ô chia trước khi sửa = 60/40; order lưu 70/30, phần thợ 30%; setting tiệm vẫn 60                     | ✅     |
| TC-VP5627-14 | Item Discount không theo Custom (DC-09)                             | High     | Custom 60/40                          | Item Discount 10% trên 1 dòng   | Mở dòng › Apply Discount 10% › Save → đọc DB                                  | Dòng có discountType percentage, rate 10; order không có tỉ lệ chia promotion (null), không phần thợ | ✅     |
| TC-VP5627-15 | Available promotion chia theo Available (DC-08)                     | High     | Order có khách `VP5627_CUSTOMER`      | Promotion `VP5627_PROMOTION`    | Gán khách → Promo & Rewards › chọn promotion → mở ô chia → Apply → đọc DB     | Ô chia đổi thành Available (61/39), order lưu 61/39 (không phải Custom)                              | ⚠️     |
| TC-VP5627-16 | Reward giữ cách chia cũ (DC-09)                                     | High     | Order có khách `VP5627_CUSTOMER`      | Reward `VP5627_REWARD`          | Promo & Rewards › chọn reward → Apply → đọc DB                                | Có `redeemId`; order không lưu tỉ lệ chia (null), không phần thợ — giống order reward trước 04/11    | ⚠️     |
| TC-VP5627-17 | Order đã thanh toán giữ tỉ lệ khi đổi setting (DC-07)               | Critical | Order Custom 60/40 đã thanh toán Cash | Setting đổi 50/50               | Thanh toán Cash → POS đổi Custom 50/50 → đọc lại DB order                     | Order vẫn 60/40, phần thợ không đổi; setting = 50                                                    | ✅     |

## 4. Đồng bộ / dọn dữ liệu

| TC ID        | Title                                | Priority | Precondition                                        | Test Data    | Steps                                                                                                   | Expected Result                                        | Status |
| ------------ | ------------------------------------ | -------- | --------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | ------ |
| TC-VP5627-18 | Đồng bộ 2 chiều Portal ↔ POS (DC-03) | High     | Portal + POS cùng tiệm; `.portal-profile` còn phiên | 70/30, 40/60 | 1. Portal lưu Custom 70/30 → POS DB + Charge & Fee (không mở lại app). 2. POS lưu 40/60 → Portal reload | POS thấy 70/30; Portal thấy 40/60; Available không đổi | ⚠️     |
| TC-VP5627-20 | Dọn dữ liệu: trả setting gốc         | Low      | Sau khi chạy                                        | —            | Trả Custom về giá trị gốc → đọc DB                                                                      | Custom = giá trị gốc (100), Available không đổi        | ✅     |

**Lý do 🧱:**

- TC-03/04/05/07: Portal lane đăng nhập bằng QR (`npm run portal:login`), spec Portal hiện chỉ đọc / lưu / chụp thẻ; các bước validate chưa code. Đã PASS tay 05/11.

**⚠️ điều kiện:** TC-01/02/06 và TC-18 cần `.portal-profile/` còn phiên (`npm run portal:login`, quét QR 1 lần); TC-18 mở Edge riêng trên profile đó qua CDP cổng 9333 (`PORTAL_CDP_PORT`) bằng `src/support/portal/PortalCdp.ts` + `src/pages/web/PortalDiscountSettingCdp.ts` — đóng mọi cửa sổ Edge đang dùng `.portal-profile` trước khi chạy; hết phiên thì TC-18 skip có lý do. TC-02 chỉ chạy khi `VP5627_EXPECT_DEFAULT=1` (tiệm chưa từng chỉnh Custom). TC-15/16 cần khách có promotion / reward (đổi bằng biến `VP5627_*`); không tìm thấy thì spec skip có lý do.

**Kết quả chạy tự động 06/11/2026 (POS 1.1.107):**

| TC                                 | Kết quả                                                 | Ghi chú                                                                                                                                                                                                                                                                                                                                                                           |
| ---------------------------------- | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TC-08 → TC-14, TC-16, TC-17, TC-20 | ✅ PASS (10)                                            | `npm run test:attach -- --spec tests/regression/settings/vp-5627-custom-promo-split.spec.ts`, 2m58s                                                                                                                                                                                                                                                                               |
| TC-15                              | ✅ PASS (lượt 4, 34.9s)                                 | Lượt 1 SKIP: "New Client" chỉ hiện cho khách chưa có lần thanh toán nào, khách Oxcqwp đã thanh toán lúc QC tay → tách biến `VP5627_PROMO_CUSTOMER` (QC Camp Qbvzjg, không thanh toán). Lượt 2–3 FAIL (nút Promo & Rewards không hiện, chưa rõ gốc); lượt 4 PASS: order lưu 61/39.                                                                                                 |
| TC-18                              | ✅ PASS tự động (06/11 16:40 và 16:46, ~50s cùng TC-20) | Spec mở Edge Portal qua CDP: Portal lưu 70/30 → POS nhận 70 (~9s) + Charge & Fee 70/30; POS lưu 40/60 → Portal reload hiện 40/60, Available 61/39. 1 lượt FAIL do spec đọc Portal trước khi thẻ render (đã vá: `PortalDiscountSettingCdp.reload()` chờ giá trị); 1 lượt chết ở root before-all (attach app > 180s, môi trường). Ảnh: `.playwright-mcp/VP-5627/tc18-portal-*.png`. |

## Cách chạy

```bash
npm run app:launch
npm run portal:login   # chỉ khi .portal-profile hết phiên (quét QR), rồi đóng cửa sổ Edge đó
npm run test:attach -- --spec tests/regression/settings/vp-5627-custom-promo-split.spec.ts
npm run portal:vp-5627
```
