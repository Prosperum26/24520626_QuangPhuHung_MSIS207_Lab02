// @ts-check

// ---------- Contract (A2) ----------

/**
 * @typedef {object} Employee
 * @property {number} id
 * @property {string} name
 * @property {string} department
 * @property {string} role
 * @property {number} salary
 * @property {string} joined Ngày ISO `YYYY-MM-DD`.
 */

const FIRST_NAMES = ['An', 'Binh', 'Chi', 'Dung', 'Hanh', 'Khoa', 'Lan', 'Minh', 'Nam', 'Phuong', 'Quan', 'Thao'];
const LAST_NAMES = ['Nguyen', 'Tran', 'Le', 'Pham', 'Hoang', 'Vu', 'Dang'];
const DEPARTMENTS = ['Engineering', 'Finance', 'Marketing', 'Operations', 'Support'];
const ROLES = ['Analyst', 'Associate', 'Lead', 'Manager'];

const MS_PER_DAY = 86_400_000;
const FIRST_DAY = Date.UTC(2015, 0, 1);

/**
 * Không dùng `Math.random`: mọi giá trị suy ra từ chỉ số dòng, nên test và ảnh
 * chụp Lighthouse luôn thấy cùng một dữ liệu.
 * @param {number} count
 * @returns {readonly Employee[]}
 */
export function createEmployees(count) {
  return Object.freeze(
    Array.from({ length: count }, (_, index) =>
      Object.freeze({
        id: index + 1,
        name: `${FIRST_NAMES[index % FIRST_NAMES.length]} ${LAST_NAMES[(index * 5) % LAST_NAMES.length]}`,
        department: DEPARTMENTS[(index * 3) % DEPARTMENTS.length],
        role: ROLES[(index * 7) % ROLES.length],
        salary: 40_000 + ((index * 7919) % 60) * 1_000,
        joined: new Date(FIRST_DAY + ((index * 37) % 3_000) * MS_PER_DAY).toISOString().slice(0, 10),
      }),
    ),
  );
}

export const EMPLOYEES = createEmployees(240);
