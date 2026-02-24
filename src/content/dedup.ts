import { CONFIG } from '../shared/config';

/**
 * 자막 중복 제거 모듈.
 *
 * 연속 프레임에서 동일/유사한 자막이 반복 감지되는 것을 필터링.
 * 유사도가 임계값(CONFIG.dedupThreshold) 이상이면 중복으로 판단.
 */

let lastText = '';

/** 새 텍스트가 이전과 다른지 확인. 다르면 true, 중복이면 false. */
export function isNewSubtitle(text: string): boolean {
  if (!text.trim()) return false;

  const similarity = calcSimilarity(lastText, text);
  if (similarity >= CONFIG.dedupThreshold) return false;

  lastText = text;
  return true;
}

/** 마지막 텍스트 초기화 (ROI 재선택 등) */
export function resetDedup(): void {
  lastText = '';
}

/**
 * 두 문자열 간 유사도 계산 (0~1).
 * bigram 기반 Dice coefficient — 빠르고 OCR 오차에 관대.
 */
function calcSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;

  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
  const na = norm(a);
  const nb = norm(b);
  if (na === nb) return 1;

  const bigramsA = toBigrams(na);
  const bigramsB = toBigrams(nb);

  let matches = 0;
  const used = new Set<number>();
  for (const bg of bigramsA) {
    for (let i = 0; i < bigramsB.length; i++) {
      if (!used.has(i) && bg === bigramsB[i]) {
        matches++;
        used.add(i);
        break;
      }
    }
  }

  return (2 * matches) / (bigramsA.length + bigramsB.length);
}

function toBigrams(s: string): string[] {
  const result: string[] = [];
  for (let i = 0; i < s.length - 1; i++) {
    result.push(s.substring(i, i + 2));
  }
  return result;
}
