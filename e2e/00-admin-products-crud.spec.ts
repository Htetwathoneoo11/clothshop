import { expect, test } from '@playwright/test';
import path from 'node:path';

const adminUsername = process.env.E2E_ADMIN_USERNAME;
const adminPassword = process.env.E2E_ADMIN_PASSWORD;
const uploadImagePath = path.join(process.cwd(), 'public', 'images', 'logo.png');

async function signInAsAdmin(page: import('@playwright/test').Page): Promise<void> {
    await page.goto('login');
    await page.locator('#login-username').fill(adminUsername ?? '');
    await page.locator('#login-password').fill(adminPassword ?? '');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL('**/dashboard');
}

test.describe('Admin product CRUD frontend', () => {
    test.beforeEach(async ({ page }) => {
        test.skip(!adminUsername || !adminPassword, 'Set E2E_ADMIN_USERNAME and E2E_ADMIN_PASSWORD to run admin E2E tests.');
        await signInAsAdmin(page);
    });

    test('admin can create, update, upload image, add variant, and delete a product', async ({ page }) => {
        const stamp = Date.now();
        const productName = `E2E CRUD Product ${stamp}`;
        const updatedName = `${productName} Updated`;
        const sku = `E2E-CRUD-${stamp}`;
        const secondSku = `E2E-CRUD-${stamp}-L`;

        page.on('dialog', (dialog) => dialog.accept());

        await page.goto('admin/products/create');
        if (await page.getByRole('heading', { name: 'Admin sign-in required' }).isVisible().catch(() => false)) {
            await page.reload();
        }
        await expect(page.getByRole('heading', { name: 'Create Product' })).toBeVisible();

        await page.getByPlaceholder('Product name').fill(productName);
        await page.locator('select').first().selectOption('Topwear');
        await page.getByPlaceholder('Brand').fill('E2E Brand');
        await page.getByLabel('Product image').setInputFiles(uploadImagePath);
        await expect(page.getByAltText('Preview')).toBeVisible();
        await page.getByPlaceholder('Description').fill('Created by Playwright E2E.');
        await page.getByPlaceholder('Color').fill('Black');
        await page.locator('select').nth(1).selectOption('M');
        await page.getByPlaceholder('Price (MMK)').fill('25000');
        await page.getByPlaceholder('Stock').fill('8');
        await page.getByPlaceholder('SKU (optional)').fill(sku);
        await page.getByRole('button', { name: 'Create Product' }).click();

        await page.waitForURL('**/admin/products');
        await page.getByPlaceholder('Search products...').fill(productName);
        await page.getByRole('button', { name: 'Search' }).click();
        const createdCard = page.locator('.admin-products-card').filter({ hasText: productName }).first();
        await expect(createdCard).toBeVisible();
        await createdCard.getByRole('link', { name: 'Edit Product' }).click();

        await expect(page.getByRole('heading', { name: 'Edit Product' })).toBeVisible();
        await page.locator('.admin-products-form').first().locator('input').first().fill(updatedName);
        await page.getByLabel('Replace image').setInputFiles(uploadImagePath);
        await expect(page.getByAltText('Replacement preview')).toBeVisible();
        await page.getByRole('button', { name: 'Save Product' }).click();
        await expect(page.getByText('Product updated.')).toBeVisible();

        await page.locator('.admin-products-variant-add').getByPlaceholder('Color').fill('Blue');
        await page.locator('.admin-products-variant-add').locator('select').selectOption('L');
        await page.locator('.admin-products-variant-add').getByPlaceholder('Price (MMK)').fill('30000');
        await page.locator('.admin-products-variant-add').getByPlaceholder('Stock').fill('5');
        await page.locator('.admin-products-variant-add').getByPlaceholder('SKU (optional)').fill(secondSku);
        await page.getByRole('button', { name: 'Add Variant' }).click();
        await expect(page.getByText('Variant added.')).toBeVisible();
        await expect(page.getByRole('heading', { name: /Variants \(2\)/ })).toBeVisible();

        await page.getByRole('button', { name: 'Delete Product' }).click();
        await page.waitForURL('**/admin/products');
        await page.getByPlaceholder('Search products...').fill(updatedName);
        await page.getByRole('button', { name: 'Search' }).click();
        await expect(page.getByText('No products found')).toBeVisible();
    });
});
