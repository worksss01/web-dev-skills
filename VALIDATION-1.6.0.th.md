# ผลทดสอบ Web Debug 1.6.0

ตรวจวันที่ 29 กันยายน 2026 บน Windows 11 Home build 26200, Node 24.18.0 และ Chrome 154.0.8037.57

| ชุด | ผล | หลักฐาน |
|---|---|---|
| Unit / diagnostic / security / installer integrity / reporting | 128 ผ่าน, 1 ข้าม | [TAP](validation/unit-1.6.0.json) |
| Chrome integration | 39 ผ่าน | [JSON](validation/browser-1.6.0.json) |
| Adversarial Chrome | 13 ผ่าน | [JSON](validation/adversarial-browser-1.6.0.json) |
| Review regression | 22 ผ่าน | [JSON](validation/review-browser-1.6.0.json) |
| Re-audit regression | 6 ผ่าน | [JSON](validation/re-audit-browser-1.6.0.json) |
| File drag | 5 ผ่าน | [JSON](validation/file-drag-1.6.0.json) |
| Live protocol review | 1 ผ่าน | [JSON](validation/protocol-review-1.6.0.json) |
| Installer / knowledge ledger | 14 ผ่าน | [JSON](validation/package-1.6.0.json) |
| Windows smoke | 7 ผ่านทั้งสอง shells | [PS7](validation/windows-ps7-1.6.0.json), [PS5.1](validation/windows-ps51-1.6.0.json) |

รวม **235 ผ่าน, 1 ข้าม, 0 ล้มเหลว** นับ Windows 7 กรณีครั้งเดียว และไม่บวกจำนวน methods ของ schema เป็นจำนวน tests กรณีข้ามคือ POSIX mode bits บน Windows Reporting 23 กรณีรวมอยู่ใน unit แล้ว ไม่บวกซ้ำ

## สิ่งที่ Reporting tests ตรวจ

- schema/ขนาด/enum, redaction patterns และข้อมูลภาษาไทย
- ความเห็นผู้รายงานแยกจาก triage; คิว owned code/owned guidance แยกจาก external knowledge, provider, project และ unknown
- provider/project ไม่เข้าสถานะงานแพตช์หรือ resolved ใน release ของเรา
- resolution ต้องมี version และ verification note; amendment รักษา observed versions และรีเซ็ตข้อสรุปเดิมพร้อมเก็บประวัติ
- duplicate เป็นเพียง hint; ไม่ลบ/ปิดเอง และ canonical target ต้องถูกต้อง
- private/security export, Markdown fences, ไม่เก็บ env secrets/เนื้อหาไฟล์อ้างอิง และไม่เรียก network
- missing store ไม่มี side effects, mixed-content store ไม่ถูกยึดใช้, static links/alias paths/locks/output collisions ถูกป้องกัน
- malformed records, invalid IDs และ report ขนาดเกินไม่ถูกยอมรับ; CLI template/create/triage/export ใช้งานได้จริง

ผลไม่ได้พิสูจน์การจำแนกสาเหตุอัตโนมัติ ความครบของการปกปิดข้อมูล หรือ local storage ที่ป้องกันผู้โจมตีสิทธิ์เท่าผู้ใช้ได้ทั้งหมด ไม่มี remote submission ให้ทดสอบตามช่องทางที่ผู้ใช้เลือก

รอบนี้ยังไม่ใช่ live Claude Code, Linux/macOS/Node 22.4, Headless Shell หรือ authenticated GitHub/Cloudflare test ผล Linux ที่ผู้รีวิวเคยส่งเป็นของ 1.5.2 ไม่ใช่หลักฐานของ Reporting ใหม่

## รันซ้ำ

จากชุดเต็มที่ตรวจ checksum แล้ว ใช้ work directory ใหม่ในพื้นที่โครงการ:

```powershell
node --test tests/unit.test.mjs tests/diagnostics.test.mjs tests/platforms.test.mjs tests/quality.test.mjs tests/adversarial.test.mjs tests/review-security.test.mjs tests/re-audit.test.mjs tests/raw-policy.test.mjs tests/install-integrity.test.mjs tests/report.test.mjs
node tests/browser-smoke.mjs --work work/browser-check
node tests/adversarial-browser.mjs --work work/adversarial-check
node tests/review-browser.mjs --work work/review-check
node tests/re-audit-browser.mjs --work work/re-audit-check
node tests/file-drag-browser.mjs --work work/file-drag-check
node tests/protocol-review.mjs --work work/protocol-check
node tests/package-smoke.mjs --work work/package-check
node tests/windows-smoke.mjs --work work/windows-ps7 --shell pwsh.exe
node tests/windows-smoke.mjs --work work/windows-ps51 --shell powershell.exe
```

การรัน tests ใช้ fixtures; ไม่ส่งรายงานให้ผู้ดูแลจริง ไม่แก้ global skill/configuration และปิด server/Chrome ที่สร้างเอง
