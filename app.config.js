module.exports = ({ config }) => {
  const plugins = [
    ...(config.plugins ?? []),
    [
      './plugins/withMarketPlace',
      {
        marketApplicationId: 'ir.mservices.market',
        marketBindAddress: 'ir.mservices.market.InAppBillingService.BIND',
        marketPermission: 'ir.mservices.market.BILLING',
      },
    ],
  ];
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim();
  if (!iosClientId) return { ...config, plugins };
  if (!/^[a-zA-Z0-9-]+\.apps\.googleusercontent\.com$/.test(iosClientId))
    throw new Error('EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID must be a Google iOS OAuth client ID.');
  const clientIdPrefix = iosClientId.replace('.apps.googleusercontent.com', '');
  return {
    ...config,
    plugins: [
      ...plugins,
      [
        '@react-native-google-signin/google-signin',
        { iosUrlScheme: `com.googleusercontent.apps.${clientIdPrefix}` },
      ],
    ],
  };
};
