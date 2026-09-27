import { Outcome } from '../domain/types.js';

export interface CSVExportRow {
  storeProductId: number;
  productName: string;
  optionLabel: string;
  timestamp: string;
  price: number | null;
  stock: string | null;
  outcome: Outcome;
}

export class CSVExporter {
  private static escapeCell(value: string | number | null | undefined): string {
    if (value === null || value === undefined) {
      return '';
    }
    const str = String(value);
    // If the cell contains commas, quotes, or newlines, quote it per RFC 4180
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  public static generateCSV(rows: CSVExportRow[]): string {
    const headers = [
      'store_product_id',
      'product_name',
      'option',
      'timestamp',
      'price',
      'stock',
      'outcome'
    ];

    const lines: string[] = [headers.join(',')];

    for (const row of rows) {
      const isFailed = row.outcome === 'failed';
      const formattedTimestamp = new Date(row.timestamp).toISOString();

      const line = [
        this.escapeCell(row.storeProductId),
        this.escapeCell(row.productName),
        this.escapeCell(row.optionLabel),
        this.escapeCell(formattedTimestamp),
        isFailed ? '' : this.escapeCell(row.price),
        isFailed ? '' : this.escapeCell(row.stock),
        this.escapeCell(row.outcome)
      ].join(',');

      lines.push(line);
    }

    return lines.join('\r\n') + '\r\n';
  }
}
