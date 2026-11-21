// Synthetic member transport + real Pyodide; not a live billing/model acceptance test.
async function checkMemberFigureTask(page) {
  const errors = [],
    requests = [],
    consoleIssues = [];
  const onError = (e) => errors.push(e.message);
  const onRequest = (r) => requests.push(r.url());
  const onConsole = (m) => {
    if (['error', 'warning'].includes(m.type())) consoleIssues.push(m.text());
  };
  page.on('pageerror', onError);
  page.on('request', onRequest);
  page.on('console', onConsole);
  try {
    await page.goto('http://127.0.0.1:4319/services/figure_worker/browser_member_task/index.html');
    await page.getByRole('button', { name: 'Start confirmed task', exact: true }).click();
    await page.getByText('draft', { exact: true }).waitFor({ timeout: 30000 });
    const before = JSON.parse(await page.getByLabel('Contract evidence').textContent());
    if (before.renders !== 0 || before.debits !== 0)
      throw new Error('Rendered or charged before confirmation');
    await page.getByLabel('Confirm frozen spec', { exact: true }).check();
    await page.getByRole('button', { name: 'Render and settle', exact: true }).click();
    await page.getByText('unknown', { exact: true }).waitFor({ timeout: 30000 });
    const unknown = JSON.parse(await page.getByLabel('Contract evidence').textContent());
    if (unknown.renders !== 1 || unknown.debits !== 1 || unknown.busy)
      throw new Error('Unknown completion not recoverable');
    await page.getByRole('button', { name: 'Recover original task', exact: true }).click();
    await page.getByText('completed', { exact: true }).waitFor();
    const after = JSON.parse(await page.getByLabel('Contract evidence').textContent());
    if (
      JSON.stringify(after.requests) !== JSON.stringify(['plan', 'complete', 'status']) ||
      after.debits !== 1 ||
      after.supplierCalls !== 1 ||
      after.renders !== 1 ||
      after.busy ||
      after.locked
    )
      throw new Error('Duplicate work during recovery');
    if (await page.getByRole('button', { name: 'Start confirmed task', exact: true }).isEnabled())
      throw new Error('New zero-balance task enabled');
    await page.getByAltText('Synthetic task preview').waitFor();
    const layouts = [];
    for (const width of [320, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      const layout = await page.evaluate(() => ({
        viewport: innerWidth,
        content: document.documentElement.scrollWidth,
      }));
      if (layout.content > layout.viewport) throw new Error('Horizontal overflow');
      layouts.push(layout);
    }
    const external = requests.filter((url) => !url.startsWith('http://127.0.0.1:4319/'));
    if (errors.length || consoleIssues.length || external.length)
      throw new Error(JSON.stringify({ errors, consoleIssues, external }));
    return {
      evidence: 'synthetic service, actual browser renderer',
      before,
      unknown,
      after,
      caption: await page.locator('figcaption').textContent(),
      layouts,
      errors,
      consoleIssues,
      external,
      userAgent: await page.evaluate(() => navigator.userAgent),
    };
  } finally {
    page.off('pageerror', onError);
    page.off('request', onRequest);
    page.off('console', onConsole);
  }
}
