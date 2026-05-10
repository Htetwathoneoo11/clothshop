import { expect, test } from '@playwright/test';

const customerUsername = process.env.E2E_CUSTOMER_USERNAME;
const customerPassword = process.env.E2E_CUSTOMER_PASSWORD;

async function signInAsCustomer(page: import('@playwright/test').Page): Promise<void> {
    await page.goto('login');
    await page.locator('#login-username').fill(customerUsername ?? '');
    await page.locator('#login-password').fill(customerPassword ?? '');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL('**/dashboard');
    await expect(page.getByRole('link', { name: /profile|your profile/i }).first()).toBeVisible();
}

async function openFirstProduct(page: import('@playwright/test').Page): Promise<void> {
    await page.goto('dashboard');
    await expect(page.locator('.products-cards-grid')).toBeVisible();
    const firstProduct = page.locator('.product-card-dashboard-title a').first();
    await expect(firstProduct).toBeVisible();
    await firstProduct.click();
    await expect(page.locator('.product-detail-title')).toBeVisible();
}

test.describe('Public storefront frontend', () => {
    test('dashboard, filters, product detail, and info pages render', async ({ page }) => {
        await page.goto('dashboard');
        await expect(page.getByRole('heading', { name: /wardrobe|promotion|season/i })).toBeVisible();
        await expect(page.getByLabel('Category')).toBeVisible();
        await expect(page.getByLabel('Sort')).toBeVisible();
        await expect(page.getByLabel('Search')).toBeVisible();

        const productCards = page.locator('.product-card-dashboard');
        await expect(productCards.first()).toBeVisible();

        await page.getByLabel('Sort').selectOption('price_asc');
        await expect(productCards.first()).toBeVisible();

        const firstTitle = (await page.locator('.product-card-dashboard-title a').first().innerText()).trim();
        await page.getByLabel('Search').fill(firstTitle.split(/\s+/)[0]);
        await expect(productCards.first()).toBeVisible();

        await page.locator('.product-card-dashboard-title a').first().click();
        await expect(page.locator('.product-detail-title')).toBeVisible();
        await expect(page.getByRole('link', { name: /back to shop/i })).toBeVisible();

        for (const route of ['contact', 'shipping-delivery', 'returns', 'faq', 'privacy-policy', 'terms-of-service']) {
            await page.goto(route);
            await expect(page.locator('main')).toBeVisible();
        }
    });

    test('login and registration validation messages are shown client-side', async ({ page }) => {
        await page.goto('login');
        await page.getByRole('button', { name: 'Sign in' }).click();
        await expect(page.getByRole('alert')).toContainText('Please enter your username or email.');

        await page.goto('register');
        await page.getByRole('button', { name: 'Create account' }).click();
        await expect(page.getByRole('alert')).toContainText('Please enter a username.');

        await page.locator('#register-username').fill('e2e_validation_user');
        await page.locator('#register-email').fill('invalid-email@example.test');
        await page.locator('#register-password').fill('short');
        await page.locator('#register-password-confirmation').fill('short');
        await page.getByRole('button', { name: 'Create account' }).click();
        await expect(page.getByRole('alert')).toContainText('Password must be at least 8 characters.');
    });
});

test.describe('Authenticated customer frontend', () => {
    test.beforeEach(async ({ page }) => {
        test.skip(!customerUsername || !customerPassword, 'Set E2E_CUSTOMER_USERNAME and E2E_CUSTOMER_PASSWORD to run customer E2E tests.');
        await signInAsCustomer(page);
    });

    test('product detail can add an item to cart and cart can remove it', async ({ page }) => {
        await openFirstProduct(page);
        await page.getByRole('button', { name: /add to cart/i }).click();
        await expect(page.getByText('Added to cart.')).toBeVisible();

        await page.goto('cart');
        await expect(page.getByRole('heading', { name: 'Shopping Cart' })).toBeVisible();
        await expect(page.locator('.cart-item-card').first()).toBeVisible();

        await page.getByRole('button', { name: /remove/i }).first().click();
        await expect(page.getByText('Your cart is empty.')).toBeVisible();
    });

    test('checkout validates delivery form and completes cash-on-delivery order', async ({ page }) => {
        await openFirstProduct(page);
        await page.getByRole('button', { name: /add to cart/i }).click();
        await expect(page.getByText('Added to cart.')).toBeVisible();

        await page.goto('checkout');
        await expect(page.getByRole('heading', { name: /review & place order/i })).toBeVisible();

        await page.getByRole('button', { name: /confirm checkout/i }).click();
        await expect(page.getByRole('status')).toContainText('Please fill in all delivery information fields');

        await page.getByLabel('Name').fill('E2E Customer');
        await page.getByLabel('Phone number').fill('09123456789');
        await page.getByLabel('Date for delivery').fill('2026-05-20');
        await page.getByLabel('Time for delivery').fill('10:30');
        await page.getByLabel('Building or flat number').fill('Flat 101');
        await page.getByLabel('Street or road').fill('Pyay Road');
        await page.getByLabel('Township').fill('Kamayut');
        await page.getByLabel('City').fill('Yangon');
        await page.getByLabel('Cash on delivery').check();
        await page.getByRole('button', { name: /confirm checkout/i }).click();

        await expect(page.getByRole('status')).toContainText(/checkout successful|order/i);
        await expect(page.getByText('Your cart is empty.')).toBeVisible();

        await page.goto('profile');
        await expect(page.getByRole('heading', { name: /^profile$/i })).toBeVisible();
        await expect(page.getByText(/order #/i).first()).toBeVisible();
    });
});
