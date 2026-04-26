import { API_URL } from '../config';

describe('Configuration', () => {
  it('should have a valid API URL', () => {
    expect(API_URL).toBeDefined();
    expect(typeof API_URL).toBe('string');
  });

  it('should contain /api endpoint', () => {
    expect(API_URL).toContain('/api');
  });

  it('should use local IP for development', () => {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      expect(API_URL).toContain('192.168.1.69');
    }
  });

  it('should use Render URL for production', () => {
    if (typeof __DEV__ !== 'undefined' && !__DEV__) {
      expect(API_URL).toContain('onrender.com');
    }
  });
});
