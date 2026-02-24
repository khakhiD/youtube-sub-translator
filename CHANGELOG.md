# Changelog

## v0.2.0 (2026-02-25)

### Features
- **설정 패널** — 확장 프로그램 팝업으로 설정 변경 (번역 on/off, 원문 표시, 글자 크기, 투명도 등)
- **드래그 가능한 오버레이** — 자막 위치를 드래그로 이동
- **번역 파이프라인** — Google Translate 비공식 API (en → ko), 응답 캐시 50건
- **자막 중복 제거** — bigram Dice coefficient 유사도 비교 (threshold 0.85)
- **OCR 전처리** — grayscale → 이진화(threshold 180) → 1px dilation → 2x upscale → padding
- **문자 화이트리스트** — tesseract가 영어 자막 문자만 인식하도록 제한
- **OCR 후처리** — 노이즈 라인 필터링 (알파벳 비율 40% 미만 제거)
- **네이티브 해상도 캡처** — DOM 축소 없이 비디오 원본 해상도로 캡처

### Fixes
- offscreen document에서 blob: Worker CSP 차단 → 파일 기반 Worker 로드로 해결
- 메시지 라우팅 충돌 → OCR_PROCESS 타입 분리
- ROI 선택 오버레이 중첩 방지
- 토글 스위치 클릭 안 되던 버그 수정
- ROI 표시가 거슬림 → 1.5초 후 fade out

## v0.1.0 (2026-02-25)

### Features
- Chrome Extension MV3 스켈레톤
- 유튜브 비디오 위 자막 오버레이 (Shadow DOM)
- ROI 드래그 선택 UI
- 주기적 비디오 프레임 캡처
- tesseract.js OCR (offscreen document)
