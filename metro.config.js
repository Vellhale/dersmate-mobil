const path = require('path')
const { getDefaultConfig } = require('expo/metro-config')
const { withNativeWind } = require('nativewind/metro')

const config = getDefaultConfig(__dirname)

/*
  WEB'DE datetimepicker YERİNE YEREL SAPLAMA: @react-native-community/datetimepicker'ın
  web uygulaması yok ve web bundle'ında import anında patlıyor. Uygulamanın gerçek hedefi
  Android/iOS; web çıktısı yalnızca önizleme/inceleme için var (bkz. src/lib/onizleme.js).
  Saplama, Android akışındaki "tarih → saat" adımlarını anında onaylanmış sayar.
*/
const varsayilanCozucu = config.resolver.resolveRequest
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && moduleName === '@react-native-community/datetimepicker') {
    return {
      type: 'sourceFile',
      filePath: path.resolve(__dirname, 'src/lib/datetimepicker.web-saplama.js'),
    }
  }
  return (varsayilanCozucu ?? context.resolveRequest)(context, moduleName, platform)
}

// input: Tailwind direktiflerini taşıyan tek CSS dosyası. Web'deki index.css'in karşılığı;
// NativeWind bunu derleyip stillere çevirir, tarayıcıya CSS gitmez.
module.exports = withNativeWind(config, { input: './global.css' })
