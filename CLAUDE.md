# YouTube Sub Translator - Chrome Extension

## Build & Dev
- `npm run build` - 프로덕션 빌드 (dist/ 폴더에 출력)
- `npm run dev` - 개발 모드 (watch)
- Chrome에서 테스트: `chrome://extensions` → 개발자 모드 → `dist/` 폴더 로드

## Architecture
- Chrome Extension Manifest V3, TypeScript + Webpack
- Content script → 유튜브 watch 페이지에 자동 inject
- Shadow DOM으로 오버레이 스타일 격리
- Offscreen document에서 tesseract.js OCR Worker 실행 (MV3 CSP 우회)
- 메시지 흐름: Content → (OCR_REQUEST) → Background → (OCR_PROCESS) → Offscreen → (OCR_RESULT) → Background → Content
- 설정: chrome.storage.local, popup에서 변경 → content script에서 onChanged로 실시간 반영

## Module Structure
- `src/content/` — index(오케스트레이터), overlay, roi-selector, capture, preprocess, ocr, translator, dedup
- `src/background/` — offscreen 관리, 메시지 중계
- `src/offscreen/` — tesseract.js worker 실행
- `src/popup/` — 설정 UI
- `src/shared/` — config, messages, settings, types

## Code Conventions
- TypeScript strict mode
- 모듈별 책임 분리 (단일 책임)
- 설정 상수: `src/shared/config.ts`, 사용자 설정: `src/shared/settings.ts`
- 하드코딩 금지, TODO 주석으로 임시 코드 표시
- MV3 제약사항은 코드 주석으로 이유 기록

## Key Constraints
- MV3 extension pages CSP: `script-src 'self' 'wasm-unsafe-eval'` — blob: Worker 사용 불가
- tesseract.js는 `workerBlobURL: false`로 파일 기반 로드 필수
- YouTube CSP: content script에서 Worker 생성 불가 → offscreen document 필요
- `chrome.runtime.sendMessage`는 모든 컨텍스트에 브로드캐스트 → 메시지 타입 분리 필수
