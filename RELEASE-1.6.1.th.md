# Web Debug 1.6.1 — สถานะความพร้อม

ประเมินวันที่ 29 กันยายน 2026: **พร้อมเริ่มใช้งานกับงานพัฒนา/ตรวจเว็บไซต์และรายงานปัญหาแบบ local บน Windows ในขอบเขตที่ทดสอบ** ให้ใช้ 1.6.1 ซึ่งแก้บั๊ก Reporting ที่พบในการตรวจครั้งนี้แล้ว ยังไม่ใช่การรับรองทุกระบบปฏิบัติการ ทุก provider account หรือการใช้งานกับเว็บที่เป็นอันตรายโดยไม่มี isolation

## สิ่งที่แก้ก่อนส่งมอบครั้งนี้

พบว่าตัวปิดบัง token เปลี่ยนข้อความ JSON อีกครั้งเมื่ออ่านรายงานซ้ำ เครื่องหมายท้ายข้อความหายและทำให้ exact duplicate hints คลาดเคลื่อน ยืนยันทั้งสองอาการกับ 1.6.0 ด้วยข้อมูลจำลอง ดู [หลักฐาน baseline](validation/readiness-baseline-1.6.0.json)

1.6.1 รักษาเครื่องหมายคำพูด รองรับ escaped quoted values รักษา punctuation ท้ายค่า และไม่เปลี่ยน placeholder ที่ปิดบังแล้ว ทดสอบการทำซ้ำหลายรอบและรายงาน input ตรงกันผ่าน เพิ่ม regression cases สองกรณี และใช้ระบบ Report ของเราเองบันทึก → ยืนยันว่าเป็นโค้ดของเรา → resolve ใน 1.6.1 พร้อมหลักฐาน ดู [รายงานที่แก้แล้ว](reports/report-redaction-1.6.1.md)

ไม่ได้เปลี่ยนโค้ดควบคุม Chrome หรือ provider helpers ใหม่ เปรียบเทียบกับ 1.6.0 แล้วเปลี่ยนเฉพาะ report.mjs และเลขเวอร์ชันใน common.mjs ดู [metrics](audit/release-1.6.1-metrics.json)

## ส่วนที่ใช้งานได้และช่องว่างที่ยังควรยืนยัน

| ด้าน | สถานะ |
|---|---|
| Node helpers, Chrome pipe, UI/SEO/design diagnostics บน Windows | มี full-suite baseline 1.6.0 ผ่าน 235 กรณี, ข้าม POSIX 1 กรณี |
| Reporting หลังแพตช์ | ทดสอบ 25/25 ผ่าน รวม regression ใหม่ |
| Installer และ knowledge ledger | ทดสอบแพตช์นี้ 14/14 ผ่าน |
| Codex/Claude Code ใช้งานสกิลที่ติดตั้งจริงครบ flow | โครงสร้างและการคัดลอกไฟล์ทดสอบแล้ว; ยังต้อง acceptance test ใน session จริงของแต่ละ host |
| Linux/macOS ของรุ่นปัจจุบัน | ยังไม่ได้ทดสอบเอง; ผล Linux ของผู้รีวิวเป็นของ 1.5.2 |
| GitHub/Cloudflare ที่มีบัญชีและสิทธิ์จริง | ยังไม่ได้ทดสอบครบ; GitHub helper ต้องมี gh และ auth ของผู้ใช้ ส่วน Wrangler ใช้เมื่องาน Cloudflare ต้องใช้ |

การตรวจ PATH ในเครื่องนี้พบ Node, Git และ Claude CLI แต่ไม่พบ gh หรือ Wrangler แบบ global ตอนตรวจ ไม่ได้ค้น/รับรอง dependencies ในทุกโครงการ และไม่ได้ล็อกอินหรือติดตั้งเครื่องมือเพิ่มให้

## ความรู้: มีแหล่งข้อมูล แต่ยังไม่ควรอ้างว่าทั้งชุดยืนยันล่าสุด

ตรวจ cache ที่ใช้ระหว่างพัฒนาแล้วมี snapshots 40 แหล่ง, hash ตรงครบ, ไม่มี fetch error แต่ทั้ง 40 ยังเป็น `reviewRequired` และไม่มี semantic-review acknowledgment ที่สมบูรณ์ใน ledger ดู [ผลตรวจ](validation/knowledge-readiness-1.6.1.json)

สถานะนี้หมายถึงยังขาดบันทึกการตรวจความหมาย ไม่ใช่ข้อสรุปว่าทุกแหล่งผิดหรือเลิกใช้ การทำงานแต่ละโครงการควรตรวจแหล่งที่เกี่ยวข้องกับเวอร์ชันจริง และบันทึก hash-bound review ตาม maintenance workflow ก่อนอ้างว่าข้อมูลนั้นได้รับการยืนยันแล้ว การรับรองความรู้ทั้งหมดต้องทบทวนเพิ่ม; ไม่ควรใช้เพียง fetch สำเร็จหรือวันที่ edition เป็นหลักฐาน

## สิ่งที่ควรทำต่อ

1. ทดลอง flow จริงบนโครงการตัวแทนผ่าน Codex และ Claude Code: เรียกสกิล → เปิด local site → หาบั๊ก/แก้ → ตรวจซ้ำ → สร้าง/ส่งออก Report
2. ทบทวน sources ตาม stack ที่ใช้ก่อน เช่น Chrome/CDP และ framework หลัก พร้อมบันทึก review จริง; หากจะรับรองทั้งชุดให้ทบทวนครบ
3. ตรวจ GitHub/Cloudflare กับบัญชีและโครงการที่ได้รับอนุญาต และเพิ่ม Linux/macOS coverage หากต้องแจกใช้ข้ามระบบ

ข้อจำกัดเดิมยังมีผล: raw CDP เป็น privileged opt-in, redaction เป็น heuristic, Windows ACL ไม่ได้รับการรับรองเป็น owner-only และ local race/memory/network isolation ไม่ครบทุก threat model รายงานจะไม่ส่งไปให้ผู้ดูแลเอง ต้องตรวจและส่งไฟล์ตามช่องทางที่เลือก

งานถัดไปควรเน้น acceptance tests, การทบทวนความรู้และ Report จากการใช้งานจริง เพื่อเลือกแพตช์จากหลักฐาน ดู [ผลทดสอบแพตช์นี้](VALIDATION-1.6.1.th.md) และ [คู่มือติดตั้ง](README.th.md)
