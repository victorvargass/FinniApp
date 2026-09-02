const GOOGLE_SIGN_IN_PLUGIN = '@react-native-google-signin/google-signin';
const LOCALIZATION_PLUGIN = 'expo-localization';
const LOCAL_AUTHENTICATION_PLUGIN = 'expo-local-authentication';
const nativeSpanish = require('./locales/native-es.json');

function getGoogleIosUrlScheme(clientId) {
  const suffix = '.apps.googleusercontent.com';
  if (!clientId.endsWith(suffix)) {
    throw new Error(
      'EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID debe ser un OAuth Client ID de iOS válido.'
    );
  }

  return `com.googleusercontent.apps.${clientId.slice(0, -suffix.length)}`;
}

module.exports = ({ config }) => {
  const googleIosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim();
  const plugins = (config.plugins ?? []).filter((plugin) => {
    const name = Array.isArray(plugin) ? plugin[0] : plugin;
    return name !== GOOGLE_SIGN_IN_PLUGIN && name !== LOCALIZATION_PLUGIN && name !== LOCAL_AUTHENTICATION_PLUGIN;
  });

  plugins.push([
    LOCALIZATION_PLUGIN,
    {
      supportedLocales: {
        ios: ['es'],
        android: ['es'],
      },
    },
  ]);
  plugins.push([
    LOCAL_AUTHENTICATION_PLUGIN,
    { faceIDPermission: nativeSpanish.faceIDPermission },
  ]);

  if (googleIosClientId) {
    plugins.push([
      GOOGLE_SIGN_IN_PLUGIN,
      { iosUrlScheme: getGoogleIosUrlScheme(googleIosClientId) },
    ]);
  }

  return {
    ...config,
    plugins,
  };
};
