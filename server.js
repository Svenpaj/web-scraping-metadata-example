const express = require('express');
const path = require('path');
require('dotenv').config({ debug: true });

/*
 * const originalLog = console.log;
 * console.log = () => {};
 * require('dotenv').config();
 * console.log = originalLog;
 */ 



const ScraperService = require('./services/scraperService');
const SearchService = require('./services/searchService');

const app = express();
const PORT = process.env.PORT || 3000;

// Basic middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

// Initialize services
const scraperService = new ScraperService();
const searchService = new SearchService();

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: '1.0.0',
        note: 'Routes fixed - no more path-to-regexp errors!'
    });
});

// Scrape specific website
app.post('/api/scrape', async (req, res) => {
    try {
        const { url, selector, options = {} } = req.body;
        
        if (!url) {
            return res.status(400).json({ 
                error: 'URL is required' 
            });
        }

        // Validate URL
        try {
            new URL(url);
        } catch {
            return res.status(400).json({ 
                error: 'Invalid URL format' 
            });
        }

        console.log(`Scraping: ${url}`);

        const result = await scraperService.scrapeWebsite({
            url,
            selector: selector || 'h1, h2, h3, p',
            options: {
                waitForSelector: options.waitForSelector,
                timeout: options.timeout || 30000,
                javascript: options.javascript || false,
                headers: options.headers || {}
            }
        });

        res.json({
            success: true,
            data: result,
            scrapedAt: new Date().toISOString()
        });

    } catch (error) {
        console.error('Scraping error:', error);
        res.status(500).json({ 
            error: 'Scraping failed', 
            message: error.message 
        });
    }
});

// Search and scrape multiple websites
app.post('/api/search-scrape', async (req, res) => {
    try {
        const { query, maxResults = 5, selector, options = {} } = req.body;
        
        if (!query) {
            return res.status(400).json({ 
                error: 'Search query is required' 
            });
        }

        console.log(`Search-scrape: "${query}"`);

        // Search for websites
        const searchResults = await searchService.searchWebsites(query, maxResults);
        
        if (searchResults.length === 0) {
            return res.json({
                success: true,
                data: {
                    query,
                    searchResults: [],
                    scrapedData: [],
                    message: 'No search results found'
                }
            });
        }

        // Scrape found websites
        const scrapedData = await Promise.allSettled(
            searchResults.map(async (result) => {
                try {
                    const scraped = await scraperService.scrapeWebsite({
                        url: result.url,
                        selector: selector || 'h1, h2, h3, p',
                        options: {
                            timeout: 15000,
                            javascript: options.javascript || false
                        }
                    });
                    
                    return { ...result, scraped, success: true };
                } catch (error) {
                    return { ...result, error: error.message, success: false };
                }
            })
        );

        const processedData = scrapedData.map((result, index) => {
            return result.status === 'fulfilled' ? result.value : {
                ...searchResults[index],
                error: result.reason.message,
                success: false
            };
        });

        res.json({
            success: true,
            data: {
                query,
                searchResults,
                scrapedData: processedData,
                summary: {
                    totalFound: searchResults.length,
                    successfulScrapes: processedData.filter(d => d.success).length,
                    failedScrapes: processedData.filter(d => !d.success).length
                }
            },
            scrapedAt: new Date().toISOString()
        });

    } catch (error) {
        console.error('Search-scrape error:', error);
        res.status(500).json({ 
            error: 'Search and scrape failed', 
            message: error.message 
        });
    }
});

// Validate URL endpoint
app.post('/api/validate-url', (req, res) => {
    try {
        const { url } = req.body;
        const parsedUrl = new URL(url);
        
        res.json({
            valid: true,
            protocol: parsedUrl.protocol,
            hostname: parsedUrl.hostname,
            pathname: parsedUrl.pathname
        });
    } catch {
        res.json({ valid: false });
    }
});

// API routes fallback
app.all('/api/*', (req, res) => {
    res.status(404).json({ 
        error: 'API endpoint not found',
        path: req.path,
        method: req.method,
        availableEndpoints: [
            'GET /api/health',
            'POST /api/scrape',
            'POST /api/search-scrape',
            'POST /api/validate-url'
        ]
    });
});

// General fallback for all other routes (instead of app.use('*'))
app.all('*', (req, res) => {
    // If it's requesting a file that doesn't exist, return 404
    if (req.path.includes('.')) {
        return res.status(404).json({ error: 'File not found' });
    }
    
    // Otherwise, serve the main app (for SPA routing)
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Unhandled error:', error);
    res.status(500).json({ 
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
});

// Graceful shutdown
const gracefulShutdown = async (signal) => {
    console.log(`${signal} received, shutting down gracefully...`);
    try {
        await scraperService.cleanup();
        console.log('Cleanup completed');
        process.exit(0);
    } catch (error) {
        console.error('Error during cleanup:', error);
        process.exit(1);
    }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server
app.listen(PORT, () => {
    console.log(`Web Scraper running on http://localhost:${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/api/health`);
    console.log(`Serving static files from: ${path.join(__dirname, 'public')}`);
});

module.exports = app;
