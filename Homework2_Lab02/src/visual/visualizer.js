// @ts-check
import { computeBars } from './bars.js';

/** Số cột phổ. */
const BAR_COUNT = 64;

/** Khoảng hở giữa hai cột (px). */
const BAR_GAP = 2;

/**
 * Vòng vẽ `requestAnimationFrame`. Dữ liệu đi thẳng từ `read()` vào canvas: không qua state
 * nào, không tạo object mới mỗi khung hình (mảng `bars` tạo một lần).
 * `raf` và `caf` được inject vì jsdom không có requestAnimationFrame.
 *
 * @param {object} options
 * @param {{ width: number, height: number, getContext: (type: '2d') => CanvasRenderingContext2D | null }} options.canvas
 * @param {() => ArrayLike<number>} options.read
 * @param {(callback: (time: number) => void) => number} options.raf
 * @param {(id: number) => void} options.caf
 * @param {number} [options.barCount]
 * @param {string} [options.barColor]
 */
export function createVisualizer({ canvas, read, raf, caf, barCount = BAR_COUNT, barColor = '#1a3d8f' }) {
  const context = canvas.getContext('2d');
  if (!context) throw new Error('A 2D canvas context is required');

  const bars = new Uint16Array(barCount);
  /** @type {number | null} */
  let frameId = null;

  function draw() {
    const { width, height } = canvas;
    computeBars(read(), bars, height);

    context.clearRect(0, 0, width, height);
    context.fillStyle = barColor;
    const slot = width / barCount;
    const barWidth = Math.max(1, slot - BAR_GAP);
    for (let bar = 0; bar < barCount; bar += 1) {
      if (bars[bar] === 0) continue;
      context.fillRect(bar * slot, height - bars[bar], barWidth, bars[bar]);
    }
  }

  function frame() {
    frameId = raf(frame);
    try {
      draw();
    } catch (error) {
      // Dừng hẳn thay vì để lỗi lặp 60 lần mỗi giây; lỗi vẫn được ném ra để thấy trong console.
      stop();
      throw error;
    }
  }

  function start() {
    if (frameId !== null) return;
    frameId = raf(frame);
  }

  function stop() {
    if (frameId === null) return;
    caf(frameId);
    frameId = null;
  }

  function clear() {
    context.clearRect(0, 0, canvas.width, canvas.height);
  }

  return { start, stop, clear, get isRunning() { return frameId !== null; } };
}
