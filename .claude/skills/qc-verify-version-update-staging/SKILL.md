---
name: qc-verify-version-update-staging
description: QC 1 task Linear liên quan Version Update / auto update của Volt POS trên môi trường STAGING (menu ≡ → Version Update, updater, release notes, Update Now/retry, update lên bản mới rồi verify fix). Tự test trên app staging, lập bảng TC PASS/FAIL, comment tiếng Việt kèm nhiều ảnh. PASS → "I have verified that the task passed on staging (version X)..." + QC Completed. FAIL → mỗi bug 1 sub task, "Please help me fix bug..." + assign lại dev. Dùng khi user nói "test version update trên staging", "update POS staging rồi verify VP-xxxx", "/qc-verify-version-update-staging VP-xxxx".
---

# qc-verify-version-update-staging — Version Update trên POS STAGING

Tham số: `$ARGUMENTS` = mã task (VP-xxxx / URL), tuỳ chọn version mong đợi, tuỳ chọn @dev.
Thiếu mã task → hỏi user (gợi ý các task liên quan update đang mở), không đoán.

Skill này là bản staging của `qc-verify-version-update` (dev). Quy tắc comment / sub task / tag dev / cc /
tiếng Việt / upload ảnh giống hệt skill `qc-verify-pos-task-staging` — đọc mục 4–7 ở đó.

## Thông số staging

| Mục         | Giá trị                                                                                                                 |
| ----------- | ----------------------------------------------------------------------------------------------------------------------- |
| Feed update | `https://sys.stage.volt-pos.fastboy.dev/auto_update/check_version_update/<version-hiện-tại>` (`configs/env/loadEnv.ts`) |
| API         | `https://sys.stage.volt-pos.fastboy.dev`                                                                                |
| Badge app   | STAGE/STAGING — thấy DEV/PROD là sai máy → dừng, báo user                                                               |
| Dev / cc    | Dev làm task (comment dev / PR author; lời user > suy luận) — cc `@tienpd @loan_dang`                                   |
| Phạm vi     | Chỉ app Volt POS; phần Portal (Feature Flags, publish version) không verify                                             |

## 1. Đọc task + chuẩn bị

1. `get_issue`, `list_comments`, sub task cũ, `extract_images`.
2. Version hiện tại: `browser_evaluate` → `window.__TAURI_INTERNALS__.invoke('plugin:app|version')`, và chụp menu ≡ → **Version Update**
   (mở bằng JS click text "Version Update" → URL `?dialog=version-update`).
3. Bản mới nhất trên feed: `curl -s <feed>/<version-hiện-tại>` — rỗng/204 = đã mới nhất.
4. Version có fix (task là bug fix khác): repo `D:\Project\volt-pos\volt-pos`, `git log --grep=VP-xxxx` rồi commit `bump version` kế tiếp.

## 2. Test case Version Update

| TC ID    | Title                   | Ý chính                                                                          |
| -------- | ----------------------- | -------------------------------------------------------------------------------- |
| TC-VU-01 | Mở trang Version Update | Menu ≡ → Version Update hiện Current version, không popup auto update            |
| TC-VU-02 | Có bản mới              | Hiện version mới + release notes đúng feed staging                               |
| TC-VU-03 | Đã mới nhất             | "You're Up to Date", nút Update ẩn/disable                                       |
| TC-VU-04 | Update Now → confirm    | Tải + cài, app restart lên version mới                                           |
| TC-VU-05 | Huỷ ở confirm           | Không update, ở lại màn hình                                                     |
| TC-VU-06 | Update lỗi              | Toast "Update failed" gọn, nút retry không bị che                                |
| TC-VU-07 | Sau update              | Version mới; order/setting còn nguyên; passcode/login OK; fix của task hoạt động |
| TC-VU-08 | UI / ngôn ngữ           | EN/Tiếng Việt đúng, không tràn chữ                                               |

Chọn case liên quan task + thêm case riêng của task (vd chạy lại bước tái hiện bug sau khi update).

### Cách test

- **Update thật**: Version Update → Update Now → confirm. App restart làm mất CDP → `taskkill //IM volt-pos.exe //F`,
  launch lại build staging với CDP 9222, attach lại `volt-app`, đọc lại version, chụp ảnh.
- **Staging không có bản mới** → giả lập updater: wrap `window.fetch` trả về cho `http://ipc.localhost/plugin:updater|check`
  `{rid, currentVersion, version, body: JSON.stringify({description}), rawJson:{}}` (`body` phải là chuỗi JSON);
  làm `plugin:updater|download` reject cho TC-VU-06. Reload là mất mock. Click bằng text/JS.
- Ghi rõ trong comment case nào update thật, case nào giả lập.
- Mỗi case ≥1 ảnh trước/sau; gom ảnh các ngày trước nếu task đã test nhiều lần.

## 3. Kết quả

- PASS hết → comment `I have verified that the task passed on staging (version <version>) Thank you @<dev> cc @tienpd @loan_dang`
  - `**Kết quả: Y/Y PASS — 0 FAIL**` + bảng TC + ảnh theo ngày → `save_issue state="QC Completed"`.
- Có FAIL → mỗi bug 1 sub task `[POS][Staging][Version Update] <mô tả>` (Todo, Bug, assign dev) →
  comment `Please help me fix bug @<dev> cc @tienpd @loan_dang` + bảng TC + danh sách bug + ảnh → assign task cha cho dev.
- Báo user: version trước/sau update, X/Y PASS, link comment, sub task, trạng thái.
