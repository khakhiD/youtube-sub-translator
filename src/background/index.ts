import { CONFIG } from '../shared/config';

/**
 * Background Service Worker (MV3).
 * 현재는 최소 skeleton - 확장 설치/활성화 로그만 처리.
 *
 * TODO: Step 2+ 에서 popup ↔ content script 메시지 라우팅 추가
 * NOTE: MV3에서 service worker는 비활성 시 종료됨 (persistent: false)
 *       상태는 chrome.storage에 저장해야 함
 */

chrome.runtime.onInstalled.addListener(() => {
  console.log(CONFIG.logPrefix, 'Extension installed');
});

// TODO: 메시지 핸들러 추가 예정
chrome.runtime.onMessage.addListener((_message, _sender, _sendResponse) => {
  // Step 2+ 에서 구현
  return false;
});
