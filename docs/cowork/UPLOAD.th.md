# ไฟล์สำหรับหน้า Upload a skill

ใช้ `web-debug-cowork-1.6.2.zip` ทั้งไฟล์กับหน้าในภาพ ไม่ต้องแตก ZIP และไม่ต้องเลือก SKILL.md แยก เพราะสกิลมี references และ scripts ประกอบ

1. ดาวน์โหลด ZIP จาก [GitHub Releases](https://github.com/worksss01/web-dev-skills/releases/latest)
2. คลิกช่อง **Skill file / browse** หรือ drag-and-drop ZIP ลงในช่อง
3. กด **Upload** และรอผล **Security scan**
4. เมื่อระบบรับไฟล์แล้ว ตรวจว่ามี `web-debug-cowork` ในรายการ Skills และเปิดใช้หากบัญชีแสดงตัวเลือกนี้

ทดสอบเริ่มต้นด้วยข้อความ:

```text
ใช้ web-debug-cowork ตรวจความพร้อมของ runtime ก่อน
บอก Node.js version, platform และว่ามี Chrome/Chromium ที่รันผ่าน CDP โดยตรงได้หรือไม่
แยกผลที่ตรวจจริงออกจากสิ่งที่ยังไม่ได้ทดสอบ
หากรันไม่ได้ ให้แจ้งข้อจำกัดและใช้เฉพาะข้อมูล/ไฟล์ที่ฉันให้มา
```

ไฟล์นี้เป็น adaptation สำหรับ Cowork ของ base 1.6.2 มี root folder เดียวชื่อ `web-debug-cowork`, SKILL.md ที่มี name/description ใน YAML และ description 155 ตัวอักษร ไม่มี PACKAGE-INFO.txt ที่ root หรือ metadata UI ของ Codex

รุ่น 1.6.2 ตรวจโครงสร้าง ZIP และ local links 19 จุด พร้อมยืนยันว่าสคริปต์เหมือน core ผลย้อนหลังของ 1.6.1 ทดสอบ helper แบบ local ผ่านสามรายการ: เปิด entry point, สร้าง Report และ export Markdown ดู [package validation](package-validation.json) และ [local smoke](local-smoke-validation.json)

**ยังไม่ได้อัปโหลดหรือรันใน Cowork จริง** จึงยังไม่ยืนยันว่าจะผ่าน security scan ของบัญชีนี้ หรือว่า Cowork มี Node/Chrome/สิทธิ์ครบ การอัปโหลดสำเร็จก็ไม่เท่ากับควบคุม Chrome บน Windows ของผู้ใช้ได้แล้ว

สกิลจะใช้ direct CDP เฉพาะเมื่อ execution runtime รองรับ ตามเงื่อนไขเดิมของผู้ใช้ ไม่สลับไปใช้ Cowork built-in browser, Claude in Chrome หรือ provider browser-control tools เอง ถ้ารันไม่ได้จะวิเคราะห์โค้ด/หลักฐานและทำรายงานแบบ manual พร้อมระบุว่ายังไม่ได้ execute helper

Cowork โหลด skills จากบัญชี Claude แยกจาก personal Claude Code installation ตาม [เอกสาร Claude Code](https://code.claude.com/docs/en/skills#use-skills-in-cowork-and-cloud-sessions) ส่วนรูปแบบ custom skill/ZIP ดู [คู่มือสร้างสกิล](https://support.claude.com/en/articles/12512198-how-to-create-custom-skills) การรันของ Cowork แยกจากเครื่องผู้ใช้ตาม [รายละเอียด execution environment](https://support.claude.com/en/articles/13364135-use-claude-cowork-safely)

แพ็กเกจนี้ไม่มี report store, Chrome profiles, credentials หรือข้อมูลการติดตั้งส่วนบุคคล สำเนา Codex/Claude Code ที่ติดตั้งไว้เดิมไม่ได้ถูกแก้ไข
