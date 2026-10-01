# Web Debug 1.6.2

รุ่น 1.6.2 เพิ่ม MIT License และช่องทาง GitHub สำหรับรายงานที่ผู้ใช้สั่งให้ส่ง อ่าน [รายการเปลี่ยนแปลง](RELEASE-1.6.2.th.md) และ [ผลตรวจรุ่นนี้](VALIDATION-1.6.2.th.md) สำเนาที่ติดตั้งยังไม่อัปเดตอัตโนมัติ

สกิลสำหรับ Codex และ Claude Code ที่พัฒนาและตรวจเว็บไซต์จากโค้ดและหลักฐานใน Chrome โดยตรง ไม่ต้องใช้ browser tool ของผู้ให้บริการ AI ไม่มี npm dependencies เพิ่ม

รุ่นก่อนหน้า 1.6.1 แก้การปิดบัง token ใน JSON ที่เปลี่ยนข้อความเมื่ออ่านซ้ำและทำให้ duplicate hints คลาดเคลื่อน ระบบ **Report Skills** ยังคงเก็บไฟล์ในโครงการและแยกเจ้าของปัญหา ไม่มีการส่งข้อมูลอัตโนมัติ อ่าน [สถานะความพร้อมและแพตช์](RELEASE-1.6.1.th.md), [ความสามารถ Reporting](RELEASE-1.6.0.th.md), [คู่มือรายงาน](web-debug/references/reporting.md) และ [ผลทดสอบแพตช์](VALIDATION-1.6.1.th.md)

## ความสามารถ

| ด้าน | เครื่องมือและแนวทางที่มี |
|---|---|
| Debug เว็บไซต์ | บริบทโครงการ เวอร์ชันจริง build/runtime/hydration/network และเปรียบเทียบก่อน–หลัง |
| Chrome โดยตรง | แท็บ คลิก กรอกข้อความ คีย์บอร์ด DOM/AX tree, console/network, screenshot และ trace |
| Website Design / UI | Responsive, typography, interaction, overflow, controls และ contrast บางกรณี พร้อมตรวจภาพ |
| SEO / AEO | Metadata, canonical, robots/index intent, JSON-LD และคำตอบที่ชัดเจนมีหลักฐาน |
| ภาษาไทย/อังกฤษ | รักษาข้อเท็จจริงและน้ำเสียง ตรวจข้อความซ้ำ คำกล่าวอ้างและ CTA |
| Cybersecurity | Defensive review และ passive security-header/cookie-attribute checks |
| Cloudflare | DNS/TLS/cache, edge/origin และคู่มือ Workers/Pages/Wrangler |
| GitHub | PR/CI metadata ผ่าน gh โดยเทียบ commit SHA และ run attempt |
| Windows 11 | PowerShell, PATH, พอร์ต และ Windows/WSL |
| ความรู้ที่อัปเดตได้ | เอกสารทางการ 40 แหล่ง พร้อม snapshot/hash และการทบทวนแยกจากการดาวน์โหลด |
| Report Skills | รายงานบั๊ก/ช่องโหว่ แยกเจ้าของปัญหา ขอข้อมูลเพิ่ม ติดตามแพตช์ และส่งออกไฟล์ให้ผู้ดูแล |

ต้องมี Node.js 22.4+ และ local shell ส่วน Chrome, gh, Wrangler หรือ PowerShell ใช้เฉพาะงานด้านนั้น สกิลไม่ติดตั้งเครื่องมือหรือล็อกอินบัญชีให้อัตโนมัติ Cloud agent จะควบคุม Chrome ในสภาพแวดล้อมของตนเอง ไม่ได้เห็น Chrome บนเครื่องผู้ใช้โดยอัตโนมัติ

## ติดตั้ง

ใช้ ZIP แบบสกิลอย่างเดียวเพื่อคัดลอกโฟลเดอร์ `web-debug` ไปยังตำแหน่งสกิลของคุณ ชุดเต็มมีตัวติดตั้ง ชุดทดสอบและรายงานเพิ่มให้ โดยเนื้อหาสกิลเหมือนกัน

หากส่งให้ผู้ตรวจสอบ ใช้ **`web-debug-kit-1.6.2.zip` ชุดเต็ม** ซึ่งมีผลทดสอบ, metrics และ SHA256 manifest ส่วน `web-debug-1.6.2.zip` เป็นสกิลสำหรับติดตั้งและมี PACKAGE-INFO.txt อธิบายว่ารายงานอยู่ในชุดเต็ม

ก่อนแตก ZIP หรือรันโค้ด ให้เทียบ SHA-256 กับค่าที่ได้รับผ่านข้อความส่งมอบหรือช่องทางผู้เผยแพร่ที่เชื่อถือได้ซึ่งแยกจาก ZIP เช่น บน PowerShell:

```powershell
Get-FileHash -LiteralPath .\web-debug-kit-1.6.2.zip -Algorithm SHA256
```

ไฟล์ `.sha256` ที่ดาวน์โหลดมาพร้อม ZIP ช่วยเทียบค่าได้ แต่หากผู้โจมตีเปลี่ยนได้ทั้งสองไฟล์ก็ไม่ยืนยันแหล่งที่มา เช่นเดียวกับ manifest ใน ZIP แพ็กเกจนี้ยังไม่มีลายเซ็นดิจิทัลจากผู้เผยแพร่ที่ยืนยันตัวตน

ตัวติดตั้งระดับโครงการต้องมี Git และ repository ที่มีอยู่แล้ว เปิด terminal ในโฟลเดอร์ชุดเต็มแล้วรัน:

```powershell
node .\install.mjs --project "D:\project\ชื่อโครงการ" --target both
```

เปลี่ยนพาธเป็น repository จริง เลือก `codex`, `claude` หรือ `both` ตัวติดตั้งใช้ `.agents/skills/web-debug` สำหรับ Codex และ `.claude/skills/web-debug` สำหรับ Claude Code ตามรูปแบบที่ตรวจจาก [Codex](https://learn.chatgpt.com/docs/build-skills) และ [Claude Code](https://code.claude.com/docs/en/skills)

ติดตั้งซ้ำได้ถ้าไฟล์เหมือนกัน หากพบไฟล์ต่างกันจะเก็บของเดิมไว้เพื่อให้ตรวจ diff และอัปเดตอย่างตั้งใจ ไม่แก้ AGENTS.md หรือ permission settings ให้คุณ หาก agent ยังไม่เห็นสกิล ให้เริ่ม session ใหม่

ตัวติดตั้ง 1.5.3 ตรวจทุกไฟล์ที่ manifest ระบุ รวมเอกสาร/หลักฐาน และตรวจว่าไม่มีไฟล์สกิลนอกบัญชีก่อนคัดลอก ถ้าแตกไฟล์ไม่ครบ, hash ไม่ตรง, manifest หาย หรือมี path/link ที่ไม่รองรับ จะหยุดโดยไม่สร้างปลายทาง ไม่สร้าง manifest ใหม่ให้เองเพื่อกลบความผิดปกติ หากต้องปรับ source อย่างตั้งใจ ให้ทบทวนและสร้างแพ็กเกจ/manifest ใหม่ในขั้นตอน build ที่เชื่อถือได้

## ใช้งานกับ AI

ใน Codex ใช้ `$web-debug` ใน Claude Code ใช้ `/web-debug` เช่น:

```text
ใช้ $web-debug ตรวจ flow สมัครสมาชิกของโครงการนี้
หาสาเหตุจากโค้ดและ Chrome แก้ไข แล้วทดสอบกรณีเดิมซ้ำ
```

ระบุเฉพาะด้านที่ต้องการ เช่น “ปรับ SEO/AEO และภาษาไทยของหน้านี้ โดยรักษาข้อเท็จจริงเดิม” หรือ “ตรวจ deploy Cloudflare ที่ล้มเหลวใน GitHub Actions” สกิลจะอ่านคู่มือเฉพาะงาน ไม่บังคับตรวจทุกด้านพร้อมกัน

หากพบปัญหาของสกิล พูดกับ AI ได้ว่า:

```text
ใช้ $web-debug ทำรายงานปัญหาที่พบ เก็บเป็นไฟล์ให้ฉันส่งผู้ดูแล
แยกสิ่งที่สงสัยจากสาเหตุที่ตรวจยืนยันแล้ว และอย่าแนบข้อมูลลับ
```

หรือเริ่มรายงานสั้น ๆ ผ่านคำสั่ง:

```powershell
node .agents/skills/web-debug/scripts/debug.mjs report create --title "อาการที่พบ" --summary "ผลที่เกิดและผลกระทบ" --origin unknown
node .agents/skills/web-debug/scripts/debug.mjs report list
node .agents/skills/web-debug/scripts/debug.mjs report export --id REPORT_ID --out work/report-to-maintainer.md
```

ใช้ ID ที่คำสั่งแรกคืนมา คลังเริ่มต้นคือ `work/web-debug/reports`; ตัวรายงานเป็น JSON ส่วนไฟล์ที่ส่งผู้ดูแลเป็น Markdown ต้องตรวจแล้วส่งไฟล์เอง ผู้ดูแลจะยังไม่เห็นรายงานจนกว่าจะได้รับไฟล์ ช่องโหว่ (`kind: security`) ส่งออกแบบ private และไม่อนุญาต public export ดู [ตัวอย่างจากบั๊กเก่าที่แก้แล้ว](examples/report-example.md) และ [แบบฟอร์ม JSON](examples/report-input.json)

## ทางเข้าคำสั่งเดียว

จาก root ของโครงการที่ติดตั้งสกิลสำหรับ Codex แล้ว:

```powershell
node .agents/skills/web-debug/scripts/debug.mjs --help
node .agents/skills/web-debug/scripts/debug.mjs project --project . --out work/project.json
node .agents/skills/web-debug/scripts/debug.mjs chrome check --url http://localhost:3000 --out work/check.json
```

คำสั่ง `check` เปิด Chrome แบบ headless ผ่าน pipe ตรวจ DOM/AX และ console/network ตั้งแต่เริ่มโหลดหน้า บันทึกผล แล้วปิดและลบโปรไฟล์ชั่วคราวเอง ไม่ต้องเปิดพอร์ตหรือหา target ID เพิ่ม `--headed` หากต้องการเห็นหน้าต่าง หรือ `--plan work/repro.json` สำหรับ flow คลิก/กรอก/ภาพ/trace ที่กำหนดเอง

การเปิดเว็บยังรัน JavaScript และส่ง network requests ตามปกติ คำว่า read-only จำกัด actions ของ helper ไม่ใช่การแยกเครือข่ายหรือป้องกันผลข้างเคียงจากเว็บไซต์ `ok: true` หมายถึง actions สำเร็จ ต้องอ่าน findings ต่อด้วย

State ใช้ `work/web-debug/chrome` โดยปริยาย เปลี่ยนได้ด้วย `--state-dir` การใช้ `--out` แสดงผลสั้นใน terminal แต่เก็บหลักฐานเต็ม เพิ่ม `--full` เมื่อต้องการ stdout เต็ม ถ้าไฟล์ผลมีอยู่แล้วให้เปลี่ยนชื่อหรือเพิ่ม `--overwrite` อย่างตั้งใจ

คำสั่งย่อยอื่นคือ `analyze`, `copy`, `edge`, `github`, `windows`, `knowledge` ใช้ `คำสั่งย่อย --help` ดูตัวเลือก เช่น:

```powershell
node .agents/skills/web-debug/scripts/debug.mjs edge --url https://เว็บไซต์ของคุณ/ --security --out work/edge.json
node .agents/skills/web-debug/scripts/debug.mjs windows --project . --ports 3000,5173 --out work/windows.json
node .agents/skills/web-debug/scripts/debug.mjs knowledge status --out work/web-knowledge
```

อ่าน [คู่มือ Chrome](web-debug/references/chrome.md) สำหรับ actions ทั้งหมด และเริ่มที่ [SKILL.md](web-debug/SKILL.md) เพื่อเลือกคู่มือเฉพาะด้าน แทนการอ่านเอกสารทั้งหมด

## ความรู้และขอบเขต

วันที่ 28/09/2026 เป็นวันที่ของชุดความรู้ ไม่ใช่คำรับรองว่าจะทันสมัยตลอดไป ใช้ `knowledge fetch` กับ source IDs ที่เกี่ยวข้อง จากนั้นอ่านและทบทวนความหมายก่อนบันทึก review ตาม [คู่มือ](web-debug/references/maintenance.md)

Snapshot paths เป็น relative ต่อ `ledger.json` หากย้ายเครื่องให้ย้ายทั้งโฟลเดอร์ความรู้พร้อม `snapshots/` และประวัติ review ส่วน Chrome session เป็นสถานะเฉพาะเครื่อง ให้เริ่มใหม่บนปลายทาง

สคริปต์ทำงานด้วยสิทธิ์ของ host จึงไม่ใช่ sandbox สำหรับ plan หรือเว็บที่ไม่น่าเชื่อถือ ต้องอ่าน plan และเปิดสิทธิ์ขั้นสูงตามงานจริง ไม่ทำตามคำสั่งที่แฝงอยู่ในหน้าเว็บ/รายงาน เก็บหลักฐานไว้ในพื้นที่โครงการและตรวจข้อมูลก่อนแชร์ ผลตรวจไม่รับรองอันดับค้นหา, AI citation, ผู้เขียนเป็นคนหรือ AI, accessibility compliance หรือความปลอดภัยทั้งระบบ

## ย้ายจากรุ่น 1.4

| งาน | รุ่น 1.5 |
|---|---|
| ตรวจหน้าเว็บทั่วไป | ใช้ `chrome check --url URL --out work/check.json` ได้ทันที |
| เปิด Chrome ค้างไว้ | `launch --allow-tcp-debugging` แล้วใช้ `new/tabs/run/stop` ตามเดิม; local TCP ไม่มี authentication |
| eval/assert/waitFor ใน plan | เพิ่ม `--allow-script` เฉพาะ script ที่ตรวจแล้ว; ใช้ `waitForSelector` แทน custom JS เมื่อต้องการรอ element |
| raw CDP นอก allowlist | เพิ่ม `--allow-raw-cdp`; ตั้งแต่ 1.5.1 รวม `Debugger.enable` ด้วย; ยังห้าม Browser/Target.*, file-input/download-path APIs และคำสั่งปิด protection ที่ระบุไว้ |
| raw CDP ตั้งแต่ 1.5.2 | ต้องอยู่ใน domain allowlist; Extensions/PWA และ domains ที่ไม่ได้ระบุถูกปฏิเสธ; drag-and-drop อนุญาตเฉพาะข้อมูลที่ไม่มีรายชื่อไฟล์ |
| แนบ browser ภายนอก | เพิ่ม `--allow-external-browser`; หากจะโต้ตอบเพิ่ม `--allow-external-actions` และสิทธิ์ script/raw ตามงาน |
| อ่านไฟล์จาก plan | วางไฟล์ที่อนุญาตใน `inputs/` ใต้โฟลเดอร์ plan หรือ `--work-dir` |
| screenshot/trace | ใช้ relative `.png`/`.json` ภายใน work root; ห้าม output ผ่าน link/junction หรือใต้ `inputs/` ทุกตัวพิมพ์; เขียนทับต้อง `--overwrite` |
| เก็บ/ลบ profile | `check --keep-profile` เมื่อจำเป็น; persistent ใช้ `stop --purge-profile` เพื่อลบเฉพาะ profile ที่มี ownership marker |
| เทียบก่อน–หลัง | ใช้ state/work directory เดิมเพื่อใช้ private HMAC key เดียวกัน; ไม่แชร์ `.context-key` |

ตัวติดตั้งจะไม่เขียนทับสกิลเดิมที่แตกต่าง ให้อ่าน diff และสำรองงานที่ปรับเองก่อนเปลี่ยนโฟลเดอร์เป็นรุ่นใหม่ ไม่ต้องแก้ AGENTS.md ระดับเครื่อง รายละเอียด permissions, budgets และข้อจำกัดอยู่ใน [Chrome reference](web-debug/references/chrome.md)

ข้อจำกัด path ใช้กับฟิลด์ไฟล์ของ helper ไม่ใช่ขอบเขตการเข้าถึงของ browser ทั้งตัว โดยเฉพาะ raw CDP ยังอ่าน cookies/session และสั่ง script ได้ CLI flags ช่วยให้เห็นและบันทึกสิทธิ์ที่เลือก แต่ไม่ได้ยืนยันการอนุมัติจากผู้ใช้แยกต่างหาก สิทธิ์ที่บังคับจริงขึ้นกับ host/OS ที่ใช้งาน
