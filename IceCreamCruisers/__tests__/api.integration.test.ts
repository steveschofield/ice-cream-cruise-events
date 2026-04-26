import { API_URL } from '../config';

describe('API Integration Tests', () => {
  const skipIntegrationTests = process.env.SKIP_INTEGRATION_TESTS === 'true';

  describe('GET /api/events', () => {
    (skipIntegrationTests ? it.skip : it)('should fetch events successfully', async () => {
      const response = await fetch(`${API_URL}/events`, { signal: AbortSignal.timeout(5000) });
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
    }, 10000);

    (skipIntegrationTests ? it.skip : it)('should return valid event structure', async () => {
      const response = await fetch(`${API_URL}/events`, { signal: AbortSignal.timeout(5000) });
      const data = await response.json();

      if (data.length > 0) {
        const event = data[0];
        expect(event).toHaveProperty('id');
        expect(event).toHaveProperty('name');
        expect(event).toHaveProperty('date');
        expect(event).toHaveProperty('waypoints');
        expect(Array.isArray(event.waypoints)).toBe(true);
      }
    }, 10000);
  });

  describe('GET /api/events/:id', () => {
    (skipIntegrationTests ? it.skip : it)('should handle invalid event ID', async () => {
      const response = await fetch(`${API_URL}/events/99999`, { signal: AbortSignal.timeout(5000) });
      expect([404, 500]).toContain(response.status);
    }, 10000);
  });
});
