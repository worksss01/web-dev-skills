# ผลทดสอบ Web Debug 1.5.1

รันวันที่ 29 กันยายน 2026 เวลา Asia/Bangkok (timestamps ใน JSON เป็น UTC) บน Windows 11 Home build 26200, Node 24.18.0, Chrome 154.0.8037.57

| ชุดทดสอบ | ผล | หลักฐาน |
|---|---|---|
| Unit / diagnostics / platforms / quality / adversarial / review / re-audit | 86 ผ่าน, 1 ข้าม | [TAP และผลรวม](validation/unit-1.5.1.json) |
| Chrome integration เดิม | 39 ผ่าน | [JSON](validation/browser-1.5.1.json) |
| Adversarial Chrome | 13 ผ่าน | [JSON](validation/adversarial-browser-1.5.1.json) |
| Chrome review regression จาก 1.5 | 22 ผ่าน | [JSON](validation/review-browser-1.5.1.json) |
| Chrome re-audit regression | 6 ผ่าน | [JSON พร้อม baseline proof](validation/re-audit-browser-1.5.1.json) |
| ตัวติดตั้งและ knowledge ledger | 14 ผ่าน | [JSON](validation/package-1.5.1.json) |
| Windows smoke | 7 ผ่านทั้งสอง shells | [PowerShell 7](validation/windows-ps7-1.5.1.json), [PowerShell 5.1](validation/windows-ps51-1.5.1.json) |
| Skill Creator validator | ผ่าน | ตรวจ frontmatter/naming/scaffold |
| ZIP และ local document links | ตรวจขณะ packaging | SHA256 แนบกับ ZIP; skill files ในชุดเต็ม/ชุดเบาตรงกัน |

รวม **187 กรณีผ่าน และ 1 กรณีข้าม** ไม่มี failure นับ Windows 7 กรณีเพียงครั้งเดียว ไม่เพิ่มยอดจากการรัน baseline หรือจากตัวอย่างย่อยใน mutation corpus กรณีที่ข้ามคือ POSIX permission bits ซึ่งไม่ควรอ้างว่าผ่านจาก Windows

## สิ่งที่ยืนยันเพิ่มในรอบนี้

- Baseline 1.5.0 หยุดที่ `inspect` หลัง `Debugger.enable` ด้วย Runtime.evaluate timeout ใน 21.3 วินาที; รุ่นใหม่ปฏิเสธ default plan ก่อนโหลดเว็บ และ quick observation ผ่านกับหน้า debugger fixture
- Windows filesystem ที่ทดสอบไม่แยกตัวพิมพ์ ยืนยันว่า baseline เขียน `Inputs/capture.png` เข้า inputs จริง รุ่นใหม่ป้องกันได้ รวม internal junction และ `--overwrite`
- Method ที่แตะไฟล์ตรงและ `Target.*` ถูกปฏิเสธแม้เปิด raw; advanced diagnostic ที่อนุญาตยังทำงานและบันทึก policy
- การอ่าน project manifest ปฏิเสธ final symlink/oversize และตรวจการสลับไฟล์/เพิ่มขนาดระหว่างขั้นตอน โดยยังอ่านไฟล์ปกติและ hardlinks ได้
- ทดสอบเดิมซ้ำหลังเปลี่ยน common reader และ plan validation รวมการติดตั้งสองแพลตฟอร์ม การย้าย knowledge cache การตรวจ UI/SEO/design และ Chrome pipe/TCP lifecycle

รายละเอียดการตัดสินใจและความเสี่ยงคงเหลืออยู่ใน [ผลตอบ re-audit](RE-AUDIT-RESPONSE.th.md) Tests ไม่ใช่หลักฐานว่าไม่มีช่องโหว่ทั้งหมด โดยเฉพาะ Windows ACL, hostile parent-directory races, renderer memory/egress และการเลือกสิทธิ์ของ agent

ยังไม่ได้ทดสอบ live Claude Code session, Linux/macOS/Node 22.4, Headless Shell, WSL runtime หรือ authenticated GitHub/Cloudflare รอบนี้ ไม่มีการเปลี่ยนบัญชีหรือระบบ production

## รันซ้ำ

จากโฟลเดอร์ชุดเต็ม ใช้พื้นที่ work ใหม่ภายในโครงการ:

```powershell
node --test tests/unit.test.mjs tests/diagnostics.test.mjs tests/platforms.test.mjs tests/quality.test.mjs tests/adversarial.test.mjs tests/review-security.test.mjs tests/re-audit.test.mjs
node tests/browser-smoke.mjs --work work/browser-check
node tests/adversarial-browser.mjs --work work/adversarial-check
node tests/review-browser.mjs --work work/review-check
node tests/re-audit-browser.mjs --work work/re-audit-check
node tests/package-smoke.mjs --work work/package-check
node tests/windows-smoke.mjs --work "work/windows-ps7 ภาษาไทย" --shell pwsh.exe
node tests/windows-smoke.mjs --work "work/windows-ps51 ภาษาไทย" --shell powershell.exe
```

`re-audit-browser` รับ `--baseline PATH_TO_1.5.0_SKILL` แบบ optional สำหรับทำซ้ำหลักฐานรุ่นเก่า โดยใช้เฉพาะ local fixture; ชุดส่งมอบไม่ติดตั้งรุ่นเก่าให้ Tests ปิด server/Chrome ที่สร้างเอง ชุด legacy อาจเก็บ profile เพื่อการตรวจย้อนหลัง ส่วน pipe/re-audit ตรวจและลบ owned profiles ตาม scenario
