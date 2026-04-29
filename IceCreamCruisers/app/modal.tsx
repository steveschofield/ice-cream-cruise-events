import { Platform } from 'react-native';

// Use platform-specific modal screens
const ModalScreen = Platform.select({
  native: () => require('../screens/modal-screen.native').default,
  web: () => require('../screens/modal-screen.web').default,
  default: () => require('../screens/modal-screen.native').default,
})();

export default ModalScreen;
