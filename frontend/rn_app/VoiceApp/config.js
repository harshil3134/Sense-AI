// Get the API URL from environment or use a default
export const API_URL = __DEV__ 
  ? process.env.EXPO_PUBLIC_API_URL || 'http://10.251.226.60:8000'  // Development
  : 'https://your-production-api.com';  // Production

// Optional: Export other config values
export const API_TIMEOUT = 30000; // 30 seconds