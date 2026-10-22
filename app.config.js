module.exports = ({ config }) => {
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim();
  if (!iosClientId) return config;
  if (!/^[a-zA-Z0-9-]+\.apps\.googleusercontent\.com$/.test(iosClientId))
    throw new Error('EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID must be a Google iOS OAuth client ID.');
  const clientIdPrefix = iosClientId.replace('.apps.googleusercontent.com', '');
  return {
    ...config,
    plugins: [
      ...(config.plugins ?? []),
      [
        '@react-native-google-signin/google-signin',
        { iosUrlScheme: `com.googleusercontent.apps.${clientIdPrefix}` },
      ],
    ],
  };
};
