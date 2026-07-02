import { Injectable } from '@nestjs/common';

@Injectable()
export class UtilitiesDatesService {
  constructor() {}

  getCurrentDatetime(): string {
    return new Date().toISOString();
  }

  addDurationToDatetime(
    datetime: Date,
    duration: {
      years?: number;
      months?: number;
      days?: number;
      hours?: number;
      minutes?: number;
      seconds?: number;
    },
  ): Date {
    const result = new Date(datetime);

    const {
      years = 0,
      months = 0,
      days = 0,
      hours = 0,
      minutes = 0,
      seconds = 0,
    } = duration;

    result.setFullYear(result.getFullYear() + years);
    result.setMonth(result.getMonth() + months);
    result.setDate(result.getDate() + days);
    result.setHours(result.getHours() + hours);
    result.setMinutes(result.getMinutes() + minutes);
    result.setSeconds(result.getSeconds() + seconds);
    return result;
  }
}
