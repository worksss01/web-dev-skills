# ผลทดสอบ Web Debug 1.6.1

วันที่ 29 กันยายน 2026 บน Windows / Node 24.18.0 แพตช์นี้เปลี่ยนการ redaction ใน Reporting และเลขเวอร์ชันเท่านั้น

| ชุดที่รันสำหรับแพตช์ | ผล | หลักฐาน |
|---|---|---|
| Reporting ทั้งชุด รวม regression ใหม่สองกรณี | 25 ผ่าน, 0 ล้ม, 0 ข้าม | [TAP](validation/report-1.6.1.json) |
| Installer / knowledge ledger regression | 14 ผ่าน | [JSON](validation/package-1.6.1.json) |
| เปรียบเทียบขอบเขต source ที่เปลี่ยน | ตรงตามขอบเขต report + version | [Metrics](audit/release-1.6.1-metrics.json) |

รวม **39 กรณีผ่านในแพตช์นี้** ไม่บวกซ้ำกับ [full-suite 1.6.0](VALIDATION-1.6.0.th.md) ซึ่งผ่าน 235 และข้าม 1 กรณี และไม่อ้างว่ารัน Chrome suite ใหม่ทั้งหมดสำหรับแพตช์นี้

Regression ใหม่ตรวจว่า quoted JSON values ที่มี escaped quotes/slashes, bare placeholders และ punctuation ท้ายข้อความยังคงเดิมเมื่อ redact ซ้ำ พร้อมตรวจว่า input รายงานตรงกันยังได้ duplicate hints หลังอ่าน record หลายครั้ง ข้อมูลทุกค่าเป็น synthetic ไม่ใช้ credentials จริง

หลักฐานก่อนแก้อยู่ใน [baseline reproduction](validation/readiness-baseline-1.6.0.json) ส่วน [รายงานของเราเอง](reports/report-redaction-1.6.1.md) บันทึกสาเหตุ การจัดประเภทและเวอร์ชันแก้

```powershell
node --test tests/report.test.mjs
node tests/package-smoke.mjs --work work/package-check
```

ใช้ชุดเต็มที่ตรวจ checksum แล้วและ work directory ใหม่ในพื้นที่โครงการ ผลไม่รับรองการปิดบังข้อมูลทุกชนิดหรือทุกภาษา รายการที่ยังต้องยืนยันเพิ่มเติมอยู่ใน [สถานะความพร้อม](RELEASE-1.6.1.th.md)
