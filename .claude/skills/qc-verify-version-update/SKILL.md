---
name: qc-verify-version-update
description: QC 1 task Linear liên quan đến Version Update của Volt POS (menu ≡ → Version Update, updater, release notes, Update Now/retry, auto update) — đọc task, tự test trên POS dev, liệt kê bảng test case PASS/FAIL, rồi comment kết quả tiếng Việt kèm nhiều ảnh + video (🎬 Video). PASS → comment "I have verified..." + chuyển QC Completed. FAIL → mỗi bug 1 sub task, comment "Please help me fix bug..." + assign mọi bug (sub task + task cha) cho Mai Khanh. Dùng khi user nói "test task VP-xxxx (version update / update POS) xem pass chưa", "verify version update", "/qc-verify-version-update VP-xxxx".
argument-hint: '<VP-xxxx hoặc URL Linear> [version] [@dev]'
---

# qc-verify-version-update — QC task Version Update trên POS dev

Tham số: `$ARGUMENTS` = mã task (VP-xxxx / URL), tuỳ chọn version POS đang test, tuỳ chọn @dev.
Nếu thiếu mã task → hỏi user, KHÔNG đoán task.

## Mặc định (user đã yêu cầu, có thể bị ghi đè bởi tham số)

| Mục                         | Giá trị                                                                                   |
| --------------------------- | ----------------------------------------------------------------------------------------- |
| Dev tag trong comment       | `@ngan_huynh` (Ngan Huynh Thi Thao) — lời user > PR author                                |
| Assignee khi FAIL           | **Mai Khanh** (`khanh_do@fastboy.net` / `me`) — MỌI bug: sub task + task cha (user 06/11) |
| cc                          | `@tienpd @loan_dang`                                                                      |
| Ngôn ngữ comment / sub task | Tiếng Việt (giữ nguyên câu mở đầu tiếng Anh của template)                                 |
| Version ghi trong comment   | Version **thật sự đã test** (đọc trong app), không phải số trong template (vd 1.1.57)     |
| Video                       | 1 video case chính (luồng update) + 1 video cho mỗi bug FAIL — xem mục 4b                 |
| Version test                | Luôn là **bản dev mới nhất trên feed** (mục 2), trừ khi tham số chỉ định version          |

## 1. Đọc task

1. Linear MCP (ToolSearch `+linear-server` hoặc `list_issues`/`get_issue`): `get_issue` (kèm attachments, relations),
   `list_comments`, `extract_images` cho ảnh mô tả/design. Đọc cả sub-issue cũ (`list_issues parentId=`) để retest bug đã fix.
2. Rút ra: hành vi mong đợi, màn hình liên quan, version fix, dev làm (PR / comment dev).
3. Nếu task ghi "production" mà chỉ test được dev → hỏi user trước.

## 2. Chuẩn bị POS — luôn test trên bản dev MỚI NHẤT

User yêu cầu (05/11): mọi lần QC đều phải chạy trên **bản dev mới nhất trên feed**.

1. Bản mới nhất: `curl -s https://volt-pos.v2.dev-fastboypay.com/auto_update/check_version_update/0.0.1` → `version`.
2. Bản đang cài: Windows Uninstall (`Volt POS` → `DisplayVersion`) và trong app `invoke('plugin:app|version')`.
   Bản prod có số kiểu `1.1.6`, khác dòng dev `1.1.9x`.
3. Bản đang cài ≠ bản mới nhất → dừng, báo user (kèm link `binary.exe` của bản mới nhất trên feed) và hỏi trước khi
   tải / cài; KHÔNG test trên bản cũ. Tham số `[version]` chỉ định version khác thì dùng version đó.
4. PR của task phải merge vào `develop` trước thời điểm build bản mới nhất; chưa có → báo user.
5. Đọc lại version ngay trước khi test và trước mỗi lượt chạy spec (dòng "Binary under test" + `plugin:app|version`):
   session Claude khác trên cùng máy có thể cài đè bản cũ hoặc đăng xuất POS (05/11: 1.1.98 bị đè thành 1.1.90).
   Lệch version → dừng và báo user; kết quả chạy trên bản cũ không dùng để kết luận.
6. Cổng CDP: biến môi trường `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9222` làm app WebView2
   khác (vd TeamViewer) có thể giành 9222 → kiểm tra `curl http://127.0.0.1:9222/json/list` có "Volt POS"; nếu không,
   launch và chạy spec với `REMOTE_DEBUG_PORT=9223`.

- Launch build cài đặt (CDP 9222): `APP_PATH="$LOCALAPPDATA\Volt POS\volt-pos.exe" npm run app:launch` (chạy nền).
- Lái app bằng MCP `volt-app` (ToolSearch `+volt-app`), chọn tab chính (không phải `/customer/`).
  Ảnh chỉ lưu được trong repo: `.playwright-mcp/<VP-xxxx>/NN-<mo-ta>.png`. Ảnh chụp ngay sau navigate có thể đen → đợi rồi chụp lại.
- Đọc version hiện tại: menu ≡ → **Version Update** (hoặc About). Feed dev:
  `curl -s https://volt-pos.v2.dev-fastboypay.com/auto_update/check_version_update/<version-hiện-tại>` để biết có bản mới không.

## 3. Test case Version Update (chọn những case liên quan task, thêm case riêng của task)

| TC ID    | Title                                 | Ý chính                                                                              |
| -------- | ------------------------------------- | ------------------------------------------------------------------------------------ |
| TC-VU-01 | Mở trang Version Update               | Menu ≡ → Version Update hiện version hiện tại, không còn popup auto update           |
| TC-VU-02 | Kiểm tra có bản mới                   | Hiện version mới + release notes (đúng nội dung feed)                                |
| TC-VU-03 | Đang là bản mới nhất                  | Hiện "đã là bản mới nhất", nút Update ẩn/disable                                     |
| TC-VU-04 | Update Now → confirm                  | Download + cài, app restart lên version mới                                          |
| TC-VU-05 | Huỷ ở popup confirm                   | Không update, ở lại màn hình                                                         |
| TC-VU-06 | Update lỗi (mất mạng / download fail) | Toast "Update failed" hiển thị gọn, nút Update Now (retry) không bị che              |
| TC-VU-07 | Sau update                            | Version trong app = version mới; dữ liệu order/setting còn nguyên; login/passcode OK |
| TC-VU-08 | UI / đa ngôn ngữ                      | Text đúng EN / Tiếng Việt, không tràn chữ, responsive                                |

Cách test:

- **Update thật**: menu ≡ → Version Update → Update Now → confirm. App restart mất CDP →
  `taskkill //IM volt-pos.exe //F` rồi launch lại với APP_PATH override, đọc lại version.
- **Không có bản mới trên dev** → fake updater: wrap `window.fetch` để trả lời `http://ipc.localhost/plugin:updater|check`
  (`{rid, currentVersion, version, body: JSON.stringify({description}), rawJson:{}}` — `body` phải là JSON) và làm
  `plugin:updater|download` fail cho case lỗi. Reload là mất mock. Click bằng JS/text, không bằng toạ độ.
- Mỗi case chụp ≥1 ảnh (trước / sau). "Nhiều ảnh trong nhiều ngày": nếu task đã test các ngày trước, gom cả ảnh cũ
  (ảnh trong comment trước / thư mục `.playwright-mcp/<VP-xxxx>/`), ghi ngày dưới mỗi ảnh.
- Theo dõi `browser_console_messages` + `browser_network_requests` để bắt lỗi JS / API.

## 4. Upload ảnh

Linear MCP `prepare_file_upload` / `create_attachment_from_upload` (hoặc `prepare_attachment_upload`) → lấy URL,
nhúng vào markdown `![TC-VU-01 - 02/11](url)`.

## 4b. Video (giống dev đính "🎬 Video: …mp4")

Công cụ: `scripts/record.mjs` (ffmpeg có sẵn qua devDependency `ffmpeg-static`).

1. **Bắt đầu**: `npm run rec:start -- --name VP-xxxx-TC-VU-01` ngay trước bước tái hiện, chờ dòng `● REC …` (~1–5s).
   - App có CDP 9222 → quay **màn staff + màn khách cạnh nhau** thẳng từ WebView; cửa sổ khác che lên không bị quay.
     Chỉ cần màn staff (hầu hết case Version Update): `--screens staff`.
2. Làm các bước, dừng 1–2s ở kết quả (dialog Version Update, release notes, số version mới…).
3. **Dừng**: `npm run rec:stop` → in `■ Saved .recordings/<name>-<time>.mp4`. Quá 600s tự dừng (`--max` để đổi).
4. **Riêng luồng Update Now → app tải → tắt → mở lại** (CDP mất khi app restart nên video CDP sẽ đứng hình):
   - Cách A (mặc định): video 1 bằng CDP tới lúc bấm Update Now / tiến trình tải → `rec:stop`; app lên lại và có
     CDP → video 2 quay màn hình version mới (≡ → Version Update). Đính cả 2.
   - Cách B (muốn liền một mạch cả lúc cài): `npm run rec:start -- --name … --source desktop`, đưa cửa sổ POS lên
     trên cùng và không đụng máy tới khi xong — chế độ desktop quay mọi thứ nằm trên cùng màn hình (kể cả Claude).
5. **Kiểm nhanh** 1 khung trước khi up:
   `node -e "require('child_process').spawnSync(require('ffmpeg-static'),['-y','-ss','2','-i','<file.mp4>','-frames:v','1','<scratchpad>/check.jpg'])"` → Read ảnh.
6. **Upload**: `prepare_file_upload(filename: "<name>.mp4", contentType: "video/mp4", size: <stat -c %s>)` → ngay lập tức
   `node .claude/skills/qc-verify-production/scripts/linear-put.mjs <file.mp4> "TC-VU-01 – <mô tả>" <<'JSON' … JSON`
   → in `[🎬 Video: TC-VU-01 – <mô tả>](assetUrl)` để dán vào comment / sub task.
7. Video nằm trong `.recordings/` (git-ignored); xoá sau khi đã post comment.

## 5. Bảng test case (bắt buộc trong mọi comment)

```
| TC ID | Title | Priority | Precondition | Test Data | Steps | Expected Result | Status |
|---|---|---|---|---|---|---|---|
| TC-VU-01 | ... | High | ... | ... | 1. ... 2. ... | ... | ✅ PASS |
```

Dòng tổng: `**Kết quả: X/Y PASS — Z FAIL**`.

## 6a. Tất cả PASS

Comment (save_comment):

```
I have verified that the task passed on dev (version <version-đã-test>) Thank you @ngan_huynh cc @tienpd @loan_dang

**Kết quả: Y/Y PASS**

<bảng TC>

**Hình ảnh minh hoạ**
- Ngày dd/MM: TC-VU-01 – <mô tả tiếng Việt>
  ![](url)
...

[🎬 Video: TC-VU-01 – <luồng update chính>](url)
```

Sau đó đổi trạng thái task → **QC Completed** (`save_issue` state).

## 6b. Có FAIL

1. **Mỗi bug = 1 sub task** (`save_issue`): parentId = task, cùng team/project, label `Bug`, state `Todo`,
   assignee **Mai Khanh** (`khanh_do@fastboy.net`). Title: `[POS][Version Update] <mô tả ngắn>`. Body tiếng Việt:
   `**Mô tả**`, `**Version**`, `**Các bước tái hiện**`, `**Kết quả mong đợi**`, `**Kết quả thực tế**`, ảnh,
   `[🎬 Video: VP-aaaa – tái hiện bug](url)`.
2. Comment vào task:

```
Please help me fix bug @ngan_huynh cc @tienpd @loan_dang

Đã test trên dev (version <version>). **Kết quả: X/Y PASS — Z FAIL**

<bảng TC, case FAIL ghi ❌ FAIL + link sub task>

**Bug:**
- VP-aaaa – <tiêu đề>
...

**Hình ảnh minh hoạ**
...

[🎬 Video: VP-aaaa – <bug tái hiện>](url)
```

3. Assign task cha cho **Mai Khanh** (`khanh_do@fastboy.net`). Không tự đổi trạng thái khác nếu user không bảo (thường user sẽ bảo chuyển Todo).
4. Linear có automation tự đổi assignee khi chuyển trạng thái (06/11: chuyển Todo → tự sang Thien Duy). Sau mỗi lần đổi
   state, đọc lại assignee; lệch → set lại Mai Khanh.

## 7. Báo lại user

Tóm tắt: version đã test (và đó có phải bản mới nhất trên feed lúc test không), X/Y PASS, link comment, sub task đã tạo (link), trạng thái mới.
Cập nhật memory nếu học được điều mới về updater.
