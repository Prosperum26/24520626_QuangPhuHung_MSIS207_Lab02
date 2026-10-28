// @ts-check
import { createAudioApp } from './src/app/audio-app.js';
import { createAnalyser, createFrequencyReader } from './src/audio/analyser-reader.js';
import { createPlayer } from './src/audio/audio-player.js';
import { createTrackLoader } from './src/audio/track-loader.js';
import { AudioTaskQueue } from './src/queue/audio-task-queue.js';
import { createMotionPolicy } from './src/visual/motion-policy.js';
import { createVisualizer } from './src/visual/visualizer.js';

const root = document.querySelector('main');
const canvas = document.getElementById('visualizer');
if (root === null) throw new Error('Missing <main> in index.html');
if (!(canvas instanceof HTMLCanvasElement)) throw new Error('Missing #visualizer canvas in index.html');

/** @type {{ reader: ReturnType<typeof createFrequencyReader>, player: ReturnType<typeof createPlayer>, queue: AudioTaskQueue } | null} */
let engine = null;

/**
 * AudioContext tạo lười, lần đầu người dùng thêm file hoặc bấm Play: trình duyệt chặn (và
 * cảnh báo) AudioContext tạo lúc tải trang khi chưa có tương tác.
 */
function getEngine() {
  if (engine === null) {
    const audioContext = new AudioContext();
    const analyser = createAnalyser(audioContext);
    engine = {
      reader: createFrequencyReader(analyser),
      player: createPlayer({ audioContext, analyser }),
      queue: new AudioTaskQueue(createTrackLoader({ audioContext })),
    };
  }
  return engine;
}

const visualizer = createVisualizer({
  canvas,
  // Chỉ được gọi khi vòng vẽ chạy, tức là khi đang phát, nên engine đã tồn tại.
  read: () => getEngine().reader.read(),
  raf: (callback) => requestAnimationFrame(callback),
  caf: (id) => cancelAnimationFrame(id),
  barColor: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || undefined,
});

const motion = createMotionPolicy({
  visualizer,
  isPlaying: () => engine !== null && engine.player.isPlaying,
});

createAudioApp({
  root,
  getEngine,
  visualizer,
  motion,
  urls: {
    create: (file) => URL.createObjectURL(file),
    revoke: (url) => URL.revokeObjectURL(url),
  },
});
