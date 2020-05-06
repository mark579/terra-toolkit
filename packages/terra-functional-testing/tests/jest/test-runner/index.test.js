const TestRunner = require('../../../lib/test-runner');

describe('index', () => {
  it('should export the test runner', () => {
    expect(TestRunner).toBeDefined();
  });
});
