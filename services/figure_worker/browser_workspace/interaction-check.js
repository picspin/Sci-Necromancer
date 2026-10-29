// Run with the Playwright MCP run-code tool against the loopback Vite harness.
async function checkDataFigureWorkspace(page) {
  const requests = [],
    errors = [];
  const onRequest = (request) => requests.push(request.url());
  const onConsole = (message) => {
    if (message.type() === 'error') errors.push(message.text());
  };
  page.on('request', onRequest);
  page.on('console', onConsole);
  try {
    await page.goto('http://127.0.0.1:4319/services/figure_worker/browser_workspace/index.html');
    await page.getByRole('button', { name: 'Load synthetic example', exact: true }).click();
    await page.getByRole('button', { name: 'Inspect local CSV', exact: true }).click();
    await page.getByRole('button', { name: 'Cancel and release runtime', exact: true }).click();
    if (await page.getByRole('button', { name: 'Cancel and release runtime', exact: true }).count())
      throw new Error('Cancel did not release runtime');
    const brokenCore = '**/runtime/pyodide/314.0.7/pyodide.asm.wasm';
    await page
      .context()
      .route(brokenCore, (route) =>
        route.fulfill({ status: 200, body: 'intentionally corrupted synthetic test asset' })
      );
    await page.getByRole('button', { name: 'Inspect local CSV', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'figure_runtime_failed' }).waitFor();
    await page.context().unroute(brokenCore);
    await page.getByRole('button', { name: 'Inspect local CSV', exact: true }).click();
    await page.getByText('2 rows · 2 columns', { exact: true }).waitFor();
    await page.getByRole('combobox', { name: 'category', exact: true }).selectOption('col_1');
    await page.getByRole('combobox', { name: 'value', exact: true }).selectOption('col_2');
    await page.getByRole('textbox', { name: 'Unit · value', exact: true }).fill('patients');
    await page
      .getByRole('combobox', { name: 'Journal-inspired style', exact: true })
      .selectOption('nejm');
    await page.getByRole('checkbox').check();
    await page
      .getByRole('button', { name: 'Render local validation preview', exact: true })
      .click();
    await page.getByAltText('Data figure preview', { exact: true }).waitFor();
    const record = JSON.parse(await page.locator('.figure-output pre').textContent());
    if (
      record.width_px !== 4204 ||
      Math.abs(record.dpi - 600) > 0.05 ||
      record.style_id !== 'nejm' ||
      record.preview_watermark !== 'sci-necromancer'
    )
      throw new Error('Unexpected rendered metadata');
    if (
      await page
        .getByRole('button', { name: 'Download original · free with authorization', exact: true })
        .isEnabled()
    )
      throw new Error('Unauthorized original export');
    await page
      .getByRole('combobox', { name: 'Journal-inspired style', exact: true })
      .selectOption('lancet');
    if (
      (await page.getByAltText('Data figure preview', { exact: true }).count()) ||
      (await page.getByRole('checkbox').isChecked())
    )
      throw new Error('Changed plan retained stale confirmation/result');
    const plan = JSON.parse(await page.locator('.figure-controls pre').textContent());
    await page.getByText('Import frozen FigureSpec / multipanel plan', { exact: true }).click();
    await page
      .getByRole('textbox', { name: 'Complete FigureSpec JSON', exact: true })
      .fill(JSON.stringify({ ...plan, python: 'not executed' }));
    await page.getByRole('checkbox').check();
    await page
      .getByRole('button', { name: 'Render local validation preview', exact: true })
      .click();
    await page.getByRole('alert').filter({ hasText: 'invalid_figure_spec_fields' }).waitFor();
    await page.getByRole('textbox', { name: 'Complete FigureSpec JSON', exact: true }).fill('');
    await page.getByRole('checkbox').check();
    await page
      .getByRole('button', { name: 'Render local validation preview', exact: true })
      .click();
    await page.getByAltText('Data figure preview', { exact: true }).waitFor();
    const recovered = JSON.parse(await page.locator('.figure-output pre').textContent());
    // Fixed synthetic fixtures matching the native FigureSpec tests. No inferred
    // intervals, effect sizes, denominators, p correction, or radar axis ranges.
    const cases = [
      [
        'distribution',
        'V,G\n1,A\n4,A\n9,A\n',
        { value: 'col_1', group: 'col_2' },
        { value: 'score' },
        {},
      ],
      [
        'radar',
        'M,T,V\nA,AUC,0.75\nA,Time,25\nA,Error,-2\n',
        { method: 'col_1', metric: 'col_2', value: 'col_3' },
        {},
        {
          radar: {
            axes: [
              { metric: 'AUC', unit: 'ratio', lower: 0, upper: 1, direction: 'higher' },
              { metric: 'Time', unit: 'seconds', lower: 0, upper: 100, direction: 'lower' },
              { metric: 'Error', unit: 'mm', lower: -5, upper: 5, direction: 'lower' },
            ],
          },
        },
      ],
      ['scatter', 'X,Y\n1,2\n', { x: 'col_1', y: 'col_2' }, { x: 'mm', y: 'score' }, {}],
      [
        'heatmap',
        'R,C,V\nA,X,2\n',
        { row: 'col_1', column: 'col_2', value: 'col_3' },
        { value: 'score' },
        {},
      ],
      [
        'trend',
        'X,V\n1,3\n2,8\n',
        { x: 'col_1', value: 'col_2' },
        { x: 'weeks', value: 'patients' },
        {},
      ],
      [
        'dot-interval',
        'L,E,Low,High\nA,2,1,3\n',
        { label: 'col_1', estimate: 'col_2', lower: 'col_3', upper: 'col_4' },
        { value: 'score' },
        { interval: { type: 'CI', ci_level: 95 } },
      ],
      [
        'forest',
        'L,E,Low,High\nA,1.2,0.9,1.8\n',
        { label: 'col_1', estimate: 'col_2', lower: 'col_3', upper: 'col_4' },
        { value: 'OR' },
        { interval: { type: 'CI', ci_level: 95, effect_type: 'OR' } },
      ],
      [
        'ranked-lollipop',
        'L,V\nA,3\nB,5\n',
        { label: 'col_1', value: 'col_2' },
        { value: 'score' },
        { ranking: { ordering: 'descending', top_n: 1 } },
      ],
      [
        'composition',
        'G,C,N,D\nA,X,2,5\nA,Y,3,5\n',
        { group: 'col_1', component: 'col_2', count: 'col_3', denominator: 'col_4' },
        { count: 'patients' },
        {
          composition: {
            display: 'percent',
            denominator_scope: 'within-group',
            mutually_exclusive: true,
            exhaustive: true,
          },
        },
      ],
      [
        'volcano',
        'ID,FC,P\nA,-2,0.001\nB,2,0\n',
        { identifier: 'col_1', log2fc: 'col_2', p: 'col_3' },
        { log2fc: 'log2 fold change', p: 'probability' },
        {
          volcano: {
            p_kind: 'adjusted_p',
            p_threshold: '0.05',
            fold_threshold: 1,
            zero_p_floor: '0.0001',
          },
        },
      ],
    ];
    const templates = [
      {
        template: record.template_version,
        style: record.style_id,
        width: record.width_px,
        height: record.height_px,
      },
    ];
    for (let i = 0; i < cases.length; i++) {
      const [template, csv, mapping, units, options] = cases[i];
      await page.getByRole('textbox', { name: 'CSV content', exact: true }).fill(csv);
      await page.getByRole('button', { name: 'Inspect local CSV', exact: true }).click();
      await page.getByRole('combobox', { name: 'Chart type', exact: true }).selectOption(template);
      await page
        .getByRole('combobox', { name: 'Journal-inspired style', exact: true })
        .selectOption(['standard', 'cell', 'nature', 'nejm', 'lancet'][i % 5]);
      for (const [role, column] of Object.entries(mapping)) {
        await page
          .getByRole('combobox', {
            name: role === 'group' && template !== 'composition' ? 'group · optional' : role,
            exact: true,
          })
          .selectOption(column);
      }
      for (const [role, unit] of Object.entries(units))
        await page.getByRole('textbox', { name: `Unit · ${role}`, exact: true }).fill(unit);
      if (Object.keys(options).length)
        await page
          .getByRole('textbox', { name: 'Explicit statistical options (JSON)', exact: true })
          .fill(JSON.stringify(options));
      await page.getByRole('checkbox').check();
      await page
        .getByRole('button', { name: 'Render local validation preview', exact: true })
        .click();
      await page.getByAltText('Data figure preview', { exact: true }).waitFor();
      const current = JSON.parse(await page.locator('.figure-output pre').textContent());
      if (current.width_px !== 4204 || Math.abs(current.dpi - 600) > 0.05)
        throw new Error(`Invalid actual resolution: ${template}`);
      templates.push({
        template: current.template_version,
        style: current.style_id,
        width: current.width_px,
        height: current.height_px,
      });
    }
    const fixtureBase =
      'http://127.0.0.1:4319/services/figure_worker/examples/radiology-validation/';
    const csv = await (await page.request.get(`${fixtureBase}data.csv`)).text();
    const composite = await (await page.request.get(`${fixtureBase}spec.json`)).json();
    await page.getByRole('textbox', { name: 'CSV content', exact: true }).fill(csv);
    await page.getByRole('button', { name: 'Inspect local CSV', exact: true }).click();
    const composites = [];
    for (const count of [2, 3, 4]) {
      const spec = JSON.parse(JSON.stringify(composite));
      if (count === 2) spec.panels = [spec.panels[0], spec.panels[2]];
      if (count === 4) spec.panels.push({ ...spec.panels[1], title: 'Supplied interval repeat' });
      if (
        !(await page
          .getByRole('textbox', { name: 'Complete FigureSpec JSON', exact: true })
          .isVisible())
      )
        await page.getByText('Import frozen FigureSpec / multipanel plan', { exact: true }).click();
      await page
        .getByRole('textbox', { name: 'Complete FigureSpec JSON', exact: true })
        .fill(JSON.stringify(spec));
      await page.getByRole('checkbox').check();
      await page
        .getByRole('button', { name: 'Render local validation preview', exact: true })
        .click();
      await page.getByAltText('Data figure preview', { exact: true }).waitFor();
      const current = JSON.parse(await page.locator('.figure-output pre').textContent());
      const aspect = 16 / (5.5 * (count === 2 ? 1 : 2));
      if (
        current.width_mm !== 254 ||
        Math.abs(current.width_px / current.height_px - aspect) > 0.005
      )
        throw new Error('Composite aspect/physical size changed');
      composites.push({
        panels: count,
        width: current.width_px,
        height: current.height_px,
        width_mm: current.width_mm,
        height_mm: current.height_mm,
        dpi: current.dpi,
      });
    }
    await page.setViewportSize({ width: 390, height: 844 });
    const layout = await page.evaluate(() => ({
      viewport: innerWidth,
      content: document.documentElement.scrollWidth,
    }));
    if (layout.content > layout.viewport) throw new Error('Narrow viewport overflows');
    const unexpected = requests.filter(
      (url) => !url.startsWith('http://127.0.0.1:4319/') && !url.startsWith('data:')
    );
    if (unexpected.length || requests.some((url) => url.includes('/api/')))
      throw new Error('Unexpected external/API request');
    if (errors.length) throw new Error('Browser console errors');
    return {
      status: 'passed',
      templates,
      composites,
      corruptCoreRejected: true,
      cancelAndRetry: true,
      stalePlanInvalidated: true,
      injectedCodeRejected: true,
      recovery: true,
      freeOriginalStillUnauthorized: true,
      unexpectedRequests: unexpected,
      consoleErrors: errors,
      layout,
      first: record,
      recovered,
    };
  } finally {
    page.off('request', onRequest);
    page.off('console', onConsole);
  }
}
