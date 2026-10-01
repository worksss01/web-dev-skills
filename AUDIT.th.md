# Adversarial review — Web Debug 1.3.0 → 1.4.0

ตรวจวันที่ 28 กันยายน 2026 เป้าหมายคือหาข้อบกพร่องในเครื่องมือและคำสั่งสกิล แล้วแก้ไขโดยรักษาความสามารถเดิม การทดสอบโจมตีใช้ไฟล์ sentinel, HTTP fixture, Chrome profile และ repository จำลองในพื้นที่งาน ไม่โจมตีเว็บไซต์หรือบัญชีของบุคคลอื่น

**ยืนยันปัญหาเดิมได้ 15 ประเด็นและแก้แล้ว** พร้อมเพิ่มการป้องกันอื่นที่มี regression tests รองรับ ระดับความสำคัญด้านล่างเป็นลำดับแก้ไขของเครื่องมือ local ไม่ใช่คะแนน CVSS และไม่ได้หมายความว่าโจมตีจากเว็บไซต์ภายนอกได้โดยไม่ต้องมีเงื่อนไขอื่น

## ปัญหาที่ทำซ้ำได้ในรุ่นเดิม

| # | ประเด็น / ความสำคัญ | ผลที่พบ | การแก้ใน 1.4.0 |
|---|---|---|---|
| 1 | Input/output ชนกัน — สูง | กำหนด output เป็น input ของ copy/analyze แล้วไฟล์ต้นฉบับถูกเขียนทับ | ตรวจพาธจริงและ hardlink identity ก่อนเขียน รวมถึง output ของ screenshot/trace |
| 2 | ตัวเลือก CLI ผิดถูกมองข้าม — กลาง | ใส่ option ที่ไม่มีอยู่ แต่คำสั่งยังสำเร็จได้ | ระบุ options ของแต่ละคำสั่งและปฏิเสธสิ่งที่ไม่รู้จัก |
| 3 | Boolean กลายเป็นตัวเลข — กลาง | true ถูกตีความเป็น 1 ในตัวตรวจค่าตัวเลข | ปฏิเสธ boolean/null/ข้อความที่ไม่ใช่ตัวเลข |
| 4 | รายงานขัดแย้งแต่ยังบอกสำเร็จ — กลาง | ok=true พร้อม step ที่ล้มเหลว ยังได้ scenarioPassed=true | ตรวจความสอดคล้องและไม่ให้ capture ที่ขัดแย้งผ่าน |
| 5 | Inline URL payload ถูกส่งออก — กลาง | data:/javascript: URL เก็บข้อความ payload ไว้ในรายงาน | ตัด payload และจำกัดความยาว URL ที่ใช้แสดงผล |
| 6 | Snapshot หลุดผ่าน junction — สูงตามบริบท | reader อ่านไฟล์ภายนอก cache ผ่าน snapshots junction ได้ | ตรวจขอบเขตหลัง resolve links สำหรับ cache/ledger/history |
| 7 | ความรู้ดูพร้อมใช้ทั้งที่หลักฐานหาย — กลาง | snapshot หายและวันที่ review ผิดรูปแบบ แต่ status ไม่เตือน | ตรวจไฟล์/hash และจัดวันที่ผิดหรืออยู่อนาคตเป็นข้อมูลต้องทบทวน |
| 8 | Output symlink เขียนทับ target — สูงตามบริบท | เขียน JSON ผ่าน symlink แล้ว sentinel ปลายทางถูกเปลี่ยน | ปฏิเสธ linked/non-file targets และใช้ temporary file + replacement |
| 9 | CDP ผิดรูปแบบทำโปรเซสล้ม — กลาง | รับ JSON null/ข้อมูล event ผิดแล้วเกิด uncaught error | ตรวจ envelope จับ callback errors และระบุหลักฐานไม่สมบูรณ์ |
| 10 | fill เปลี่ยน checkbox — กลาง | fill ที่ selector ชี้ checkbox คลิกเปลี่ยนสถานะก่อนพยายามพิมพ์ | ตรวจชนิด control ก่อน interaction |
| 11 | คลิก element ใต้ parent ที่มองไม่เห็น — กลาง | parent opacity=0 แต่ child ถูกคลิกได้ | ตรวจ visibility/opacity ของ ancestry และ disabled/inert |
| 12 | Plan ผิดท้ายรายการหลังเกิดผลบางส่วนแล้ว — กลาง | action ต้นทางทำงานไปก่อนพบ action สะกดผิดท้าย plan | validate ทั้ง plan ก่อนเริ่ม page actions |
| 13 | Trace หายเมื่อ assertion ล้ม — กลาง | หยุดก่อน traceStop จึงไม่มี trace ของเหตุการณ์ที่ผิด | finalize trace ไปยัง path ที่ประกาศไว้เมื่อทำได้ โดยคงสถานะทดสอบล้มเหลว |
| 14 | Design scan ทำงานเกิน sample limit — ประสิทธิภาพ | หน้าจำลอง 2,000 elements อ่าน computed style 4,500 ครั้ง แม้เลือก 500 ตัวอย่าง | หยุดเมื่อเก็บตัวอย่างครบ; เหลือ 1,001 ครั้งใน fixture เดิม |
| 15 | Unicode เสียใน Windows stdout — การใช้งาน | พาธไทยใน stdout ไม่ตรงกับ JSON ที่บันทึก ทั้ง PowerShell 7/5.1 | ส่ง Unicode escapes ใน JSON stdout โดยไม่เปลี่ยน console settings; ไฟล์ยังเป็น UTF-8 |

หลักฐานก่อนแก้: [ทั่วไป](audit/baseline-findings.json), [Chrome](audit/baseline-browser-findings.json), [Windows](audit/baseline-windows-findings.json)

ข้อสงสัย “fill ข้อความว่างไม่ล้าง input” ถูกทดสอบแล้ว **ไม่พบปัญหาใน baseline** จึงไม่กล่าวว่าเป็นบั๊ก และเก็บ regression case ไว้เพื่อรักษาพฤติกรรมที่ทำงานถูกต้อง

## การป้องกันและความทนทานเพิ่มเติม

- เช็ก focus หลังคลิกและหลัง select-all ก่อนใส่ข้อความ เพื่อลดการพิมพ์ผิดช่องเมื่อ handler เปลี่ยน focus
- ใช้ operation lock สำหรับคำสั่งที่เปลี่ยน browser ซึ่งอ้างถึง state directory เดียวกัน และไม่ล้าง emulation ที่ run นั้นไม่ได้เปลี่ยน
- waitFor ใช้เวลาที่เหลือจริงกับการ evaluate; ทดสอบ promise ที่ไม่ resolve และยืนยันว่า timeout ทำงาน
- จำกัดขนาด input/response และ event payload; เมื่อหลักฐานถูกตัดจะไม่ยืนยันว่าไม่มี event ที่อาจหายไป
- อ่าน JSON ที่มี UTF-8/UTF-16 BOM ได้ และไม่สรุป report ที่ว่าง/ผิดรูปแบบว่าเป็นหลักฐานสำเร็จ
- หา executable จาก absolute PATH แทนการปล่อยให้ไฟล์ชื่อเดียวกันใน working directory มีโอกาสถูกเรียกก่อน
- ติดตั้งผ่าน staging ตรวจไฟล์ และติดตั้งซ้ำแบบเดิมได้; ไฟล์ที่ต่างหรือผู้ใช้แก้ยังถูกเก็บไว้
- เขียน metadata/report แบบ replacement และตรวจ schema ของ knowledge ledger ก่อนเปลี่ยนข้อมูล

นี่เป็นการลดข้อผิดพลาดและขอบเขตเสี่ยงที่ทดสอบได้ ไม่ใช่การสร้าง sandbox ใหม่ให้ Node/PowerShell

## ความขัดแย้งและการทำงานร่วมกัน

| ส่วนที่อาจขัดกัน | ข้อกำหนดที่คงไว้และตรวจความสอดคล้อง |
|---|---|
| SEO กับ privacy/security | ต้องระบุเจตนา indexing; ไม่เอา noindex ออกจากหน้าส่วนตัวเพื่อให้รายงานดูดี |
| AEO กับภาษาที่เป็นธรรมชาติ | ไม่บังคับ FAQ/keyword formula และไม่แต่งหลักฐานหรือความเชี่ยวชาญ |
| Design กับ accessibility | ตรวจภาพและบริบท; ขนาด/contrast เป็นข้อมูลประกอบ ไม่ใช่ beauty/compliance score |
| Security กับการใช้งาน | ตรวจ policy กับ flow ที่ถูกต้อง ไม่ปิด TLS/CORS/sandbox หรือใส่ policy สำเร็จรูปเพื่อซ่อนอาการ |
| Cloudflare กับ GitHub CI | แยก local build, commit/check, deployment และ URL ที่ให้บริการจริง |
| Windows กับ WSL/เครื่องอื่น | runtime/session เป็นข้อมูลเฉพาะเครื่อง; snapshot เป็น relative path และต้องย้ายพร้อมไฟล์ |
| Codex กับ Claude Code | ใช้ SKILL.md และ Node scripts ชุดเดียวกัน ไม่มี provider browser SDK/MCP เป็น dependency |
| สกิลอื่นกับ host rules | สกิลนี้ไม่ทับสิทธิ์หรือ workflow ที่ host/repository กำหนด และไม่ขยายอำนาจจากการมี tool |

ตรวจเส้นทางอ้างอิงในเอกสารและลดข้อความเริ่มต้นของ SKILL.md ให้เป็นตัวเลือกตามงาน รายละเอียดเฉพาะด้านยังอยู่ครบและอ่านเมื่อเกี่ยวข้อง เอกสารอธิบายพฤติกรรมใหม่เรื่อง trace failure, locks, incomplete evidence และ Unicode ให้ตรงกับโค้ดแล้ว

## สิ่งที่ทำให้เบาขึ้น

1. มีทางเข้าเดียว `debug.mjs`; ไม่ต้องจำชื่อ helper หลายไฟล์ คำสั่งเดิมยังใช้ได้
2. เมื่อบันทึก `--out` ทางเข้าใหม่แสดงผลย่อ แต่หลักฐานเต็มยังอยู่ในไฟล์ และเรียก `--full` ได้
3. อ่าน reference เฉพาะงาน ลดข้อความใน SKILL.md ที่ทุกครั้งต้องโหลด โดยไม่ลบคู่มือความสามารถ
4. Design audit หยุดเมื่อครบ sample และ copy metrics นับแบบวนทีละ segment แทนสร้างอาร์เรย์ segment ทั้งข้อความ
5. ZIP แบบติดตั้งมีเฉพาะสกิล ส่วนชุดทดสอบ/ภาพ/รายงานอยู่ในชุดเต็ม ไฟล์สกิลทั้งสองแบบเท่ากันทุก byte

ตัวเลขที่วัดได้อยู่ใน [optimization.json](audit/optimization.json): รวมขนาด entry/README, จำนวน style reads และ stdout ของ capture ตัวอย่าง ไม่ควรตีความเปอร์เซ็นต์เหล่านี้เป็นความเร็วที่เพิ่มขึ้นเท่ากันทุกเว็บไซต์ โค้ดสำหรับป้องกันข้อผิดพลาดเพิ่มขึ้น และชุดเต็มอาจใหญ่ขึ้นเพราะมี tests มากขึ้น

## ขอบเขตที่ยังเหลือ

- Eval, raw CDP และ file paths ใน plan ยังเป็นความสามารถที่ต้องใช้กับ input ที่เชื่อถือได้ เครื่องมือไม่ได้ sandbox สิทธิ์ทั้งหมดของโปรเซส
- Cache/link guards ป้องกันกรณี static ที่ทดสอบ ไม่ป้องกัน local actor ที่มีสิทธิ์เท่ากันและเปลี่ยนโค้ด/สลับ filesystem ระหว่างดำเนินการทั้งหมด
- Lock ใช้ร่วมกันเมื่อใช้ state directory เดียวกันเท่านั้น; DevTools, external endpoints หรือ state ที่คัดลอกไปยังอีก directory ต้องประสานกัน
- URL redaction ไม่ล้างข้อมูลลับในทุก console string, DOM, ภาพหรือ trace ต้องตรวจหลักฐานก่อนแชร์
- Network/OS resolver และบริการภายนอกยังมีข้อจำกัดของสภาพแวดล้อม; host ควรใช้ process timeout ที่เหมาะสม ไม่ถือว่า logical timeout ทุกตัวรับรอง deadline ของ OS ทั้งหมด
- ยังไม่ได้รัน live Claude Code session, macOS/Linux, Node 22.4, authenticated GitHub/Cloudflare หรือทดสอบทุก Chrome version ขอบเขตที่ตรวจจริงอยู่ใน [VALIDATION.th.md](VALIDATION.th.md)
- ข้อมูลความรู้จากเว็บและคำแนะนำของโมเดลยังต้อง semantic review; hash, tests และไฟล์เอกสารไม่ใช่การรับรองว่าไม่มีข้อผิดพลาดเหลืออยู่

## รันทดสอบซ้ำ

จากชุดเต็ม ในพื้นที่โครงการที่อนุญาตให้สร้าง `work/`:

```powershell
node --test tests/unit.test.mjs tests/diagnostics.test.mjs tests/platforms.test.mjs tests/quality.test.mjs tests/adversarial.test.mjs
node tests/browser-smoke.mjs --work work/browser-check
node tests/adversarial-browser.mjs --work work/adversarial-browser-check
node tests/package-smoke.mjs --work work/package-check
node tests/windows-smoke.mjs --work "work/windows-check ภาษาไทย"
```

Tests ปิด Chrome/HTTP server ที่สร้างเอง แต่เก็บ artifacts/profile ใน work เพื่อให้ตรวจย้อนหลังได้ ไม่ลบหรือเปลี่ยนข้อมูลโปรไฟล์ Chrome ส่วนตัว
