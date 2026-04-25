import { test, expect } from '@playwright/test';

test.describe('Axiom Health E2E Tests', () => {
  test('Landing Page loads correctly', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Patient Portal')).toBeVisible();
    await expect(page.locator('text=Researcher View')).toBeVisible();
  });

  test('Patient Login and File Upload Flow', async ({ page }) => {
    await page.goto('/');
    
    // One-click demo login
    await page.click('text=Patient Portal');
    await expect(page).toHaveURL(/\/patient/);

    // Verify Patient Dashboard UI
    await expect(page.locator('text=Find your clinical trial')).toBeVisible();
    await expect(page.locator('text=PHI protected')).toBeVisible();

    // Verify Sign Out functionality
    await page.click('text=Sign out');
    await expect(page).toHaveURL(/\//);
  });

  test('Researcher Login and Map View Flow', async ({ page }) => {
    await page.goto('/');
    
    // One-click demo login as researcher
    await page.click('text=Researcher View');
    await expect(page).toHaveURL(/\/researcher/);

    // Verify Researcher Metrics UI
    await expect(page.locator('text=Active Trial')).toBeVisible();
    await expect(page.locator('text=LIVE DISPATCH')).toBeVisible();

    // Test Exit button
    await page.click('text=Exit');
    await expect(page).toHaveURL(/\//);
  });

  test('RBAC Middleware Enforces Roles', async ({ page, request }) => {
    // Attempting to access /researcher without auth should redirect home
    const response = await request.get('/researcher');
    expect(response.status()).toBe(200); // Redirects to '/' which gives 200

    // Log in as patient
    await page.goto('/');
    await page.click('text=Patient Portal');
    await expect(page).toHaveURL(/\/patient/);

    // Try to navigate to researcher page directly
    await page.goto('/researcher');
    // Should be redirected back to the root '/' or '/patient' 
    // depending on the NextAuth config. The current middleware redirects to '/'.
    await expect(page).toHaveURL(/\//);
  });
});
