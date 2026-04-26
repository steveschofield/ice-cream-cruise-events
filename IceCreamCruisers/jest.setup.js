// Define __DEV__ global for testing (test environment is production)
global.__DEV__ = false;

// Mock expo-router
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({}),
  Link: ({ children }) => children,
  useFocusEffect: (callback) => callback(),
}));

// Mock expo-keep-awake
jest.mock('expo-keep-awake', () => ({
  activateKeepAwakeAsync: jest.fn(),
  deactivateKeepAwake: jest.fn(),
}));

// Mock expo-av
jest.mock('expo-av', () => ({
  Audio: {
    setAudioModeAsync: jest.fn(),
    Sound: {
      createAsync: jest.fn(() => Promise.resolve({ sound: { playAsync: jest.fn() } })),
    },
  },
}));

// Mock expo-location
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  watchPositionAsync: jest.fn(),
  Accuracy: { High: 6 },
}));

// Mock react-native-maps
jest.mock('react-native-maps', () => ({
  default: ({ children }) => children,
  Marker: () => null,
  Polyline: () => null,
  Callout: ({ children }) => children,
}));

// Suppress console warnings in tests
global.console = {
  ...console,
  error: jest.fn(),
  warn: jest.fn(),
};
