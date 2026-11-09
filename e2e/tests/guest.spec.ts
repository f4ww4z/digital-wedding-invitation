import { expect, test } from '@playwright/test';

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
});
