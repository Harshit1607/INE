export interface NormalizedPrice {
  price: number;
  currency: string;
  rawText: string;
}

export interface NormalizedStock {
  status: string;
  qty: number | null;
  rawText: string;
}

export class PriceNormalizer {
  /**
   * Cleans hidden, zero-width, non-breaking and directional formatting characters.
   */
  public static cleanInvisibleChars(str: string): string {
    return str
      .replace(/[\u200B-\u200D\uFEFF\u200E\u200F\u202A-\u202E\u2060]/g, '')
      .replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g, ' ')
      .replace(/[\uFF10-\uFF19]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
      .trim();
  }

  /**
   * Normalizes raw price text into a numeric price and ISO currency code.
   */
  public static normalizePrice(rawPriceText: string): NormalizedPrice {
    const cleaned = this.cleanInvisibleChars(rawPriceText);

    let currency = 'INR';
    if (cleaned.includes('€') || /EUR/i.test(cleaned)) {
      currency = 'EUR';
    } else if (cleaned.includes('$') || /USD/i.test(cleaned)) {
      currency = 'USD';
    } else if (cleaned.includes('£') || /GBP/i.test(cleaned)) {
      currency = 'GBP';
    } else if (cleaned.includes('₹') || /Rs\.?/i.test(cleaned) || /INR/i.test(cleaned)) {
      currency = 'INR';
    }

    // Remove currency prefixes, suffixes, tax text, trailing slashes
    let numStr = cleaned
      .replace(/Rs\.?/gi, '')
      .replace(/[₹$€£]/g, '')
      .replace(/INR|USD|EUR|GBP/gi, '')
      .replace(/\/-\s*\(.*?\)/gi, '')
      .replace(/\/-/g, '')
      .replace(/\s+/g, '')
      .trim();

    // Comma as decimal separator with dot grouping, in Western (1.234,56) or Indian lakh
    // (1.84.683,00) grouping, or no grouping (1234,00)
    if (/^\d+(\.\d{2,3})*,\d{2}$/.test(numStr)) {
      numStr = numStr.replace(/\./g, '').replace(',', '.');
    } else {
      // Standard comma as thousands separator (e.g. 12,345 or 12,345.67)
      numStr = numStr.replace(/,/g, '');
    }

    // Extract the first valid floating number
    const match = numStr.match(/(\d+(?:\.\d+)?)/);
    if (!match) {
      return { price: NaN, currency, rawText: rawPriceText };
    }

    const price = parseFloat(match[1]);
    return {
      price,
      currency,
      rawText: rawPriceText
    };
  }

  /**
   * Normalizes raw stock text into stock status and optional quantity.
   */
  public static normalizeStock(rawStockText: string): NormalizedStock {
    const cleaned = this.cleanInvisibleChars(rawStockText);

    if (/sold\s*out|out\s*of\s*stock|unavailable/i.test(cleaned)) {
      return {
        status: 'out_of_stock',
        qty: 0,
        rawText: rawStockText
      };
    }

    const qtyMatch = cleaned.match(/(\d+)/);
    const qty = qtyMatch ? parseInt(qtyMatch[1], 10) : null;

    let status = 'in_stock';
    if (qty !== null && qty <= 5) {
      status = 'low_stock';
    }

    return {
      status,
      qty,
      rawText: rawStockText
    };
  }
}
