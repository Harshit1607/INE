import { Browser, BrowserContext, chromium } from 'playwright';
import { CatalogClient } from '../catalog/catalog-client.js';
import { PriceReader, PriceReading, ScrapeError, UIManifest } from '../domain/types.js';
import { PriceNormalizer } from './price-normalizer.js';
import { ReadingValidator } from '../domain/validator.js';

export interface PlaywrightPriceReaderOptions {
  baseUrl?: string;
  headless?: boolean;
  slowMo?: number;
  catalogClient?: CatalogClient;
  logger?: (message: string) => void;
  pageTimeoutMs?: number;
}

export class PlaywrightPriceReader implements PriceReader {
  private browser: Browser | null = null;
  private readonly baseUrl: string;
  private readonly headless: boolean;
  private readonly slowMo: number;
  private readonly catalogClient: CatalogClient;
  private readonly logger: (message: string) => void;
  private readonly pageTimeoutMs: number;

  constructor(options: PlaywrightPriceReaderOptions = {}) {
    this.baseUrl = (options.baseUrl || process.env.STORE_BASE_URL || 'https://demo.inelabteamdev.com').replace(/\/$/, '');
    this.headless = options.headless ?? (process.env.HEADLESS !== 'false');
    this.slowMo = options.slowMo ?? (process.env.SLOW_MO_MS ? parseInt(process.env.SLOW_MO_MS, 10) : 0);
    this.catalogClient = options.catalogClient || new CatalogClient({ baseUrl: this.baseUrl });
    this.logger = options.logger || (() => {});
    this.pageTimeoutMs = options.pageTimeoutMs || (process.env.SCRAPE_TRY_TIMEOUT_MS ? parseInt(process.env.SCRAPE_TRY_TIMEOUT_MS, 10) : 25000);
  }

  private async getBrowser(): Promise<Browser> {
    if (!this.browser) {
      this.logger(`[PriceReader] Launching browser (headless=${this.headless}, slowMo=${this.slowMo}ms)`);
      this.browser = await chromium.launch({
        headless: this.headless,
        slowMo: this.slowMo,
        args: [
          '--disable-dev-shm-usage',
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-gpu'
        ]
      });
    }
    return this.browser;
  }

  public async close(): Promise<void> {
    if (this.browser) {
      this.logger('[PriceReader] Closing browser instance');
      await this.browser.close();
      this.browser = null;
    }
  }

  public async read(storeProductId: number, optionId: string): Promise<PriceReading> {
    const browser = await this.getBrowser();
    const context: BrowserContext = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });

    const page = await context.newPage();
    page.setDefaultTimeout(this.pageTimeoutMs);

    try {
      // 1. Fetch current UI manifest
      this.logger(`[PriceReader] Fetching UI manifest for dynamic selectors...`);
      let manifest: UIManifest;
      try {
        manifest = await this.catalogClient.fetchManifest();
      } catch (err: unknown) {
        throw new ScrapeError('http_5xx', `Failed to fetch UI manifest: ${err instanceof Error ? err.message : String(err)}`, true);
      }

      const priceWrapClass = manifest.classes.priceWrap || 'offer-panel';
      const priceValueClass = manifest.classes.priceValue;
      const stockClass = manifest.classes.stock;

      // 2. Block heavy assets to save memory
      await page.route('**/*', (route) => {
        const resourceType = route.request().resourceType();
        const url = route.request().url();
        if (
          resourceType === 'image' ||
          resourceType === 'media' ||
          resourceType === 'font' ||
          url.endsWith('.png') ||
          url.endsWith('.jpg') ||
          url.endsWith('.svg') ||
          url.endsWith('.woff') ||
          url.endsWith('.woff2')
        ) {
          return route.abort();
        }
        return route.continue();
      });

      // 3. Navigate to product page
      const productUrl = `${this.baseUrl}/item/${storeProductId}`;
      this.logger(`[PriceReader] Navigating to ${productUrl}...`);
      
      try {
        const response = await page.goto(productUrl, { waitUntil: 'domcontentloaded', timeout: this.pageTimeoutMs });
        if (response && !response.ok()) {
          if (response.status() === 429) {
            throw new ScrapeError('http_429', `Rate limited by store (HTTP 429)`, true);
          }
          if (response.status() === 401 || response.status() === 403) {
            throw new ScrapeError('auth_rejected', `Authentication/access rejected (HTTP ${response.status()})`, true);
          }
          if (response.status() >= 500) {
            throw new ScrapeError('http_5xx', `Store server error (HTTP ${response.status()})`, true);
          }
        }
      } catch (err: unknown) {
        if (err instanceof ScrapeError) throw err;
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('timeout') || msg.includes('Timeout')) {
          throw new ScrapeError('timeout', `Navigation timed out: ${msg}`, true);
        }
        throw new ScrapeError('navigation_failed', `Failed to navigate to ${productUrl}: ${msg}`, true);
      }

      // Handle cookie consent dialog if displayed
      try {
        const consentBtn = page.locator('.consent-scrim button, button[aria-label="Allow cookies"]').first();
        if (await consentBtn.isVisible({ timeout: 1200 })) {
          this.logger(`[PriceReader] Dismissing cookie consent banner...`);
          await consentBtn.click();
          await page.locator('.consent-scrim').waitFor({ state: 'detached', timeout: 2000 }).catch(() => {});
        }
      } catch {
        // Ignored if not found
      }

      // 4. Select Option and confirm it
      this.logger(`[PriceReader] Locating option chip for '${optionId}'...`);
      const optionPickerSelector = '.opt-picker, [role="group"]';
      try {
        await page.waitForSelector(optionPickerSelector, { timeout: 8000 });
      } catch {
        throw new ScrapeError('structure_changed', `Option picker container not found on page`, false);
      }

      const itemDetail = await this.catalogClient.fetchItem(storeProductId);
      const targetOption = itemDetail.options.find((o) => o.id === optionId);
      if (!targetOption) {
        throw new ScrapeError('option_mismatch', `Option '${optionId}' does not exist for product ${storeProductId}`, false);
      }
      const targetOptionLabel = targetOption.label;

      this.logger(`[PriceReader] Target option: '${targetOptionLabel}' (${optionId})`);

      // Click the button with target label
      const optionButtonLocator = page.locator(`.opt-picker button:has-text("${targetOptionLabel}")`);
      const count = await optionButtonLocator.count();
      if (count === 0) {
        throw new ScrapeError('option_mismatch', `Option button for '${targetOptionLabel}' not found on page`, false);
      }

      await optionButtonLocator.first().click();
      this.logger(`[PriceReader] Clicked option button '${targetOptionLabel}'`);

      // Confirm option is active
      await page.waitForFunction(
        ([label]) => {
          const btns = Array.from(document.querySelectorAll('.opt-picker button'));
          const btn = btns.find((b) => (b as HTMLElement).textContent?.trim() === label) as HTMLElement | undefined;
          return Boolean(btn && (btn.getAttribute('aria-pressed') === 'true' || btn.classList.contains('opt-chip-on')));
        },
        [targetOptionLabel],
        { timeout: 5000 }
      );
      this.logger(`[PriceReader] Confirmed option '${targetOptionLabel}' is active.`);

      // 5. Interaction Gate: Locate price panel, hover, dwell, and click
      this.logger(`[PriceReader] Locating price panel (${priceWrapClass})...`);
      const panelLocator = page.locator(`.${priceWrapClass}, .offer-panel`).first();
      try {
        await panelLocator.waitFor({ state: 'visible', timeout: 8000 });
      } catch {
        throw new ScrapeError('structure_changed', `Price panel (.${priceWrapClass}) not found on page`, false);
      }

      const box = await panelLocator.boundingBox();
      if (!box) {
        throw new ScrapeError('structure_changed', `Unable to get bounding box for price panel`, false);
      }

      this.logger(`[PriceReader] Simulating human pointer movements and dwell on price area...`);
      const startX = box.x + 10;
      const startY = box.y + 10;
      await page.mouse.move(startX, startY);

      // Perform >= 10 realistic pointer moves across the box
      const moveSteps = 12;
      for (let i = 1; i <= moveSteps; i++) {
        const x = box.x + 15 + ((box.width - 30) * i) / moveSteps;
        const y = box.y + 15 + (Math.sin(i) * 10);
        await page.mouse.move(x, y, { steps: 2 });
        const { promise, resolve } = Promise.withResolvers<void>();
        setTimeout(resolve, 60);
        await promise;
      }

      // Dwell for 750ms to satisfy minDwellMs (600ms)
      this.logger(`[PriceReader] Dwelling over price area (750ms)...`);
      const { promise: dwellPromise, resolve: resolveDwell } = Promise.withResolvers<void>();
      setTimeout(resolveDwell, 750);
      await dwellPromise;

      // 6. Click the action button to request price
      const checkBtn = page.locator('.ctl-main, button[aria-label="Check today’s price"]').first();
      try {
        await checkBtn.waitFor({ state: 'visible', timeout: 6000 });
        await page.waitForFunction(
          () => {
            const btn = document.querySelector('.ctl-main, button[aria-label="Check today’s price"]');
            return Boolean(btn && !btn.hasAttribute('disabled'));
          },
          { timeout: 6000 }
        );
      } catch {
        this.logger(`[PriceReader] Button not enabled yet; proceeding with click attempt`);
      }

      this.logger(`[PriceReader] Clicking 'Check today’s price' button...`);
      try {
        await checkBtn.click({ timeout: 4000 });
      } catch {
        // Fallback: click directly or dispatch click event
        await page.evaluate(() => {
          const btn = document.querySelector('.ctl-main, button[aria-label="Check today’s price"]') as HTMLElement | null;
          btn?.click();
        });
      }

      // 7. Wait for real value
      this.logger(`[PriceReader] Waiting for price value resolution...`);
      const priceTag = manifest.priceTag || 'strong, span';
      const priceSelector = priceValueClass ? `.${priceValueClass}` : `${priceTag}`;

      await page.waitForFunction(
        ([sel]) => {
          const el = document.querySelector(sel);
          if (!el) return false;
          const text = el.textContent?.trim() || '';
          if (!text) return false;
          if (text.includes('Price locked') || text.includes('Hold on') || text.includes('Loading')) {
            return false;
          }
          return /\d/.test(text);
        },
        [priceSelector],
        { timeout: 12000 }
      );

      // 8. Extract price text and stock text
      const rawPriceText = await page.locator(priceSelector).first().innerText();
      this.logger(`[PriceReader] Raw price text: "${rawPriceText}"`);

      let rawStockText = 'In Stock';
      if (stockClass) {
        const stockEl = page.locator(`.${stockClass}, .avail-pill`).first();
        if (await stockEl.count() > 0) {
          rawStockText = await stockEl.innerText();
        }
      } else {
        const stockEl = page.locator('.avail-pill').first();
        if (await stockEl.count() > 0) {
          rawStockText = await stockEl.innerText();
        }
      }
      this.logger(`[PriceReader] Raw stock text: "${rawStockText}"`);

      // 9. Normalize and Validate
      const normPrice = PriceNormalizer.normalizePrice(rawPriceText);
      const normStock = PriceNormalizer.normalizeStock(rawStockText);

      const reading: PriceReading = {
        storeProductId,
        optionId,
        optionLabel: targetOptionLabel,
        price: normPrice.price,
        currency: normPrice.currency,
        stockStatus: normStock.status,
        stockQty: normStock.qty,
        manifestRevision: manifest.revision,
        readAt: new Date().toISOString()
      };

      this.logger(`[PriceReader] Normalised reading: Price=${reading.price} ${reading.currency}, Stock=${reading.stockStatus} (${reading.stockQty ?? 'N/A'})`);

      // Run strict validator rules
      ReadingValidator.validate(reading, { storeProductId, optionId });

      return reading;
    } catch (err: unknown) {
      if (err instanceof ScrapeError) {
        throw err;
      }
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('timeout') || msg.includes('Timeout')) {
        throw new ScrapeError('timeout', `Operation timed out: ${msg}`, true);
      }
      throw new ScrapeError('unknown', `Scrape failed: ${msg}`, true);
    } finally {
      await context.close().catch(() => {});
    }
  }
}
