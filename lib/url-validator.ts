export interface URLValidationConfig {
  baseUrl: string;
  allowedPatterns?: string[];
  blockedPatterns?: string[];
  blockedDomains?: string[];
  utilityPatterns?: string[];
}

export interface ValidationResult {
  valid: boolean;
  reason?: string;
  type: 'article' | 'listing' | 'utility' | 'external';
}

export interface ClassificationResult {
  type: 'homepage' | 'listing' | 'category' | 'article' | 'utility' | 'external';
  shouldCrawl: boolean;
  shouldExtract: boolean;
  priority: number;
}

export class URLValidator {
  private baseDomain: string;
  private baseHostname: string;
  
  private readonly SOCIAL_DOMAINS = [
    'facebook.com', 'fb.com', 'facebook.me',
    'twitter.com', 'x.com',
    'youtube.com', 'youtu.be',
    'instagram.com', 'linkedin.com',
    'pinterest.com', 'tiktok.com',
    'whatsapp.com', 't.me', 'telegram.me'
  ];
  
  private readonly UTILITY_PATTERNS = [
    '/unicode-converter', '/converter', '/unicode',
    '/search', '/archives', '/all-tags', '/all-writers', '/all_tags',
    '/privacy-policy', '/terms-conditions', '/terms-of-service',
    '/about-us', '/contact-us', '/contact', '/about',
    '/namaz', '/prayer-time', '/sitemap', '/feed',
    '/login', '/register', '/signup', '/signin',
    '/admin', '/wp-admin', '/wp-login.php',
    '/cart', '/checkout', '/account', '/profile',
    '/subscribe', '/newsletter', '/unsubscribe',
    '/video', '/videos', '/gallery', '/galleries',
    '/author', '/widget', '/amp'
  ];
  
  private readonly ARTICLE_PATTERNS = [
    '/news/', '/article/', '/story/', '/post/',
    '/press-release/', '/breaking-news/', '/latest-news/',
    '/world-news/', '/bangla-news/', '/sports-news/',
    '/entertainment/', '/technology/', '/business/',
    '/politics/', '/economy/', '/culture/'
  ];
  
  private readonly HOMEPAGE_PATTERNS = [
    '/latest$', '/latest/$', '/news$', '/news/$',
    '/$', '/home$', '/homepage'
  ];
  
  constructor(baseUrl: string) {
    const url = new URL(baseUrl);
    this.baseHostname = url.hostname.replace(/^www\./, '');
    this.baseDomain = url.hostname;
  }
  
  validate(url: string): ValidationResult {
    if (!url || typeof url !== 'string') {
      return { valid: false, reason: 'Invalid URL', type: 'external' };
    }

    if (!url.startsWith('http')) {
      return { valid: false, reason: 'Invalid protocol', type: 'external' };
    }

    if (!this.isSameDomain(url)) {
      return { valid: false, reason: 'External domain', type: 'external' };
    }

    if (this.isSocialDomain(url)) {
      return { valid: false, reason: 'Social domain', type: 'external' };
    }

    if (this.isUtilityPage(url)) {
      return { valid: false, reason: 'Utility page', type: 'utility' };
    }

    const classification = this.classify(url);

    if (classification.type === 'listing' || classification.type === 'homepage') {
      return { valid: true, type: 'listing', reason: 'Listing page - crawl only' };
    }

    if (classification.type === 'utility') {
      return { valid: false, reason: 'Utility page', type: 'utility' };
    }

    if (classification.type === 'article') {
      return { valid: true, type: 'article' };
    }

    return { valid: false, reason: 'Unknown URL type', type: 'external' };
  }

  classify(url: string): ClassificationResult {
    const parsed = new URL(url);
    const pathname = parsed.pathname.replace(/\/$/, '');
    const fullUrl = parsed.href;

    if (pathname === '' || pathname === '/home' || pathname.endsWith('/$') || pathname === this.baseHostname) {
      return {
        type: 'homepage',
        shouldCrawl: true,
        shouldExtract: false,
        priority: 1
      };
    }

    if (this.HOMEPAGE_PATTERNS.some(pattern => fullUrl.endsWith(pattern.replace('$', '')))) {
      return {
        type: 'listing',
        shouldCrawl: true,
        shouldExtract: false,
        priority: 2
      };
    }

    if (/\/page\/\d+/.test(pathname) || /\/paged\d+/.test(pathname) || /\/page\d+/.test(pathname)) {
      return {
        type: 'listing',
        shouldCrawl: true,
        shouldExtract: false,
        priority: 2
      };
    }

    if (/\/category\//.test(pathname) && !/\/news\//.test(pathname) && !/\/article\//.test(pathname)) {
      return {
        type: 'category',
        shouldCrawl: true,
        shouldExtract: false,
        priority: 4
      };
    }

    if (this.UTILITY_PATTERNS.some(pattern => pathname.toLowerCase().includes(pattern))) {
      return {
        type: 'utility',
        shouldCrawl: false,
        shouldExtract: false,
        priority: 9
      };
    }

    if (this.ARTICLE_PATTERNS.some(pattern => pathname.includes(pattern))) {
      return {
        type: 'article',
        shouldCrawl: false,
        shouldExtract: true,
        priority: 3
      };
    }

    if (/\/[a-z]+-\d{6,}/.test(pathname) || /\/[a-z]+-\d{8,}/.test(pathname)) {
      return {
        type: 'article',
        shouldCrawl: false,
        shouldExtract: true,
        priority: 3
      };
    }

    if (pathname.length > 30 && !pathname.includes('.')) {
      return {
        type: 'article',
        shouldCrawl: false,
        shouldExtract: true,
        priority: 5
      };
    }

    return {
      type: 'external',
      shouldCrawl: false,
      shouldExtract: false,
      priority: 10
    };
  }

  private isSameDomain(url: string): boolean {
    try {
      const parsed = new URL(url);
      const hostname = parsed.hostname.replace(/^www\./, '');
      return hostname === this.baseHostname || hostname.endsWith(`.${this.baseHostname}`);
    } catch {
      return false;
    }
  }

  private isSocialDomain(url: string): boolean {
    try {
      const hostname = new URL(url).hostname.toLowerCase();
      return this.SOCIAL_DOMAINS.some(domain => hostname.includes(domain));
    } catch {
      return true;
    }
  }

  private isUtilityPage(url: string): boolean {
    const pathname = new URL(url).pathname.toLowerCase();
    return this.UTILITY_PATTERNS.some(pattern => pathname.includes(pattern));
  }

  extractArticleId(url: string): string | null {
    const patterns = [
      /\/(\d{6,})\/?$/,
      /\/article[_-](\d+)/,
      /\/(\w+)-\d{8,}/,
      /\/news\/(\w+)/
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }

    return null;
  }

  getBaseHostname(): string {
    return this.baseHostname;
  }
}
