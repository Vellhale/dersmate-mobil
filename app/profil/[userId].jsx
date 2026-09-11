import { useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { api } from '../../src/lib/api'
import { engelDegisti } from '../../src/lib/engelSurumu'
import { useAsync } from '../../src/state/useAsync'
import { EngellemeModali } from '../../src/components/EngellemeModali'
import { ProfilGorunumu } from '../../src/components/ProfilGorunumu'
import { Button, ErrorBox, Notice } from '../../src/components/ui'
import { useAuth } from '../../src/state/AuthContext'

/*
  BAŞKASININ PROFİLİ — tab çubuğunun ÜSTÜNDE açılan yığın ekranı (akış kartından,
  sohbet başlığından, Keşfet kartından gelinir). Web'de /profil/:userId aynı bileşene
  gidiyordu; mobilde düzenleme eylemleri kendi profil sekmesinde kalıyor, bu rotada
  yalnızca başkasına yönelik iki eylem var: arkadaş ekle ve engelle (web #30).

  Kendi id'sine gelen kullanıcı da aynı görünümü alır, eylem düğmeleri olmadan
  (düzenleme yine sekmesinde) — yönlendirme karmaşası yerine tek doğru davranış.
*/

/* Kimlikler iki ayrı kaynaktan geliyor (adres ve profil yanıtı). Harf büyüklüğü farkı
   olursa karşılaştırma ıskalar ve düğmeler SESSİZCE hiç çıkmaz — api.js'teki
   avatarAnahtar ile aynı gerekçe. */
const ayniKisi = (a, b) => String(a ?? '').toLowerCase() === String(b ?? '').toLowerCase()

export default function BaskasininProfili() {
  const { userId } = useLocalSearchParams()
  const router = useRouter()
  const { session } = useAuth()
  const [notice, setNotice] = useState(null)
  /* Eylem düğmeleri kişinin ADINI istiyor ("X engellendi"); ad ProfilGorunumu'nun
     çektiği veriden geri veriliyor (onYuklendi), ikinci bir profil isteği atılmıyor. */
  const [kisi, setKisi] = useState(null)
  const kendiProfilim = session?.userId === userId

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      <View className="flex-row items-center gap-2 border-b border-slate-200 bg-white px-2 py-2">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Geri"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          className="h-11 w-11 items-center justify-center rounded-lg"
        >
          <Text className="text-xl text-slate-500">←</Text>
        </Pressable>
        <Text className="text-lg font-bold text-slate-900">Profil</Text>
      </View>

      <ScrollView contentContainerClassName="gap-3 p-4">
        {/*
          ⚠️ `ayniKisi(kisi.userId, userId)` YANLIŞ KİŞİYE İŞLEM YAPMAYI ÖNLÜYOR (web #33):
          adres değişip yeni profil gelene kadar elde ESKİ kişinin verisi kalıyor. O
          pencerede "Engelle" bir öncekini engellerdi ve onay kipi de onun adını yazdığı
          için fark edilmezdi. `key` de userId'ye bağlı: önceki kişinin hata kutusu ve açık
          kipi taşınmıyor.

          Düğmeler profil YÜKLENDİKTEN sonra beliriyor: var olmayan bir kullanıcıya istek
          düğmesi hiç görünmüyor. Kendi profilim mi: asıl kaynak sunucunun isSelf alanı
          (ProfilGorunumu kuralı), oturumdaki id yalnızca yedek.
        */}
        {kisi && !(kisi.isSelf ?? kendiProfilim) && ayniKisi(kisi.userId, userId) && (
          <BaskaKisiIslemleri key={userId} kisi={kisi} onNotice={setNotice} />
        )}

        {notice && (
          <Notice tone="success" onDismiss={() => setNotice(null)}>
            {notice}
          </Notice>
        )}

        <ProfilGorunumu userId={userId} kendiProfilim={kendiProfilim} onYuklendi={setKisi} />
      </ScrollView>
    </SafeAreaView>
  )
}

/*
  BAŞKASININ PROFİLİNDEKİ İKİ EYLEM — web Profile.jsx BaskaKisiIslemleri portu.

  NEDEN BURADA DA VAR: kişiyi forumda, bir yorumda ya da ders listesinde görüp adına
  dokunan kullanıcı, istek göndermek için Keşfet'e dönüp adını yeniden aramak zorunda
  kalmamalı. Engelleme de aynı sebeple burada — rahatsız eden biriyle karşılaşılan yer
  çoğu zaman profil.

  ENGEL DURUMU AYRI İSTEKLE okunuyor: profil yanıtına "engelledim mi" alanı bilerek
  eklenmedi (web kararı) — o uç forumda ve ders listelerinde de çağrılıyor, yalnızca bu
  ekranın kullandığı bir alan her profil görüntülemesine bir sorgu daha bindirirdi.

  KARŞI TARAF BENİ ENGELLEDİYSE bu bileşen bunu BİLMİYOR ve bilmemeli: karşı tarafın
  engelini kullanıcıya söylemek engellemeyi misillemeye çevirirdi. Düğme görünür, basılınca
  sunucu nötr bir hatayla reddeder ("Bu kişiye istek gönderilemiyor.").
*/
function BaskaKisiIslemleri({ kisi, onNotice }) {
  const engeller = useAsync(() => api.myBlocks(), [])
  const [kipAcik, setKipAcik] = useState(false)
  const [busy, setBusy] = useState(false)
  const [hata, setHata] = useState(null)

  const engelli = (engeller.data ?? []).some((e) => ayniKisi(e.userId, kisi.userId))

  async function istekGonder() {
    if (busy) return
    setBusy(true)
    setHata(null)
    /* Önceki başarı bildirimi de siliniyor (web #33): ikinci deneme hata verdiğinde
       "gönderildi" ile "zaten bekleyen isteğin var" yan yana kalıyor ve hangisinin şu
       ana ait olduğu okunmuyordu. */
    onNotice(null)
    try {
      /* Konusuz istek — Keşfet'teki "Arkadaş isteği" ile AYNI çağrı; sunucuda arkadaşlık
         diye ayrı bir tür yok. Kip yok: Keşfet kipinin gösterdiği kişi bilgisi burada
         zaten ekranda. */
      await api.createMatch({
        responderUserId: kisi.userId,
        requestedTopicId: null,
        offeredTopicId: null,
      })
      onNotice(`${kisi.displayName} kişisine arkadaş isteği gönderildi. Kabul edilince sohbet açılacak.`)
    } catch (err) {
      setHata(err)
    } finally {
      setBusy(false)
    }
  }

  async function engelKaldir() {
    if (busy) return
    setBusy(true)
    setHata(null)
    try {
      await api.unblockUser(kisi.userId)
      // Alttaki Keşfet odakta tazelensin: kişi aramaya geri dönmeli (bkz. lib/engelSurumu).
      engelDegisti()
      onNotice(`${kisi.displayName} için engel kaldırıldı.`)
      engeller.reload({ silent: true })
    } catch (err) {
      setHata(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <View className="gap-2">
      {engelli ? (
        /* Engelliyken "Arkadaş ekle" HİÇ GÖSTERİLMİYOR: basılsa sunucu zaten reddederdi ve
           kullanıcı kendi koyduğu engeli bir hata kutusundan hatırlardı. Önce engeli
           kaldırmak, tek anlamlı sıra. */
        <View className="flex-row flex-wrap items-center justify-between gap-2">
          <Text className="text-sm font-medium text-rose-700">Bu kişiyi engelledin</Text>
          <Button variant="secondary" loading={busy} onPress={engelKaldir}>
            Engeli kaldır
          </Button>
        </View>
      ) : (
        <View className="flex-row gap-2">
          <Button variant="secondary" onPress={() => setKipAcik(true)}>
            Engelle
          </Button>
          <Button className="flex-1" loading={busy} onPress={istekGonder}>
            Arkadaş ekle
          </Button>
        </View>
      )}

      {/* Hata düğmelerin altında: istek reddedildiğinde (bekleyen istek, günlük tavan,
          engel) sebep düğmenin yanında okunmalı. onRetry KUTUYU DA KAPATIYOR (web #33):
          ErrorBox hatayı kendisi temizlemiyor; temizlenmezse başarılı ikinci denemeden
          sonra da eski hata ekranda kalırdı. */}
      <ErrorBox
        error={hata}
        onRetry={
          hata
            ? () => {
                setHata(null)
                if (engelli) engelKaldir()
                else istekGonder()
              }
            : undefined
        }
      />

      <EngellemeModali
        kisi={kipAcik ? kisi : null}
        onClose={() => setKipAcik(false)}
        onEngellendi={(ad) => {
          setKipAcik(false)
          // Engelleme öncesindeki "zaten bekleyen isteğin var" kutusu yeni durumla çelişirdi.
          setHata(null)
          onNotice(`${ad} engellendi. Artık birbirinize istek gönderemezsiniz.`)
          engeller.reload({ silent: true })
        }}
      />
    </View>
  )
}
