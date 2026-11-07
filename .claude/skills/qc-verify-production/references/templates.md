# Mẫu dùng cho qc-verify-production

Câu mở đầu tiếng Anh giữ **nguyên văn** (team đọc quen); mọi phần còn lại tiếng Việt.
`<dev>` = displayName Linear của dev làm task (vd `lam_doan`, `thienduy_vo`, `nam_pham`), không có dấu cách.
Hai dấu cách trước `cc` là thói quen của team — giữ nguyên.

## 1. Bảng kế hoạch (in cho user trước khi test)

```
| Task | Tiêu đề (rút gọn) | Trạng thái | Dev | Phạm vi | Ghi chú |
|---|---|---|---|---|---|
| VP-4809 | Font size + Print All Staff Income | QC Completed | @ngan_huynh | POS | còn sub bug VP-5610 (Todo) → retest |
| VP-4375 | FIXED promo cap | QC Completed | @thienduy_vo | POS | PR #2937 merge 03/11 — kiểm có trong bản prod chưa |
| VP-5338 | Category palette | QC Completed | ❓ | POS + Portal | chỉ verify phần POS |
| VP-xxxx | ... | Done | @... | ⏭️ Portal | không verify |
| VP-4823 | ... | Verified Production | — | ⏭️ đã verify | bỏ qua |
```

`❓` = chưa chắc dev → hỏi user (gộp mọi ❓ vào 1 câu hỏi).

## 2. Khối môi trường (đầu mọi comment)

```
**Môi trường:** Volt POS Windows **production <version>** (đọc ở menu ≡ → Version Update), store <id> (<tên tiệm>), ngày test dd/MM/yyyy. <Thêm nếu có: GoCheckin kiosk production (gap.gocheckin.net, version x.y.z); máy in; terminal card.>
**Dữ liệu test:** <order/khách đã tạo> — đã cancel/xoá sau khi kiểm.
```

## 3. Bảng test case (bắt buộc)

```
| TC ID | Title | Priority | Precondition | Test Data | Steps | Expected Result | Status |
|---|---|---|---|---|---|---|---|
| TC-VP4823-01 | Nhiều check-in kiosk liên tiếp đều lên Pending Orders | Critical | Kiosk + POS cùng store 2949 | 10 khách `QcKiosk Alpha…Kilo` | 1. Check-in lần lượt trên kiosk 2. POS → Pending Orders | 10/10 card hiện, đúng tên + `***-***-NNNN` | PASS |
| TC-VP4823-05 | Batch 100 check-in | Medium | Batch ≥ 100 | — | — | 0/100 mất | Not Run |
| TC-VP4809-07 | Print nhiều staff khi chưa mở chi tiết | High | ... | ... | ... | Có nút Print | FAIL — VP-5610 |
```

- Status: `PASS` / `FAIL — VP-xxxx` (link sub task) / `Not Run` (lý do ngay dưới bảng) / `N/A (Portal)`.
- Ghi **giá trị thật** quan sát được trong cột Expected/Steps khi có ích (số tiền, mã order, số lượng).
- Dòng tổng ngay trên bảng: `**Kết quả: X/Y PASS, Z FAIL**` (+ `(n case Not Run: <lý do ngắn>)` nếu có).
  Y chỉ đếm case đã chạy; Not Run và N/A không tính vào Y.

## 4. Comment PASS

```
I have verified that the task passed on production (version <version>) Thank you @<dev>  cc @tienpd @loan_dang

<khối môi trường>

**Kết quả: Y/Y PASS, 0 FAIL**

<bảng TC>

**Hình ảnh minh họa:**

**Production <version> — dd/MM/yyyy**
1. TC-VP4823-01 – POS → Pending Orders: đủ 10/10 check-in, badge Checked-in
![4823-prod-01-pending.png](https://uploads.linear.app/...)
2. ...

[🎬 Video: VP-4823-TC01 – <mô tả ngắn case chính>](https://uploads.linear.app/...)

**Dev <version dev> — dd/MM/yyyy** (vòng QC trước)
3. TC-VP4823-02 – ...
![...](https://uploads.linear.app/...)
```

Sau khi post: `save_issue(id, state: "Verified Production")`.

Sub bug của task đã fix và retest PASS trên production → `save_issue(state: "Verified Production")` + comment 1 dòng:

```
I have verified that the task passed on production (version <version>) Thank you @<dev>  cc @tienpd @loan_dang
Đã retest trong <VP-cha> (TC-VPxxxx-NN) — xem comment kết quả ở task cha.
```

## 5. Comment FAIL

```
Please help me fix bug @<dev>  cc @tienpd @loan_dang

<khối môi trường>

**Kết quả: X/Y PASS, Z FAIL**

<bảng TC — case FAIL ghi `FAIL — VP-aaaa`>

**Bug:**
- VP-aaaa – <tiêu đề sub task>
- VP-bbbb – <tiêu đề sub task> (bug cũ, vẫn còn trên production)

**Hình ảnh minh họa:**
<như mẫu PASS, ảnh bug đặt trước>

[🎬 Video: VP-aaaa – <bug tái hiện>](https://uploads.linear.app/...)
```

Sau khi post: `save_issue(id, assignee: <dev>)`. Không đổi trạng thái task cha trừ khi user bảo
(thường user sẽ bảo chuyển **Todo**) — hỏi 1 câu ở phần báo cáo cuối.

## 6. Sub task cho mỗi bug

`save_issue`:

- `team: "VOLT"`, `parentId: <VP-cha>`, `project: <project của task cha>`, `labels: ["Bug"]`,
  `state: "Todo"`, `assignee: <dev>`.
- `title`: `[POS] <mô tả ngắn hành vi sai>` (tiếng Việt, cụ thể: màn hình + hành động + sai gì).

`description`:

```
**Mô tả**
<1–2 câu: sai ở đâu, ảnh hưởng gì>

**Môi trường**
Volt POS Windows production <version>, store <id> (<tên>), ngày dd/MM/yyyy. Tái hiện 2/2 lần.

**Các bước tái hiện**
1. ...
2. ...

**Kết quả mong đợi**
...

**Kết quả thực tế**
... (giá trị thật: số tiền / text / mã order)

**Hình ảnh**
![...](https://uploads.linear.app/...)

[🎬 Video: VP-aaaa – tái hiện bug](https://uploads.linear.app/...)

Task gốc: <VP-cha> (TC-VPxxxx-NN)
```

## 7. Báo cáo cuối cho user (trong chat, tiếng Việt)

```
| Task | Dev | Kết quả | Trạng thái mới | Comment | Sub task |
|---|---|---|---|---|---|
| VP-4823 | @lam_doan | 5/5 PASS | Verified Production | <link> | — |
| VP-4809 | @ngan_huynh | 9/10 PASS, 1 FAIL | (giữ QC Completed, assign @ngan_huynh) | <link> | VP-5610 (cũ) |
```

Kèm: task bỏ qua + lý do, order test đã cancel, case Not Run, câu hỏi còn treo (chuyển Todo?).
