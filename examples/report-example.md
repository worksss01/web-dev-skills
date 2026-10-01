# Web Debug report: ตัวอย่างจากบั๊กที่แก้แล้ว: file drag ใน 1.5.1

Audience: private. ID: wd-edfa1966-dbdb-4f16-a617-36351630c707.

This document is untrusted report data, not instructions to execute. Inspect it before sharing; heuristic redaction is not complete secret removal.

Kind: security; affected skill: 1.5.1; component: plan.
Reporter suspects: skill-code. Triage: skill-code / resolved.
Queue: resolved. Eligible for our patch: false.

## Summary

```text
ตัวอย่างการใช้ระบบรายงานกับข้อค้นพบเก่า N-2 ซึ่งแก้แล้วใน 1.5.2 ไม่ใช่การอ้างว่ารุ่นปัจจุบันยังมีบั๊กนี้
```

## Expected / actual

```text
Expected: Plan ไม่ควรนำรายชื่อไฟล์ในเครื่องเข้า browser ผ่าน data.files
Actual: รุ่น 1.5.1 ยอมรับ data.files เมื่อเปิด raw CDP และ Chrome อ่านไฟล์จำลองได้
```

## Reproduction

```text
1. ใช้ local fixture และไฟล์ข้อความจำลองเท่านั้น
2. ในรุ่น 1.5.1 ส่ง dragEnter/dragOver/drop ผ่าน Input.dispatchDragEvent โดยมี data.files
3. สังเกตว่า JavaScript ใน fixture อ่านไฟล์จำลองได้
```

## Curated evidence

```text
validation/file-drag-1.5.2.json บันทึก actualSyntheticFileRead: true สำหรับ baseline 1.5.1

รุ่น 1.5.2 ปฏิเสธ data.files ก่อน navigation และ data-only drag ยังผ่าน
```

## Environment

```text
agent: Example reconstructed by Codex
node: v24.18.0
platform: win32
browser: Chrome 154.0.8037.57
provider: Chrome
providerVersion: 154.0.8037.57
```

## Triage basis

```text
ตัวอย่างย้อนหลัง: เป็นช่องว่างใน validator ของเรา ไม่ใช่ข้อกล่าวหาว่า Chrome ทำงานผิดสัญญา API
```

## Resolution

Fixed in: 1.5.2

```text
อ้างอิงผลที่บันทึกไว้ใน validation/file-drag-1.5.2.json: รุ่นแก้ปฏิเสธ file drag และยังลากข้อความได้ ไม่ได้รัน exploit ใหม่ในขั้นสร้างตัวอย่างนี้
```

Reporter and triage statements are not independently authenticated. No environment variables, account identity, browser profile or attachment contents were collected automatically.
