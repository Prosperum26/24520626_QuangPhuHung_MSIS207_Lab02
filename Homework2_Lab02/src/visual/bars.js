// @ts-check

/**
 * Gộp các bin tần số thành `bars.length` cột (trung bình mỗi nhóm), ghi chiều cao nguyên
 * pixel vào mảng `bars` cho sẵn thay vì tạo mảng mới, để vòng vẽ không cấp phát mỗi khung hình.
 *
 * Nhóm i phủ các bin [floor(i*n/k), floor((i+1)*n/k)), nên các nhóm chia hết toàn bộ bin
 * (không bỏ sót bin nào) kể cả khi n không chia hết cho k; nếu k > n thì mỗi nhóm có ít nhất một bin.
 *
 * @param {ArrayLike<number>} frequencyData giá trị 0..255 từ getByteFrequencyData
 * @param {Uint16Array} bars mảng đầu ra, độ dài là số cột
 * @param {number} height chiều cao tối đa (px)
 * @returns {Uint16Array} chính `bars`
 */
export function computeBars(frequencyData, bars, height) {
  const binCount = frequencyData.length;
  const barCount = bars.length;
  for (let bar = 0; bar < barCount; bar += 1) {
    const start = Math.floor((bar * binCount) / barCount);
    const end = Math.max(start + 1, Math.floor(((bar + 1) * binCount) / barCount));
    let sum = 0;
    for (let bin = start; bin < end; bin += 1) sum += frequencyData[bin];
    bars[bar] = Math.round((sum / (end - start) / 255) * height);
  }
  return bars;
}
