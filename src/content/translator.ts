import { CONFIG } from '../shared/config';

/**
 * Google Translate 비공식 API를 사용한 번역 모듈 (en → ko).
 *
 * - 간단한 캐시로 동일 텍스트 재번역 방지
 * - 번역 실패 시 원문 반환
 */

const TRANSLATE_URL = 'https://translate.googleapis.com/translate_a/single';
const MAX_CACHE_SIZE = 50;

const cache = new Map<string, string>();

/** 영어 텍스트를 한국어로 번역 */
export async function translate(text: string): Promise<string> {
  if (!text.trim()) return '';

  // 캐시 확인
  const cached = cache.get(text);
  if (cached) return cached;

  try {
    const params = new URLSearchParams({
      client: 'gtx',
      sl: 'en',
      tl: 'ko',
      dt: 't',
      q: text,
    });

    const res = await fetch(`${TRANSLATE_URL}?${params}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const json = await res.json();

    // 응답 형식: [[["번역문","원문",...], ...], ...]
    const translated = (json[0] as Array<[string]>)
      .map((seg: [string]) => seg[0])
      .join('');

    // 캐시 저장 (크기 제한)
    if (cache.size >= MAX_CACHE_SIZE) {
      const firstKey = cache.keys().next().value!;
      cache.delete(firstKey);
    }
    cache.set(text, translated);

    return translated;
  } catch (err) {
    console.error(CONFIG.logPrefix, 'Translation failed:', err);
    return text; // 실패 시 원문 반환
  }
}
