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
    const url = 'http://127.0.0.1:4319/services/figure_worker/browser_member_task/index.html';
    const start = page.getByRole('button', { name: 'Start confirmed task', exact: true });
    const render = page.getByRole('button', { name: 'Render and settle', exact: true });
    const recover = page.getByRole('button', { name: 'Recover original task', exact: true });
    const confirm = page.getByLabel('Confirm frozen spec', { exact: true });
    const phase = (name) => page.getByText(name, { exact: true }).waitFor({ timeout: 30000 });
    const evidence = async () =>
      JSON.parse(await page.getByLabel('Contract evidence').textContent());
    await page.goto(url);
    await start.click();
    await phase('draft');
    const before = await evidence();
    if (before.renders !== 0 || before.debits !== 0)
      throw new Error('Rendered or charged before confirmation');
    await confirm.check();
    await render.click();
    await phase('unknown');
    const unknown = await evidence();
    if (unknown.renders !== 1 || unknown.debits !== 1 || unknown.busy)
      throw new Error('Unknown completion not recoverable');
    await recover.click();
    await phase('completed');
    const after = await evidence();
    if (
      JSON.stringify(after.requests) !== JSON.stringify(['plan', 'complete', 'status']) ||
      after.debits !== 1 ||
      after.supplierCalls !== 1 ||
      after.renders !== 1 ||
      after.busy ||
      after.locked
    )
      throw new Error('Duplicate work during recovery');
    if (await start.isEnabled()) throw new Error('New zero-balance task enabled');
    await page.getByAltText('Synthetic task preview').waitFor();
    const caption = await page.locator('figcaption').textContent();
    if (
      after.manifest.width_px !== 4204 ||
      after.manifest.height_px !== 2362 ||
      Math.abs(after.manifest.dpi - 600) > 0.01
    )
      throw new Error('Unexpected export dimensions or DPI');
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
    const released = {};
    for (const outcome of ['cancelled', 'failed']) {
      await page.goto(outcome === 'failed' ? `${url}?scenario=render-failure` : url);
      await start.click();
      await phase('draft');
      if (outcome === 'cancelled') {
        await page.getByRole('button', { name: 'Cancel task', exact: true }).click();
      } else {
        await confirm.check();
        await render.click();
      }
      await phase(outcome);
      const result = await evidence();
      if (
        result.debits !== 0 ||
        result.busy ||
        result.locked ||
        result.wallet.heldBonus !== 0 ||
        result.wallet.availableBonus !== 1 ||
        (await recover.isEnabled()) ||
        (await render.isEnabled()) ||
        result.renders !== (outcome === 'cancelled' ? 0 : 1) ||
        result.requests.join(',') !== (outcome === 'cancelled' ? 'plan,cancel' : 'plan,fail')
      )
        throw new Error(`Unexpected wallet or state after ${outcome}`);
      released[outcome] = result;
    }
    await page.goto(`${url}?scenario=plan-unavailable`);
    await start.click();
    await phase('unknown');
    await recover.click();
    await phase('unknown');
    await page.getByRole('button', { name: 'Abandon task locally', exact: true }).click();
    await phase('idle');
    const abandoned = await evidence();
    if (
      abandoned.requests.join(',') !== 'plan,plan' ||
      abandoned.debits !== 0 ||
      abandoned.locked ||
      !(await start.isEnabled())
    )
      throw new Error('Unknown task did not return safely to idle');
    const external = requests.filter((url) => !url.startsWith('http://127.0.0.1:4319/'));
    if (errors.length || consoleIssues.length || external.length)
      throw new Error(JSON.stringify({ errors, consoleIssues, external }));
    return {
      evidence: 'synthetic service, actual browser renderer',
      before,
      unknown,
      after,
      caption,
      released,
      abandoned,
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
