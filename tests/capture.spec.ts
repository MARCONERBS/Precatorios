import { test, expect } from '@playwright/test';

test('capture console', async ({ page }) => {
  const logs: string[] = [];
  page.on('console', msg => logs.push(`[${msg.type()}] ${msg.text()}`));
  page.on('pageerror', exception => {
    logs.push(`[UNCAUGHT EXCEPTION] ${exception.name}: ${exception.message}`);
    logs.push(`${exception.stack}`);
  });

  await page.goto('http://localhost:8080/chat', { waitUntil: 'networkidle' });
  
  // Wait a bit just in case
  await page.waitForTimeout(2000);

  console.log("--- BROWSER LOGS START ---");
  for (const log of logs) {
    console.log(log);
  }
  console.log("--- BROWSER LOGS END ---");
});
