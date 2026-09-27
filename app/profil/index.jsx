import { useCallback, useRef, useState } from 'react'
import { Pressable, ScrollView } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import * as ImagePicker from 'expo-image-picker'
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator'
import { api } from '../../src/lib/api'
import { profilSurumu } from '../../src/lib/profilSurumu'
import { slate } from '../../src/lib/theme'
import { useAuth } from '../../src/state/AuthContext'
import { AltBilgi } from '../../src/components/AltBilgi'
import { EkranBasligi } from '../../src/components/EkranBasligi'
import { HamburgerDugmesi } from '../../src/components/Cekmece'
import { AyarlarIkonu } from '../../src/components/Ikonlar'
import { ProfilGorunumu } from '../../src/components/ProfilGorunumu'
import { ErrorBox, Notice } from '../../src/components/ui'

/*
  PROFİLİM — web'deki Profile.jsx'in "kendi profilim" hâli. Başkasının profili
  ayrı rotada (app/profil/[userId].jsx); web'deki "tek bileşen, iki rota" kararının
  mobil karşılığı: görünüm ProfilGorunumu'nda ortak, fark yalnızca fotoğraf rozetinin
  ve ayarlar düğmesinin görünürlüğü.

  PROFİL = VİTRİN, AYARLAR AYRI (2026-09-26). Ekranın üstündeki düğme blokları kalktı:
  • Fotoğrafı değiştir → avatarın kamera rozeti (ProfilGorunumu → ProfilFotografi).
  • Arkadaşlarım → fotoğrafın altındaki hap (ProfilGorunumu → ArkadasOzeti).
  • Derslerim, Yönetim paneli → yalnızca çekmecede (zaten oradaydılar).
  • Profili düzenle, Bildirim ayarları, Veri tercihleri, Rehberi tekrar izle, Çıkış yap,
    Hesabımı sil → sağ üstteki dişliden açılan Ayarlar ekranı (app/ayarlar.jsx).
  Alt bilgi yalnızca sayfa bağlantıları ve künye (AltBilgi): ayar ve eylem oraya girmez.

  FOTOĞRAF DEĞİŞTİRME web'deki AvatarPicker'ın (canvas kırpma) mobil karşılığı:
  expo-image-picker kare kırpmayı sistem arayüzüyle yapar (allowsEditing) — canvas'a
  gerek yok. Alan adı web ile aynı: form.append('avatar', …). Burada kaldı, Ayarlar'a
  taşınmadı: sonucu bu ekranda görünüyor ve görünümü bu ekran yeniden kuruyor.
*/
export default function Profil() {
  const guvenli = useSafeAreaInsets()
  const { session } = useAuth()

  const [notice, setNotice] = useState(null)
  const [avatarBusy, setAvatarBusy] = useState(false)
  const [avatarError, setAvatarError] = useState(null)
  // Alt bileşenleri yeniden kurmak için: avatar/profil değişince taze veri okunsun.
  const [version, setVersion] = useState(0)

  /*
    AYARLAR'DA DÜZENLENEN PROFİL. Bu ekran kök yığında kurulu kalıyor ve Ayarlar onun
    üstüne itiliyor; "Profili düzenle"den dönen kullanıcı aksi hâlde eski adı ve eski
    "hakkında"yı görürdü. Sürüm değiştiyse görünüm yeniden kuruluyor (src/lib/profilSurumu.js);
    değişmediyse hiçbir şey yapılmıyor. Her odakta yeniden kurmak açık akordeonları
    kapatır ve beş-altı isteği boşa atardı (arkadaş sayısı kendi kancasında ayrıca
    tazeleniyor).
  */
  const gorulenSurum = useRef(profilSurumu())
  useFocusEffect(
    useCallback(() => {
      const guncel = profilSurumu()
      if (guncel !== gorulenSurum.current) {
        gorulenSurum.current = guncel
        setVersion((v) => v + 1)
      }
    }, []),
  )

  async function fotografDegistir() {
    setAvatarError(null)

    const secim = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true, // kare kırpma — web'deki canvas kırpıcının sistem karşılığı
      aspect: [1, 1],
      quality: 0.9,
    })
    if (secim.canceled) return

    const foto = secim.assets[0]
    setAvatarBusy(true)
    try {
      /*
        KÜÇÜLTME İSTEMCİDE — web'in canvas adımının mobil karşılığı ve ATLANAMAZ.

        ImagePicker'ın allowsEditing + aspect [1,1] ayarı yalnızca KIRPIYOR, çözünürlüğü
        düşürmüyor: telefon kamerasıyla çekilmiş 4032×3024 bir fotoğraf kare kırpıldıktan
        sonra da ~3000×3000 kalıyor ve q90 JPEG'te 2-4 MB ediyor. Sunucu sınırı 2 MB
        (ProfileCommands.MaxAvatarBytes), controller sınırı 3 MB — yani normal bir telefon
        fotoğrafı reddediliyordu. 2-3 MB arası "Fotoğraf 2 MB'tan büyük", üstünde ise
        gövdesiz 413 yüzünden hiçbir şey açıklamayan bir hata görünüyordu; küçük dosyalar
        (ekran görüntüsü) geçtiği için sorun rastgele görünüyordu.

        Hedef web ile AYNI: 512×512 JPEG (AvatarPicker.jsx → OUTPUT_SIZE = 512).
      */
      const olcekli = await ImageManipulator.manipulate(foto.uri)
        .resize({ width: 512, height: 512 })
        .renderAsync()
      const kucuk = await olcekli.saveAsync({ compress: 0.85, format: SaveFormat.JPEG })

      const form = new FormData()
      form.append('avatar', {
        uri: kucuk.uri,
        name: 'avatar.jpg',
        type: 'image/jpeg',
      })
      await api.uploadAvatar(form)
      /*
        ÜÇ ADIM, ÜÇÜ DE GEREKLİ:
        1. Seçilen dosya hatırlanıyor — kullanıcı yeni fotoğrafı ANINDA görüyor ve bu,
           uzaktaki görselin önbellekten tazelenmesine hiç bağlı değil. (Önceki sürümde
           yükleme sunucuda başarılıydı ama ekranda değişiklik olmuyordu.)
        2. Sürüm sayacı artıyor — diğer ekranlardaki (akış, sohbet) avatarlar bir
           sonraki çizimde ?v= ile yeniden isteniyor.
        3. Görünüm yeniden kuruluyor — profil verisi tazeleniyor.
      */
      api.rememberLocalAvatar(session.userId, kucuk.uri)
      api.forgetAvatar(session.userId)
      setVersion((v) => v + 1)
      setNotice('Profil fotoğrafın güncellendi.')
    } catch (err) {
      setAvatarError(err)
    } finally {
      setAvatarBusy(false)
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
      <EkranBasligi baslik="Profilim" sol={<HamburgerDugmesi />} sag={<AyarlarDugmesi />} />

      <ScrollView contentContainerClassName="gap-3 p-4"
        /* Alt dolgu = güvenli alan (home indicator) + nefes payı. Eskiden buraya yüzen
           sekme çubuğunun yüksekliği de giriyordu (sekmeCubugu.js); çubuk kalktı, gezinme
           artık soldaki çekmeceden ve içeriğin üstünde duran bir katman yok. */
        contentContainerStyle={{ paddingBottom: guvenli.bottom + 16 }}
      >
        {notice && (
          <Notice tone="success" onDismiss={() => setNotice(null)}>
            {notice}
          </Notice>
        )}
        <ErrorBox error={avatarError} />

        <ProfilGorunumu
          key={version}
          userId={session?.userId}
          kendiProfilim
          fotograf={{ onPress: fotografDegistir, yukleniyor: avatarBusy }}
        />

        {/*
          ALT BİLGİ — Hakkımızda ve yasal metinler + künye. Yasal metinlere uygulama
          İÇİNDEN erişim mağaza incelemesinin de beklediği bir şey; kayıt ekranındaki onay
          bağlantıları doğrudan sayfalara gidiyor, kullanıcı sonradan da buradan okuyabilmeli.
          "Veri tercihleri" oturumlu yüzeyde alt bilgide DEĞİL, Ayarlar'da (AltBilgi.jsx).
        */}
        <AltBilgi className="mt-6" />
      </ScrollView>
    </SafeAreaView>
  )
}

/*
  AYARLAR DÜĞMESİ — başlığın sağ yuvasında dişli. Hamburger düğmesinin aynası (-mr-2:
  ikon, başlığın px-4 kenarıyla optik olarak hizalansın). Boy px ile: h-11 rem ve cihazda
  38.5dp çizerdi (CLAUDE.md → "Dokunma ve yüzey dili").
*/
function AyarlarDugmesi() {
  const router = useRouter()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Ayarlar"
      onPress={() => router.push('/ayarlar')}
      className="-mr-2 h-[44px] w-[44px] items-center justify-center rounded-lg active:bg-slate-100"
    >
      <AyarlarIkonu renk={slate[700]} boy={24} />
    </Pressable>
  )
}
