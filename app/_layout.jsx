import '../global.css'
import { useEffect } from 'react'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import * as SplashScreen from 'expo-splash-screen'
import { AuthProvider, useAuth } from '../src/state/AuthContext'
import { WalletProvider } from '../src/state/WalletContext'
import { InboxProvider } from '../src/state/InboxContext'

/*
  KÖK KABUK — web'deki App.jsx'in karşılığı.

  Web'de RequireAuth + Navigate ile yapılan koruma burada Stack.Protected ile:
  oturum yoksa (tabs) grubu erişilemezdir ve router (auth)/giris'e düşer; oturum
  gelince tam tersi olur. Giriş başarısında elle navigate ETMEYE GEREK YOK —
  guard değişince router korunan gruba kendisi geçer.

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

  const stack = (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={isAuthenticated}>
        <Stack.Screen name="(tabs)" />
        {/* Tab çubuğunun ÜSTÜNDE açılan yığın ekranları. Burada AÇIKÇA sayılıyorlar:
            guard yalnızca Protected bloğundaki ekranları kapsar — dosya keşfine
            bırakılsalardı oturumsuz da erişilebilir olurlardı. */}
        <Stack.Screen name="profil/[userId]" />
        <Stack.Screen name="sohbet/[conversationId]" />
        <Stack.Screen name="eslesmeler" />
        <Stack.Screen name="dersler" />
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
      <InboxProvider>{stack}</InboxProvider>
    </WalletProvider>
  )
}

export default function RootLayout() {
  return (
    <AuthProvider>
      {/* Sayfalar açık zeminli (slate-50); durum çubuğu koyu simgelerle okunur. */}
      <StatusBar style="dark" />
      <RootNavigator />
    </AuthProvider>
  )
}
