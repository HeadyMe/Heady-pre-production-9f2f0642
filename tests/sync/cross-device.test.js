const { syncDevices } = require('../../scripts/sync-pycharm');

describe('Cross-device synchronization', () => {
  it('should sync PyCharm settings across devices', async () => {
    const result = await syncDevices();
    expect(result.success).toBeTruthy();
    expect(result.failedDevices).toHaveLength(0);
  });
});
