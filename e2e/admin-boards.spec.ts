import { expect, test } from '@playwright/test';

const adminUsername = process.env.E2E_ADMIN_USERNAME;
const adminPassword = process.env.E2E_ADMIN_PASSWORD;

async function signInAsAdmin(page: import('@playwright/test').Page): Promise<void> {
    await page.goto('login');
    await page.locator('#login-username').fill(adminUsername ?? '');
    await page.locator('#login-password').fill(adminPassword ?? '');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL('**/dashboard');
    await page.goto('admin/boards');
    if (await page.getByText('Could not load boards. Try again.').isVisible().catch(() => false)) {
        await page.reload();
    }
    await expect(page.getByRole('heading', { name: 'Boards' })).toBeVisible();
}

function extractTotalCount(text: string): number {
    const match = text.match(/\d+/);
    return match ? parseInt(match[0], 10) : 0;
}

async function ensureAtLeastOneBoard(page: import('@playwright/test').Page): Promise<void> {
    const cards = page.locator('.admin-hero-card-list .admin-hero-card');
    await expect(page.locator('.admin-hero-list-wrap')).toBeVisible();
    await expect(page.locator('.admin-hero-skeleton-list')).toBeHidden();

    if (await cards.count()) {
        return;
    }

    if (await page.getByText(/You can create up to \d+ boards/i).isVisible()) {
        return;
    }

    const title = `E2E Board ${Date.now()}`;
    const createSection = page.locator('section[aria-labelledby="admin-hero-new"]');
    await createSection.getByRole('textbox', { name: 'Title *' }).fill(title);
    await createSection.getByRole('button', { name: /Publish board/i }).click();
    if (await page.getByText('Could not create board.').isVisible().catch(() => false)) {
        await page.reload();
        if (await cards.count()) {
            return;
        }

        const retryTitle = `E2E Board ${Date.now()}`;
        await createSection.getByRole('textbox', { name: 'Title *' }).fill(retryTitle);
        await createSection.getByRole('button', { name: /Publish board/i }).click();
        await expect(page.locator('.admin-hero-card-title').filter({ hasText: retryTitle })).toBeVisible();
        return;
    }
    await expect(page.locator('.admin-hero-card-title').filter({ hasText: title })).toBeVisible();
}

test.describe('Admin boards UX', () => {
    test.beforeEach(async ({ page }) => {
        test.skip(!adminUsername || !adminPassword, 'Set E2E_ADMIN_USERNAME and E2E_ADMIN_PASSWORD to run admin E2E tests.');
        await signInAsAdmin(page);
        await ensureAtLeastOneBoard(page);
    });

    test('confirm modal supports keyboard access and restores focus', async ({ page }) => {
        let deactivateButton = page.getByRole('button', { name: 'Deactivate' }).first();

        if (!await deactivateButton.isVisible().catch(() => false)) {
            await page.getByRole('button', { name: 'Activate' }).first().click();
            const activateDialog = page.getByRole('dialog');
            await expect(activateDialog).toBeVisible();
            await activateDialog.getByRole('button', { name: 'Activate' }).click();
            await expect(activateDialog).toBeHidden();
            deactivateButton = page.getByRole('button', { name: 'Deactivate' }).first();
        }

        await expect(deactivateButton).toBeVisible();
        await deactivateButton.click();

        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible();

        const cancel = dialog.getByRole('button', { name: 'Cancel' });
        const confirm = dialog.getByRole('button', { name: 'Deactivate' });
        await expect(cancel).toBeFocused();

        await page.keyboard.press('Shift+Tab');
        await expect(confirm).toBeFocused();

        await page.keyboard.press('Escape');
        await expect(dialog).toBeHidden();
        await expect(deactivateButton).toBeFocused();
    });

    test('duplicate action supports undo', async ({ page }) => {
        const totalTextBefore = await page.locator('.admin-hero-list-head .admin-hero-count').innerText();
        const totalBefore = extractTotalCount(totalTextBefore);
        test.skip(totalBefore >= 5, 'Board limit reached; duplicate is disabled by design.');

        page.getByRole('button', { name: 'Duplicate' }).first().click();
        const dialog = page.getByRole('dialog');
        await dialog.getByRole('button', { name: 'Duplicate' }).click();

        await expect(page.getByText('Board duplicated.').first()).toBeVisible();

        await expect.poll(async () => {
            const text = await page.locator('.admin-hero-list-head .admin-hero-count').innerText();
            return extractTotalCount(text);
        }).toBe(totalBefore + 1);

        await page.getByRole('button', { name: 'Undo', exact: true }).click();
        await expect(page.getByText('Duplicate removed.')).toBeVisible();

        await expect.poll(async () => {
            const text = await page.locator('.admin-hero-list-head .admin-hero-count').innerText();
            return extractTotalCount(text);
        }).toBe(totalBefore);
    });

    test('toolbar state persists in URL across reload', async ({ page }) => {
        const firstTitle = (await page.locator('.admin-hero-card-title').first().innerText()).trim();
        const query = firstTitle.split(/\s+/).slice(0, 2).join(' ');

        const toolbar = page.locator('.admin-hero-toolbar');
        const searchInput = toolbar.locator('input').first();
        const statusSelect = toolbar.locator('select').nth(0);
        const sortSelect = toolbar.locator('select').nth(1);

        await searchInput.fill(query);
        await statusSelect.selectOption('all');
        await sortSelect.selectOption('title_asc');
        await toolbar.getByRole('button', { name: 'Search' }).click();

        await expect(page).toHaveURL(/q=/);
        await expect(page).toHaveURL(/sort=title_asc/);

        await page.reload();
        await expect(searchInput).toHaveValue(query);
        await expect(statusSelect).toHaveValue('all');
        await expect(sortSelect).toHaveValue('title_asc');
    });
});
