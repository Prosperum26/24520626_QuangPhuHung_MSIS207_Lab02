// @ts-check

/** Hằng thời gian (giây) của `setTargetAtTime`: đủ ngắn để thấy tức thì, đủ dài để không lách tách. */
const VOLUME_TIME_CONSTANT = 0.015;

/**
 * Chuỗi nối: source -> analyser -> gain -> destination. Analyser đứng TRƯỚC gain
 * để hình phổ không phụ thuộc âm lượng.
 *
 * Chỗ DUY NHẤT quản lý vòng đời `AudioBufferSourceNode`: tại mọi thời điểm giữ tối đa một node,
 * và mọi node tạo ra đều được `stop()` + `disconnect()` đúng một lần qua `release()`.
 *
 * @param {object} deps
 * @param {AudioContext} deps.audioContext
 * @param {AnalyserNode} deps.analyser
 */
export function createPlayer({ audioContext, analyser }) {
  const gain = audioContext.createGain();
  gain.gain.value = 1;
  analyser.connect(gain);
  gain.connect(audioContext.destination);

  /** @type {AudioBufferSourceNode | null} */
  let source = null;
  let volume = 1;

  function release() {
    if (!source) return;
    const node = source;
    source = null;
    // Gỡ onended trước để lần dừng chủ động không kích hoạt onEnded của người gọi.
    node.onended = null;
    node.stop();
    node.disconnect();
  }

  /**
   * Phải được gọi trực tiếp từ handler của người dùng: trình duyệt chặn AudioContext tự phát,
   * và `resume()` chỉ được chấp nhận khi còn trong cử chỉ của người dùng.
   * `onEnded` chỉ chạy khi bản nhạc tự hết, không chạy khi gọi `stop()` hay bị `play()` khác thay.
   * @param {AudioBuffer} buffer
   * @param {{ onEnded?: () => void }} [options]
   */
  async function play(buffer, { onEnded } = {}) {
    if (audioContext.state === 'suspended') await audioContext.resume();
    release();

    const node = audioContext.createBufferSource();
    node.buffer = buffer;
    node.connect(analyser);
    node.onended = () => {
      if (source !== node) return;
      release();
      if (onEnded) onEnded();
    };
    source = node;
    node.start();
  }

  /** Giá trị ngoài [0, 1] được kẹp lại; không phải số hữu hạn thì ném lỗi. */
  function setVolume(value) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new RangeError(`volume must be a finite number, got ${String(value)}`);
    }
    volume = Math.min(1, Math.max(0, value));
    gain.gain.setTargetAtTime(volume, audioContext.currentTime, VOLUME_TIME_CONSTANT);
  }

  return {
    play,
    stop: release,
    setVolume,
    get isPlaying() { return source !== null; },
    get volume() { return volume; },
  };
}
