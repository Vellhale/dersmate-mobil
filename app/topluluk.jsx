import { Redirect } from 'expo-router'

/*
  ESKİ TOPLULUK ADRESİ — yönlendirme (2026-09-23).

  Topluluk ekranı ana ekrana taşındı (app/index.jsx), yani artık adresi `/`.
  Bu dosya silinmedi çünkü `dersmate://topluluk` derin bağlantısı sessizce ölürdü:
  projede `linking` yapılandırması YOK, adresler dosya adlarından türüyor (app.json'daki
  `scheme: "dersmate"`), dolayısıyla dosyayı silmek adresi de siler ve bunu hiçbir uyarı
  söylemez.

  Uygulama henüz mağazada olmadığı için dışarıda dolaşan bir bağlantı beklenmiyor —
  bu, ucuz sigortadır. Dosya kaldırılacaksa önce o bağlantının hiçbir yerde
  paylaşılmadığından emin olunmalı.
*/
export default function EskiToplulukAdresi() {
  return <Redirect href="/" />
}
