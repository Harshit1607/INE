import { PriceReading, ScrapeError } from './types.js';

export interface ValidationTarget {
  storeProductId: number;
  optionId: string;
}

export class ReadingValidator {
  public static validate(reading: PriceReading, target: ValidationTarget): void {
    if (reading.storeProductId !== target.storeProductId) {
      throw new ScrapeError(
        'structure_changed',
        `Product ID mismatch: expected ${target.storeProductId}, received ${reading.storeProductId}`,
        false
      );
    }

    if (reading.optionId !== target.optionId) {
      throw new ScrapeError(
        'option_mismatch',
        `Option ID mismatch: expected ${target.optionId}, received ${reading.optionId}`,
        false
      );
    }

    if (typeof reading.price !== 'number' || !Number.isFinite(reading.price) || reading.price <= 0 || isNaN(reading.price)) {
      throw new ScrapeError(
        'invalid_price',
        `Invalid price value: ${reading.price}`,
        true
      );
    }

    if (!reading.stockStatus || typeof reading.stockStatus !== 'string' || reading.stockStatus.trim() === '') {
      throw new ScrapeError(
        'invalid_stock',
        `Invalid stock status: ${reading.stockStatus}`,
        true
      );
    }
  }
}
