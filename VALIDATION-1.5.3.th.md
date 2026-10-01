# ผลทดสอบ Web Debug 1.5.3

วันที่ 29 กันยายน 2026 บน Windows 11 / Node 24.18.0 แพตช์นี้เปลี่ยนเฉพาะตัวติดตั้งและการอธิบาย integrity; skill runtime ต่างจาก 1.5.2 เฉพาะ version identifier

| ชุดที่รันในรอบนี้ | ผล | หลักฐาน |
|---|---|---|
| Manifest / installer integrity | 13 ผ่าน, 0 ล้ม, 0 ข้าม | [ผลที่บันทึกจาก TAP](validation/install-integrity-1.5.3.json) |
| Installer และ knowledge ledger regression | 14 ผ่าน | [JSON](validation/package-1.5.3.json) |
| เปรียบเทียบ skill files กับ 1.5.2 | ผ่าน: เปลี่ยนเฉพาะ version | [Metrics](audit/re-audit-1.5.3-metrics.json) |
| Packaging | ตรวจ required artifacts, ZIP links, manifest hashes และไฟล์สกิลสองชุดตรงกัน | `MANIFEST.sha256` และ sidecar checksum/contents ของ ZIP |

รวมเฉพาะ tests ที่รัน **27 กรณีผ่าน** ไม่มี failure หรือ skip ในสองชุดนี้ ไม่เพิ่มจำนวนจาก packaging checks และไม่รวม baseline ซ้ำ

ชุด integrity ครอบคลุม manifest ปกติและพาธภาษาไทย/ช่องว่าง, ไฟล์แก้ไข/หาย, manifest หาย/ใหญ่เกิน, ไฟล์สกิลนอกบัญชี, duplicate/case aliases, malformed hash, traversal/absolute/device paths, symlink/junction, ขาด installer/SKILL.md ในบัญชี และ CLI ที่พบ helper เสียก่อน import/สร้างปลายทาง รวมถึง test ที่ยืนยันว่าการแก้ทั้งไฟล์และ manifest ยังตรวจผ่านได้โดยไม่อ้าง publisher authentication

ผลทั้งหมดของ runtime รุ่น 1.5.2 อยู่ใน [baseline Windows](VALIDATION-1.5.2.th.md): 199 ผ่าน, 1 POSIX case ข้าม ส่วน [Linux 193 ผ่าน](validation/external-review-1.5.2.json) เป็นข้อมูลจากเอกสารที่ผู้รีวิวส่งมา ไม่ได้รันโดยเราและไม่ได้ยืนยัน installer 1.5.3 บน Linux

## รันซ้ำ

ใช้ชุดเต็มที่ตรวจ checksum แล้ว และใช้ work directory ใหม่ในพื้นที่โครงการ:

```powershell
node --test --test-reporter=tap tests/install-integrity.test.mjs
node tests/package-smoke.mjs --work work/package-check
```

ตัวติดตั้งต้องใช้ source และ manifest ที่ตรงกัน หากแก้ไฟล์ในชุดเต็มอย่างตั้งใจ ต้องทำขั้นตอน build/review ของผู้ดูแลและสร้าง manifest ใหม่ก่อนทดสอบ installer ไม่แก้ manifest เพื่อมองข้ามไฟล์เสียที่ไม่ทราบสาเหตุ ชุดทดสอบเขียนเฉพาะ fixtures ใน work และไม่แตะการติดตั้ง global

ดู [ผลตอบ I-6](RE-AUDIT-1.5.3.th.md) สำหรับความต่างระหว่าง integrity กับ authenticity และข้อจำกัดที่ยังเหลือ
