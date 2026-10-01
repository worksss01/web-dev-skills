# Validation 1.6.2

วันที่ 1 ตุลาคม 2026

ผลที่รันในเครื่อง Windows บน Node.js 24.18.0:

- Unit / security / reporting / installer: ผ่าน 130 จาก 131 กรณี ข้าม 1 กรณีที่ตรวจ POSIX file permissions; ล้มเหลว 0
- Installer และ portable knowledge ledger: ผ่าน 14 กรณี
- Skill validator: ผ่าน
- สร้าง ZIP ครบ 3 แบบ ตรวจไฟล์และลิงก์ภายใน โดย executable helpers ใน Cowork เหมือน core
- เปิด GitHub Issues และ private vulnerability reporting สำเร็จ ตรวจค่ากลับจาก GitHub API

CI แยกตรวจ Windows/Linux บน Node 22/24; ดูผลจริงของ commit ในหน้า Actions ไม่ถือว่าการเพิ่ม workflow แปลว่ารันผ่านแล้ว ไม่ได้รันทดสอบ Chrome จริงหรือ Cowork runtime ใหม่ในรุ่นเอกสารนี้ ไม่สร้าง issue ทดลองสาธารณะ และไม่อ้างว่าการส่งผ่านบัญชีของผู้ใช้ทุกคนผ่านการทดสอบแล้ว

หลักฐานรุ่นเก่าคงวันที่และเวอร์ชันเดิม การเผยแพร่ ZIP ไม่ได้เปิด automatic updates ให้สำเนาที่ติดตั้ง
