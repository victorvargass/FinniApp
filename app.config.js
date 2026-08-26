const GOOGLE_SIGN_IN_PLUGIN = '@react-native-google-signin/google-signin';

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
    return name !== GOOGLE_SIGN_IN_PLUGIN;
  });

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
