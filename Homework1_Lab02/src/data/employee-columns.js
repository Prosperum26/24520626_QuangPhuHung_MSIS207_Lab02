// @ts-check

/**
 * Cột của bảng nhân viên: nơi duy nhất quyết định cột nào hiện và cột nào sắp xếp được.
 * @type {readonly import('../grid/grid-contract.js').ColumnDef<import('./employees.js').Employee>[]}
 */
export const EMPLOYEE_COLUMNS = Object.freeze([
  Object.freeze({ header: 'Name', accessorKey: 'name', sortable: true }),
  Object.freeze({ header: 'Department', accessorKey: 'department', sortable: true }),
  Object.freeze({ header: 'Role', accessorKey: 'role' }),
  Object.freeze({ header: 'Salary (USD)', accessorKey: 'salary', sortable: true }),
  Object.freeze({ header: 'Joined', accessorKey: 'joined', sortable: true }),
]);
