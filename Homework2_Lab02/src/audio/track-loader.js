// @ts-check

/** @typedef {import('../queue/audio-task.js').LoadTrack} LoadTrack */

/**
 * Tạo hàm `load` để đưa vào AudioTaskQueue.
 *
 * `signal.throwIfAborted()` ném `signal.reason`; queue gọi `abort()` không kèm lý do nên đó
 * là DOMException AbortError mặc định. Gọi sau MỖI `await` vì `decodeAudioData` không nhận
 * signal: nếu bị hủy lúc đang giải mã thì giải mã vẫn chạy đến cùng, ta chỉ bỏ kết quả.
 *
 * @param {object} deps
 * @param {{ decodeAudioData: (data: ArrayBuffer) => Promise<AudioBuffer> }} deps.audioContext
 * @param {(url: string, init: { signal: AbortSignal }) => Promise<Response>} [deps.fetchImpl]
 * @returns {LoadTrack}
 */
export function createTrackLoader({ audioContext, fetchImpl = (url, init) => fetch(url, init) }) {
  return async function loadTrack(trackUrl, { signal, onPhase }) {
    const response = await fetchImpl(trackUrl, { signal });
    signal.throwIfAborted();
    if (!response.ok) throw new Error(`HTTP ${response.status} while loading ${trackUrl}`);

    const bytes = await response.arrayBuffer();
    signal.throwIfAborted();

    onPhase('decoding');
    const buffer = await audioContext.decodeAudioData(bytes);
    signal.throwIfAborted();
    return buffer;
  };
}
