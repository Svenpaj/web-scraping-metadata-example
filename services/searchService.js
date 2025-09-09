const axios = require('axios');
const cheerio = require('cheerio');

class SearchService {
    constructor() {
        this.userAgent = 'Educational Web Scraper 1.0';
        this.searchEngines = [
            {
                name: 'duckduckgo',
                url: 'https://html.duckduckgo.com/html/',
                method: 'GET'
            },
            {
                name: 'bing',
                url: 'https://www.bing.com/search',
                method: 'GET'
            }
        ];
    }

    async searchWebsites(query, maxResults = 5) {
        try {
            // Try DuckDuckGo first (no API key required)
            const results = await this.searchDuckDuckGo(query, maxResults);
            
            if (results.length === 0) {
                // Fallback to Bing search
                return await this.searchBing(query, maxResults);
            }
            
            return results;
        } catch (error) {
            console.error('Search failed:', error.message);
            // Return demo results for testing
            return this.getDemoResults(query, maxResults);
        }
    }

    async searchDuckDuckGo(query, maxResults) {
        try {
            const response = await axios.get('https://html.duckduckgo.com/html/', {
                params: { q: query },
                headers: {
                    'User-Agent': this.userAgent,
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
                },
                timeout: 10000
            });

            const $ = cheerio.load(response.data);
            const results = [];

            $('.result').each((index, element) => {
                if (results.length >= maxResults) return false;

                const $result = $(element);
                const titleEl = $result.find('.result__title a');
                const snippetEl = $result.find('.result__snippet');
                
                const title = titleEl.text().trim();
                const url = titleEl.attr('href');
                const snippet = snippetEl.text().trim();

                if (title && url && url.startsWith('http')) {
                    results.push({
                        title,
                        url,
                        snippet,
                        source: 'duckduckgo',
                        rank: index + 1
                    });
                }
            });

            return results;
        } catch (error) {
            console.error('DuckDuckGo search failed:', error.message);
            return [];
        }
    }

    async searchBing(query, maxResults) {
        try {
            const response = await axios.get('https://www.bing.com/search', {
                params: { 
                    q: query,
                    count: maxResults 
                },
                headers: {
                    'User-Agent': this.userAgent,
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
                },
                timeout: 10000
            });

            const $ = cheerio.load(response.data);
            const results = [];

            $('.b_algo').each((index, element) => {
                if (results.length >= maxResults) return false;

                const $result = $(element);
                const titleEl = $result.find('h2 a');
                const snippetEl = $result.find('.b_caption p, .b_caption div');
                
                const title = titleEl.text().trim();
                const url = titleEl.attr('href');
                const snippet = snippetEl.first().text().trim();

                if (title && url && url.startsWith('http')) {
                    results.push({
                        title,
                        url,
                        snippet,
                        source: 'bing',
                        rank: index + 1
                    });
                }
            });

            return results;
        } catch (error) {
            console.error('Bing search failed:', error.message);
            return [];
        }
    }

    // Demo/fallback results for testing when search engines are unavailable
    getDemoResults(query, maxResults) {
        const demoSites = [
            {
                title: `Example.com - Information about ${query}`,
                url: 'https://example.com',
                snippet: `Find comprehensive information about ${query} on this example website.`,
                source: 'demo',
                rank: 1
            },
            {
                title: `HTTPBin.org - Testing ${query}`,
                url: 'https://httpbin.org/html',
                snippet: `A simple HTML page for testing web scraping with ${query} related content.`,
                source: 'demo',
                rank: 2
            },
            {
                title: `JsonPlaceholder - ${query} API`,
                url: 'https://jsonplaceholder.typicode.com',
                snippet: `Free to use fake online REST API for testing and prototyping related to ${query}.`,
                source: 'demo',
                rank: 3
            }
        ];

        return demoSites.slice(0, maxResults).map(site => ({
            ...site,
            snippet: `[DEMO MODE] ${site.snippet}`
        }));
    }

    // Advanced search with site filtering
    async searchSpecificSite(query, site, maxResults = 5) {
        const siteQuery = `site:${site} ${query}`;
        return await this.searchWebsites(siteQuery, maxResults);
    }

    // Search for specific file types
    async searchFileType(query, fileType, maxResults = 5) {
        const fileQuery = `${query} filetype:${fileType}`;
        return await this.searchWebsites(fileQuery, maxResults);
    }

    // Search with date range (if supported by search engine)
    async searchWithDateRange(query, dateRange, maxResults = 5) {
        const dateQuery = `${query} ${dateRange}`;
        return await this.searchWebsites(dateQuery, maxResults);
    }

    // Validate search results
    validateResults(results) {
        return results.filter(result => {
            // Check if URL is valid
            try {
                new URL(result.url);
                return true;
            } catch {
                return false;
            }
        }).filter(result => {
            // Filter out common unwanted domains
            const unwantedDomains = [
                'facebook.com',
                'twitter.com',
                'instagram.com',
                'linkedin.com',
                'youtube.com'
            ];
            
            const url = new URL(result.url);
            return !unwantedDomains.some(domain => 
                url.hostname.includes(domain)
            );
        });
    }

    // Get search suggestions (mock implementation)
    async getSearchSuggestions(query) {
        return [
            `${query} tutorial`,
            `${query} examples`,
            `${query} guide`,
            `${query} documentation`,
            `${query} best practices`
        ];
    }
}

module.exports = SearchService;
