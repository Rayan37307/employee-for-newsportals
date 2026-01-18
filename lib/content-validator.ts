export interface ContentQualityResult {
  isValid: boolean;
  score: number;
  reasons: string[];
  isListingPage: boolean;
  isContactPage: boolean;
  isAdvertisement: boolean;
  isFooterContent: boolean;
  hasRealArticleContent: boolean;
}

export interface ContentValidationConfig {
  minContentLength: number;
  minParagraphs: number;
  maxContactKeywords: number;
  maxCopyrightKeywords: number;
  maxAdvertisementKeywords: number;
  qualityScoreThreshold: number;
}

export class ContentValidator {
  private config: ContentValidationConfig;

  private readonly CONTACT_PATTERNS = [
    /\b(phone|tel|mobile|cell)\s*[:.]?\s*[\d\-\+\(\)\s]{7,}/gi,
    /\b(email|mail|e-mail)\s*[:.]?\s*[\w\.\-]+@[\w\.\-]+\.\w{2,}/gi,
    /\b(address|location)\s*[:.]?\s*[\w\s,\-\.\(\)]{10,}/gi,
    /\b(contact us|get in touch|reach us)\b/gi,
    /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
    /\+?\d{1,3}[-.\s]?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}/g
  ];

  private readonly COPYRIGHT_PATTERNS = [
    /\b(copyright|©|all rights reserved|powered by|designed by)\b/gi,
    /\b\d{4}\s*[-–]\s*\d{4}\b/gi,
    /\b(privacy policy|terms and conditions|terms of use|disclaimer)\b/gi,
    /\b(about us|who we are|our team|meet the staff)\b/gi
  ];

  private readonly ADVERTISEMENT_PATTERNS = [
    /\b(advertisement|advert|sponsored|paid content|pr article)\b/gi,
    /\b(click here|sign up|subscribe now|limited time offer)\b/gi,
    /\b(buy now|order now|get started|free trial)\b/gi,
    /\b(this is an ad|advertorial|native ad)\b/gi
  ];

  private readonly FOOTER_PATTERNS = [
    /\b(quick links|useful links|important links|site map)\b/gi,
    /\b(follow us on|like us on|share this)\b/gi,
    /\b(back to top|scroll to top|return to top)\b/gi,
    /\b(categories:|tags:|related news|you may also like)\b/gi
  ];

  private readonly LISTING_PAGE_PATTERNS = [
    /\b(read more|continue reading|view all|see more)\b/gi,
    /\b(page \d+ of \d+|showing \d+-\d+ of \d+)\b/gi,
    /\b(news list|article list|latest posts|recent stories)\b/gi,
    /<ul[^>]*class="[^"]*pagination/gi,
    /\b(previous|next|older|newer)\b/gi,
    /\d+\s*(results|articles|posts|stories)/gi
  ];

  private readonly ARTICLE_INDICATORS = [
    /<h1[^>]*class="[^"]*title[^"]*"/gi,
    /<h1[^>]*id="[^"]*title[^"]*"/gi,
    /<article/gi,
    /<time[^>]*datetime/gi,
    /<span[^>]*class="[^"]*author[^"]*"/gi,
    /<div[^>]*class="[^"]*article[-_]body[^"]*"/gi,
    /<div[^>]*class="[^"]*post[-_]content[^"]*"/gi,
    /<p[^>]*class="[^"]*lead[^"]*"/gi
  ];

  private readonly LOW_QUALITY_PATTERNS = [
    /^[a-z0-9\s,\-\.]+$/i,
    /\b(the|a|an)\s.*\b(the|a|an)\s/i,
    /(.)\1{4,}/i,
    /\b\d{5,}\b/
  ];

  constructor(config?: Partial<ContentValidationConfig>) {
    this.config = {
      minContentLength: 300,
      minParagraphs: 3,
      maxContactKeywords: 0,
      maxCopyrightKeywords: 0,
      maxAdvertisementKeywords: 0,
      qualityScoreThreshold: 60,
      ...config
    };
  }

  validate(content: string, title: string, url: string): ContentQualityResult {
    const reasons: string[] = [];
    let score = 100;

    const lowerContent = content.toLowerCase();
    const upperContent = content.toUpperCase();

    if (content.length === 0) {
      return {
        isValid: false,
        score: 0,
        reasons: ['Empty content'],
        isListingPage: false,
        isContactPage: false,
        isAdvertisement: false,
        isFooterContent: false,
        hasRealArticleContent: false
      };
    }

    const contactMatches = this.countMatches(content, this.CONTACT_PATTERNS);
    const copyrightMatches = this.countMatches(content, this.COPYRIGHT_PATTERNS);
    const adMatches = this.countMatches(content, this.ADVERTISEMENT_PATTERNS);
    const footerMatches = this.countMatches(content, this.FOOTER_PATTERNS);
    const listingMatches = this.countMatches(content, this.LISTING_PAGE_PATTERNS);

    const isContactPage = contactMatches > this.config.maxContactKeywords;
    const isAdvertisement = adMatches > this.config.maxAdvertisementKeywords;
    const isFooterContent = footerMatches > 2 && content.length < 500;
    const isListingPage = listingMatches > 2;

    if (isContactPage) {
      score -= 50;
      reasons.push(`Contact information detected (${contactMatches} matches)`);
    }

    if (isAdvertisement) {
      score -= 50;
      reasons.push(`Advertisement content detected (${adMatches} matches)`);
    }

    if (isFooterContent) {
      score -= 40;
      reasons.push('Likely footer content detected');
    }

    if (isListingPage) {
      score -= 60;
      reasons.push('Listing page content detected');
    }

    if (copyrightMatches > this.config.maxCopyrightKeywords) {
      score -= 30;
      reasons.push(`Copyright/boilerplate content detected (${copyrightMatches} matches)`);
    }

    const paragraphs = this.extractParagraphs(content);
    if (paragraphs.length < this.config.minParagraphs) {
      score -= 20 * (this.config.minParagraphs - paragraphs.length);
      reasons.push(`Too few paragraphs (${paragraphs.length} < ${this.config.minParagraphs})`);
    }

    if (content.length < this.config.minContentLength) {
      score -= 30;
      reasons.push(`Content too short (${content.length} < ${this.config.minContentLength})`);
    }

    const titleWords = title.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const titleInContent = titleWords.filter(word => lowerContent.includes(word)).length;
    const titleCoverage = titleWords.length > 0 ? titleInContent / titleWords.length : 0;
    
    if (titleCoverage < 0.3 && title.length > 20) {
      score -= 20;
      reasons.push('Title not well reflected in content');
    }

    const articleIndicators = this.countMatches(content, this.ARTICLE_INDICATORS);
    if (articleIndicators === 0) {
      score -= 25;
      reasons.push('No article structure indicators found');
    }

    const avgParagraphLength = paragraphs.reduce((sum, p) => sum + p.length, 0) / (paragraphs.length || 1);
    if (avgParagraphLength < 50) {
      score -= 15;
      reasons.push('Paragraphs are unusually short');
    }

    if (avgParagraphLength > 2000) {
      score -= 10;
      reasons.push('Paragraphs are unusually long (possible concatenated content)');
    }

    const hasRealArticleContent = 
      !isContactPage && 
      !isAdvertisement && 
      !isFooterContent && 
      !isListingPage &&
      content.length >= this.config.minContentLength &&
      paragraphs.length >= this.config.minParagraphs &&
      score >= this.config.qualityScoreThreshold;

    return {
      isValid: hasRealArticleContent,
      score: Math.max(0, score),
      reasons,
      isListingPage,
      isContactPage,
      isAdvertisement,
      isFooterContent,
      hasRealArticleContent
    };
  }

  validateHTML(html: string): ContentQualityResult {
    const content = this.extractTextFromHTML(html);
    const title = this.extractTitleFromHTML(html);
    return this.validate(content, title, '');
  }

  private countMatches(text: string, patterns: RegExp[]): number {
    let count = 0;
    for (const pattern of patterns) {
      const matches = text.match(pattern);
      if (matches) count += matches.length;
    }
    return count;
  }

  private extractParagraphs(content: string): string[] {
    return content
      .split(/\n\n+/)
      .map(p => p.trim())
      .filter(p => p.length > 20);
  }

  private extractTextFromHTML(html: string): string {
    const dom = new (require('jsdom').JSDOM)(html);
    const scriptAndStyle = dom.window.document.querySelectorAll('script, style, noscript, iframe');
    scriptAndStyle.forEach((el: Element) => el.remove());
    
    const articleSelectors = [
      'article',
      '[class*="article"]',
      '[class*="post"]',
      '[class*="news-content"]',
      '[class*="entry-content"]',
      '.single-post',
      '.post-content',
      '.article-body',
      'main'
    ];

    let articleElement: Element | null = null;
    for (const selector of articleSelectors) {
      const el = dom.window.document.querySelector(selector);
      if (el) {
        articleElement = el;
        break;
      }
    }

    const element = articleElement || dom.window.document.body;
    const paragraphs = element.querySelectorAll('p');
    
    const contentParts: string[] = [];
    for (const p of Array.from(paragraphs) as Element[]) {
      const text = p.textContent?.trim() || '';
      if (text.length > 30) {
        contentParts.push(text);
      }
    }

    return contentParts.join('\n\n');
  }

  private extractTitleFromHTML(html: string): string {
    const dom = new (require('jsdom').JSDOM)(html);
    
    const ogTitle = dom.window.document.querySelector('meta[property="og:title"]')?.getAttribute('content');
    if (ogTitle) return ogTitle;

    const h1 = dom.window.document.querySelector('h1');
    if (h1) return h1.textContent?.trim() || '';

    const titleTag = dom.window.document.querySelector('title');
    return titleTag?.textContent?.trim() || '';
  }

  isListingPage(html: string, url: string): boolean {
    const urlValidation = this.validateListingURL(url);
    if (urlValidation.isListing) return true;

    const contentValidation = this.validateContentIndicators(html);
    return contentValidation.isListing;
  }

  private validateListingURL(url: string): { isListing: boolean; reason: string } {
    const pathname = new URL(url).pathname.toLowerCase();

    const listingPatterns = [
      /\/latest(-news)?\/?$/,
      /\/news\/?$/,
      /\/updates\/?$/,
      /\/all(-news)?\/?$/,
      /\/page\/\d+/,
      /\/category\//,
      /\/tag\//,
      /\/archive\//
    ];

    for (const pattern of listingPatterns) {
      if (pattern.test(pathname)) {
        return { isListing: true, reason: `URL matches listing pattern: ${pattern}` };
      }
    }

    return { isListing: false, reason: '' };
  }

  private validateContentIndicators(html: string): { isListing: boolean } {
    const listingIndicators = [
      /class="[^"]*pagination/gi,
      /class="[^"]*paging/gi,
      /\d+\s*(results|articles|posts)/gi,
      /(previous|next|older|newer)[^<]*(article|post|news)/gi,
      /<ul[^>]*class="[^"]*article[-_]?list/gi
    ];

    const matches = this.countMatches(html, listingIndicators);
    return { isListing: matches > 1 };
  }
}

export function calculateContentQualityScore(
  content: string,
  title: string,
  paragraphs: string[]
): number {
  let score = 100;

  if (content.length < 100) return 0;
  if (content.length < 300) score -= 20;
  if (content.length < 500) score -= 10;

  if (paragraphs.length < 2) score -= 30;
  else if (paragraphs.length < 3) score -= 15;
  else if (paragraphs.length < 5) score -= 5;

  const avgLength = paragraphs.reduce((sum, p) => sum + p.length, 0) / paragraphs.length;
  if (avgLength < 50) score -= 20;
  if (avgLength > 1500) score -= 10;

  const titleWords = title.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  const contentLower = content.toLowerCase();
  const titleCoverage = titleWords.filter(w => contentLower.includes(w)).length / titleWords.length;
  if (titleCoverage < 0.2 && titleWords.length > 0) score -= 15;

  const copyrightPatterns = [/copyright/i, /all rights reserved/i, /©/];
  const hasCopyright = copyrightPatterns.some(p => p.test(content));
  if (hasCopyright && content.length < 1000) score -= 25;

  const contactPatterns = [/phone/i, /tel/i, /email/i, /contact/i];
  const hasContact = contactPatterns.some(p => p.test(content));
  if (hasContact) score -= 20;

  const adPatterns = [/advertisement/i, /sponsored/i, /advert/i];
  const hasAds = adPatterns.some(p => p.test(content));
  if (hasAds) score -= 30;

  return Math.max(0, Math.min(100, score));
}
