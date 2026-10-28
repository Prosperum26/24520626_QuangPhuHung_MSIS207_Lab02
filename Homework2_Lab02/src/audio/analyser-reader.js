// @ts-check

/** Kích thước FFT: đề chỉ cho 256 hoặc 512 (số bin = fftSize / 2). Đổi ở đúng một chỗ này. */
export const FFT_SIZE = 256;

const ALLOWED_FFT_SIZES = Object.freeze([256, 512]);

/** Làm mượt giữa các khung hình để cột không giật; 0 là không mượt, 1 là đứng yên. */
const SMOOTHING = 0.8;

/**
 * @param {{ createAnalyser: () => AnalyserNode }} audioContext
 * @param {number} [fftSize]
 */
export function createAnalyser(audioContext, fftSize = FFT_SIZE) {
  if (!ALLOWED_FFT_SIZES.includes(fftSize)) {
    throw new RangeError(`fftSize must be one of ${ALLOWED_FFT_SIZES.join(', ')}, got ${fftSize}`);
  }
  const analyser = audioContext.createAnalyser();
  analyser.fftSize = fftSize;
  analyser.smoothingTimeConstant = SMOOTHING;
  return analyser;
}

/**
 * Một `Uint8Array` tạo đúng một lần rồi dùng lại mọi khung hình, để vòng vẽ 60 fps
 * không cấp phát bộ nhớ và không tạo áp lực GC.
 * @param {AnalyserNode} analyser
 */
export function createFrequencyReader(analyser) {
  const data = new Uint8Array(analyser.frequencyBinCount);
  return {
    binCount: data.length,
    /** Mảng trả về là CÙNG một tham chiếu mỗi lần; đừng giữ lại hay sửa nó. */
    read() {
      analyser.getByteFrequencyData(data);
      return data;
    },
  };
}
