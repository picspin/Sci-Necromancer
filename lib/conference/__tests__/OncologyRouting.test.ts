import { beforeEach, describe, expect, it } from 'vitest';
import { ConferenceRegistry } from '../ConferenceRegistry';
import { conferenceRouter } from '../ConferenceRouter';

describe('oncology conference routing', () => {
  beforeEach(() => ConferenceRegistry.reset());

  it('registers ASCO and ESMO without removing existing conference modules', async () => {
    await ConferenceRegistry.initialize();

    expect(conferenceRouter.getAvailableConferences()).toEqual(
      expect.arrayContaining(['ISMRM', 'RSNA', 'ER', 'ESC', 'ASCO', 'ESMO'])
    );
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
