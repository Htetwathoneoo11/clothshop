import { defineConfig, devices } from '@playwright/test';

const baseURL = (process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8000/clothshop').replace(/\/?$/, '/');

export default defineConfig({
    testDir: './e2e',
    timeout: 60_000,
    expect: {
        timeout: 10_000,
    },
    fullyParallel: false,
    forbidOnly: Boolean(process.env.CI),
    retries: process.env.CI ? 2 : 0,
    workers: 1,
    webServer: [
        {
            command: 'php artisan serve --host=127.0.0.1 --port=8000 --no-reload',
            url: 'http://127.0.0.1:8000/clothshop',
            reuseExistingServer: true,
            timeout: 120_000,
        },
        {
            command: 'npm run dev -- --host 127.0.0.1',
            url: 'http://127.0.0.1:5173/@vite/client',
            reuseExistingServer: true,
            timeout: 120_000,
        },
    ],
    reporter: [
        ['list'],
        ['html', { open: 'never' }],
    ],
    use: {
        baseURL,
        extraHTTPHeaders: {
            'X-Playwright-E2E': '1',
        },
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
    },
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],
});
