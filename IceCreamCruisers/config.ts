// Backend API URL
// Automatically switches based on environment:
// - Development (npm start): http://localhost:3000/api
// - Production (App Store/Play Store): https://ice-cream-cruise-events.onrender.com/api
export const API_URL = __DEV__
  ? 'http://localhost:3000/api'
  : 'https://ice-cream-cruise-events.onrender.com/api';
