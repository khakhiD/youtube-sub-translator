import { CONFIG } from '../shared/config';
import { MSG } from '../shared/messages';
import type { OcrRequestMessage, OcrProcessMessage, OcrResultMessage } from '../shared/messages';

/**
 * Background Service Worker (MV3).
 *
 * 역할:
 * - Offscreen document 생성/관리
 * - Content script ↔ Offscreen 간 OCR 메시지 중계
 *
 * NOTE: MV3에서 service worker는 비활성 시 종료됨.
 *       offscreen document도 함께 종료되므로 필요 시 재생성.
 */

let offscreenCreated = false;

/** Offscreen document 생성 (OCR worker 실행용) */
async function ensureOffscreen(): Promise<void> {
  if (offscreenCreated) return;

  // 이미 존재하는지 확인 (service worker 재시작 대비)
  const contexts = await chrome.runtime.getContexts({
    contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
  });

  if (contexts.length > 0) {
    offscreenCreated = true;
    return;
  }

  await chrome.offscreen.createDocument({
    url: 'offscreen.html',
    // WORKERS: offscreen에서 Web Worker 사용을 위한 reason
    reasons: [chrome.offscreen.Reason.WORKERS],
    justification: 'Tesseract.js OCR worker requires blob: URL worker creation blocked by YouTube CSP',
  });

  offscreenCreated = true;
  console.log(CONFIG.logPrefix, 'Offscreen document created for OCR');
}

chrome.runtime.onInstalled.addListener(() => {
  console.log(CONFIG.logPrefix, 'Extension installed');
});

// Content script → Background → Offscreen 메시지 중계
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === MSG.OCR_REQUEST) {
    handleOcrRequest(message as OcrRequestMessage, sendResponse);
    return true; // async sendResponse
  }
  return false;
});

async function handleOcrRequest(
  message: OcrRequestMessage,
  sendResponse: (response: OcrResultMessage) => void,
): Promise<void> {
  try {
    await ensureOffscreen();

    // OCR_REQUEST → OCR_PROCESS로 변환하여 offscreen에 전달
    // (sendMessage는 모든 컨텍스트에 전달되므로 다른 메시지 타입 사용)
    const processMessage: OcrProcessMessage = {
      type: MSG.OCR_PROCESS,
      payload: { imageDataUrl: message.payload.imageDataUrl },
    };
    const response = await chrome.runtime.sendMessage(processMessage);
    sendResponse(response);
  } catch (err) {
    console.error(CONFIG.logPrefix, 'OCR relay failed:', err);
    sendResponse({
      type: MSG.OCR_RESULT,
      payload: { text: '', error: String(err) },
    });
  }
}
