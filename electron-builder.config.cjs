const publish = require('./scripts/desktop-update-feed.cjs')(process.env.PARABOLIC_UPDATE_FEED_URL);
module.exports = {
  appId: 'internal.parabolic.desktop',
  productName: 'Parabolic',
  directories: { output: 'release' },
  asar: true,
  afterPack: require('./scripts/sign-local-mac.cjs'),
  npmRebuild: false,
  nodeGypRebuild: false,
  files: ['dist/**/*', 'dist-desktop/**/*', 'package.json', '!node_modules/**/*'],
  protocols: [{ name: 'Parabolic workspace link', schemes: ['parabolic'] }],
  ...(publish ? { publish, forceCodeSigning: true } : {}),
  mac: {
    icon: 'src/desktop/Parabolic.icns',
    category: 'public.app-category.productivity',
    target: publish ? [{ target: 'zip', arch: ['arm64'] }, { target: 'dmg', arch: ['arm64'] }] : [{ target: 'dir', arch: ['arm64'] }],
    ...(publish ? {} : { identity: null }),
    darkModeSupport: true,
    extendInfo: { NSAppTransportSecurity: { NSAllowsLocalNetworking: true } },
  },
};
