import { loadSettings, saveSettings } from '../shared/settings';
import type { Settings } from '../shared/settings';

const TOGGLES: (keyof Settings)[] = ['translateEnabled', 'showOriginal', 'autoHideControls'];
const RANGES: { id: keyof Settings; format: (v: number) => string }[] = [
  { id: 'fontSize', format: (v) => `${v}px` },
  { id: 'bgOpacity', format: (v) => `${v}%` },
];

async function init(): Promise<void> {
  const settings = await loadSettings();

  // 토글 초기화
  for (const key of TOGGLES) {
    const el = document.getElementById(key) as HTMLInputElement;
    el.checked = settings[key] as boolean;
    el.addEventListener('change', () => {
      saveSettings({ [key]: el.checked });
    });
  }

  // 슬라이더 초기화
  for (const { id, format } of RANGES) {
    const el = document.getElementById(id) as HTMLInputElement;
    const valueEl = document.getElementById(`${id}Value`)!;
    const val = settings[id] as number;
    el.value = String(val);
    valueEl.textContent = format(val);

    el.addEventListener('input', () => {
      const num = Number(el.value);
      valueEl.textContent = format(num);
      saveSettings({ [id]: num });
    });
  }
}

init();
