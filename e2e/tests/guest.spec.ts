import { expect, test, type Page } from '@playwright/test';

/** Drag upward from the wax seal by `share` of the viewport height. */
async function swipeUp(page: Page, share: number) {
  const box = (await page.getByRole('button', { name: /Buka Undangan|Open Invitation/ }).boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  const h = page.viewportSize()!.height;
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) await page.mouse.move(x, y - (h * share * i) / 12);
  await page.mouse.up();
}

const stamp = Date.now().toString(36);

test.describe('guest journey', () => {
  test('link preview tags are server-rendered for WhatsApp', async ({ request }) => {
    const html = await (await request.get('/')).text();
    expect(html).toMatch(/<meta property="og:title" content="[^"]+"/);
    expect(html).toMatch(/<meta property="og:image" content="https?:\/\//);
    expect(html).not.toContain('<!--# include');
  });

  test('security headers are present', async ({ request }) => {
    const res = await request.get('/');
    const h = res.headers();
    expect(h['content-security-policy']).toContain("script-src 'self'");
    expect(h['x-frame-options']).toBe('DENY');
    expect(h['x-content-type-options']).toBe('nosniff');
    expect((await request.get('/api/admin/stats')).status()).toBe(401);
  });

  test('open (2.5D fallback), RSVP, and leave a wish', async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const name = `E2E Guest ${stamp}`;

    await page.goto(`/?to=${encodeURIComponent(name)}`);
    await expect(page.getByRole('dialog').getByText(name)).toBeVisible();
    await expect(page.locator('canvas')).toHaveCount(0); // reduced motion → no WebGL
    await expect(page.locator('body')).toHaveClass(/scroll-locked/);
    await page.getByRole('button', { name: /Buka Undangan|Open Invitation/ }).click();
    await expect(page.locator('#home')).toBeVisible();
    await expect(page.locator('body')).not.toHaveClass(/scroll-locked/);

    const rsvp = page.locator('#rsvp');
    await rsvp.scrollIntoViewIfNeeded();
    await expect(rsvp.getByLabel(/^(Nama|Name)$/)).toHaveValue(name);
    await rsvp.getByRole('radio', { name: /^(Hadir|Attending)$/ }).click();
    await rsvp.getByRole('button', { name: /Kirim konfirmasi|Send RSVP/ }).click();
    await expect(page.getByText(/Konfirmasi tersimpan|RSVP saved/)).toBeVisible();

    const wishes = page.locator('#wishes');
    await wishes.scrollIntoViewIfNeeded();
    const msg = `Selamat! <b>${stamp}</b>`;
    await wishes.getByPlaceholder(/Tulis ucapan|Write your wishes/).fill(msg);
    await wishes.getByRole('button', { name: /Kirim ucapan|Send wish/ }).click();
    // Markup is shown as text, and the badge reflects the RSVP we just sent.
    const item = wishes.locator('li', { hasText: stamp }).first();
    await expect(item).toContainText(msg);
    await expect(item).toContainText(/Hadir|Attending/);
    expect(errors).toEqual([]);
    await ctx.close();
  });

  test('3D cover renders and opens', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('canvas')).toHaveCount(1, { timeout: 15_000 });
    await page.getByRole('button', { name: /Buka Undangan|Open Invitation/ }).click();
    await expect(page.locator('#home')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('canvas')).toHaveCount(0, { timeout: 10_000 }); // unmounted after opening
  });

  test('swiping the envelope up past the threshold opens it', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('canvas')).toHaveCount(1, { timeout: 15_000 });
    await expect(page.locator('body')).toHaveClass(/scroll-locked/);
    await swipeUp(page, 0.25); // ~78% of a full swipe, past the 45% commit point
    await expect(page.locator('#home')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('scroll-hint')).toBeVisible();
    await page.mouse.wheel(0, 600);
    await expect(page.getByTestId('scroll-hint')).toHaveCount(0, { timeout: 5_000 });
  });

  test('a short swipe springs back and keeps the cover', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('canvas')).toHaveCount(1, { timeout: 15_000 });
    await swipeUp(page, 0.05);
    await page.waitForTimeout(1500);
    await expect(page.locator('#cover-title')).toBeVisible();
    await expect(page.locator('#home')).toHaveCount(0);
  });

  test('keyboard can open the cover', async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await page.goto('/');
    await page.getByRole('button', { name: /Buka Undangan|Open Invitation/ }).focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#home')).toBeVisible();
    await ctx.close();
  });

  test('gift options stay tucked away until asked for', async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    await page.goto(`/?to=${encodeURIComponent(`Gift ${stamp}`)}`);
    await page.getByRole('button', { name: /Buka Undangan|Open Invitation/ }).click();
    const gift = page.locator('#gift');
    await gift.scrollIntoViewIfNeeded();
    const cta = gift.getByRole('button', { name: /Konfirmasi kirim hadiah|Send or confirm a gift/ });
    await expect(cta).toBeVisible();
    await expect(page.getByText('1234567890', { exact: true })).toBeHidden();

    await cta.click();
    const sheet = page.getByRole('dialog', { name: /Kirim tanda kasih|Send a gift/ });
    await expect(sheet.getByText('1234567890', { exact: true })).toBeVisible();
    await sheet.getByRole('radio', { name: /Dompet digital|E-wallet/ }).click();
    await sheet.getByRole('button', { name: /Kirim konfirmasi|Send confirmation/ }).click();
    await expect(sheet.getByText(/Terima kasih|Thank you/).first()).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();
    await ctx.close();
  });
});
