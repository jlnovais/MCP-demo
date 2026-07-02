import { beforeEach, describe, expect, it } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { UtilitiesDatesService } from '../../../apps/mcp-server/src/mcp/utilities/utilities-dates.service';

describe('UtilitiesDatesService', () => {
  let service: UtilitiesDatesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UtilitiesDatesService],
    }).compile();

    service = module.get<UtilitiesDatesService>(UtilitiesDatesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('addDurationToDatetime', () => {
    const base = new Date(2026, 4, 29, 9, 36, 55);

    it('should add years', () => {
      const result = service.addDurationToDatetime(base, { years: 2 });

      expect(result.getFullYear()).toBe(2028);
      expect(result.getMonth()).toBe(4);
      expect(result.getDate()).toBe(29);
      expect(result.getHours()).toBe(9);
      expect(result.getMinutes()).toBe(36);
      expect(result.getSeconds()).toBe(55);
    });

    it('should add months', () => {
      const result: Date = service.addDurationToDatetime(base, { months: 3 });

      expect(result.getFullYear()).toBe(2026);
      expect(result.getMonth()).toBe(7);
      expect(result.getDate()).toBe(29);
    });

    it('should add days', () => {
      const result: Date = service.addDurationToDatetime(base, { days: 10 });

      expect(result.getMonth()).toBe(5);
      expect(result.getDate()).toBe(8);
    });

    it('should add hours', () => {
      const result: Date = service.addDurationToDatetime(base, { hours: 5 });

      expect(result.getHours()).toBe(14);
      expect(result.getMinutes()).toBe(36);
      expect(result.getSeconds()).toBe(55);
    });

    it('should add minutes', () => {
      const result: Date = service.addDurationToDatetime(base, { minutes: 30 });

      expect(result.getHours()).toBe(10);
      expect(result.getMinutes()).toBe(6);
      expect(result.getSeconds()).toBe(55);
    });

    it('should add seconds', () => {
      const result: Date = service.addDurationToDatetime(base, { seconds: 10 });

      expect(result.getMinutes()).toBe(37);
      expect(result.getSeconds()).toBe(5);
    });

    it('should add combined duration parts', () => {
      const result: Date = service.addDurationToDatetime(base, {
        years: 1,
        months: 2,
        days: 3,
        hours: 4,
        minutes: 5,
        seconds: 6,
      });

      expect(result.getFullYear()).toBe(2027);
      expect(result.getMonth()).toBe(7);
      expect(result.getDate()).toBe(1);
      expect(result.getHours()).toBe(13);
      expect(result.getMinutes()).toBe(42);
      expect(result.getSeconds()).toBe(1);
    });

    it('should return the same instant when duration is empty', () => {
      const result: Date = service.addDurationToDatetime(base, {});

      expect(result.getTime()).toBe(base.getTime());
    });

    it('should not mutate the original datetime', () => {
      const original = new Date(2026, 4, 29, 9, 36, 55);
      const originalTime = original.getTime();

      service.addDurationToDatetime(original, { days: 5 });

      expect(original.getTime()).toBe(originalTime);
    });

    it('should roll over when adding months crosses a year boundary', () => {
      const december = new Date(2026, 11, 15);
      const result: Date = service.addDurationToDatetime(december, {
        months: 2,
      });

      expect(result.getFullYear()).toBe(2027);
      expect(result.getMonth()).toBe(1);
      expect(result.getDate()).toBe(15);
    });

    it('should roll over when adding 10 seconds to the last day of the year - crosses a year boundary', () => {
      const december = new Date(2026, 12, 31, 23, 59, 59);
      const result: Date = service.addDurationToDatetime(december, {
        seconds: 10,
      });

      expect(result.getFullYear()).toBe(2027);
      expect(result.getHours()).toBe(0);
      expect(result.getMinutes()).toBe(0);
      expect(result.getSeconds()).toBe(9);
      expect(result.getMonth()).toBe(1);
      expect(result.getDate()).toBe(1);
    });

    it('should handle month-end overflow', () => {
      const jan31 = new Date(2026, 0, 31);
      const result: Date = service.addDurationToDatetime(jan31, { months: 1 });

      expect(result.getMonth()).toBe(2);
      expect(result.getDate()).toBe(3);
    });
  });
});
