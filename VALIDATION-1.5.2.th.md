# ผลทดสอบ Web Debug 1.5.2

ทดสอบวันที่ 29 กันยายน 2026 เวลา Asia/Bangkok บน Windows 11 Home build 26200, Node 24.18.0 และ Chrome 154.0.8037.57 Timestamps ใน JSON ใช้ UTC

| ชุด | ผล | หลักฐาน |
|---|---|---|
| Unit และ regression รวม raw-policy/schema scanner | 92 ผ่าน, 1 ข้าม | [TAP](validation/unit-1.5.2.json) |
| Chrome integration | 39 ผ่าน | [JSON](validation/browser-1.5.2.json) |
| Adversarial Chrome | 13 ผ่าน | [JSON](validation/adversarial-browser-1.5.2.json) |
| Review regression | 22 ผ่าน | [JSON](validation/review-browser-1.5.2.json) |
| Re-audit regression | 6 ผ่าน | [JSON](validation/re-audit-browser-1.5.2.json) |
| File drag และ data-only drag | 5 ผ่าน | [JSON และ baseline reproduction](validation/file-drag-1.5.2.json) |
| Live protocol review | 1 ผ่าน | [661 commands / 16 candidates](validation/protocol-review-1.5.2.json) |
| Installer และ knowledge ledger | 14 ผ่าน | [JSON](validation/package-1.5.2.json) |
| Windows smoke | 7 ผ่านทั้งสอง shells | [PS7](validation/windows-ps7-1.5.2.json), [PS5.1](validation/windows-ps51-1.5.2.json) |

รวม **199 ผ่าน, 1 ข้าม, 0 ล้มเหลว** ไม่บวก Windows ซ้ำ ไม่ขยายจำนวน tests ตามจำนวน protocol commands, baseline replay หรือตัวอย่างย่อย กรณีข้ามคือ POSIX file-mode test บน Windows

Skill Creator validator ผ่าน และ packaging ตรวจความเท่ากันของ skill files ใน ZIP สองแบบ รวม required reports/metrics, local links ภายใน archive และ SHA256 manifest การผ่าน schema scan หมายถึง candidates ใน snapshot นี้ถูกบล็อกหรือทบทวนแล้ว ไม่ได้พิสูจน์ว่า raw CDP ไม่มีช่องทางอื่น

ยังไม่ได้ทดสอบ live Claude Code, Linux/macOS/Node 22.4, Headless Shell, WSL runtime หรือ authenticated GitHub/Cloudflare ไม่มีการทดสอบกับ production หรือไฟล์ส่วนตัว ผู้รีวิวสามารถเทียบหลักฐานกับข้อจำกัดใน [รายงานตอบ re-audit](RE-AUDIT-1.5.2.th.md)

## รันซ้ำจากชุดเต็ม

ใช้ work directory ใหม่ภายในโครงการ:

```powershell
node --test tests/unit.test.mjs tests/diagnostics.test.mjs tests/platforms.test.mjs tests/quality.test.mjs tests/adversarial.test.mjs tests/review-security.test.mjs tests/re-audit.test.mjs tests/raw-policy.test.mjs
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

`file-drag-browser` รับ `--baseline PATH_TO_1.5.1_SKILL` เพิ่มได้เพื่อทำซ้ำด้วย synthetic fixture file เท่านั้น การทดสอบไม่จำเป็นต้องมี baseline สำหรับตรวจรุ่นใหม่ ส่วน `protocol-review` เปิด TCP เฉพาะ owned test Chrome เพื่ออ่าน schema และ cleanup เอง; probe params ถูกตรวจใน validator ไม่ถูกส่งไป execute
