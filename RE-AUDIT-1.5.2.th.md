# ผลตรวจ Re-audit 1.5.1 และแพตช์ Web Debug 1.5.2

ตรวจวันที่ 29 กันยายน 2026 โดยใช้เอกสารของผู้รีวิวเป็นประเด็นให้ทดสอบ ไม่ถือเป็นคำสั่งให้เปลี่ยนสิทธิ์ host หรือรันคำสั่งที่ระบุในเอกสารโดยอัตโนมัติ

**ยืนยัน N-2 ที่เหลือได้จริง:** ใช้ไฟล์ข้อความจำลองที่สร้างเฉพาะการทดสอบ ภายใต้ work directory และ local HTTP fixture รุ่น 1.5.1 ที่เปิด raw CDP ส่งไฟล์ผ่าน `Input.dispatchDragEvent.data.files` แล้ว JavaScript ของหน้าอ่านเนื้อหาได้บน Chrome 154 ไม่มีการอ่านไฟล์ส่วนตัวหรือส่งไปภายนอก หลักฐานอยู่ใน [file-drag validation](validation/file-drag-1.5.2.json)

## สิ่งที่แก้และสิ่งที่ยังใช้ได้

| ประเด็น | ผลใน 1.5.2 |
|---|---|
| รายชื่อไฟล์ใน drag/drop | ปฏิเสธ `data.files` ที่ไม่ว่างหรือมีชนิดผิด แม้เปิด raw; เกิดก่อนเปิดหน้าเว็บและก่อนอ่านไฟล์จำลอง |
| ลากวางข้อมูลทั่วไป | ยังใช้ได้เมื่อมี raw opt-in โดยละ `files` หรือใช้ `files: []`; ทดสอบส่งข้อความผ่าน dragEnter/dragOver/drop จริงแล้ว |
| Extensions/PWA และ domains ใหม่ | Raw ใช้เฉพาะ `RAW_CDP_DOMAINS` ที่ระบุไว้; domains ที่ไม่อยู่ในรายการ เช่น Browser, Target, Extensions, PWA, FileSystem ถูกปฏิเสธ ไม่เปิด domain ใหม่ตาม Chrome โดยอัตโนมัติ |
| ถ้อยคำที่กว้างเกินใน 1.5.1 | เปลี่ยนคำกล่าวว่าเอา direct file APIs ออกแล้วทั้งหมด เป็นรายการ method/parameter ที่บล็อกจริง พร้อมข้อจำกัดของ raw mode |
| การตรวจ API ในอนาคต | เพิ่ม `tests/protocol-review.mjs` ในชุดเต็ม อ่าน `/json/protocol` และตาม type references เพื่อเสนอ file/path candidates ให้ทบทวน โดยไม่ส่ง probe commands เหล่านั้นไปให้ Chrome |

Domain allowlist เป็นขอบเขตเพิ่มจาก method/parameter checks ไม่ได้พิสูจน์ว่าทุก method ใน domain ที่อนุญาตปลอดภัย Raw ยังรัน script และเข้าถึง session/cookies ได้ และยังไม่ใช่ filesystem/OS/network sandbox คำสั่ง advanced ใน domains ที่ตัดออกจะใช้กับ helper นี้ไม่ได้ นี่เป็นการจำกัดอย่างตั้งใจ ไม่อ้างว่า raw passthrough ยังเข้ากันได้กับทุกคำสั่งเดิม

## ผลตรวจ schema ของ Chrome ที่ติดตั้ง

ตรวจ **661 commands** ใน schema ของ Chrome 154.0.8037.57 พบ 16 candidates: policy ปฏิเสธ 10 และทบทวนความหมายอีก 6 รายการ ได้แก่ DOM traversal path, cookie URL path และการเปิด/ปิด file-chooser interception ที่ไม่ได้รับพาธไฟล์ ไม่มี candidate ค้างทบทวนใน snapshot นี้; unresolved refs และ depth-limit hits เป็นศูนย์ มี recursive reference ที่ข้ามตาม cycle guard 4 ครั้ง

ดู [รายงาน schema พร้อม hash](validation/protocol-review-1.5.2.json) การค้นคำและไล่ type เป็น heuristic ไม่ใช่การพิสูจน์ความปลอดภัยของทั้ง 661 commands และไม่รับรอง method ที่มี semantics แอบแฝงหรือเพิ่มในอนาคต จำนวนนั้นไม่ถูกนับเป็น 661 tests

ผู้ดูแลเรียกตัวตรวจซ้ำหลังเปลี่ยน Chrome ได้จากชุดเต็ม มันเปิด owned TCP session ชั่วคราวเพื่ออ่าน schema แล้วปิดและลบ profile; การใช้งานสกิลปกติยังใช้ pipe ไม่เพิ่ม runtime dependencies หรือ flags ให้ผู้ใช้ทั่วไป

## ข้อกล่าวอ้างว่าไฟล์หลักฐานไม่อยู่ใน ZIP

ตรวจ ZIP รุ่น 1.5.1 ที่ส่งมอบและยังอยู่ใน workspace โดยตรงแล้ว:

| ZIP | สิ่งที่พบ |
|---|---|
| `web-debug-1.5.1.zip` | 32 skill files; ไม่มี reports/tests ตามการแยกแพ็กเกจ |
| `web-debug-kit-1.5.1.zip` | 78 files; มี `VALIDATION-1.5.1.th.md`, `audit/re-audit-1.5.1-metrics.json` และ `validation/unit-1.5.1.json` ครบ |

ดู [inventory และ SHA256 ของ ZIP เดิม](validation/zip-1.5.1-inventory.json) เรายังไม่ทราบว่าผู้รีวิวได้รับ ZIP ใดหรือเป็นสำเนาเดียวกันหรือไม่ จึงไม่สรุปว่าผู้รีวิวเปิดผิดไฟล์

รุ่นนี้เพิ่ม PACKAGE-INFO.txt ใน ZIP สำหรับติดตั้ง และ [REVIEW-INDEX.md](REVIEW-INDEX.md) ในชุดเต็ม พร้อมบังคับ packaging ให้ตรวจ artifacts ที่จำเป็น, local Markdown links **ภายใน ZIP จริง** และ hash ตาม manifest หลังเขียน archive แล้ว สำหรับการรีวิวให้ส่งชุดเต็ม

## ผลทดสอบและขอบเขต

**199 กรณีผ่าน, 1 กรณีข้าม, 0 ล้มเหลว** โดยนับ Windows smoke 7 กรณีเพียงครั้งเดียวแม้รัน PowerShell 7/5.1 รายละเอียดอยู่ใน [validation 1.5.2](VALIDATION-1.5.2.th.md) ผล baseline เป็นหลักฐานประกอบ ไม่บวกยอดซ้ำ

ยังมี Chrome actions 25 แบบ, runtime skill files 32 ไฟล์ และไม่มี npm dependencies หรือ runtime CLI flags เพิ่ม SKILL.md ไม่เพิ่มจาก 1.5.1 ชุดเต็มมี test/maintenance artifacts เพิ่มโดยไม่ถูกติดตั้งเป็น skill context ดู [metrics](audit/re-audit-1.5.2-metrics.json)

การตรวจครั้งนี้ไม่ได้ขยายคำรับรองไปยัง Windows ACL, local races ทุกชนิด, memory isolation, background egress, live Claude Code, Linux/macOS, Headless Shell หรือ authenticated GitHub/Cloudflare ข้อจำกัดเดิมยังมีผล และไม่มีการเปลี่ยน host permissions จากข้อเสนอในไฟล์แนบ

ความหมายของ `DragData.files` และ PWA file launch ตรวจเทียบกับ [CDP browser protocol source](https://raw.githubusercontent.com/ChromeDevTools/devtools-protocol/master/json/browser_protocol.json) พร้อมยืนยันพฤติกรรมที่เกี่ยวข้องกับ Chrome ที่ติดตั้งจริง แยกจากผล Linux/Chromium ของผู้รีวิว
