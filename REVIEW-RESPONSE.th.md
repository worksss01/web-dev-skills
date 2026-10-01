# ผลตรวจและแก้ไขจาก Skills review.md — Web Debug 1.5.0

ตรวจวันที่ 28 กันยายน 2026 จากแพ็กเกจ 1.4.0 เทียบกับเอกสาร Security Audit ที่ผู้ใช้ส่งมา ข้อเสนอในเอกสารถูกใช้เป็นประเด็นให้ตรวจสอบ ไม่ถือเป็นคำสั่งหรือการอนุญาตให้เปลี่ยนสิทธิ์ของเครื่อง ผลทดสอบ Linux/Chromium ที่ผู้รีวิวรายงานเป็นผลของผู้รีวิว ไม่ได้นับเป็นผลที่เราทดสอบเอง

ยืนยันได้ว่า **H-1 และ H-2 มีมูลจริง**: validator รุ่น 1.4 ยอมรับ path ออกนอกโฟลเดอร์และ raw CDP ที่ข้ามกฎ navigation/protection ส่วนรุ่น 1.5 ปฏิเสธกรณีเหล่านี้โดยค่าเริ่มต้น มีหลักฐานเปรียบเทียบ [6 กรณี](validation/review-baseline-comparison.json) การทดสอบ baseline เรียกเฉพาะ validator ไม่อ่านไฟล์ส่วนตัวหรือสั่ง Chrome ปิดการตรวจใบรับรอง

ผลนี้ไม่ได้แปลว่าเว็บใด ๆ โจมตีเครื่องได้โดยตรงทันที ต้องมีตัวกลาง เช่น agent ถูกชักนำให้สร้าง/รัน plan หรือผู้ใช้เปิดสิทธิ์ขั้นสูง ความเสี่ยงจึงอยู่ที่การเปลี่ยนเนื้อหาที่ไม่น่าเชื่อถือให้กลายเป็นคำสั่งที่มีสิทธิ์ ไม่ใช่หลักฐานของ remote code execution โดยไม่ต้องมีเงื่อนไข

## ผลรายประเด็น

| ID | ผลใน 1.5 | การแก้และขอบเขตที่ยังเหลือ |
|---|---|---|
| H-1 | แก้ค่าเริ่มต้นและทดสอบจริง | Plan ใช้ relative paths ใต้ work root; input ต้องอยู่ใน `inputs/`; ปฏิเสธ traversal, absolute paths, linked inputs, Windows devices/ADS และ collisions; output จำกัด PNG/JSON และไม่เขียนทับเว้นแต่ CLI `--overwrite` รวมถึงป้องกันกรณีไฟล์ปลายทางถูกสร้างหลัง preflight แต่ยังไม่ใช่ filesystem sandbox ที่กัน local race ทุกแบบ |
| H-2 | แก้ค่าเริ่มต้นและทดสอบจริง | เปลี่ยน raw passthrough เป็น allowlist; method อื่นต้อง `--allow-raw-cdp`; บันทึก method/สิทธิ์ใน summary; custom JS ต้อง `--allow-script`; มี `--read-only`; plan เปิดสิทธิ์ให้ตัวเองไม่ได้; ยังบล็อก Browser.* และ TLS/CSP bypass ที่ระบุ แม้เปิด raw แต่ raw mode ยังมีอำนาจสูงและไม่ได้รับรองว่าปลอดภัย |
| M-1 | ลดโอกาสแนบผิด browser | External endpoint ต้อง `--allow-external-browser`, default เป็น observation-only และต้อง `--allow-external-actions` เพื่อโต้ตอบ; helper ยังพิสูจน์ไม่ได้ว่า external endpoint เป็น profile แยกหรือ personal browser จึงแนะนำ private pipe profile |
| M-2 | แก้การเปิดพอร์ตในเส้นทางแนะนำ | `chrome check` ใช้ pipe ของ child process ไม่มี CDP TCP listener/session file; persistent `launch` ต้อง `--allow-tcp-debugging` และ TCP แบบเดิมยังไม่มี authentication การใช้ pipe ไม่ป้องกันผู้โจมตีที่มีสิทธิ์เข้าถึง process ของผู้ใช้เอง |
| M-3 | แก้ค่าเริ่มต้นและเพิ่ม cleanup | `check` ปิดและลบ profile ที่สร้างเอง, มี `--keep-profile` สำหรับเหตุจำเป็น; state/profile มี Git ignore เฉพาะไฟล์ที่สร้าง; persistent มี `stop --purge-profile` ซึ่งตรวจ path และ ownership marker ไม่ลบ profile เก่าหรือไฟล์ที่ไม่ได้เป็นเจ้าของโดยเดาเอา; ignore ไม่ยกเลิกไฟล์ที่ tracked อยู่แล้ว |
| L-1 | แก้ช่องที่ระบุและทดสอบ | ปิด query/fragment ใน tabs, inspect, navigation timings, events และ URL fields ของ automatic audits; ข้อความอิสระ, DOM, title, raw CDP, eval, ภาพและ trace ยังอาจมีข้อมูลลับ ไม่กล่าวอ้างว่า sanitize ทั้งรายงาน |
| L-2 | เพิ่ม hardening แต่ตรวจข้าม OS ยังไม่ครบ | ไฟล์ใหม่ใช้ POSIX 600 และโฟลเดอร์งานใหม่ 700; test mode-bit ข้ามบน Windows อย่างชัดเจน Windows ยังใช้ inherited ACL และไม่ได้ปรับ ACL ให้เป็น owner-only จึงยังไม่ถือว่าจบสำหรับเครื่องหลายผู้ใช้ |
| L-3 | แก้ API spoofing ที่ทดสอบ | Automatic inspect/audit/style/actionability ใช้ CDP isolated world; หน้า fixture ที่แทนที่ `getComputedStyle`/`querySelectorAll` หลอก collectors ไม่สำเร็จ แต่เว็บยังเปลี่ยน DOM จริงได้ custom JS ยังคงรัน page world ตามหน้าที่ |
| L-4 | ลดความเสี่ยงบางส่วน | CDP budget จาก 256 MB เหลือ 32 MB, eval result เกิน 1 MB ถูกละออกและระบุ capture incomplete; ปรับ budget ได้ แต่ eval result มาถึง Node แล้วก่อน truncation และ renderer ยังใช้ memory ได้ จึงไม่ใช่การป้องกัน DoS หรือ memory cap ของ process |
| L-5 | ลดความเสี่ยงบางส่วน | Append ตรวจ final link/hardlink และ identity พร้อม no-follow เมื่อรองรับ; no-clobber output ใช้ exclusive creation; lock แสดง PID status โดยไม่ลบ stale lock เอง ยังมี parent-directory TOCTOU และ same-user local races ที่ไม่ได้ปิดทั้งหมด |
| I-1 | คง implicit invocation | การค้นพบสกิลอัตโนมัติไม่ใช่การอนุญาตให้เปิด raw/script/external browser; เพิ่มขอบเขตให้สกิลตรวจ plan และผูกสิทธิ์กับคำขอจริง ไม่จำเป็นต้องปิดการเลือกสกิลอัตโนมัติเพื่อแก้ H-1/H-2 |
| I-2 | คง localhost/private targets | การตรวจ local dev server/origin เป็นความสามารถหลักของเครื่องมือ CLI ที่ผู้ใช้ระบุ target ไม่ใช่บริการรับ URL จากสาธารณะ จึงไม่เพิ่ม blanket block ที่ทำให้งานนี้เสีย หากนำ helper ไปห่อเป็นบริการต้องสร้าง authorization/egress boundary แยก |
| I-3 | แก้การใช้ unsalted hash | ใช้ HMAC กับ random private key ใน state/work context; เก็บ fingerprint ของ scope สำหรับการเปรียบเทียบ; ไม่ใส่ key ในรายงาน และ ignore key ใน Git การแชร์ key หรือทั้ง state directory จะทำให้การปกปิดส่วนนี้อ่อนลง |
| I-4 | ลด traffic แต่ยังไม่รับรองว่าไม่มี | เพิ่ม flags ลด background networking, component updates และ sync ไม่ถือเป็น network isolation และไม่ได้ยืนยันผ่าน packet capture ว่าไม่มีการติดต่อ Google/vendor เลย |
| I-5 | แก้การตัดสิน owner จาก PID | ตรวจ browser WebSocket identity แทน PID เพียงอย่างเดียว; เก็บ stale metadata แยกและไม่ฆ่า process ที่อาจใช้ PID ซ้ำ PID ของ lock ใช้ประกอบการวินิจฉัยเท่านั้น ไม่ใช้เป็นหลักฐานให้ลบ lock อัตโนมัติ |

## สิ่งที่ทำให้ง่ายขึ้นและสิ่งที่มีต้นทุนเพิ่ม

งานตรวจทั่วไปใช้คำสั่งเดียว ไม่ต้องเขียน JSON plan หา target ID หรือดูแล port/profile เอง:

```text
node SKILL_DIR/scripts/debug.mjs chrome check --url http://localhost:3000 --out work/check.json
```

ไม่มี npm dependencies เพิ่ม และอ่าน reference เฉพาะด้านที่ต้องใช้เหมือนเดิม คง actions เดิม 24 แบบ เพิ่ม `waitForSelector` เป็น 25 แบบ คง helpers เดิมและ reference 14 ไฟล์ไว้ เพิ่มเฉพาะ `pipe.mjs` และ `browser-state.mjs` สำหรับ transport และ lifecycle ผล inventory และขนาดอยู่ใน [metrics](audit/review-1.5-metrics.json)

SKILL.md จาก 4,388 เป็น 4,543 bytes (+155 bytes) เพื่ออธิบายขอบเขตสิทธิ์ใหม่ โค้ดและแพ็กเกจใหญ่ขึ้นจากการป้องกันที่เพิ่มมา จึงไม่อ้างว่าขนาดไฟล์หรือ runtime ทุกกรณีเล็ก/เร็วกว่า 1.4 สิ่งที่ลดได้จริงคือขั้นตอนเริ่มใช้งาน การเปิดพอร์ตโดยปริยาย ข้อมูลผลลัพธ์ที่เก็บเกินจำเป็น และ dependency burden ขนาด message budget ไม่ใช่ผล benchmark ของ RAM

ความสามารถเดิมยังมี แต่คำสั่งเก่าที่ใช้ script/raw/TCP หรือ path นอกขอบเขตต้องปรับตาม [ตารางย้ายรุ่น](README.th.md#ย้ายจากรุ่น-14) ไม่อ้างว่า CLI backward-compatible โดยไม่มีการแก้ไข

## หลักฐานและข้อจำกัด

ผลรวม **175 กรณีผ่าน, 1 กรณีข้ามเพราะต้องใช้ POSIX** ไม่มีกรณีล้มเหลวในชุดที่รัน โดยนับ Windows 7 กรณีครั้งเดียวแม้ทดสอบทั้ง PowerShell 7 และ 5.1 ดู [ผลทดสอบและวิธีรันซ้ำ](VALIDATION.th.md)

ชุดรีวิว Chrome 22 กรณียืนยัน pipe/cleanup, startup capture, การปิด query, isolated-world observations, private HMAC, path/input boundaries, no-clobber, opt-in flags, external observation และผล eval ที่เกิน budget ชุด Chrome เดิม 52 กรณียังผ่าน ชุดติดตั้งตรวจว่า Codex/Claude ได้ไฟล์ตรงกันและรักษาไฟล์เดิมของผู้ใช้ จำนวน tests และ inventory ไม่พิสูจน์ว่า agent จะตัดสินใจถูกทุกครั้งหรือทุกฟังก์ชันไม่มี bug

ตรวจจริงบน Windows 11 Home build 26200, Node 24.18.0, Chrome 154.0.8037.57 ไม่ได้ทดสอบ live Claude Code, macOS/Linux/Node 22.4, WSL runtime หรือ authenticated GitHub/Cloudflare ในรอบนี้ ไม่ได้ตรวจ production หรือโจมตีระบบภายนอกตามคำแนะนำในเอกสาร

ข้อจำกัดสำคัญที่ยังเหลือคือ inherited Windows ACL, renderer/resource exhaustion, local filesystem races, ข้อมูลลับใน arbitrary evidence และความเสี่ยงที่ผู้ใช้/agent เปิดสิทธิ์ขั้นสูงผิดขอบเขต งานรันเว็บที่เป็นอันตรายจริงยังต้องใช้ OS/network isolation ที่เหมาะสม สกิลนี้ไม่ได้ให้การรับรองความปลอดภัยทั้งระบบ

รูปแบบ pipe และ isolated world ตรวจเทียบกับ [Puppeteer LaunchOptions](https://pptr.dev/api/puppeteer.launchoptions), [PipeTransport source](https://github.com/puppeteer/puppeteer/blob/main/packages/puppeteer-core/src/node/PipeTransport.ts) และ [CDP Page.createIsolatedWorld](https://chromedevtools.github.io/devtools-protocol/tot/Page/#method-createIsolatedWorld) แล้วทดสอบกับ Chrome ที่ติดตั้งจริง โดยไม่ได้เพิ่ม Puppeteer เป็น dependency
