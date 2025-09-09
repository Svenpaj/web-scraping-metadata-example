const cheerio = require('cheerio');
const puppeteer = require('puppeteer');
const axios = require('axios');

class ScraperService {
    constructor() {
        this.browser = null;
        this.userAgent = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    }

    async initBrowser() {
        if (!this.browser) {
            this.browser = await puppeteer.launch({
                headless: 'new',
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--disable-gpu'
                ]
            });
        }
        return this.browser;
    }

    async scrapeWebsite({ url, selector, options = {} }) {
        const startTime = Date.now();
        
        try {
            // Check robots.txt first
            await this.checkRobotsTxt(url);
            
            // Determine scraping method
            if (options.javascript) {
                return await this.scrapeWithPuppeteer(url, selector, options);
            } else {
                try {
                    return await this.scrapeWithCheerio(url, selector, options);
                } catch (error) {
                    console.log('Cheerio failed, falling back to Puppeteer:', error.message);
                    return await this.scrapeWithPuppeteer(url, selector, options);
                }
            }
        } catch (error) {
            throw new Error(`Scraping failed for ${url}: ${error.message}`);
        } finally {
            const endTime = Date.now();
            console.log(`Scraping completed in ${endTime - startTime}ms for ${url}`);
        }
    }

    async scrapeWithCheerio(url, selector, options) {
        const response = await axios.get(url, {
            timeout: options.timeout || 30000,
            headers: {
                'User-Agent': this.userAgent,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate',
                'Connection': 'keep-alive',
                ...options.headers
            },
            maxRedirects: 5
        });

        const $ = cheerio.load(response.data);
        const results = [];

        // Remove script and style elements
        $('script, style, noscript').remove();

        $(selector).each((index, element) => {
            const $el = $(element);
            const text = $el.text().trim();
            
            if (text && text.length > 0) {
                results.push({
                    index,
                    tag: element.tagName.toLowerCase(),
                    text: text,
                    html: $el.html(),
                    attributes: this.getElementAttributes(element),
                    classes: $el.attr('class') ? $el.attr('class').split(' ') : [],
                    id: $el.attr('id') || null
                });
            }
        });

        return {
            url,
            method: 'cheerio',
            selector,
            found: results.length,
            data: results,
            metadata: {
                title: $('title').text().trim(),
                description: $('meta[name="description"]').attr('content') || '',
                keywords: $('meta[name="keywords"]').attr('content') || '',
                charset: $('meta[charset]').attr('charset') || 'utf-8',
                viewport: $('meta[name="viewport"]').attr('content') || ''
            }
        };
    }

    async scrapeWithPuppeteer(url, selector, options) {
        const browser = await this.initBrowser();
        const page = await browser.newPage();
        
        try {
            // Set user agent and viewport
            await page.setUserAgent(this.userAgent);
            await page.setViewport({ width: 1920, height: 1080 });

            // Set extra headers if provided
            if (options.headers && Object.keys(options.headers).length > 0) {
                await page.setExtraHTTPHeaders(options.headers);
            }

            // Navigate to page
            await page.goto(url, { 
                waitUntil: 'networkidle2', 
                timeout: options.timeout || 30000 
            });

            // Wait for specific selector if provided
            if (options.waitForSelector) {
                await page.waitForSelector(options.waitForSelector, { timeout: 5000 });
            }

            // Extract data
            const results = await page.evaluate((sel) => {
                const elements = document.querySelectorAll(sel);
                const data = [];

                elements.forEach((element, index) => {
                    const text = element.textContent.trim();
                    if (text && text.length > 0) {
                        // Get all attributes
                        const attributes = {};
                        for (let attr of element.attributes) {
                            attributes[attr.name] = attr.value;
                        }

                        data.push({
                            index,
                            tag: element.tagName.toLowerCase(),
                            text: text,
                            html: element.innerHTML,
                            attributes: attributes,
                            classes: element.className ? element.className.split(' ') : [],
                            id: element.id || null
                        });
                    }
                });

                // Get page metadata
                const metadata = {
                    title: document.title,
                    description: document.querySelector('meta[name="description"]')?.getAttribute('content') || '',
                    keywords: document.querySelector('meta[name="keywords"]')?.getAttribute('content') || '',
                    charset: document.querySelector('meta[charset]')?.getAttribute('charset') || 'utf-8',
                    viewport: document.querySelector('meta[name="viewport"]')?.getAttribute('content') || ''
                };

                return { data, metadata };
            }, selector);

            return {
                url,
                method: 'puppeteer',
                selector,
                found: results.data.length,
                data: results.data,
                metadata: results.metadata
            };

        } finally {
            await page.close();
        }
    }

    async checkRobotsTxt(url) {
        try {
            const robotsUrl = new URL('/robots.txt', url).href;
            const response = await axios.get(robotsUrl, { 
                timeout: 5000,
                headers: { 'User-Agent': this.userAgent }
            });
            
            const robotsTxt = response.data;
            
            // Basic robots.txt parsing (simplified)
            const lines = robotsTxt.split('\n').map(line => line.trim().toLowerCase());
            let userAgentSection = false;
            
            for (const line of lines) {
                if (line.startsWith('user-agent:')) {
                    userAgentSection = line.includes('*') || line.includes('educational');
                }
                
                if (userAgentSection && line.startsWith('disallow:')) {
                    const disallowPath = line.split('disallow:')[1].trim();
                    const urlPath = new URL(url).pathname;
                    
                    if (disallowPath === '/' || (disallowPath && urlPath.startsWith(disallowPath))) {
                        console.warn(`Robots.txt disallows scraping ${url}`);
                        // Don't throw error, just warn - let user decide
                    }
                }
            }
        } catch (error) {
            // Robots.txt not found or inaccessible - continue scraping
            console.log(`Could not access robots.txt for ${url}`);
        }
    }

    getElementAttributes(element) {
        const attributes = {};
        if (element.attribs) {
            Object.keys(element.attribs).forEach(attr => {
                attributes[attr] = element.attribs[attr];
            });
        }
        return attributes;
    }

    async cleanup() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }
    }
}

module.exports = ScraperService;
