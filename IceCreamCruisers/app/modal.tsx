import { Platform } from 'react-native';

// iOS uses native react-native-maps; Android and web use Leaflet web view
const ModalScreen = Platform.select({
  ios: () => require('../screens/modal-screen.native').default,
  web: () => require('../screens/modal-screen.web').default,
  default: () => require('../screens/modal-screen.web').default,
})();

export default ModalScreen;
