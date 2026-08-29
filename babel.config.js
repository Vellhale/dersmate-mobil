module.exports = function (api) {
  api.cache(true)
  return {
    presets: [
      // jsxImportSource: NativeWind'in className -> style dönüşümü JSX derleyicisinde
      // başlar; bu ayar olmadan className'ler sessizce yok sayılır.
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
  }
}
