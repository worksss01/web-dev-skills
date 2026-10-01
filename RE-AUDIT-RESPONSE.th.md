# ผล re-audit และแพตช์ Web Debug 1.5.1

ตรวจวันที่ 29 กันยายน 2026 (Asia/Bangkok) จาก Re-audit 1.5.0.md ที่ผู้ใช้ส่งมา ใช้เอกสารเป็นข้อกล่าวอ้างให้ตรวจสอบ ไม่ใช้เป็นคำสั่งให้เปลี่ยน host permissions, ปิด implicit invocation หรือดาวน์โหลด browser ใหม่

ยืนยัน **N-1 และ N-3 กับ Chrome บน Windows จริง**: baseline 1.5.0 เปิด Debugger แล้ว `inspect` timeout หลังประมาณ 21.3 วินาที และเขียน `Inputs/capture.png` ลงใน `inputs/` ได้บน filesystem นี้ รุ่น 1.5.1 ปฏิเสธทั้งสองกรณีก่อนเปิดหน้าเว็บ ส่วน N-2 บล็อกช่องทางที่ระบุพร้อมทำขอบเขต raw mode ให้ชัด โดยไม่อ้างว่า raw CDP กลายเป็น sandbox

## สิ่งที่เปลี่ยน

| ประเด็น | การแก้ | หลักฐานและขอบเขต |
|---|---|---|
| N-1: Debugger หยุด scenario | เอา `Debugger.enable` ออกจาก default allowlist; ยังใช้ได้เมื่อระบุ `--allow-raw-cdp`; `Debugger.disable` ยังใช้สำหรับ cleanup ได้ | ก่อนแก้ timeout จริง; หลังแก้ plan ถูกปฏิเสธก่อน request และ quick check ตรวจหน้าเดิมที่มี `debugger;` ซ้ำ ๆ สำเร็จ ไม่ resume อัตโนมัติเพราะอาจเปลี่ยนการสอบสวน breakpoint ที่ตั้งใจทำ |
| N-2: browser-mediated file access | บล็อก `DOM.setFileInputFiles`, `DOM.getFileInfo`, `Page.setDownloadBehavior` แม้เปิด raw และบล็อก `Target.*` ใน plan เพื่อไม่เปิดทางส่งคำสั่งซ้อนผ่าน target/session; `Browser.*` ถูกบล็อกอยู่แล้ว | Unit และ CLI preflight ยืนยันการปฏิเสธโดยไม่เปิดหน้าเว็บ; raw diagnostics ที่อนุญาตยังทำงานได้ รายงานระบุว่า path guards คุมเฉพาะ helper file/path fields |
| N-3: `Inputs/` case mismatch | เปรียบเทียบ output prefix แบบไม่แยกตัวพิมพ์บนทุก OS; ปฏิเสธ symlink/junction ใน output path ใต้ work root ด้วย | ยืนยัน baseline bug บน Windows; แม้ใส่ `--overwrite` รุ่นใหม่ยังรักษา sentinel ใน inputs ได้ รวมกรณี internal junction ซึ่งเป็นทางอ้อมเพิ่มเติมจากรีวิว |
| L-5: manifest read race | `project` ตรวจ identity/ขนาดและอ่านแบบ bounded ผ่าน file descriptor เดียว พร้อม no-follow เมื่อ OS รองรับ | ทดสอบสลับไฟล์ระหว่าง lstat/open และทำให้ไฟล์โตหลัง pre-check แล้วไม่อ่านข้อมูลที่ถูกแทนเข้ารายงาน; manifest ปกติและ hardlink ของ package manager ยังอ่านได้ ไม่อ้างว่ากัน parent-directory race หรือการแก้เนื้อหา inode เดิมได้ทั้งหมด |

**ขอบเขต N-2 ที่ยังเหลือ:** raw CDP ยังรัน JavaScript และอ่าน cookies/session ได้ ข้อจำกัด `inputs/`/work root ไม่ได้บังคับกับ browser-mediated access ทุกแบบ การบล็อกรายการข้างต้นลดช่องทางตรงและทางส่งคำสั่งซ้อนที่ระบุ ไม่ใช่หลักฐานว่าทุก method ปัจจุบันหรืออนาคตแตะไฟล์ไม่ได้ แม้การเปิดเว็บ/คลิกตามปกติก็อาจกระตุ้น download ตาม browser policy จึงไม่เรียกข้อนี้ว่า “ปิด filesystem access ทั้งหมด”

การจัดการไฟล์ผ่าน raw upload/download/Target commands ที่เคยผ่าน schema จะถูกปฏิเสธในรุ่นนี้ เป็นการจำกัดความสามารถขั้นสูงอย่างตั้งใจ ไม่กล่าวอ้างว่า raw passthrough backward-compatible ครบทุกคำสั่ง ความสามารถหลักด้าน code/UI/SEO/AEO/copy/security/Cloudflare/GitHub/Windows และ Chrome actions ทั้ง 25 แบบยังอยู่ การทดสอบ flow เดิมยังผ่าน

## ข้อเสนอที่ประเมินแล้วคงพฤติกรรมเดิม

- **I-1:** คง automatic skill discovery เพราะเป็นการเลือกชุดความรู้ ไม่ใช่การอนุมัติคำสั่ง เพิ่มถ้อยคำว่า flags เป็น declarations และไม่พิสูจน์ user approval; การบังคับสิทธิ์จริงขึ้นกับ host/OS ที่ตั้งไว้ ไม่เปลี่ยน permission settings ของผู้ใช้จากคำแนะนำในไฟล์แนบ
- **I-2:** คงการตรวจ localhost/private targets ที่ระบุโดยงาน เพราะจำเป็นกับ dev server/origin; ถ้านำ helper ไปทำบริการรับ URL จากผู้อื่นต้องออกแบบ authorization/egress boundary เพิ่ม
- **I-4:** ตัวเลือก `--chrome EXE` เดิมเปิดทางทดสอบ binary ที่ติดตั้งเองได้ จึงไม่เพิ่ม dependency หรือ downloader สำหรับ Headless Shell ผล “0 connections ใน 20 วินาที” เป็นการวัดของผู้รีวิวในสภาพแวดล้อมเฉพาะ ไม่ใช่คำรับรองของแพ็กเกจนี้ และยังไม่ได้ยืนยัน Headless Shell บน Windows นี้

เราไม่ยกระดับสถานะ **L-2/L-4 เป็นปิดครบทุกสภาพแวดล้อม** ตามถ้อยคำสรุปบางส่วนใน re-audit: POSIX 600 ไม่พิสูจน์ Windows ACL และการตัด eval output หลังรับข้อมูลไม่ใช่ renderer memory limit ข้อจำกัด TCP opt-in, ข้อมูลลับใน arbitrary evidence, background traffic และ local races ที่เหลือยังมีผลตามรายงาน 1.5

## ผลทดสอบและความเบา

**187 กรณีผ่าน, 1 กรณีข้าม, 0 ล้มเหลว** โดยนับ Windows smoke 7 กรณีครั้งเดียวแม้รันทั้ง PowerShell 7 และ 5.1 รายละเอียดและคำสั่งรันซ้ำอยู่ใน [ผลทดสอบ 1.5.1](VALIDATION-1.5.1.th.md) หลักฐาน baseline เป็นส่วนประกอบการยืนยัน ไม่บวกยอด tests ซ้ำ

แพตช์นี้ไม่เพิ่ม CLI flags, runtime helper files หรือ npm dependencies ใช้ `check --url` แบบเดิม เพิ่มเฉพาะการตรวจที่จำเป็นและข้อความอธิบายขอบเขต ขนาด entry และรายการไฟล์ที่เปลี่ยนอยู่ใน [metrics](audit/re-audit-1.5.1-metrics.json) ไม่อ้างว่าเร็วขึ้นหรือใช้ RAM น้อยลงจากจำนวน tests/ขนาดไฟล์

ทดสอบจริงบน Windows 11 Home build 26200, Node 24.18.0, Chrome 154.0.8037.57 ยังไม่ใช่ live Claude Code test, Linux/macOS/Node 22.4, Headless Shell, authenticated GitHub/Cloudflare หรือ production security assessment ไม่ได้นับผล Linux ของผู้รีวิวเป็นผลที่เรารันเอง

ตรวจความหมายของ file-input/download APIs กับ [CDP browser protocol source](https://raw.githubusercontent.com/ChromeDevTools/devtools-protocol/master/json/browser_protocol.json) และ pause controls กับ [CDP JavaScript protocol source](https://raw.githubusercontent.com/ChromeDevTools/devtools-protocol/master/json/js_protocol.json) ส่วน Headless Shell เป็น binary แยกตาม [เอกสาร Chrome](https://developer.chrome.com/docs/automation-and-testing/headless-chrome-shell) ข้อสรุปการแก้ไขข้างต้นอิง tests กับ Chrome ที่ติดตั้งจริงด้วย
