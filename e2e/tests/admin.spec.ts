import { expect, test, type Page } from '@playwright/test';

const PASSWORD = process.env.ADMIN_PASSWORD;
const USERNAME = process.env.ADMIN_USERNAME ?? 'admin';
const stamp = Date.now().toString(36);

async function login(page: Page) {
  await page.goto('/admin');
  await page.getByLabel('Username').fill(USERNAME);
  await page.getByLabel('Password').fill(PASSWORD!);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
}

test.describe('admin journey', () => {
  test.skip(!PASSWORD, 'Set ADMIN_PASSWORD to run admin tests');

  test('rejects a wrong password', async ({ page }) => {
    await page.goto('/admin');
    await page.getByLabel('Password').fill('definitely-wrong-password');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByRole('alert')).toContainText(/Invalid username or password/);
  });

  test('add a guest whose personal link greets them by name', async ({ page, context }) => {
    await login(page);
    await page.goto('/admin/guests');
    const name = `E2E Family ${stamp}`;
    await page.getByRole('button', { name: 'Add guest' }).click();
    const dlg = page.locator('dialog[open]');
    await dlg.getByLabel('Name as it appears on the invitation').fill(name);
    await dlg.getByLabel('Max guests').fill('3');
    await dlg.getByRole('button', { name: 'Save guest' }).click();
    await expect(page.getByText('Guest added')).toBeVisible();

    const guests = await (await page.request.get('/api/admin/guests')).json();
    const g = guests.find((x: { name: string }) => x.name === name);
    expect(g.code).toMatch(/^[A-Za-z0-9]{10}$/);

    const guestPage = await context.newPage();
    await guestPage.emulateMedia({ reducedMotion: 'reduce' });
    await guestPage.goto(`/?g=${g.code}`);
    await expect(guestPage.getByRole('dialog').getByText(name)).toBeVisible();
    await guestPage.close();

    // clean up
    page.once('dialog', (d) => void d.accept());
    await page.reload();
    await page.getByRole('button', { name: `Delete ${name}` }).click();
    await expect(page.getByText('Guest deleted')).toBeVisible();
  });

  test('publish a content change and see it live', async ({ page }) => {
    await login(page);
    await page.goto('/admin/content');
    await page.getByRole('button', { name: 'Closing & more', exact: true }).click();
    const field = page.getByRole('group', { name: 'Signature line' }).getByLabel('EN');
    const original = await field.inputValue();
    const changed = `With love ${stamp}`;
    await field.fill(changed);
    await page.getByRole('button', { name: 'Publish' }).click();
    await expect(page.getByText('Changes published')).toBeVisible();
    const live = await (await page.request.get('/api/content')).json();
    expect(live.content.closing.signature.en).toBe(changed);

    // invalid values block publishing
    await page.getByRole('button', { name: 'General & look' }).click();
    await page.getByLabel('Primary (rose) hex value').fill('#nope');
    await expect(page.getByRole('button', { name: 'Publish' })).toBeDisabled();

    // restore
    page.once('dialog', (d) => void d.accept());
    await page.getByRole('button', { name: 'Discard' }).click();
    await page.getByRole('button', { name: 'Closing & more', exact: true }).click();
    await field.fill(original);
    await page.getByRole('button', { name: 'Publish' }).click();
    await expect(page.getByText('Changes published')).toBeVisible();
  });
});
