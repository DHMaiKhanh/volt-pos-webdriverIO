---
name: qc-verify-production
description: Verify production cho Volt POS — nhận link project/milestone Linear (vd Maintenance 2026-Q4-M10-W4) hoặc danh sách VP-xxxx, đọc từng task, lọc task app POS (bỏ task Portal), tự lái app Volt POS production đang cài (code qua CDP 9222) để test, lập bảng test case PASS/FAIL, comment tiếng Việt kèm nhiều ảnh nhiều ngày. PASS → "I have verified that the task passed on production (version X) Thank you @dev  cc @tienpd @loan_dang" + chuyển Verified Production. FAIL → mỗi bug 1 sub task, comment "Please help me fix bug @dev  cc @tienpd @loan_dang" + assign lại dev. Dùng khi user nói "verify production", "verify lại tất cả các task volt pos", "test task trên production xem pass chưa", "chuyển trạng thái verify production", dán link project Linear kèm yêu cầu verify, hoặc "/qc-verify-production" — kể cả khi chỉ có 1 task.
argument-hint: '<URL project Linear | VP-xxxx [VP-yyyy …]> [version prod, vd 1.1.6] [dry-run] [@dev]'
---

# qc-verify-production — verify task Volt POS trên production

Tham số: `$ARGUMENTS` = link project / milestone / view Linear hoặc 1..n mã task, tuỳ chọn version production
user mong đợi, `dry-run` (test + soạn comment ra file, không post), `@dev` (ép dev cho mọi task).
Thiếu phạm vi task → hỏi, không đoán.

Đọc trước: memory `linear-qc-retest-workflow` và `manual-pos-driving` (quirk app đã biết, không báo lại là bug),
mẫu comment ở [references/templates.md](references/templates.md).

## Mặc định

| Mục                 | Giá trị                                                                                               |
| ------------------- | ----------------------------------------------------------------------------------------------------- |
| Môi trường          | App Volt POS **production** đang cài (`%LOCALAPPDATA%\Volt POS\volt-pos.exe`), store đang đăng nhập   |
| Version ghi comment | Version **đọc trong app**, không phải số user gõ (user gõ 1.1.6 mà app 1.1.7 → ghi 1.1.7 và báo lại)  |
| cc                  | `@tienpd @loan_dang`                                                                                  |
| Trạng thái khi PASS | `Verified Production` (team VOLT; QC Completed = mới pass dev)                                        |
| Khi FAIL            | sub task mỗi bug + assign task cha cho dev; không đổi trạng thái task cha nếu user chưa bảo           |
| Ngôn ngữ            | Tiếng Việt cho comment, bảng, sub task, caption ảnh — chỉ câu mở đầu giữ tiếng Anh                    |
| Phạm vi             | Chỉ hành vi trên app POS Windows. Portal / Android / chỉ-backend không có biểu hiện trên POS → bỏ qua |

## 1. Lấy task & lập kế hoạch

1. Linear MCP (ToolSearch `+linear-server`): `list_issues(project=<slug từ URL>, limit 250,
fields [id,title,status,assignee,labels,parentId])` — lấy luôn sub issue. 1 task lẻ → `get_issue`.
2. Với mỗi task cha: `get_issue(fields [description, attachments, relations, stateHistory, releases])`,
   `list_comments`, sub issue (`list_issues parentId=`). Sub issue không verify riêng — gộp thành TC retest
   trong task cha.
3. Phân loại:
   - **Verify**: task đã qua QC dev (`QC Completed`, `Done`) và có hành vi trên POS.
   - **Bỏ qua — Portal**: thay đổi chỉ trên Portal / CMS / web (title `[Portal]`, PR chỉ ở repo portal, mô tả
     là setting Portal). Task POS + Portal → chỉ verify phần POS, case Portal ghi `N/A (Portal)`.
   - **Bỏ qua — Android**: chỉ label Android (máy này là Windows).
   - **Bỏ qua — đã xong**: đã `Verified Production`, `Canceled`, `Duplicate` — trừ khi user nói verify lại cả
     những task đó.
   - **Hỏi**: chưa qua QC dev (`Ready to Review`, `QC Testing`, `In Progress`, `Todo`, `Backlog`) — có thể
     chưa lên production.
4. Xác định dev cho từng task (task của ai tag người đó), theo thứ tự tin cậy:
   1. Lời user (tham số `@dev` hoặc user đã nói trong chat) — luôn thắng.
   2. @mention trong comment QC dev trước đó ("I have verified … passed on dev … Thank you @X",
      "Please help me fix bug @X").
   3. Dev comment "please help me verify" / PR author (GitHub → map sang Linear bằng `list_users`).
   4. Không rõ → `❓`, hỏi user. Assignee hiện tại thường là QC (khanh_do), **không** phải dev.
5. In bảng kế hoạch (templates §1). Chỉ dừng hỏi khi có `❓`, task "Hỏi", hoặc app không phải production;
   còn lại test luôn.

## 2. Chuẩn bị app production

- **Chung CDP 9222 với session khác**: `ListAgents` — nếu có session `e2e-volt-pos-webdriverio-*` đang busy,
  nhắn hỏi trước khi lái app (chúng giật app sang màn khác).
- CDP: `curl -s -m 3 http://127.0.0.1:9222/json/version`. Chưa có → chạy nền
  `APP_PATH="$LOCALAPPDATA\Volt POS\volt-pos.exe" npm run app:launch` (`.env.dev` trỏ build debug cũ).
- Lái app bằng MCP `volt-app` (ToolSearch `+volt-app`), chọn tab chính (không phải `/customer/`).
- **Xác nhận đúng production** trước khi test bất cứ gì:
  - `browser_network_requests`: host phải là `volt-pos.v2.fastboypay.com` / `sys.v2.fastboypay.com`.
    Thấy `dev-fastboypay.com` → đây là build dev: dừng, báo user cài build production.
  - Version: menu ≡ → **Version Update**. Có bản production mới hơn → hỏi user trước khi Update Now.
  - Store: đọc tên / id tiệm trên màn hình (production hay dùng Bee Bee Spa #2949).
- Passcode production: user tự nhập trên máy hoặc đưa trong chat. Không ghi vào file nào được track.
- Không bao giờ `db:reset` / `RESET_DB` — dev và prod dùng chung `%APPDATA%\VoltPOS`, và đây có thể là
  máy của tiệm thật.

## 3. Test từng task

**Nguồn test case** (dùng lại TC ID cũ, không đánh số lại):
`docs/qc/volt-qc/vp-tickets/VP-<id>-*-test-cases.md`, spec `tests/regression/**/vp-<id>-*.spec.ts`
(đọc làm kịch bản), bảng TC trong comment QC dev trước đó. Thêm TC retest cho từng sub bug đã fix.
Task thuộc Version Update (menu ≡ → Version Update, updater) → lấy bảng TC-VU trong skill
`qc-verify-version-update`, feed prod: `https://volt-pos.v2.fastboypay.com/auto_update/check_version_update/<ver>`.

**"Chạy code verify"** = lái app thật bằng code: MCP `volt-app` (`browser_snapshot` / `_click` /
`_evaluate` / `_run_code_unsafe`), đọc dữ liệu bằng GraphQL trong trang
(`window.__TAURI_INTERNALS__.invoke('graphql',{query,variables,operation:null})`). Script lái tay viết ở
`.playwright-mcp/<VP-xxxx>/` để chạy lại các ngày sau.
Không chạy `npm run test:attach` / `test:spec` / `test:dev` vào build production: các lệnh đó đặt
`ENV=dev` nên lớp chặn ghi dữ liệu tưởng là dev → spec sẽ tạo order / charge thẻ thật trên tiệm thật.
`npm run test:prod` (chỉ smoke, read-only) thì được chạy để kiểm tổng quát.

**An toàn dữ liệu production:**

- Order test: số tiền nhỏ, trả Cash / Other. Card thật chỉ khi user nói rõ. Tên khách test `QC Prod <ddMM>`.
- Cancel / xoá mọi order test sau khi kiểm và ghi mã order vào comment ("đã cancel").
- Đổi setting tiệm chỉ khi task cần, chụp giá trị cũ và trả lại ngay sau test.
- Kiosk GoCheckin production: creds `PROD_GCI_*` trong `configs/env/.env.dev` (git-ignored).

**Chấm từng TC:** `PASS` / `FAIL` / `Not Run` (ghi lý do: cần terminal, cần 100 check-in…) / `N/A (Portal)`.

- Nghi FAIL → tái hiện lần 2, đọc giá trị bằng snapshot/evaluate (WebView2 hay render trễ, đừng tin ảnh một mình).
- Trước khi tạo bug: kiểm sub issue cũ của task + memory bug đã biết → bug cũ còn tồn tại thì dẫn link, không
  tạo trùng.
- Production vẫn còn bug cũ → kiểm fix đã có trong bản prod chưa (`releases` của task, ngày merge PR so với
  ngày phát hành bản prod, hỏi dev). Chưa có → ghi "chưa lên production", hỏi user, không tạo sub bug.
- Spec/automation báo sai (false fail) không phải bug app: ghi vào báo cáo, không sửa code spec trong flow này.

## 4. Ảnh minh hoạ "nhiều ngày"

- Ảnh production mới: `.playwright-mcp/<VP-xxxx>/prod-<yyyy-mm-dd>/NN-<mo-ta>.png` (MCP chỉ lưu được trong
  repo; ảnh chụp ngay sau navigate có thể đen → đợi rồi chụp lại). Mỗi TC quan trọng ≥ 1 ảnh, bug có ảnh
  trước/sau.
- Ảnh các ngày trước: thư mục `.playwright-mcp/<VP-xxxx>/` của vòng dev + ảnh trong comment QC cũ
  (`list_comments` → `attachments[].url`, bỏ phần `?signature=…` là dùng lại được, không cần upload lại).
- Upload từng ảnh, **prepare xong PUT ngay** (URL ký sống 60s):
  1. `prepare_file_upload(filename, contentType: "image/png", size: <byte>)`
  2. Ngay lập tức:
     ```
     node .claude/skills/qc-verify-production/scripts/linear-put.mjs <file.png> "<caption>" <<'JSON'
     <dán nguyên JSON kết quả prepare_file_upload>
     JSON
     ```
     Script in ra dòng `![caption](assetUrl)` để dán vào comment.
- Caption tiếng Việt, nhóm theo ngày + môi trường: `**Production 1.1.6 — 03/11/2026**`, `**Dev 1.1.90 — 31/10/2026**`.

## 5. Comment & trạng thái

Theo [references/templates.md](references/templates.md):

- **Không có FAIL** (Not Run có lý do vẫn được): comment PASS (§4) → `save_issue(state: "Verified Production")`.
  Sub bug đã fix retest PASS → cũng `Verified Production` + comment 1 dòng.
- **Có FAIL**: mỗi bug mới 1 sub task (§6) → comment FAIL (§5) dẫn link sub task → `save_issue(assignee: <dev>)`
  cho task cha. Trạng thái task cha giữ nguyên, hỏi user có chuyển Todo không.
- **POS PASS nhưng còn sub bug Portal đang mở**: comment PASS phần POS, giữ trạng thái task cha, assign sub bug
  Portal cho dev (user đã chọn cách này ở VP-4566).
- `@mention` viết `@displayName` (vd `@lam_doan`) — Linear tự thành mention.
- `dry-run`: ghi comment / sub task ra `reports/qc-prod/<yyyy-mm-dd>/VP-xxxx.md`, không post, không đổi trạng thái.

Post xong mỗi task rồi mới sang task tiếp theo, để nếu bị dừng giữa chừng thì task đã xong không phải làm lại.

## 6. Kết thúc

- Kiểm lại đã cancel hết order test (Order History hôm nay, lọc tên `QC Prod`).
- Báo user bằng bảng tổng (templates §7): task · dev · X/Y PASS · trạng thái mới · link comment · sub task;
  kèm task bỏ qua + lý do, case Not Run, câu hỏi còn treo.
- Cập nhật memory: 1 file project cho đợt verify (ngày, version prod, kết quả từng task, dev đúng của từng
  task); quirk app production mới học → `manual-pos-driving`; dev user sửa lại → `linear-qc-retest-workflow`.
