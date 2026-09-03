---
title: 'Main Flow Onboard'
source: https://linear.app/fastboy/document/main-flow-onboard-7df28580516e
linear_id: dd69481a-fac8-43f4-8481-f23912d9cefc
team: VOLT
updated: 2026-06-11T09:59:17.684Z
---

# Main Flow Onboard

> 📌 **Source of truth: Linear** (từ 2026-06-11). PO viết & sửa spec trực tiếp tại đây — bản Google Docs gốc đã freeze, chỉ để tham khảo lịch sử.

1. CRM create order cho tiệm mới và create ticket New Client gồm những thông tin dịch vụ mà khách sử dụng trong order đó (Device, POS Package, …)
2. Dựa trên ticket CRM vừa tạo với khách cho tiệm mới, team Payment US sẽ list những thiết bị cần ship ra cho khách.

- Order device: [https://crm.fastboy.dev/tickets/detail/1180716](https://crm.fastboy.dev/tickets/detail/1180716)

3. Team Merchant dùng thông tin khách, đăng kí application tạo merchant trên Secure Bancard
4. Team AE tạo ticket request tạo account POS và assign cho tech team DTS.

- Create Account: [https://crm.fastboy.dev/tickets/detail/1163773](https://crm.fastboy.dev/tickets/detail/1163773)

5. Sau khi đã nhận được thông tin account từ DTS gửi về và thông tin từ team AE đã làm việc với khách và collect thông tin, tạo ticket gửi team SS để setup thông tin trên POS cho chủ tiệm

- Setup: [https://crm.fastboy.dev/tickets/detail/1178238](https://crm.fastboy.dev/tickets/detail/1178238)

6. Sau khi đã hoàn tất quá trình cbi thiết bị và setup tiệm. Team SS tiến hành setup device tại tiệm và hướng dẫn sử dụng

- Onboard: [https://crm.fastboy.dev/tickets/detail/1194610](https://crm.fastboy.dev/tickets/detail/1194610)

**CRM**  
│  
├─ (1) Create Order cho tiệm mới  
│ - Device  
│ - POS Package  
│ - Service khác (nếu có)  
│  
└─ Create Ticket: "New Client"  
- Bao gồm toàn bộ dịch vụ trong order  
───────────────►

**Payment US**  
│  
├─ (2) Review ticket New Client  
│  
└─ List thiết bị cần ship cho khách  
───────────────►

**Merchant Team**  
│  
├─ (3) Dùng thông tin khách  
│  
└─ Đăng ký Application tạo Merchant trên Secure Bancard  
───────────────►

**AE Team**  
│  
├─ (4) Tạo ticket request tạo POS Account  
│  
└─ Assign ticket cho Tech SS > gửi ticket qua DTS  
───────────────►

**DTS (Tech Team)**  
│  
├─ Tạo POS Account (Admin Insight) dựa trên Package trong ticket  
│  
└─ Gửi lại thông tin account cho AE  
───────────────►

**AE Team**  
│  
├─ Nhận account từ DTS  
├─ Thu thập thêm thông tin từ khách  
│  
└─ (5) Tạo ticket gửi SS để setup POS  
───────────────►

**SS Team**  
│  
├─ Setup thông tin trên POS system  
├─ Chuẩn bị thiết bị  
│  
└─ (6) Setup device tại tiệm & training cho chủ tiệm

**\[Volt POS\] Login flow - Account Test**

1. **Thực hiện tải app POS trong link sau:**  
   [https://drive.google.com/drive/folders/1Q-54F-tZdMyeugyurzDssOtJWZdhuyAh?usp=drive_link](https://drive.google.com/drive/folders/1Q-54F-tZdMyeugyurzDssOtJWZdhuyAh?usp=drive_link)  
   !\[\]\[image25\]
2. **Kết nối máy in và cài đặt driver:**  
   File driver trong link sau: [https://drive.google.com/drive/folders/1Q-54F-tZdMyeugyurzDssOtJWZdhuyAh?usp=drive_link](https://drive.google.com/drive/folders/1Q-54F-tZdMyeugyurzDssOtJWZdhuyAh?usp=drive_link)  
   !\[\]\[image26\]
3. **Mở app và login bằng cách Scan QCcode từ Business App**

- App Business: [https://dev.business.gocheckin.net/](https://dev.business.gocheckin.net/)
- Tiệm: Volt POS 14 - WhmcsID 14
- Owner phone: 205 205 2052 / 123456
- **Lưu ý**: nhớ chọn đúng tiệm 14 rồi sau đó mới thực hiện Scan QR code

4. **Kết nối Bamboo DOT**

- Add Serial Number của terminal trên Fastboy Portal: [https://dev.fastboypay.com/terminals?offset=0&limit=20&sort=created_at.desc](https://dev.fastboypay.com/terminals?offset=0&limit=20&sort=created_at.desc)

!\[\]\[image27\]

5. **Kiểm tra kết nối của tất cả các thiết bị đi kèm**

- Printer / Bamboo DOT: hiển thị Connected (như hình)
- Scanner / Keyboard / Mouse: gắn vào là dùng được
- Cash Drawer đi theo máy in

---

_Source: Google Docs — "Main Flow Onboard" tab in [Volt Pos Documents](https://docs.google.com/document/d/1cwBOliobcnSqxDpH0ZcjKXiHxvGAYlrO7wM95jNKTl4/edit)._
