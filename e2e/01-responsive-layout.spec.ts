import { expect, test } from '@playwright/test';

const customerUsername = process.env.E2E_CUSTOMER_USERNAME;
const customerPassword = process.env.E2E_CUSTOMER_PASSWORD;

async function expectNoHorizontalOverflow(page: import('@playwright/test').Page): Promise<void> {
    await expect.poll(async () => page.evaluate(() => {
        const documentWidth = document.documentElement.scrollWidth;
        const viewportWidth = document.documentElement.clientWidth;
        return documentWidth <= viewportWidth + 2;
    })).toBe(true);
}

async function signInAsCustomer(page: import('@playwright/test').Page): Promise<void> {
    await page.goto('login');
    await page.locator('#login-username').fill(customerUsername ?? '');
    await page.locator('#login-password').fill(customerPassword ?? '');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL('**/dashboard');
    await expect(page.getByRole('link', { name: /profile|your profile/i }).first()).toBeVisible();
}

async function clearCart(page: import('@playwright/test').Page): Promise<void> {
    await page.goto('cart');

    for (let i = 0; i < 10; i += 1) {
        const itemCount = await page.locator('.cart-item-card').count();
        const removeButton = page.getByRole('button', { name: /remove/i }).first();
        if (!await removeButton.isVisible({ timeout: 1500 }).catch(() => false)) {
            return;
        }

        await removeButton.click();
        await expect.poll(async () => page.locator('.cart-item-card').count()).toBeLessThan(itemCount);
    }
}

async function openDashboardWithProducts(page: import('@playwright/test').Page, searchTerm = ''): Promise<void> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
        await page.goto('dashboard');
        if (searchTerm) {
            await page.getByLabel('Search').fill(searchTerm);
        }

        const productLink = searchTerm
            ? page.locator('.product-card-dashboard-title a').filter({ hasText: searchTerm }).first()
            : page.locator('.product-card-dashboard-title a').first();

        if (await productLink.isVisible({ timeout: 5000 }).catch(() => false)) {
            return;
        }
    }

    const productLink = searchTerm
        ? page.locator('.product-card-dashboard-title a').filter({ hasText: searchTerm }).first()
        : page.locator('.product-card-dashboard-title a').first();
    await expect(productLink).toBeVisible();
}

test.describe('Responsive frontend layout', () => {
    test.use({ viewport: { width: 390, height: 844 }, isMobile: true });

    test('public storefront and product detail remain usable on mobile', async ({ page }) => {
        await openDashboardWithProducts(page);
        await expect(page.getByRole('region', { name: 'Product catalog' })).toBeVisible();
        await expect(page.getByLabel('Category')).toBeVisible();
        await expect(page.getByLabel('Sort')).toBeVisible();
        await expect(page.getByLabel('Search')).toBeVisible();
        await expect(page.locator('.product-card-dashboard').first()).toBeVisible();
        await expectNoHorizontalOverflow(page);

        await page.locator('.product-card-dashboard-title a').first().click();
        await expect(page.locator('.product-detail-title')).toBeVisible();
        await expect(page.getByRole('link', { name: /back to shop/i })).toBeVisible();
        await expectNoHorizontalOverflow(page);
    });

    test('cart and checkout pages remain usable on mobile for a customer', async ({ page }) => {
        test.skip(!customerUsername || !customerPassword, 'Set E2E_CUSTOMER_USERNAME and E2E_CUSTOMER_PASSWORD to run customer E2E tests.');
        await signInAsCustomer(page);
        await clearCart(page);

        await openDashboardWithProducts(page, 'AAA E2E Test Product');
        await page.locator('.product-card-dashboard-title a').filter({ hasText: 'AAA E2E Test Product' }).first().click();
        await page.getByRole('button', { name: /add to cart/i }).click();
        await expect(page.getByText('Added to cart.')).toBeVisible();

        await page.goto('cart');
        await expect(page.getByRole('heading', { name: 'Shopping Cart' })).toBeVisible();
        await expect(page.locator('.cart-item-card').first()).toBeVisible();
        await expectNoHorizontalOverflow(page);

        await page.goto('checkout');
        await expect(page.getByRole('heading', { name: /review & place order/i })).toBeVisible();
        await expect(page.getByRole('button', { name: /confirm checkout/i })).toBeVisible();
        await expectNoHorizontalOverflow(page);
    });
});
