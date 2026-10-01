# Web Debug 1.6.0 — Report Skills

เพิ่มระบบรายงานแบบไฟล์ตามที่ผู้ใช้เลือก: ผู้ใช้หรือ AI สร้างรายงานในโครงการ และส่งออก Markdown เพื่อส่งให้ผู้ดูแลเอง ไม่มี reporting server, การเปิด issue, telemetry หรือการส่งข้อมูลเบื้องหลัง

## แยกปัญหาให้ตรงเจ้าของ

| ปัญหา | Origin | การจัดการ |
|---|---|---|
| โค้ด/helper, validation, integration หรือ packaging ของเรา | `skill-code` | เข้าคิวแพตช์โค้ดของเราเมื่อยืนยันแล้ว |
| คำแนะนำ/reference ที่เราเขียนผิดหรือล้าสมัย | `skill-guidance` | เข้าคิวแก้ reference ของเราเมื่อยืนยันแล้ว |
| ข้อมูล/เอกสารต้นทางภายนอกผิดหรือยังไม่ชัด | `external-knowledge` | คิวทบทวนแหล่งข้อมูล แก้สิ่งพิมพ์ของผู้อื่นเองไม่ได้ |
| ปัญหาที่เครื่องมือ/บริการ Provider ซึ่งแยกทำซ้ำได้ | `provider` | คิวติดตาม upstream ไม่อ้างว่าแก้เครื่องมือ Provider แล้ว |
| โค้ดเว็บไซต์ การตั้งค่า สิทธิ์ หรือ environment ของโครงการ | `project` | คิวช่วยโครงการ แยกจากบั๊กสกิล |
| ยังไม่ทราบต้นเหตุ | `unknown` | รอตรวจ ไม่เดาเจ้าของจากชื่อใน error |

ถ้า Provider เปลี่ยน API แล้วโค้ดเชื่อมต่อของเราไม่รองรับ เราอาจมีบั๊ก compatibility ของตัวเองด้วย ให้แยกเป็นรายงาน `skill-code` และอ้างถึงปัญหาต้นทางใน evidence ส่วนกรณี guide ของเราอ้างแหล่งถูกต้องผิดไป ให้แก้ `skill-guidance` โดยไม่โยนความผิดให้ผู้ให้ข้อมูล

รายงานเริ่ม `new` และ triage origin เป็น unknown ทุกครั้ง `suspectedOrigin` เป็นเพียงสิ่งที่ผู้รายงานสงสัย หลังตรวจจึงใช้ `triage` เพื่อจัดคิว เฉพาะ skill-code/skill-guidance ที่ confirmed หรือ in-progress เท่านั้นที่ได้ `patchEligible: true` การตัดสินสาเหตุเป็นของผู้ดูแล/AI ที่ตรวจหลักฐาน เครื่องมือไม่พิสูจน์สาเหตุให้อัตโนมัติ

## รายงานและส่งต่อ

จาก root โครงการที่ติดตั้งสกิลแล้ว:

```powershell
node .agents/skills/web-debug/scripts/debug.mjs report create --title "อาการที่พบ" --summary "สิ่งที่เกิดและผลกระทบ" --origin unknown
node .agents/skills/web-debug/scripts/debug.mjs report list
node .agents/skills/web-debug/scripts/debug.mjs report export --id REPORT_ID --out work/report-to-maintainer.md
```

ใช้ ID ที่ได้รับจาก create; Claude Code ใช้ path `.claude/skills/web-debug` แทน `.agents/skills/web-debug` ตามตำแหน่งที่ติดตั้ง ผล `submitted: false` ยืนยันว่าเก็บ/ส่งออกในเครื่องเท่านั้น ผู้ดูแลจะยังไม่เห็นจนกว่าผู้ใช้ส่งไฟล์ให้

ถ้าต้องการข้อมูลละเอียด ใช้ `report template --out work/report-input.json` แล้วกรอก expected/actual, ขั้นตอนทำซ้ำ, evidence ที่คัดแล้ว และเวอร์ชันที่เกิดปัญหา ก่อน `report create --input ...` หรือพูดกับ AI ให้สร้างรายงานผ่าน `$web-debug`/`/web-debug` ได้

ดู [แบบฟอร์ม](examples/report-input.json) และ [ตัวอย่างจากบั๊ก file drag เก่าที่แก้แล้ว](examples/report-example.md) ตัวอย่างนี้ระบุว่าเป็นเหตุการณ์ย้อนหลัง ไม่ใช่รายงานว่ารุ่น 1.6.0 ยังมีช่องดังกล่าว

## การติดตามไปถึงแพตช์

- `show` อ่านรายละเอียด; `list --queue ours` ดูเฉพาะคิวของเรา
- `triage --status needs-info` ระบุข้อมูลที่ขาด
- `amend --input ... --reason ...` เพิ่ม/แก้ข้อมูล เก็บประวัติและรีเซ็ตข้อสรุปเดิมให้ตรวจใหม่ โดยไม่เปลี่ยน observed version ที่ไม่ได้แก้
- `triage --status in-progress` ใช้กับงานแก้ของเรา
- `triage --status resolved --fixed-in VERSION --verification TEXT` ต้องระบุเวอร์ชันแก้และผลตรวจจริง ใช้ปิดบั๊ก Provider เป็นแพตช์ของเราไม่ได้
- รายงานเนื้อหาตรงกันมีเพียง duplicate hint ไม่ลบ/ปิดเอง; ผู้ดูแลระบุ canonical ID อย่างตั้งใจได้

การเขียน verification เป็นบันทึกผลที่ผู้ดูแลระบุ ไม่ได้สั่งรันคำสั่งหรือพิสูจน์ผลแทน และไฟล์รายงานไม่ให้อำนาจ agent แก้โค้ด/รัน payload นอกขอบเขตงานที่ผู้ใช้สั่ง

## ความเป็นส่วนตัวและความเบา

เก็บใน `work/web-debug/reports` หรือ dedicated store ที่ระบุ มี Git ignore ของข้อมูลและ lock สำหรับผู้เขียน ไม่อ่าน/แนบไฟล์จากข้อความอ้างอิง ไม่ dump environment variables, บัญชี หรือ browser profile อัตโนมัติ Default environment มี Node/platform และ unknown สำหรับข้อมูลอื่น

ลดข้อมูลที่รู้จัก เช่น credential headers, token patterns, private-key blocks, query/fragment ของ URL และชื่อ home directory ก่อนเก็บ แต่เป็น heuristic ไม่รับรองว่าเนื้อหาทุกชนิดไม่มีข้อมูลลับ ต้องตรวจ Markdown ก่อนส่ง ข้อมูลใน URL path/ข้อความอิสระอาจยังละเอียดอ่อน

Export เป็น private โดยปริยาย และ `kind: security` ถูกห้าม export เป็น public เพื่อใช้ช่องทางส่วนตัวที่ตกลงกับผู้ดูแล การตั้ง kind เป็นข้อมูลที่ผู้รายงานระบุ เครื่องมือไม่ได้จำแนกช่องโหว่จากข้อความทุกชนิดแทนผู้ใช้

ไม่มี database, SDK หรือ npm dependency เพิ่ม มี helper ใหม่หนึ่งไฟล์และ reference หนึ่งไฟล์ การจัดรายการ/หา duplicate อ่านทีละรายงานและเก็บเฉพาะ summary/ID ที่จำเป็น ไม่โหลดทุก report body ค้างไว้พร้อมกัน จำกัด 1000 รายงานต่อ store, 512 KB ต่อ record และ 100 history events รายงานเป็น local bookkeeping ไม่ใช่ audit log ที่มีลายเซ็น และ Windows ยังใช้ inherited ACL

## การยืนยัน

ผลทดสอบรุ่นนี้ **235 กรณีผ่าน, 1 POSIX case ข้าม** โดยนับ Windows smoke เพียงครั้งเดียวแม้รันสอง PowerShell versions ในนี้มี Reporting 23 กรณี รวมการแยกความรับผิดชอบ, upstream ไม่ปิดเป็นแพตช์ของเรา, การแก้รายงาน/รักษาประวัติ, duplicate hints, privacy, public-security export, path/lock/ขนาดข้อมูล และการใช้งานภาษาไทยผ่าน entry point

อ่าน [ผลทดสอบทั้งหมด](VALIDATION-1.6.0.th.md), [metrics](audit/release-1.6.0-metrics.json) และ [คู่มือสำหรับ agent/ผู้ดูแล](web-debug/references/reporting.md) ช่องทางเครือข่ายและการติดตั้ง global ไม่ได้ถูกเปิดหรือแก้ไข
