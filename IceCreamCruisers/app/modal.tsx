import { Platform } from 'react-native';

// iOS: native react-native-maps
// Android: WebView with Leaflet (no Google Maps API key needed)
// Web: iframe with Leaflet
const ModalScreen = Platform.select({
  ios: () => require('../screens/modal-screen.native').default,
  android: () => require('../screens/modal-screen.android').default,
  web: () => require('../screens/modal-screen.web').default,
  default: () => require('../screens/modal-screen.android').default,
})();

export default ModalScreen;
