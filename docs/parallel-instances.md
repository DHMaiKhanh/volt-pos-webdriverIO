# Chạy song song nhiều app (parallel instances)

GUI ⚡ chạy được **2 app Volt POS cùng lúc trên 1 máy**: app đã cài, cộng với một bản sao
có identifier riêng. Hai app chia nhau các spec. Bản sao chạy **ngầm**: cửa sổ của nó bị dời ra ngoài
màn hình, không che việc của người dùng.

## Vì sao 2 app không đụng nhau

Mọi thứ khiến app thứ hai đụng app thứ nhất đều đi theo **Tauri identifier**:

- khoá single-instance (`<id>-sim`): không đổi identifier thì lần bật thứ hai chỉ focus cửa sổ cũ rồi thoát;
- thư mục data `%APPDATA%\<id>`: đăng nhập thiết bị, database local;
- profile WebView2 `%LOCALAPPDATA%\<id>\EBWebView`.

`scripts/make-instance.mjs` copy **đúng bản đã cài** (không build lại). Nó sửa 2 byte của chuỗi
`VoltPOS` trong exe (compiler ghép chuỗi này bằng 2 lệnh `mov` chồng nhau) thành `VoltP01`, `VoltP02`…
Byte được tìm theo pattern chứ không theo offset, nên cài bản mới thì chỉ cần chạy lại script.

| Instance | Exe                                    | Identifier | CDP      | Driver   | tauri native |
| -------- | -------------------------------------- | ---------- | -------- | -------- | ------------ |
| 0        | `%LOCALAPPDATA%\Volt POS\volt-pos.exe` | VoltPOS    | 9222     | 4444     | 4445         |
| N ≥ 1    | `D:\VoltE2E\iN\volt-pos-iN.exe`        | VoltP0N    | 9222+10N | 4444+10N | 4445+10N     |

Driver của instance N cũng được đổi tên: `msedgedriver-iN.exe`, `tauri-driver-iN.exe`. Nhờ vậy mọi
lệnh kill / "đang chạy không" trong `src/support/process.ts` (qua env `APP_IMAGES`, `DRIVER_IMAGES`)
chỉ đụng vào instance của chính nó.

## Tạo và đăng nhập bản sao (1 lần)

```bash
node scripts/make-instance.mjs 1
```

Bản sao mới tạo **chưa đăng nhập**. Mở nó với cửa sổ hiện ra giữa màn hình, rồi quét QR bằng app
**GCI Business** (tài khoản tiệm 14):

```bash
cmd /c D:\VoltE2E\i1\launch.cmd visible
```

Đăng nhập xong thì đóng app đi. Từ lần chạy sau, GUI tự thấy bản sao (có file `credentials` trong
`%APPDATA%\VoltP01`) và chạy 2 làn. Cách dễ nhất là bấm chip **Mở QR** trên GUI.

Bản sao **không** phải là một thiết bị riêng trên server: Device ID gắn theo máy, nên app gốc và bản
sao dùng chung một bản ghi thiết bị (cùng terminal thẻ). Vì vậy mọi test thẻ đều chạy trên app gốc.

**Đăng nhập dùng được nhiều ngày.** Bản sao giữ đăng nhập qua các lần tắt/bật và các lần chạy.
Ngoại lệ đã gặp: **cài bản app mới** (1.1.85 → 1.1.86). Sau lần cài đó, bản sao không đọc lại được
đăng nhập cũ và tự đăng xuất. Mỗi lần chạy, GUI so bản sao với app đã cài (`source.json`) và **tự làm
lại bản sao** khi app đổi bản. Nếu bản sao bị đăng xuất, chip trên GUI chuyển sang _Bản sao chưa đăng
nhập_: bấm **Mở QR**, quét một lần là xong. Trong lúc đó run vẫn chạy bằng 1 app, không hỏng.

**Bấm Run là tự chạy 2 app.** Chọn từ 20 file trở lên thì GUI luôn chạy ⚡, kể cả khi chưa tích
⚡, và chia cho 2 app nếu bản sao đã đăng nhập. Dòng đầu log ghi rõ _2 app song song_, hoặc lý do
chỉ chạy 1 app.

> Bật bản sao từ một process **ngoài** app Claude (GUI runner, hoặc `cmd`/Explorer). App Claude là gói
> MSIX: process con của nó bị ảo hoá AppData, nên đăng nhập sẽ rơi vào thư mục riêng của gói.

## GUI chia việc thế nào (`dashboard/server/fast-plan.mjs` → `laneClass`)

| Lớp       | File nào                                                                                                                                                                               | Chạy ở đâu                                 |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| `alone`   | có test `@exclusive` (đổi cài đặt chung của tiệm); test đọc báo cáo (`incomes/`, `reports-time/`, spec `vp-tickets` về daily sale / income summary / payroll / wage); chấm công / turn | **cuối cùng**, chỉ app gốc, bản sao đã tắt |
| `primary` | dùng terminal / gift card (`CARD_SETTLE`, `payWithCard`, `GiftCard`…), lịch hẹn, `tests/web`, `checkout-type`, `volt-qc/pay`, `card-terminal`                                          | app gốc, song song với bản sao             |
| `any`     | còn lại                                                                                                                                                                                | làn nào rảnh thì lấy                       |

`@exclusive` gắn trên từng test, nhưng **cả file** vẫn chạy riêng. Các test cạnh test có tag thường đọc
lại trạng thái nó vừa lưu, mà bản thân chúng không gắn tag. Ví dụ settings-tipping: TC-TIP-11/12 kiểm
tra cách chia tip mà TC-TIP-10 vừa lưu. Smoke 01/11 thử tách theo test thì 2 test này fail. Lợi ích mô
phỏng chỉ ~7 phút, nên đã bỏ.

`fast-run.mjs` cho mỗi làn kéo từng nhóm 10 file khỏi hàng đợi. App gốc làm hết `primary` (attach rồi
launch) trước khi nhận việc chung, vì chỉ nó làm được `primary`. Ở run 5, app gốc lấy trước 2 nhóm
chung (26 phút), nên bản sao ngồi không 70 phút cuối pha song song. Mỗi làn chạy attach trước, launch
sau. Kết quả của mọi làn gộp thành **một** mục lịch sử (`scripts/finalize-dashboard.ts`). Trước mỗi lần
chạy, file live của lần trước (timeline, log, plan) được lưu vào `reports/.gui-runs/<run id>/`.

Bản sao chưa đăng nhập, hoặc làn của nó lỗi khi khởi động, thì làn đó bỏ qua và app gốc làm hết. Kết
quả vẫn đủ, chỉ chậm như chạy 1 app.

### Cửa sổ của bản sao phải giống hệt app gốc

App gốc chạy fullscreen, viewport 1920×1080 (1536×864 CSS ở scale 125%). Nếu bản sao chạy với cửa sổ
nhỏ hơn, giao diện co lại, test bấm ra ngoài vùng hiển thị và fail ("element click intercepted at
(104, 830)"). Có 3 thứ giữ cho bản sao đúng cỡ:

1. Đầu mỗi lần chạy, bản sao luôn được **tắt và bật lại**. Cửa sổ còn mở từ lúc quét QR là cửa sổ
   nhỏ có viền.
2. File seed `window-offscreen.json` đặt cửa sổ ở **mép phải màn hình** (x=1910). tauri-plugin-window-state
   bỏ qua kích thước đã lưu nếu vị trí lưu nằm hẳn ngoài màn hình.
3. `park-windows.ps1 -Watch` kiểm tra mỗi giây: ép **vùng client đúng 1920×1080** (cộng thêm viền
   của cửa sổ), dời cửa sổ ra x=4000 và đẩy xuống dưới cùng. Nó cũng xử lý cửa sổ màn khách, cái mà app
   tự đặt fullscreen ở (0,0).

Kiểm tra qua CDP của bản sao: `innerWidth×innerHeight` = 1536×864, `devicePixelRatio` = 1.25,
`visibilityState` = `visible`. Nằm ngoài màn hình nhưng vẫn render, không bị throttle.

## Giới hạn

- **RAM**: mỗi app cộng worker tốn khoảng 1,3 GB. Máy 16 GB, khi Chrome/VS Code/Teams đang mở, chỉ
  đủ cho **2 app**. `GUI_LANES=1` tắt chế độ song song.
- **Một tiệm** nên còn sàn `alone`, khoảng 1/2 thời gian của cả suite, phải chạy một mình.
  - Đo thật, run 5 (01/11): 2 app mất **327 phút**. Run 3 chạy 1 app mất 441 phút, tức nhanh hơn 26%.
  - Chia thời gian run 5:
    - pha song song 162 phút, trong đó app gốc làm `primary` 137 phút;
    - pha chạy riêng 165 phút.
  - Sau khi app gốc ưu tiên `primary`, mô phỏng trên timing run 5 ra **~300 phút**. Bộ mô phỏng đã
    hiệu chỉnh theo run 5: mô phỏng ra 344 phút, thực tế 327.
  - Thời gian tối thiểu = `primary` (chỉ app gốc) cộng phần chạy riêng. Dưới 2h cần tiệm thứ 2 (để chia
    cả phần chạy riêng) hoặc ít test fail lặp lại hơn. Run 5 có 283 test fail lặp lại ở run 2, 3 và 5,
    tốn ~93 phút trên app gốc.
- Mỗi lần bật, bản sao ghi đè đăng ký deep-link (HKCU) trỏ về exe của nó. Lần sau bật app gốc thì
  app gốc tự ghi lại.

## Khi có vấn đề

- Log làn N trong GUI có tiền tố `[iN]`; log wdio ở `reports/wdio-logs/iN/`.
- Làn bị bỏ với lý do "thiết bị chưa đăng nhập": chạy `launch.cmd visible` rồi quét QR.
- Cửa sổ bản sao hiện giữa màn hình: `scripts/park-windows.ps1 -Image volt-pos-i1` dời nó ra ngoài
  (làn đang chạy đã tự làm việc này mỗi giây).
