// @ts-check

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/**
 * Chỗ DUY NHẤT quyết định khi nào hiệu ứng được chạy: đang phát, người dùng không tắt,
 * và tab đang hiển thị. Hệ thống đặt "giảm chuyển động" thì mặc định tắt hiệu ứng
 * (WCAG 2.3.3, 2.2.2) nhưng người dùng vẫn bật lại được bằng nút.
 *
 * @param {object} options
 * @param {{ start: () => void, stop: () => void }} options.visualizer
 * @param {() => boolean} options.isPlaying
 * @param {Pick<Document, 'hidden' | 'addEventListener' | 'removeEventListener'>} [options.doc]
 * @param {(query: string) => MediaQueryList} [options.matchMedia]
 */
export function createMotionPolicy({
  visualizer,
  isPlaying,
  doc = document,
  matchMedia = (query) => window.matchMedia(query),
}) {
  const reducedMotion = matchMedia(REDUCED_MOTION_QUERY);
  let effectEnabled = !reducedMotion.matches;

  function sync() {
    if (isPlaying() && effectEnabled && !doc.hidden) visualizer.start();
    else visualizer.stop();
  }

  /** @param {{ matches: boolean }} event */
  function onSystemMotionChange(event) {
    effectEnabled = !event.matches;
    sync();
  }

  doc.addEventListener('visibilitychange', sync);
  reducedMotion.addEventListener('change', onSystemMotionChange);

  return {
    sync,
    /** @param {boolean} enabled */
    setEffectEnabled(enabled) {
      effectEnabled = Boolean(enabled);
      sync();
    },
    get effectEnabled() { return effectEnabled; },
    dispose() {
      doc.removeEventListener('visibilitychange', sync);
      reducedMotion.removeEventListener('change', onSystemMotionChange);
    },
  };
}
