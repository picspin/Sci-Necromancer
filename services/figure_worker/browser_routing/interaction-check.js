// Native browser interactions against a synthetic transport, never a real model evaluation.
async function checkDataFigureRouting(page) {
  const errors = [],
    requests = [],
    consoleIssues = [];
  const onError = (error) => errors.push(error.message);
  const onRequest = (request) => requests.push(request.url());
  const onConsole = (message) => {
    if (['error', 'warning'].includes(message.type())) consoleIssues.push(message.text());
  };
  page.on('pageerror', onError);
  page.on('request', onRequest);
  page.on('console', onConsole);
  try {
    await page.goto('http://127.0.0.1:4319/services/figure_worker/browser_routing/index.html');
    const goal = page.getByLabel('Figure goal', { exact: true });
    const approval = page.getByLabel('I approve sending exactly this metadata to TypeSafe', {
      exact: true,
    });
    const submit = page.getByRole('button', {
      name: 'Assess metadata and chart types',
      exact: true,
    });
    const choose = page.getByRole('button', { name: 'Choose scatter · 93.00', exact: true });
    const selection = page.getByLabel('Selection', { exact: true });
    if (await submit.isEnabled()) throw new Error('Approval bypass');
    await goal.fill('Compare supplied numeric values');
    await approval.check();
    await submit.click();
    await choose.waitFor();
    await page.getByText('Length adequacy · 90.00', { exact: true }).waitFor();
    await page.getByText('Content readiness · 78.00', { exact: true }).waitFor();
    if (await page.getByText(/jev-1.13.0/).count()) throw new Error('Model exposed in member UI');
    if ((await selection.textContent()) !== 'none') throw new Error('Automatic selection');
    await choose.click();
    if ((await selection.textContent()) !== 'scatter') throw new Error('Selection not applied');
    const egress = JSON.parse(
      await page.getByLabel('Recorded requests', { exact: true }).textContent()
    );
    if (
      egress.length !== 1 ||
      JSON.stringify(egress).includes('PRIVATE_') ||
      JSON.stringify(egress).includes('dataset_sha256')
    )
      throw new Error('Unexpected egress');
    await goal.fill('Changed goal');
    if ((await choose.count()) || (await approval.isChecked()))
      throw new Error('Stale approval/result');
    const states = [];
    for (const scenario of ['none', 'malformed', '202', '401', '402', '403', '404', '429', '503']) {
      await page.getByLabel('Scenario', { exact: true }).selectOption(scenario);
      await goal.fill('Synthetic goal ' + scenario);
      await approval.check();
      await submit.click();
      if (scenario === 'none') await page.getByText(/No template exceeded 80/).waitFor();
      else await page.getByRole('alert').waitFor();
      if (await choose.count()) throw new Error('Invalid candidate shown');
      await page.getByRole('button', { name: 'Choose a template manually', exact: true }).click();
      states.push(scenario);
    }
    await page.getByLabel('Scenario', { exact: true }).selectOption('delayed');
    await goal.fill('Cancellation check');
    await approval.check();
    await submit.click();
    await page.getByRole('button', { name: 'Cancel suggestions', exact: true }).click();
    // The synthetic transport deliberately ignores abort and resolves at 1200ms.
    await page.waitForTimeout(1500);
    if (await choose.count()) throw new Error('Canceled late result shown');
    for (const action of ['Change dataset', 'Change identity', 'Toggle access']) {
      await goal.fill('Stale check ' + action);
      await approval.check();
      await submit.click();
      await page.getByRole('button', { name: action, exact: true }).click();
      await page.waitForTimeout(1500);
      if (await choose.count()) throw new Error('Stale result shown');
      states.push(action);
    }
    await page.getByRole('button', { name: 'Toggle access', exact: true }).click();
    await page.getByLabel('Scenario', { exact: true }).selectOption('multiple');
    await goal.fill('Review numeric relationships');
    await approval.check();
    await submit.click();
    await choose.waitFor();
    const layouts = [];
    for (const width of [320, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      const layout = await page.evaluate(() => ({
        viewport: innerWidth,
        content: document.documentElement.scrollWidth,
      }));
      if (layout.content > layout.viewport) throw new Error('Horizontal overflow');
      layouts.push(layout);
    }
    await choose.focus();
    await page.keyboard.press('Tab');
    const focus = await page.evaluate(() => document.activeElement?.textContent);
    if (focus !== 'Choose trend · 91.00') throw new Error('Keyboard focus order');
    if (
      errors.length ||
      consoleIssues.length ||
      requests.some((url) => !url.startsWith('http://127.0.0.1:4319/'))
    )
      throw new Error(JSON.stringify({ errors, consoleIssues, requests }));
    return {
      status: 'passed',
      evidence: 'synthetic transport only; not Jev quality',
      egress,
      assessment: { lengthAdequacy: 0.9, contentReadiness: 0.78 },
      states,
      cancellation: true,
      layouts,
      focus,
      pageErrors: errors,
      consoleIssues,
      userAgent: await page.evaluate(() => navigator.userAgent),
      externalRequests: [],
    };
  } finally {
    page.off('pageerror', onError);
    page.off('request', onRequest);
    page.off('console', onConsole);
  }
}
