// Backend API URL
// Automatically switches based on environment:
// - Development (npm start): http://localhost:3000/api (local machine)
// - Production (App Store/Play Store): https://ice-cream-cruise-events.onrender.com/api
export const API_URL = __DEV__
  ? 'http://192.168.1.69:3000/api'
  : 'https://ice-cream-cruise-events.onrender.com/api';
