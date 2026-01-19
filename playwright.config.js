import { defineConfig } from '@playwright/test'

export default defineConfig({
    testDir: './tests/e2e',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: 'html',

    use: {
        baseURL: 'http://localhost:8080',
        trace: 'on-first-retry',
        video: 'on-first-retry',
    },

    projects: [
        {
            name: 'chromium',
            use: {
                browserName: 'chromium',
                viewport: { width: 400, height: 600 },
                launchOptions: {
                    args: ['--use-gl=egl']
                }
            },
        },
    ],

    webServer: {
        command: 'python3 -m http.server 8080',
        url: 'http://localhost:8080',
        reuseExistingServer: !process.env.CI,
        timeout: 10000,
    },

    expect: {
        toHaveScreenshot: {
            maxDiffPixels: 100,
        },
    },
})
