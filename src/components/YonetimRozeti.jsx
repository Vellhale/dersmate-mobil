import { Text, View } from 'react-native'
import { beyaz } from '../lib/theme'
import { KalkanIkonu } from './Ikonlar'

/*
  ─── YÖNETİM ROZETİ ──────────────────────────────────────────────────────────
  Web'deki components/YonetimRozeti.jsx'in RN portu.

  Ürün sahibi kararı: forumda ve Keşfet'te platformla ilgili sorular sorulacak ve RESMİ
  CEVABIN HANGİSİ OLDUĞU ayırt edilebilmeli. Sıradan bir kullanıcının "ben yöneticiyim"
  yazmasıyla gerçek yöneticinin cevabı aynı görünürse, kimliğe bürünme bu üründeki en
  ucuz saldırı olur.

  ⚠️ İŞARET SUNUCUDAN GELİR, İSTEMCİ HESAPLAMAZ. Bu bileşen yalnızca çiziyor; kararı
  veren alan sunucudaki `isStaff` (ForumAuthorDto, OfferCardDto.TutorIsStaff,
  UniversityPeerDto.IsStaff, MatchSuggestionDto.IsStaff). Rol istemcide türetilseydi,
  kullanıcı kendi tarafında değiştirip sahte bir yönetim rozeti üretebilirdi — tam da
  engellenmek istenen şey. Bu bileşene bir "role" prop'u EKLEME; kim yönetimdir sorusu
  istemcide cevaplanmamalı.

  ⚠️ PROFİL UCU ROLÜ SIZDIRMIYOR. Bayrak yalnızca yazarın/ilan sahibinin göründüğü
  listelerde var — bu yüzden rozet profil görünümüne (ProfilGorunumu) BAĞLANMADI, tıpkı
  web'de olduğu gibi. Rozetin işi resmi cevabı ayırt etmek, kişi listelemek değil.

  METİN "YÖNETİM", "ADMİN" DEĞİL: bayrak Admin VE Moderator rollerini birlikte kapsıyor
  (sunucuda `Role is UserRole.Admin or UserRole.Moderator`). "Admin" yazmak moderatörler
  için yanlış bir unvan iddiası olurdu.

  Rozet DOLU marka zemini alıyor çünkü işi tam olarak dikkat çekmek — sessiz bir rozet,
  resmi cevabı sıradan cevaptan ayırma işini yapmaz. brand-600 üstüne beyaz metin,
  paletteki ölçülmüş AA çifti; marka rengi 500'de duruyor ve orada beyaz metin AA
  eşiğini geçmiyor, bu yüzden zemin 600.

  MOBİL NOTLARI:
  • 44px DOKUNMA HEDEFİ BURADA GEÇERLİ DEĞİL: rozet basılabilir bir öğe değil, bir
    işaret. Yazar adının yanında duruyor ve satır yüksekliğini büyütmesi, adın kendisini
    aşağı itmesi anlamına gelirdi.
  • Web'in title= ipucu (fare üstü) RN'de yok; aynı cümle accessibilityLabel'a taşındı.
    `accessible` bayrağı ŞART — yoksa etiket ekran okuyucuya ulaşmaz ve rozet, adın
    yanında anlamsız bir "Yönetim" parçası olarak okunur.
*/
export function YonetimRozeti({ kucuk = false, className = '' }) {
  return (
    <View
      accessible
      accessibilityLabel="Yönetim — dersmate ekibinden, resmi hesap"
      className={`shrink-0 flex-row items-center gap-1 rounded-full bg-brand-600
                  ${kucuk ? 'px-1.5 py-0.5' : 'px-2 py-0.5'} ${className}`}
    >
      {/*
        KALKAN İKONU Ikonlar.jsx'te HENÜZ YOK (mobil sette kalkan çizimi bulunmuyor) ve
        ikon seti tek dosyada yaşıyor — burada ikinci bir çizim tanımlamak o kuralı
        bozardı. Eklendiği anda rozet kendiliğinden ikonlu çiziliyor; yokken de işini
        görüyor, ayırt ediciliği asıl taşıyan şey dolu marka zemini.
      */}
      {KalkanIkonu ? <KalkanIkonu renk={beyaz} boy={kucuk ? 12 : 14} kalinlik={2.5} /> : null}
      <Text className={`font-semibold text-white ${kucuk ? 'text-[10px]' : 'text-[11px]'}`}>
        Yönetim
      </Text>
    </View>
  )
}
