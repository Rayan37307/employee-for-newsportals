import { chromium, Browser, Page, LaunchOptions } from 'playwright';

interface PlaywrightConfig {
  baseUrl: string;
  timeout: number;
  maxRetries: number;
  userAgent?: string;
}

interface PlaywrightResult {
  html: string | null;
  success: boolean;
  error?: string;
}

export class HardenedPlaywright {
  private browser: Browser | null = null;
  private config: PlaywrightConfig;
  private pageCount = 0;
  private readonly MAX_PAGES = 50;

  private readonly AD_DOMAINS = [
    'googlesyndication', 'googleadservices', 'doubleclick',
    'facebook.net', 'connect.facebook', 'staticxx.facebook',
    'analytics', 'tracking', 'pixel', 'counter',
    'taboola', 'outbrain', 'criteo', 'amazon-adsystem',
    'adnxs.com', 'rubiconproject.com', 'pubmatic.com',
    'openx.net', 'casalemedia.com', 'mediamath.com'
  ];

  constructor(config: PlaywrightConfig) {
    this.config = config;
  }

  async launch(): Promise<Browser> {
    if (this.browser && this.browser.isConnected()) {
      return this.browser;
    }

    const launchOptions: LaunchOptions = {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--window-size=1920,1080',
        '--disable-blink-features=AutomationControlled',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process'
      ]
    };

    this.browser = await chromium.launch(launchOptions);
    return this.browser;
  }

  async navigate(url: string): Promise<PlaywrightResult> {
    if (!this.browser) await this.launch();

    if (this.pageCount >= this.MAX_PAGES) {
      console.log('🔄 Recreating browser (page limit reached)');
      await this.recreateBrowser();
    }

    if (!this.browser) {
      await this.launch();
    }

    const page = await this.browser!.newPage();
    this.pageCount++;

    try {
      await page.setViewportSize({ width: 1920, height: 1080 });

      await page.setExtraHTTPHeaders({
        'User-Agent': this.config.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      });

      await page.route('**/*', route => {
        const resourceType = route.request().resourceType();
        const url = route.request().url();

        if (['image', 'media', 'font', 'stylesheet'].includes(resourceType)) {
          route.abort();
          return;
        }

        if (this.isAdDomain(url)) {
          route.abort();
          return;
        }

        route.continue();
      });

      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: this.config.timeout
      });

      const contentLoaded = await Promise.race([
        page.waitForSelector('article, main, [class*="article"], [class*="news-content"], .single-post, .post-content', {
          timeout: 10000
        }).then(() => true),
        new Promise<false>(resolve => setTimeout(() => resolve(false), 10000))
      ]);

      await page.waitForTimeout(1000);

      const html = await page.content();
      return { html, success: true };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.log(`⏱️ Playwright navigation failed for ${url}: ${errorMessage}`);

      if (errorMessage.includes('Target page, context or browser has been closed')) {
        await this.recreateBrowser();
      }

      return { html: null, success: false, error: errorMessage };
    } finally {
      try {
        await page.close();
      } catch {
        // Ignore close errors
      }
    }
  }

  async fetchWithRetry(url: string, maxRetries?: number): Promise<string | null> {
    const retries = maxRetries ?? this.config.maxRetries;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const result = await this.navigate(url);
        if (result.success && result.html) {
          return result.html;
        }
        lastError = new Error(result.error || 'Empty response');
      } catch (error) {
        lastError = error as Error;

        if (lastError.message.includes('Timeout')) {
          break;
        }
      }

      if (attempt < retries) {
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    console.log(`❌ Playwright failed after ${retries} attempts: ${lastError?.message}`);
    return null;
  }

  private isAdDomain(url: string): boolean {
    const lowerUrl = url.toLowerCase();
    return this.AD_DOMAINS.some(domain => lowerUrl.includes(domain));
  }

  private async recreateBrowser(): Promise<void> {
    if (this.browser) {
      try {
        await this.browser.close();
      } catch {
        // Ignore close errors
      }
      this.browser = null;
    }
    this.pageCount = 0;
    await this.launch();
  }

  async cleanup(): Promise<void> {
    if (this.browser) {
      try {
        await this.browser.close();
      } catch {
        // Ignore close errors
      }
      this.browser = null;
    }
    this.pageCount = 0;
  }

  getPageCount(): number {
    return this.pageCount;
  }
}
