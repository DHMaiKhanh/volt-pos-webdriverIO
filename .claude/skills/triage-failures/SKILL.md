---
name: triage-failures
description: Liệt kê TẤT CẢ test case đã từng FAIL (dashboard history + sổ cái bền vững), điều tra và mô tả CHI TIẾT nguyên nhân từng cái, phân loại là LỖI THẬT của app, lỗi CODE TEST, GIAO DIỆN đổi, LOGIC app đổi, MÔI TRƯỜNG, DÂY CHUYỀN hay FLAKY — kèm bằng chứng (ảnh/DOM/log/git). Nhớ kết luận vào sổ cái để lần quét sau chỉ điều tra cái mới/đổi lỗi. Dùng khi user nói "liệt kê test fail", "vì sao fail", "fail do đâu", "lỗi thật hay lỗi code", "triage", "quét lại các TC fail", "/triage-failures".
argument-hint: '[--open] [--spec <đường dẫn con>] [--since YYYY-MM-DD] [--category UI_CHANGE] | "chỉ liệt kê" | "sâu"'
---

# triage-failures — TC fail vì đâu: lỗi thật, lỗi code, UI đổi hay logic đổi

Tham số: `$ARGUMENTS` (truyền thẳng cờ cho script; "chỉ liệt kê" = dừng sau bước 1; "sâu" = điều tra
mọi nhóm, kể cả RECOVERED/FLAKY; mặc định điều tra nhóm OPEN/REGRESSED + verdict cũ đã đổi lỗi).
Luôn trả lời tiếng Việt. Không hỏi xác nhận phạm vi — tự quyết, chạy tới khi xong.

## Nhóm nguyên nhân (định nghĩa + bằng chứng bắt buộc để CHỐT)

| Nhóm           | Nghĩa                                                                                                   | Phải có bằng chứng                                                                                                                |
| -------------- | ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `APP_BUG`      | App làm sai so với yêu cầu/ticket — **lỗi thật**                                                        | Giá trị thực tế sai trên màn hình/server (ảnh, số liệu MCP/API), đối chiếu tài liệu/ticket nói đúng phải là gì; tái hiện tay được |
| `LOGIC_CHANGE` | App đổi hành vi **có chủ đích** (feature mới, đổi rule) → test phải cập nhật kỳ vọng                    | Ticket/release note/commit app, hoặc hành vi mới nhất quán & hợp lý, user/PO xác nhận                                             |
| `UI_CHANGE`    | Giao diện đổi: testid/placeholder/text/vị trí/layout → locator không còn khớp                           | DOM hiện tại (dom.html) có phần tử tương đương nhưng khác selector/text; hoặc layout tràn (scaling 125%)                          |
| `TEST_CODE`    | Lỗi trong code test: locator sai từ đầu, kỳ vọng sai, chờ sai, dọn dẹp thiếu, timeout                   | Chỉ ra dòng code sai (spec/page object/helper) + vì sao sai; app đúng                                                             |
| `ENV`          | Môi trường/dữ liệu/thiết bị: device đăng xuất, passcode/gate, terminal, dữ liệu tiệm, máy sleep, driver | Ảnh/log cho thấy trạng thái môi trường; chạy lại khi env đúng thì PASS                                                            |
| `CASCADE`      | Hệ quả của test/hook trước để lại trạng thái hỏng (dialog mở, đơn nháp, overlay)                        | Chỉ ra TC/hook gây ra (lỗi gốc) — verdict của TC dây chuyền trỏ về TC gốc                                                         |
| `FLAKY`        | Cùng code, cùng build: lúc pass lúc fail (timing, animation, re-render)                                 | Timeline có pass xen fail không kèm thay đổi code/build; chỉ ra điểm race                                                         |

Script phân loại SƠ BỘ (heuristic, nhãn có `?` = chưa chốt). Việc của skill là biến `?` thành verdict có bằng chứng.
**Không bao giờ chốt `APP_BUG` chỉ vì assertion fail** — phải loại trừ TEST_CODE/LOGIC_CHANGE/ENV trước.

## 1. Thu thập (luôn chạy trước)

```
node .claude/skills/triage-failures/scripts/collect-failures.mjs $ARGUMENTS
```

- Đọc `dashboard/public/data/history.json` (50 run gần nhất) + `reports/evidence/*/manifest.json`, gộp theo TC,
  khớp `references/known-patterns.json`, xem git của spec/helper, rồi xuất
  `reports/triage/<timestamp>/failures.md` + `failures.json`, đồng thời CỘNG DỒN lịch sử lỗi vào sổ cái
  `docs/triage/failure-ledger.json` (để TC fail cũ không mất khi history bị cắt 50 run).
- Trạng thái mỗi TC: `OPEN` (lần chạy gần nhất fail) · `REGRESSED` (verdict đã `fixed` nhưng fail lại) ·
  `RECOVERED` (đã pass lại) · `PARKED` (đang `.skip`) · `GONE` (TC/spec đã xoá hoặc đổi tên).
- Nếu chỉ "liệt kê": tóm tắt bảng nhóm + danh sách OPEN/REGRESSED theo spec rồi dừng.

## 2. Gom theo GỐC RỄ, không điều tra từng TC rời

Trong `failures.json`, gom các TC OPEN/REGRESSED (và `verdictStale: true`) theo:

1. cùng `knownPattern` hoặc cùng chữ ký lỗi (`signatures`) + cùng helper (`where.helper`);
2. cùng spec + cùng run mà TC đầu fail khác kiểu, các TC sau fail "không tìm thấy/không click được" → nghi CASCADE,
   điều tra TC ĐẦU TIÊN fail trong chuỗi (thời điểm `lastFail` sớm nhất).
   Bỏ qua TC đã có verdict còn hiệu lực (`categorySource: "ledger"`, không stale) — chỉ nhắc lại trong báo cáo.
   Ưu tiên: REGRESSED → OPEN nhóm lớn → `@critical`/thanh toán → còn lại.

## 3. Điều tra từng gốc rễ (theo thứ tự, dừng khi đủ bằng chứng)

1. **Memory/known-patterns**: đối chiếu MEMORY.md (passcode gate, preset REPLACE, placeholder "Phone, name or email",
   scaling 125%, reopen VP-5290, getText '' quirk, gift card cạn…). Đã biết → ghi verdict luôn, không điều tra lại.
2. **Evidence** của lần fail gần nhất (`row.evidence`):
   - `Read` ảnh `final.png` — màn hình lúc fail: đang ở đâu, có dialog/overlay/passcode/toast lỗi không, số trên màn hình.
   - `Grep` `dom.html` tìm phần tử test mong đợi (text, aria-label, testid, placeholder). Có nhưng khác selector → UI_CHANGE;
     không có vì đang ở màn khác/bị che → CASCADE/ENV; có đúng selector nhưng disabled → xem điều kiện logic.
   - `app.log`: lỗi JS, API 4xx/5xx → nghiêng APP_BUG (hoặc ENV nếu 401/mất mạng).
3. **Code test**: mở `where.spec` (dòng fail) và `where.helper`; đọc kỳ vọng. Kỳ vọng có khớp tài liệu
   `docs/screens/<screen>/*-test-cases.md` / ticket VP không? `git log -p --since=<firstFail-3d> -- <spec> <helper>`
   — code đổi đúng lúc bắt đầu fail → TEST_CODE. TC chưa từng PASS + locator sai → TEST_CODE.
4. **App đổi?** So build: TC từng PASS rồi fail từ một ngày cụ thể, code test không đổi → app đổi.
   Phân biệt: có ticket/release note/hành vi hợp lý → LOGIC_CHANGE; trái yêu cầu/ticket/tính tiền sai → APP_BUG.
   Số liệu server dùng MCP volt-pos (`get_order`, `get_pos_settings`, `get_customer`…, tiệm đúng merchant) để xác minh.
5. **Tái hiện live** (khi 1–4 chưa đủ, chỉ ĐỌC hoặc thao tác an toàn): attach app qua CDP 9222 bằng MCP `volt-app`
   hoặc `node .claude/skills/scan-feature/scripts/cdp.mjs scan|click|shot`; hoặc chạy lại 1 spec:
   `npx cross-env ENV=dev wdio run configs/wdio/wdio.dev.conf.ts --spec <spec> --mochaOpts.grep "<TC-id>"` (xem docs/test-commands.md). Pass khi chạy lẻ mà fail khi chạy chung → CASCADE/FLAKY.
6. **FLAKY**: timeline `PFPF…` — tìm race (đọc trước re-render, animation, toast che) rồi ghi điểm race cụ thể.

Mỗi kết luận phải trả lời đủ: **Fail ở bước nào → thấy gì (thực tế) vs mong đợi gì → vì sao (gốc rễ) → bằng chứng → xử lý**.

## 4. Chốt verdict vào sổ cái (để lần sau khỏi điều tra lại)

```
node .claude/skills/triage-failures/scripts/set-verdict.mjs \
  --match "<chuỗi con của spec hoặc tiêu đề TC>" [--match ...] \
  --category APP_BUG|LOGIC_CHANGE|UI_CHANGE|TEST_CODE|ENV|CASCADE|FLAKY \
  --cause "nguyên nhân chi tiết" --evidence "ảnh/dom/log/so sánh đã xem" \
  [--bug VP-xxxx] [--fix "cách xử lý"] [--status open|fixed|wontfix]
```

- `--dry-run` để xem TC nào khớp trước khi ghi. Verdict lưu chữ ký lỗi hiện tại; lần quét sau nếu TC fail với lỗi KHÁC,
  script báo "⚠️ verdict cũ, lỗi đã đổi" → điều tra lại. Verdict `fixed` mà fail lại → `REGRESSED`.
- Gốc rễ mang tính chung (sẽ còn lặp) → thêm 1 mục vào `references/known-patterns.json` (regex `match`, `category`,
  `cause`, `fix`) để script tự nhận ra lần sau. Gốc rễ là quirk quan trọng → cập nhật memory.
- Sau khi chốt, chạy lại bước 1 để báo cáo phản ánh verdict.

## 5. Báo cáo

Ghi `docs/triage/failing-root-causes-<YYYY-MM-DD>.md` (tiếng Việt):

- Tổng quan: số run, khoảng ngày, số TC theo trạng thái và theo nhóm (bảng).
- **Lỗi thật của app (APP_BUG)** đặt lên đầu: mỗi lỗi — TC liên quan, bước tái hiện, thực tế vs mong đợi, ảnh, ticket (nếu có).
- Mỗi nhóm còn lại: bảng `TC | spec:dòng | trạng thái | nguyên nhân chi tiết | bằng chứng | xử lý`.
- Mục "Cần làm": sửa test (TEST_CODE/UI_CHANGE/LOGIC_CHANGE — chỉ ra file:dòng), sửa môi trường (ENV), bug cần log.
- TC `PARKED`/`GONE` chỉ liệt kê gọn ở cuối.

Trả lời user: bảng tóm tắt theo nhóm + danh sách lỗi thật + top việc cần làm + link file báo cáo.
**Không** tự log bug Linear hay sửa code test trong skill này — đề xuất (skill create-bug / sửa spec) và để user quyết,
trừ khi user đã yêu cầu trong lời gọi.
