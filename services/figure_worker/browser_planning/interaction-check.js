// Actual local rendering with mock mapping responses. No real LLM/Jev or member APIs.
async function checkFigurePlanning(page) {
  const errors = [],
    requests = [];
  const onError = (error) => errors.push(error.message);
  const onConsole = (message) => {
    if (['warning', 'error'].includes(message.type())) errors.push(message.text());
  };
  const onRequest = (request) => requests.push(request.url());
  page.on('pageerror', onError);
  page.on('console', onConsole);
  page.on('request', onRequest);
  try {
    await page.goto('http://127.0.0.1:4319/services/figure_worker/browser_planning/index.html');
    const fixture = page.getByRole('combobox', { name: 'Fixture', exact: true });
    const scenario = page.getByRole('combobox', { name: 'Scenario', exact: true });
    const approve = page.getByRole('checkbox', {
      name: 'Approve displayed metadata (mock only)',
      exact: true,
    });
    const plan = page.getByRole('button', { name: 'Build mock plan', exact: true });
    const confirm = page.getByRole('checkbox', {
      name: 'Confirm frozen plan for local rendering',
      exact: true,
    });
    const render = page.getByRole('button', { name: 'Render confirmed plan', exact: true });
    if ((await plan.isEnabled()) || (await render.isEnabled())) throw new Error('Approval bypass');
    const templates = [
      'grouped-bar',
      'scatter',
      'heatmap',
      'trend',
      'dot-interval',
      'forest',
      'ranked-lollipop',
      'composition',
      'volcano',
      'distribution',
      'radar',
    ];
    const rendered = [];
    for (let i = 0; i < templates.length; i++) {
      await fixture.selectOption(String(i));
      const style = ['standard', 'lancet', 'nature', 'cell', 'nejm'][i % 5];
      await page
        .getByRole('combobox', { name: 'Journal-inspired style', exact: true })
        .selectOption(style);
      await approve.check();
      await plan.click();
      await page.getByLabel('Frozen planning draft', { exact: true }).waitFor({ timeout: 120000 });
      if (await render.isEnabled()) throw new Error('Second confirmation bypass');
      const spec = JSON.parse(
        await page.getByLabel('Frozen planning draft', { exact: true }).textContent()
      );
      const request = JSON.parse(
        await page.getByLabel('Approved planning request', { exact: true }).textContent()
      );
      const evidence = JSON.parse(request.user);
      if (
        request.user.includes(spec.dataset_sha256) ||
        Object.keys(evidence).some(
          (key) => !['templateId', 'styleId', 'goal', 'fields', 'parameters'].includes(key)
        )
      )
        throw new Error('Unapproved evidence');
      await confirm.check();
      await render.click();
      await page
        .getByAltText('Planned figure preview', { exact: true })
        .waitFor({ timeout: 120000 });
      const manifest = JSON.parse(
        await page.getByLabel('Render manifest', { exact: true }).textContent()
      );
      if (
        manifest.width_px !== 4204 ||
        manifest.height_px !== 2362 ||
        Math.abs(manifest.dpi - 600) > 0.05 ||
        manifest.template_version !== spec.template_version ||
        manifest.style_id !== style ||
        manifest.dataset_sha256 !== spec.dataset_sha256 ||
        manifest.preview_watermark !== 'sci-necromancer'
      )
        throw new Error('Wrong rendered version');
      rendered.push({
        template: templates[i],
        style,
        width: manifest.width_px,
        height: manifest.height_px,
        dpi: manifest.dpi,
        dataset: manifest.dataset_sha256,
        spec: manifest.figure_spec_sha256,
      });
    }
    await fixture.selectOption('0');
    for (const name of ['missing-unit', 'injected', 'unknown-column']) {
      await scenario.selectOption(name);
      await approve.check();
      await plan.click();
      if (name === 'missing-unit')
        await page
          .getByRole('status')
          .filter({ hasText: 'Needs input:' })
          .waitFor({ timeout: 120000 });
      else await page.getByRole('alert').waitFor({ timeout: 120000 });
      if (
        (await render.isEnabled()) ||
        (await page.getByLabel('Frozen planning draft', { exact: true }).count())
      )
        throw new Error('Invalid response admitted');
    }
    await fixture.selectOption('5');
    await scenario.selectOption('missing-options');
    await approve.check();
    await plan.click();
    await page
      .getByRole('status')
      .filter({ hasText: 'parameters.interval' })
      .waitFor({ timeout: 120000 });
    await fixture.selectOption('0');
    await scenario.selectOption('delayed');
    for (const action of ['cancel', 'dataset', 'goal']) {
      await approve.check();
      await plan.click();
      await page
        .getByRole('status')
        .filter({ hasText: 'mock-pending' })
        .waitFor({ timeout: 120000 });
      if (action === 'cancel')
        await page.getByRole('button', { name: 'Cancel work', exact: true }).click();
      if (action === 'dataset') await fixture.selectOption('1');
      if (action === 'goal')
        await page.getByRole('textbox', { name: 'Figure goal', exact: true }).fill('Changed goal');
      await page.waitForTimeout(1500); // mock intentionally ignores cancellation
      if (
        (await page.getByLabel('Frozen planning draft', { exact: true }).count()) ||
        (await approve.isChecked())
      )
        throw new Error('Late plan admitted');
    }
    const layouts = [];
    for (const width of [320, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      const layout = await page.evaluate(() => ({
        viewport: innerWidth,
        content: document.documentElement.scrollWidth,
      }));
      if (layout.viewport !== layout.content) throw new Error('Layout overflow');
      layouts.push(layout);
    }
    const external = requests.filter(
      (url) =>
        !url.startsWith('http://127.0.0.1:4319/') &&
        !url.startsWith('blob:http://127.0.0.1:4319/') &&
        !url.startsWith('data:')
    );
    if (external.length || requests.some((url) => url.includes('/api/')) || errors.length)
      throw new Error('Unexpected network or console error');
    return {
      status: 'passed',
      mode: 'mock mapping / actual Pyodide renderer',
      rendered,
      invalidAndMissing: true,
      cancelAndStale: true,
      metadataOnly: true,
      layouts,
      externalRequests: external,
      consoleErrors: errors,
    };
  } finally {
    page.off('pageerror', onError);
    page.off('console', onConsole);
    page.off('request', onRequest);
  }
}
