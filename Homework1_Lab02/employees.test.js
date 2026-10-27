import { describe, expect, it } from 'vitest';
import { EMPLOYEES, createEmployees } from './employees.js';

describe('createEmployees (A2)', () => {
  it('is deterministic: two calls give equal data', () => {
    expect(createEmployees(50)).toEqual(createEmployees(50));
  });

  it('gives unique ids', () => {
    expect(new Set(EMPLOYEES.map((e) => e.id)).size).toBe(EMPLOYEES.length);
  });

  it('exports 240 rows, frozen, rows included', () => {
    expect(EMPLOYEES).toHaveLength(240);
    expect(Object.isFrozen(EMPLOYEES)).toBe(true);
    expect(EMPLOYEES.every((e) => Object.isFrozen(e))).toBe(true);
  });

  it('has numeric salary and ISO date string joined', () => {
    for (const employee of EMPLOYEES) {
      expect(typeof employee.salary).toBe('number');
      expect(employee.joined).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('has varied text and number columns so sort and filter have something to do', () => {
    expect(new Set(EMPLOYEES.map((e) => e.department)).size).toBeGreaterThan(1);
    expect(new Set(EMPLOYEES.map((e) => e.salary)).size).toBeGreaterThan(1);
  });

  it('handles zero rows', () => {
    expect(createEmployees(0)).toEqual([]);
  });
});
