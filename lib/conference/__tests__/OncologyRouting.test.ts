import { beforeEach, describe, expect, it } from 'vitest';
import { ConferenceRegistry } from '../ConferenceRegistry';
import { conferenceRouter } from '../ConferenceRouter';

describe('oncology conference routing', () => {
  beforeEach(() => ConferenceRegistry.reset());

  it('registers ASCO and ESMO while keeping the unfinished ESC module unavailable', async () => {
    await ConferenceRegistry.initialize();

    const available = conferenceRouter.getAvailableConferences();
    expect(available).toEqual(expect.arrayContaining(['ISMRM', 'RSNA', 'ER', 'ASCO', 'ESMO']));
    expect(available).not.toContain('ESC');
    expect(ConferenceRegistry.getConferenceInfo().map((conference) => conference.id)).toEqual([
      'ISMRM',
      'RSNA',
      'ER',
      'ESC',
      'ASCO',
      'ESMO',
    ]);
  });
});
