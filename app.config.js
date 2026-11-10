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
    './plugins/withReleaseSigning',
  ];
  return { ...config, plugins };
};
