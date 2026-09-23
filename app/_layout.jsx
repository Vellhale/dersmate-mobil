import '../global.css'
import { useEffect } from 'react'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import * as SplashScreen from 'expo-splash-screen'
import { AuthProvider, useAuth } from '../src/state/AuthContext'
import { WalletProvider } from '../src/state/WalletContext'
import { InboxProvider } from '../src/state/InboxContext'
import { IzinProvider } from '../src/state/IzinContext'
import { UrunTuru } from '../src/components/UrunTuru'
import { IzinSayfasi } from '../src/components/IzinSayfasi'
import { CekmeceSaglayici } from '../src/components/Cekmece'
import { zemin } from '../src/lib/theme'

/*
  KÖK KABUK — web'deki App.jsx'in karşılığı.

  Web'de RequireAuth + Navigate ile yapılan koruma burada Stack.Protected ile:
  oturum yoksa korunan ekranların HİÇBİRİ erişilemez ve router (auth)/giris'e düşer;
  oturum gelince tam tersi olur. Giriş başarısında elle navigate ETMEYE GEREK YOK —
  guard değişince router korunan dala kendisi geçer.

  ⚠️ KÖKTE `anchor` YOK ve bu ölçülmüş bir karar: kök layout'un rota adı boş olduğu
  için expo-router varsayılan bir anchor kurmuyor ve React Navigation `routeNames[0]`e
  düşüyor. Oturum kapalıyken `index` guard tarafından elendiği için ilk ad `(auth)`
  oluyor ve onun kendi anchor'ı (giris) devreye giriyor; oturum açıkken `(auth)`
  eleniyor ve `index` başa geçiyor. `anchor: 'index'` eklemek her derin bağlantının
  altına 1900 satırlık Topluluk ekranını iterdi — açılmayacak bir ekran için istek ve
  bellek.

  SPLASH, OTURUM OKUNANA KADAR TUTULUR. SecureStore async olduğu için ilk render'da
  "oturum var mı" bilinmiyor (bkz. AuthContext.hazir). Splash'i erken bırakmak,
  oturumlu kullanıcıya her açılışta bir anlık giriş ekranı gösterirdi.
*/
SplashScreen.preventAutoHideAsync().catch(() => {
  /* zaten gizlenmişse sorun değil */
})

function RootNavigator() {
  const { isAuthenticated, hazir } = useAuth()

  useEffect(() => {
    if (hazir) SplashScreen.hideAsync().catch(() => {})
  }, [hazir])

  // Oturum durumu bilinmeden hiçbir yönlendirme kararı verilmez; splash görünür kalır.
  if (!hazir) return null

  /*
    ÜST DÜZEY EKRANLAR — hepsi `dangerouslySingular`.

    Sekme çubuğu kalkıp beş ekran kök yığına indi; çekmeceden gezinme artık düz bir
    `navigate`. expo-router StackRouter (PUSH/NAVIGATE ortak bloğu) mevcut bir rotayı
    YALNIZCA (a) getId eşleşiyorsa, (b) hedef O ANKİ rotayla aynıysa ya da
    (c) payload.pop set ise yeniden kullanıyor — üçü de sağlanmıyor. Yani
    Topluluk→Keşfet→Mesajlar→Topluluk yığını [index, kesfet, mesajlar, index] yapardı:
    on gezinme on ekran, geri tuşu onlarca adım geri ve her kopya kendi useAsync
    çağrısını koşturur.

    `dangerouslySingular` StackRouter davranışını "mevcut rotayı bul ve EN ÜSTE TAŞI"
    biçimine çeviriyor (filter + push). Yığın farklı ekran sayısıyla sınırlı kalıyor ve
    ekran SÖKÜLMÜYOR — Keşfet biriken sonsuz kaydırmasını, Topluluk akışını koruyor
    (CLAUDE.md: biriken sayfaları silme).

    ⚠️ Bu aynı zamanda ESKİ BİR HATAYI kapatıyor: eslesmeler.jsx, hakkimizda.jsx ve
    ArkadaslarBolumu.jsx kök yığından router.push ile Keşfet çağırıyordu ve bu İKİNCİ
    bir sekme navigatörü doğuruyordu (iki çubuk, iki sağlayıcı, iki kez geri tuşu).

    KABUK EKRANLARI (çekmecenin ana hedefleri) ayrıca animation:none + gestureEnabled:false
    alıyor: eskiden sekmeydiler, aralarında geçiş animasyonsuzdu ve kenar kaydırmayla
    "geri" diye bir şey yoktu. Çıkış yolları sol üstteki hamburger. Derslerim/Arkadaşlar/
    Yönetim ise kendi geri şeridini taşıyor — onlarda kaydırma ve kayma DURUYOR.
  */
  const kabuk = { animation: 'none', gestureEnabled: false }

  const stack = (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: zemin } }}>
      <Stack.Protected guard={isAuthenticated}>
        {/* Çekmecenin beş kabuk ekranı. Adresler düzleştirmeden ÖNCEKİYLE aynı:
            (tabs) bir grup klasörüydü ve URL üretmiyordu. */}
        <Stack.Screen name="index" options={kabuk} dangerouslySingular />
        <Stack.Screen name="kesfet" options={kabuk} dangerouslySingular />
        <Stack.Screen name="olustur" options={kabuk} dangerouslySingular />
        <Stack.Screen name="mesajlar" options={kabuk} dangerouslySingular />
        <Stack.Screen name="profil/index" options={kabuk} dangerouslySingular />
        {/* Çekmeceden açılan ama kendi geri şeridi olan ekranlar. Burada AÇIKÇA
            sayılıyorlar: guard yalnızca Protected bloğundaki ekranları kapsar —
            dosya keşfine bırakılsalardı oturumsuz da erişilebilir olurlardı. */}
        <Stack.Screen name="eslesmeler" dangerouslySingular />
        <Stack.Screen name="dersler" dangerouslySingular />
        <Stack.Screen name="yonetim" dangerouslySingular />
        {/* Eski /topluluk adresi: dosya artık yalnızca köke yönlendiriyor ama rota
            KAYITLI kalmalı, yoksa dersmate://topluluk ölür. */}
        <Stack.Screen name="topluluk" />
        {/* Gerçek DETAY ekranları: kayma animasyonu ve kenar kaydırma varsayılan
            kalıyor, singular DEĞİLLER — farklı kimlikler ayrı ekranlardır. */}
        <Stack.Screen name="profil/[userId]" />
        <Stack.Screen name="sohbet/[conversationId]" />
      </Stack.Protected>
      <Stack.Protected guard={!isAuthenticated}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
  )

  /*
    SAĞLAYICILAR KÖKTE, AMA YALNIZCA OTURUMLU DALDA — web'deki Layout kararının
    karşılığı: cüzdan ve gelen kutusu (SignalR bağlantısı dahil) oturum boyunca TEK
    kaynak. (tabs) grubunun içinde dursalardı sohbet/profil yığın ekranları (grubun
    DIŞINDALAR) onlara erişemezdi; ikinci bir provider açmak ise aynı kullanıcıya iki
    SignalR oturumu açar, gruba katılma/ayrılma bölünür ve mesaj kaybolurdu.

    Oturumsuz dalda sağlayıcı HİÇ KURULMAZ: kurulsalardı /api/wallet ve /api/conversations
    daha giriş ekranındayken 401'e koşardı.
  */
  if (!isAuthenticated) return stack

  return (
    <WalletProvider>
      <InboxProvider>
        {/* ÇEKMECE SAĞLAYICISI BURADA — InboxProvider içinde ve oturumlu dalda.
            Cekmece hem useAuth hem useInbox okuyor (kimlik satırı, okunmamış rozeti);
            dışarı alınsaydı oturumsuz açılışta bağlam bulunamaz ve uygulama çökerdi.
            Ekranların İÇİNDE değil kabukta çiziliyor: RNModal ayrı bir yerel pencere,
            ekran başına bir kopya olsaydı geçişte takılı kalanlar doğardı. */}
        <CekmeceSaglayici>{stack}</CekmeceSaglayici>
        {/* Ürün turu YALNIZCA oturumlu dalda: ilerlemeyi api.myPreferences'tan okuyor
            ve o uç oturum istiyor. Hiçbir ekranı değiştirmiyor, kökte tek satır. */}
        <UrunTuru />
      </InboxProvider>
    </WalletProvider>
  )
}

export default function RootLayout() {
  return (
    <AuthProvider>
      {/* Sayfalar açık zeminli (slate-50); durum çubuğu koyu simgelerle okunur. */}
      <StatusBar style="dark" />
      {/*
        İzin sağlayıcısı AuthProvider'ın İÇİNDE (oturumu okuyor) ama HER İKİ dalı da
        sarıyor: izin durumu oturumsuz da anlamlı (uygulama ilk açılışta analitik
        toplamadan önce sormalı) ve giriş ekranından da ayarlara ulaşılabilmeli.
      */}
      <IzinProvider>
        <RootNavigator />
        {/* İzin sayfası kökte: ilk açılışta kapatılamaz alt sayfa olarak çıkar,
            sonrasında Profil'deki "Veri tercihleri" bağlantısıyla açılır. Oturumsuz
            dalda da gerekli — analitik giriş ekranında da toplanabilirdi. */}
        <IzinSayfasi />
      </IzinProvider>
    </AuthProvider>
  )
}
