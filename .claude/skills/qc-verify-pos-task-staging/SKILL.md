---
name: qc-verify-pos-task-staging
description: QC 1 task Linear (bug/feature) của Volt POS trên môi trường STAGING — đọc task, tự lái app Volt POS (attach CDP 9222) để test, lập bảng test case PASS/FAIL, comment tiếng Việt kèm nhiều ảnh theo ngày. PASS → comment "I have verified that the task passed on staging (version X)..." + chuyển QC Completed. FAIL → mỗi bug 1 sub task, comment "Please help me fix bug..." + assign lại dev làm task. Chỉ verify task POS, bỏ qua task Portal. Dùng khi user nói "test task VP-xxxx trên staging xem pass chưa", "verify staging VP-xxxx", "/qc-verify-pos-task-staging VP-xxxx".
---

# qc-verify-pos-task-staging — QC task Volt POS trên STAGING

Tham số: `$ARGUMENTS` = mã task (VP-xxxx hoặc URL Linear), tuỳ chọn @dev.
Thiếu mã task → tìm task đang "Ready to Review"/"QC" gán cho mình (`list_issues assignee=me`) rồi HỎI user chọn, không đoán.

## Quy tắc chung (user đã chốt)

| Mục                            | Giá trị                                                                                                                                              |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Môi trường                     | **STAGING** (badge app phải là STAGE/STAGING, không phải DEV/PROD). Sai môi trường → dừng, báo user                                                  |
| Phạm vi                        | Chỉ verify trên **app Volt POS**. Task chỉ thuộc Portal (`[Portal]`, label Portal, PR fastboy-portal) → bỏ qua, báo user "task Portal, không verify" |
| Dev được tag / assign khi FAIL | Dev **làm task đó**: người comment "Help me verify"/"I have resolved", hoặc author PR gắn trong task. Lời user > suy luận                            |
| cc                             | `@tienpd @loan_dang`                                                                                                                                 |
| Ngôn ngữ                       | Tiếng Việt (giữ câu mở đầu tiếng Anh của template)                                                                                                   |
| Version                        | Version **thật sự đã test**, đọc trong app (menu ≡ → Version Update, hoặc `invoke('plugin:app\|version')`)                                           |
| Hỏi xác nhận                   | Không hỏi yes/no giữa chừng — tự test tới khi xong rồi comment                                                                                       |

## 1. Đọc task

1. Linear MCP: `get_issue` (includeRelations), `list_comments`, `list_issues parentId=<task>` (retest sub task cũ), `extract_images` ảnh mô tả.
2. Rút ra: các bước tái hiện, kết quả mong đợi, dev làm, PR fix.
3. Xác định version có fix: trong repo app `D:\Project\volt-pos\volt-pos`:
   `git log origin/<nhánh staging> --oneline --grep=VP-xxxx` rồi tìm commit `bump version` đầu tiên sau đó.
   Nếu app staging đang chạy bản thấp hơn → vào Version Update cập nhật (task "liên quan version update").

## 2. Chuẩn bị app

- App đã mở thì attach qua MCP `volt-app` (ToolSearch `+volt-app`); chưa mở thì launch build staging với CDP 9222.
- `browser_tabs list` → chọn tab chính (`/home`), KHÔNG phải `/customer/` (màn khách).
- Ảnh lưu `D:/Project/webdriverIO_volt_pos/.playwright-mcp/<VP-xxxx>/NN-<mo-ta>.png` (đường dẫn tuyệt đối). Ảnh ngay sau navigate có thể đen → đợi 2s chụp lại.

### Mẹo lái app (đã gặp)

- Chọn thợ: `internal:text="<Tên>"s >> nth=0` — tránh trùng tên thợ ở thẻ Pending Order bên trái (mở nhầm order "In use").
- Chọn dịch vụ: `li >> internal:has-text="<Tên dịch vụ>"i >> nth=0`. Nút Pay: `role=button[name="Pay"] >> nth=-1`.
- Passcode thanh toán: tích "Do not require passcode for the next 30 minutes" trước, bấm phím trong dialog bằng JS. Passcode lấy từ `.env.staging` / user, không đoán.
- Tip luôn đẩy sang màn khách (kể cả Other/Cash): chuyển tab `/customer/` → bấm "No Tip" → "Continue" → quay lại tab chính.
- Split: vào thẳng `/order/<id>/split-order`; Other ở split mở dialog có ô "Input payment method name".
- Payment Successful → "No Receipt"; xem chi tiết đơn: `/order-history/<order-uuid>`.
- Đọc text bằng `browser_evaluate` (innerText) để làm bằng chứng, screenshot để minh hoạ.
- Theo dõi `browser_console_messages level=error` để bắt lỗi JS.

## 3. Test case

- Case chính = bước tái hiện trong task (đơn thường + mọi biến thể task nêu: split, gift card, refund…).
- Thêm: 1 case xác nhận version, 1–2 case regression/biên (để trống, ký tự đặc biệt, reload lại trang).
- ID: `TC-<số task>-NN`. Mỗi case ≥1 ảnh.
- "Nhiều ảnh trong nhiều ngày": gom ảnh cũ trong mô tả/comment trước (ghi "Ngày dd/MM (vX — trước fix)") + ảnh hôm nay.

## 4. Upload ảnh

Từng ảnh một: `prepare_file_upload` (size = `stat -c %s`) → PUT ngay trong 60s bằng
`sh .claude/skills/qc-verify-pos-task-staging/up.sh <file> <signed-url>` (curl PUT kèm đủ header: content-type, cache-control,
x-goog-content-length-range `N,N`, Content-Disposition) → dùng `markdown` trả về.

### Video (mặc định cho case chính và mọi bug)

Quay bằng `scripts/record.mjs` (ffmpeg-static đã có trong devDependencies):

1. Ngay trước khi làm các bước tái hiện: `npm run rec:start -- --name VP-xxxx-TC01`.
   App mở CDP 9222 thì nó tự quay **màn staff + màn khách cạnh nhau** qua CDP, cửa sổ khác (Claude, Chrome…) che lên
   cũng không bị quay vào. Chỉ cần 1 màn: `--screens staff`. Không có CDP thì tự quay cả desktop (đóng app riêng tư trước).
2. Làm các bước, dừng 1–2s ở kết quả để video thấy rõ → `npm run rec:stop` → in ra đường dẫn `.recordings/<name>-<time>.mp4`.
   Quá 600s tự dừng (`--max` để đổi).
3. Upload: `prepare_file_upload(contentType: "video/mp4", size)` → ngay lập tức
   `node .claude/skills/qc-verify-production/scripts/linear-put.mjs <file.mp4> "<tên>" <<'JSON' … JSON`
   → script in `[🎬 Video: <tên>](url)`, dán vào comment/sub task dưới ảnh. (`up.sh` cứng `image/png`, đừng dùng cho video.)

Mỗi bug FAIL: 1 video trong sub task + comment. PASS: 1 video cho case chính là đủ.

## 5. Bảng TC (bắt buộc)

```
| TC ID | Title | Priority | Precondition | Test Data | Steps | Expected Result | Status |
|---|---|---|---|---|---|---|---|
```

Dòng tổng: `**Kết quả: X/Y PASS — Z FAIL**`.

## 6a. Tất cả PASS

```
I have verified that the task passed on staging (version <version>) Thank you @<dev> cc @tienpd @loan_dang

<1–2 câu tóm tắt tiếng Việt>

**Kết quả: Y/Y PASS — 0 FAIL**
<bảng TC>
<ghi chú quan sát ngoài phạm vi, nếu có>

**Hình ảnh minh hoạ**
- **Ngày dd/MM – TC-…:** <mô tả>
  ![](url)
```

Rồi `save_issue state="QC Completed"`.

## 6b. Có FAIL

1. Mỗi bug 1 sub task (`save_issue`): parentId = task, team VOLT, cùng project, label `Bug` (+ Windows/Android),
   state `Todo`, assignee = dev. Title `[POS][Staging] <mô tả ngắn>`. Body tiếng Việt:
   **Mô tả**, **Môi trường/Version**, **Các bước tái hiện**, **Kết quả mong đợi**, **Kết quả thực tế**, ảnh.
2. Comment task:

```
Please help me fix bug @<dev> cc @tienpd @loan_dang

Đã test trên staging (version <version>). **Kết quả: X/Y PASS — Z FAIL**
<bảng TC, case FAIL ghi ❌ FAIL + mã sub task>
**Bug:**
- VP-aaaa – <tiêu đề>
**Hình ảnh minh hoạ**
...
```

3. `save_issue assignee=<dev>` cho task cha. Không tự đổi state khác nếu user không bảo.

## 7. Báo lại user (tiếng Việt)

Version đã test, X/Y PASS, link comment, sub task (nếu có), trạng thái mới. Ghi memory nếu học được điều mới.
