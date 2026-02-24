# YouTube Sub Translator

유튜브 리액션 영상 등에서 **하드코딩된 자막**(영상에 직접 박힌 자막)을 OCR로 읽어 한국어로 번역해주는 Chrome 확장 프로그램.

[Changelog](CHANGELOG.md) · [Releases](https://github.com/khakhiD/youtube-sub-translator/releases) · [TODO](TODO.md)

## 주요 기능

- **ROI 선택** — 비디오 플레이어 위에서 드래그로 자막 영역 지정
- **OCR** — tesseract.js로 영어 자막 텍스트 추출 (offscreen document에서 실행)
- **실시간 번역** — Google Translate (en → ko)
- **오버레이** — 번역된 자막을 비디오 위에 표시, 드래그로 위치 이동 가능
- **중복 제거** — 동일 자막 반복 표시 방지 (bigram 유사도 비교)
- **설정 패널** — 확장 프로그램 아이콘 클릭으로 팝업 설정

## 설정 옵션

| 옵션 | 설명 | 기본값 |
|------|------|--------|
| 번역 활성화 | 번역 on/off | ON |
| 원문 함께 표시 | 원문 + 번역문 동시 표시 | OFF |
| 컨트롤 자동 숨김 | 마우스 호버 시만 버튼 표시 | OFF |
| 글자 크기 | 14–32px | 20px |
| 배경 투명도 | 0–100% | 50% |

## 기술 스택

- Chrome Extension Manifest V3
- TypeScript + Webpack
- tesseract.js v7 (WASM OCR, offscreen document)
- Google Translate 비공식 API
- Shadow DOM (스타일 격리)

## 설치 및 실행

```bash
# 의존성 설치
npm install

# 빌드
npm run build

# 개발 모드 (watch)
npm run dev
```

1. `chrome://extensions` 접속
2. 개발자 모드 ON
3. "압축해제된 확장 프로그램을 로드합니다" → `dist/` 폴더 선택
4. 유튜브 영상 페이지에서 "ROI 선택" 클릭 → 자막 영역 드래그

## 아키텍처

```
Content Script (유튜브 페이지)
├── overlay.ts      — 자막 오버레이 (Shadow DOM)
├── roi-selector.ts — ROI 드래그 선택
├── capture.ts      — 비디오 프레임 캡처
├── preprocess.ts   — OCR 전처리 (이진화, upscale)
├── ocr.ts          — OCR 요청 (→ Background로 메시지)
├── translator.ts   — Google Translate API
└── dedup.ts        — 자막 중복 제거

Background Service Worker
└── index.ts        — Offscreen 관리, 메시지 중계

Offscreen Document
└── offscreen.ts    — tesseract.js Worker 실행

Popup
└── popup.ts/html   — 설정 UI (chrome.storage)
```

## 라이선스

MIT
