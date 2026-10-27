# Bug report template — `reports/scans/<yyyy-mm-dd>-<feature>/bugs.md`

```markdown
---
feature: <tính năng>
scanned-at: <YYYY-MM-DD HH:mm>
driver: volt-app MCP (cdp-endpoint 9222) | cdp.mjs
env: <ENV>, merchant <id>, app <version nếu đọc được>
scope: <màn/luồng đã quét>
---

# Scan <feature> — <N> bug xác nhận, <M> nghi vấn

## Tóm tắt

| ID              | Mức độ                       | Tiêu đề | Tái hiện | TC             |
| --------------- | ---------------------------- | ------- | -------- | -------------- |
| BUG-<SCREEN>-01 | Critical/Major/Minor/Trivial | ...     | 2/2      | TC-<SCREEN>-NN |

## BUG-<SCREEN>-01 — <tiêu đề>

- **Mức độ:** Major — <lý do: sai tiền / chặn luồng / chỉ hiển thị>
- **Màn / route:** /checkout
- **Tiền điều kiện:** ...
- **Các bước:**
  1. ...
- **Kỳ vọng:** Total $30.25 (27.50 + 10% tax)
- **Thực tế:** Total $30.30
- **Bằng chứng:** `03-total-wrong.png`; console: `TypeError ...`; network: `POST /api/order 500`
- **Nghi gốc rễ:** ...

## Nghi vấn chưa chắc (chưa tái hiện được / cần xác nhận nghiệp vụ)

- ...

## Known / quirk đã biết (không tính là bug mới)

- ...

## Dữ liệu test đã tạo

- Đơn #..., khách QA-SCAN-... (đã xoá / còn lại)
```

Mức độ: **Critical** = sai tiền, mất dữ liệu, crash · **Major** = chặn/sai luồng chính ·
**Minor** = sai phụ, có cách vòng · **Trivial** = chữ, căn lề.
