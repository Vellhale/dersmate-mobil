import { Linking } from 'react-native'
import {
  Bolum,
  Kalin,
  Madde,
  Maddeler,
  MetinBaglantisi,
  MetinSayfasi,
  Paragraf,
} from '../src/components/MetinSayfasi'
import { ILETISIM_EPOSTA, ISLETMECI, ISLETMECI_ALAN_ADI, MARKA } from '../src/lib/kunye'
import { SOZLESME_TARIHI } from '../src/lib/yasalMetinler'

/*
  GİZLİLİK POLİTİKASI + KVKK AYDINLATMA METNİ — web'deki pages/Gizlilik.jsx'in portu.

  Web'de metnin tamamı KODU OKUYARAK yazılmıştı; bu port da öyle. Mobil karşılıklar:
    • Toplanan alanlar        → Domain/Identity/User.cs, UserDevice (ortak backend)
    • Cihaz parmak izi        → src/lib/hwid.js (WEB'DEKİNDEN FARKLI — aşağıda §2)
    • Cihazdaki depolama      → src/lib/storage.js (SecureStore + AsyncStorage)
    • Kanıt saklama süresi    → Features/Moderation/CleanupStorage.cs (180 gün)
    • Fotoğraf izni           → app.json → expo-image-picker photosPermission

  ⚠️ ÜÇ BÖLÜM BİLEREK WEB'DEN AYRILDI ve ayrılmak ZORUNDAYDI — gizlilik metninin tek
  işi platformun GERÇEKTE ne yaptığını söylemek; web metnini birebir kopyalamak burada
  "doğru metin" değil, YANLIŞ BEYAN olurdu:

  §2 CİHAZ KİMLİĞİ. Web canvas çizim testi, tarayıcı sürümü ve ekran çözünürlüğü
     kullanıyor. Mobilde canvas yok; hwid.js işletim sistemi kimliği (Android ID /
     iOS identifierForVendor) + marka/model/bellek kullanıyor. Web'in listesi burada
     yazsaydı, toplamadığımız veriyi topluyoruz demiş olurduk.

  §4 ÇEREZLER → UYGULAMA DEPOLAMASI. Mobilde çerez yok, rıza penceresi (consent.js /
     ConsentContext) yok, analitik kapısı (AnalyticsGate) yok. "Üç kategori sunuyoruz,
     seçimini değiştirebilirsin" cümlesi burada var olmayan bir ekranı tarif ederdi —
     ve bir denetimde bulunamayan bir ekran, metni tümden şüpheli hâle getirir.
     Bölüm NUMARASI korundu: yasal metinlere "§4" diye atıf yapılabiliyor.

  §6 ÜÇÜNCÜ TARAF. Mobil PAKETTE reklam veya analitik SDK'sı YOK (package.json) ve bu
     cümle aynen kalıyor — web'de Google Analytics var, burada yok. Bu, mağaza veri
     güvenliği formunda (Google Play Data safety / Apple Privacy Nutrition Label)
     beyan edilecek bilgiyle birebir aynı olmalı.

     ⚠️ AMA "üçüncü taraf yok" cümlesi TEK BAŞINA EKSİKTİ (2026-09-05'te tamamlandı).
     Uygulama doğrudan kimseye bağlanmıyor, doğru; ancak kullanıcının sunucumuza
     gönderdiği veri orada Resend (e-posta) ve Google Drive (yedek) tarafından
     işleniyor. KVKK m.10 "kimlere aktarılabileceğini" soruyor ve cevap yalnızca
     istemci paketine bakarak verilemez. §6 artık sunucu tarafını da sayıyor.

     ⛔ 2026-09-25'ten beri "uygulama doğrudan kimseye bağlanmıyor" YANLIŞ: push
     bildirimleri açılınca telefon Expo'ya ve işletim sisteminin bildirim hizmetine
     (Android'de Google FCM, iOS'ta Apple APNs) bağlanıyor. Aşağıdaki push bloğuna bak.

  ─── 2026-09-25: PUSH BİLDİRİMLERİ — SÖZLEŞME SÜRÜMÜ ARTTI ─────────────────
  §2/§3/§4/§5/§6/§7 push için genişledi; sürüm 2026-09-19 → 2026-09-25 (üç yer birlikte,
  gerekçe src/lib/yasalMetinler.js). Metin yine KOD OKUNARAK yazıldı:
    • Sunucuda saklananlar   → Domain/Communication/PushDevice.cs (token, platform, HWID
                               özeti, kapalı Android kanalları, tarihler),
                               NotificationPreference.cs (dört tercih, aydınlatma damgası,
                               erteleme sayacı), Notification.cs (defter: tür, kayıt ve
                               aktör kimlikleri, zamanlar, sonuç — İÇERİK KOPYALANMIYOR)
    • Push'un içeriği        → Features/Communication/Bildirimler/BildirimMetni.cs (başlıklar
                               sabit; ad yalnızca mesaj ve kabulde, istek/ders bildiriminde
                               konu geçebilir) ve BildirimYuku.cs (data yalnızca tür, url,
                               alıcı etiketi; etiket HMAC türevi)
    • Silme noktaları        → Logout, TumOturumlariDusurAsync, DeleteAccount, BanUser,
                               makbuzdaki DeviceNotRegistered, çevrimdışı çıkıştan sonra forget
    • Cihazdaki saklama      → src/lib/bildirimler.js (unutma işareti, KEYS.pushUnutulacak) ve
                               node_modules/expo-notifications ServerRegistrationModule:
                               rastgele kurulum numarası + son cihaz token'ı; Android'de
                               noBackupFilesDir, iOS'ta Anahtar Zinciri (ThisDeviceOnly).
                               "Haftada bir yeniden bildirir": DevicePushTokenAutoRegistration
                               .fx.ts + utils/updateDevicePushTokenAsync.ts (7 günlük TTL,
                               exp.host/--/api/v2/push/updateDeviceToken)

  İKİ CÜMLE YANLIŞA DÖNÜŞMÜŞTÜ ve düzeltildi (§6): "uygulamanın konuştuğu tek sunucu
  dersmate'in kendi sunucusudur" ve "uygulama doğrudan hiçbir üçüncü tarafa bağlanmasa da".

  §2'deki HWID cümlesi ("hiçbir üçüncü tarafa gönderilmez") DOĞRU KALIYOR ve push
  paragrafı onunla çelişmeyecek biçimde yazıldı: Expo'ya/Google'a/Apple'a giden şey
  bildirim adresi; HWID özeti yalnızca sunucumuzda, token'ı cihaza bağlamak için duruyor.

  Kilit ekranı cümlesi işletim sisteminin YAPTIĞINDAN FAZLASINI iddia etmiyor: Android
  kanalları PRIVATE kuruluyor ama kullanıcının telefon ayarı bunu geçersiz kılabilir.

  ⚠️ İKİ DEĞER HENÜZ ÖLÇÜLMEDİ, METİN TASARIMA GÜVENİYOR:
    1. "Aydınlatmadan önce Firebase'e bağlanılmaz" — plugins/firebase-otomatik-baslatma.js
       ile sağlanıyor; release APK'da taze kurulumda ağ ölçümüyle doğrulanacak. Ölçüm
       başka bir şey gösterirse §4 ve §6 düzeltilmeli, Data safety de bu ölçümden sonra.
    2. Defterin 30 günü ve makbuzların 24 saati sunucunun temizlik işinden
       (CleanupNotifications / PushReceiptJob) geliyor; iş yazılırken süre değişirse §5
       burada da değişmeli.

  ⚠️ /gizlilik-uygulama (mağazalara verilecek herkese açık adres) bu turda YOK — ayrı PR.
  Web'in /gizlilik sayfasına push aynı dalda "mobil uygulamada" kapsamıyla ekleniyor. İki
  metin aynı olguları söylemeli (taşıyıcılar, süreler, silme noktaları); ifade platforma
  göre ayrışabilir, olgu ayrışamaz.

  ─── 2026-09-22'de DÜZELTİLEN YANLIŞ BEYAN: TELEFON NUMARASI ────────────────
  §2 "isteğe bağlı profil bilgileri" arasında ve §6'da "telefon numaran" yazıyordu.
  TOPLANMIYOR. Ölçüldü: Domain/Identity/User.cs'te PhoneNumber alanı VAR, ama sunucu
  ağacında ona YAZAN tek satır DeleteAccount.cs:133 (`user.PhoneNumber = null`) —
  yani yalnızca silinirken null'lanıyor. ProfileCommands telefona dokunmuyor, web
  arayüzünde de tek bir referans yok (frontend/src taraması: sıfır). Alan şemada uyuyor.

  Metnin toplamadığı bir veriyi "topluyoruz" demesi §7'deki hatanın aynası: biri
  kullanıcıya yapabildiğini yapamıyor dedi, bu da vermediğini verdiğini söylüyordu.
  İkisi de bir denetimde metni tümden şüpheli hâle getirir.
  Aynı cümle profil.jsx'teki "Silinecekler" listesinden de çıkarıldı.

  ⚠️ SOZLESME_SURUMU ARTIRILMADI ve artırılmamalıydı. Sürüm, kullanıcının KABUL ETTİĞİ
  metni işaretler; bu değişiklik yeni bir ifşa DEĞİL, var olan bir fazlalığın
  kaldırılması. Kullanıcı zaten daha geniş bir beyanı kabul etmişti, dar olanı yeniden
  onaylatmak gerekmez. Ayrıca tek taraflı artırmak sunucuyla (2026-09-19) eşitliği
  bozar ve kayıt ekranını kilitler — bkz. src/lib/yasalMetinler.js.

  ⚠️ WEB'DE AYNI HATA DURUYOR. frontend/src/pages/Gizlilik.jsx de telefon numarasını
  sayıyor; orası ayrı depo, bu değişiklikle kapanmadı.

  ─── 2026-09-05'te DÜZELTİLEN YANLIŞ BEYAN ─────────────────────────────────
  §7 "hesabını kendi başına silebileceğin bir düğme YOK, e-posta at" diyordu. Uç ve
  ekran ÇOKTAN eklenmişti (app/(tabs)/profil.jsx → "Hesabımı sil"), metin güncellenmemişti.
  Bir gizlilik metninin yapabileceği en kötü hatalardan biri: kullanıcıya, yapabildiği
  bir şeyi yapamadığını söylemek. Silme hakkını kullanmak isteyen kişi ya haftalarca
  e-posta bekler ya vazgeçer.

  ─── 2026-09-10: §6'YA İKİ PARAGRAF — SÜRÜM ARTIRILMADI (SÜRÜM BORCU) ──────────
  Web'deki pages/Gizlilik.jsx başındaki "SÜRÜM BORCU" notunun mobil karşılığı (web #30,
  #31). İki paragrafın yasal ağırlığı AYNI DEĞİL:

   1. İSİMLE ARANABİLİRLİK + ENGELLEME — yeni ifşa değil: görünen ad §6'nın zaten
      herkese açık saydığı kümede. Arama, açık bir bilgiye ulaşmanın YOLU.
   2. ARKADAŞ SAYISI + ORTAK ARKADAŞLAR — YENİ BİR İFŞA: kiminle arkadaş olduğun o
      kümede yok, bugüne kadar yalnızca iki tarafa görünüyordu. Sözleşme sürümünün
      artması GEREKİR.

  SOZLESME_SURUMU (src/lib/yasalMetinler.js) yine de ARTIRILMADI; sebep hukuki değil
  işletimsel. Sabit sunucudakiyle (LegalDocuments.CurrentVersion) birebir aynı olmak
  zorunda ve buradaki kopya PAKETE GÖMÜLÜ: tek taraflı artırmak, sürümü tutmayan
  istemciyi KAYIT EKRANINDA kilitler. Metnin sürümden bir adım önde olması ise yalnızca
  bir kayıt gecikmesi. Üstteki "Son güncelleme" de bu yüzden değişmedi: tarih sürümün
  gününü anlatıyor, tek başına değiştirmek onu kaydedilen sürümden ayırırdı.

  Kapatma sırası MOBİLLE BAŞLAR: bu depoda sürümü artır → APK'yı yayınla (mağaza
  incelemesi dahil) → LegalDocuments.CurrentVersion + web sabitini artır → sunucuyu
  dağıt. Borç kapanınca bu not sadeleştirilmeli.

  ⚠️ İkinci paragraf Keşfet'teki "Arkadaş Ekle" sekmesini ve engellemeyi anıyor; ikisi
  mobile #30'un portuyla geliyor. Metin o port olmadan yayına çıkarsa var olmayan bir
  ekranı tarif eder — §7'de bir kez yaşanan hatanın tersi. Sekme adı değişirse metin
  de değişmeli.

  ⚠️ Arkadaş paragrafındaki {' '} bilerek duruyor: web'de aynı yerde eksik ve orada
  metin "yalnızcaortak" diye birleşik görünüyor. JSX, etikete bitişik satır sonunu
  siliyor; RN'de de aynı.
*/
export default function Gizlilik() {
  return (
    <MetinSayfasi
      baslik="Gizlilik ve KVKK aydınlatma metni"
      ozet="Hangi verini topluyoruz, neden topluyoruz, ne kadar saklıyoruz ve ne isteyebilirsin."
      sonGuncelleme={SOZLESME_TARIHI}
    >
      {/*
        ⚠️ BÖLÜM NUMARASI DEĞİŞMEDİ, YALNIZCA BAŞLIK (2026-09-21, web'le aynı).

        Veri sorumlusu kimliği bir KVKK aydınlatma metninin İLK maddesidir, yani doğal
        yeri yeni bir §1 açmaktı. AÇILMADI: §4, §5, §6, §7 ve §9'a hem bu metnin içinden
        hem Koşullar'dan atıf var; hepsini bir kaydırmak, doğru metni yanlış yere işaret
        eden atıflarla bırakırdı.
      */}
      <Bolum no="1" baslik="Kısaca ve veri sorumlusu">
        <Paragraf>
          <Kalin>{MARKA}</Kalin>, öğrencilerin birbirine ders anlattığı bir platformdur ve{' '}
          <Kalin>{ISLETMECI}</Kalin> ({ISLETMECI_ALAN_ADI}) tarafından işletilmektedir. Bu
          metinde geçen “biz”, {ISLETMECI}’tir; verinle ilgili taleplerin muhatabı da odur.
          İletişim bilgileri sayfanın altındaki künyededir.
        </Paragraf>
        <Paragraf>
          Verini reklam için kullanmıyoruz, satmıyoruz ve üçüncü taraflara pazarlama
          amacıyla aktarmıyoruz. Topladığımız her şey hesabını çalıştırmak, açtıysan sana
          bildirimle haber vermek ya da platformu kötüye kullanımdan korumak için.
        </Paragraf>
      </Bolum>

      <Bolum no="2" baslik="Topladığımız veriler">
        <Paragraf>
          <Kalin>Hesap bilgileri:</Kalin> e-posta adresin, adın (görünen ad), şifrenin geri
          döndürülemez özeti (hash). Şifreni düz metin olarak hiçbir yerde saklamıyoruz.
        </Paragraf>
        <Paragraf>
          <Kalin>İsteğe bağlı profil bilgileri:</Kalin> profil fotoğrafın, kendini anlattığın
          metin, okulun ve bölümün. Bunların hiçbiri zorunlu değildir; boş bırakabilirsin.
        </Paragraf>
        <Paragraf>
          <Kalin>Kullanım verileri:</Kalin> anlattığın ders sayısı ve süresi, kazandığın puan,
          aldığın değerlendirmeler, son giriş zamanın.
        </Paragraf>
        <Paragraf>
          <Kalin>İçerik:</Kalin> arkadaşlarınla yazıştığın mesajlar ve dersin yapıldığını
          gösteren kanıt görselleri.
        </Paragraf>
        <Paragraf>
          <Kalin>Fotoğraflarına erişim:</Kalin> profil fotoğrafı ya da ders kanıtı yüklerken
          telefonun galerisini açıyoruz. Yalnızca <Kalin>senin seçtiğin</Kalin> görsel
          uygulamaya gelir; galerin taranmaz, seçmediğin hiçbir görsel okunmaz. İzni
          vermezsen uygulamanın geri kalanı çalışmaya devam eder.
        </Paragraf>
        <Paragraf>
          <Kalin>Cihaz kimliği (önemli):</Kalin> giriş yaptığında cihazından bir kimlik özeti
          üretiyoruz. Bu özet şu bilgilerin birleştirilip geri döndürülemez biçimde
          özetlenmesiyle oluşuyor: işletim sisteminin uygulamalara verdiği cihaz kimliği
          (Android’de Android ID, iOS’ta üretici kimliği), işletim sisteminin adı, cihazın
          markası ve modeli, toplam bellek miktarı. Bu bilgilerin kendisini değil, yalnızca
          özetini saklıyoruz. Bu özet bir <Kalin>reklam kimliği değildir</Kalin>: reklam için
          kullanılmaz ve hiçbir üçüncü tarafa gönderilmez.
        </Paragraf>
        {/* HWID cümlesiyle ÇELİŞMEMELİ: dışarı giden bildirim adresi, HWID özeti değil.
            Özet yalnızca sunucuda, adresi hangi cihaza ait olduğuna bağlamak için duruyor. */}
        <Paragraf>
          <Kalin>Bildirim kaydı (yalnızca bildirimleri açarsan):</Kalin> telefonuna bildirim
          gönderebilmek için telefonunun <Kalin>bildirim adresini</Kalin> (Expo’nun verdiği ve
          Android’de Google’ın, iPhone’da Apple’ın bildirim adresini taşıyan bir numara),
          telefonunun türünü (Android ya da iOS), adresin hangi cihazına ait olduğunu bilmek
          için yukarıdaki cihaz kimliği özetini, Android’de telefon ayarlarından kapattığın
          bildirim türlerini ve kaydın tarihlerini saklıyoruz. Bildirim adresi bildirimi
          ileten hizmetlere gider (bkz. §6); cihaz kimliği özeti gitmez.
        </Paragraf>
        <Paragraf>
          <Kalin>Bildirim tercihlerin ve bildirim kayıtları:</Kalin> hangi bildirim türlerini
          almak istediğin, bildirimlerle ilgili açıklamayı görüp bildirimleri açtığın an,
          bildirim sorusunu kaç kez ertelediğin ve en son ne zaman ertelediğin (soruyu
          sık sık tekrarlamamak için). Bildirimleri açmamış olsan da sunucu,
          sana bildirim gerektiren her olay için kısa bir kayıt tutar: bildirimin türü, olayın
          ve olayı başlatan kişinin kayıt numaraları, ne zaman gönderildiği ya da neden
          gönderilmediği. Bildirimin metni ve mesajlarının içeriği bu kayda{' '}
          <Kalin>kopyalanmaz</Kalin>.
        </Paragraf>
      </Bolum>

      <Bolum no="3" baslik="Neden topluyoruz">
        <Maddeler>
          <Madde>
            <Kalin>Hesabını çalıştırmak için:</Kalin> e-posta, ad, şifre özeti. Bunlar olmadan
            giriş yapamazsın.
          </Madde>
          <Madde>
            <Kalin>Arkadaşlık ve ders için:</Kalin> profil bilgilerin ve konu tercihlerin — kimin
            kime ders anlatabileceğini bunlar belirliyor.
          </Madde>
          <Madde>
            <Kalin>Kötüye kullanımı önlemek için:</Kalin> cihaz kimliği. Kuralları ağır biçimde
            ihlal eden bir hesap kapatıldığında, aynı kişinin hemen yeni hesap açıp devam
            etmesini engelleyen tek şey bu. Öğrencilerin bir arada olduğu bir platformda bu
            korumanın karşılığı somut.
          </Madde>
          <Madde>
            <Kalin>Anlaşmazlıkları çözmek için:</Kalin> ders kanıtları ve şikayet kayıtları.
          </Madde>
          <Madde>
            <Kalin>Sana haber vermek için (bildirimler):</Kalin> bildirim adresi, bildirim
            tercihlerin ve bildirim kayıtları. Yeni mesajı, arkadaş isteğini, ders onayını ve
            yaklaşan dersi zamanında haber vermek; kapattığın türleri göndermemek; aynı olayı
            iki kez bildirmemek ve aynı kişinin sana art arda istek bildirimi düşürmesini
            sınırlamak için. Hukuki sebebi, kullandığın hizmetin parçası olduğu için
            sözleşmenin ifasıdır (KVKK m.5/2-c). Bildirimler isteğe bağlıdır: açmazsan
            uygulamanın geri kalanı aynı biçimde çalışır.
          </Madde>
        </Maddeler>
      </Bolum>

      <Bolum no="4" baslik="Uygulamanın cihazında sakladıkları">
        <Paragraf>
          Mobil uygulamada çerez yoktur. Cihazında yalnızca şunlar durur:
        </Paragraf>
        <Maddeler>
          <Madde>
            <Kalin>Oturum anahtarı ve cihaz kimliği özeti:</Kalin> cihazın güvenli anahtar
            deposunda (iOS Anahtar Zinciri / Android Keystore) şifreli olarak tutulur.
            Bunlar olmadan giriş yapılamaz. Uygulamayı sildiğinde iOS’ta bu kayıt cihazda
            kalmaya devam edebilir — yeniden kurduğunda aynı cihaz olarak tanınırsın.
          </Madde>
          <Madde>
            <Kalin>Arayüz tercihlerin:</Kalin> uygulamanın kendi tercih deposunda tutulur;
            uygulama silinince gider.
          </Madde>
          {/* İki madde de "zorunlu" kategoride (IzinContext → IZIN_KATEGORILERI) ve orada da
              yazılı: hizmetin gereği, izne bağlanamaz. IZIN_SURUMU bu yüzden ARTMADI. */}
          <Madde>
            <Kalin>Bildirim bileşeninin kayıtları (yalnızca bildirimleri açtıysan):</Kalin>{' '}
            bildirimlerin bu telefona ulaşabilmesi için bildirim bileşeni rastgele bir kurulum
            numarası ve telefonun bildirim adresini saklar; adres değiştiğinde ve en geç
            haftada bir, adresi Expo’ya kendisi yeniden bildirir. Android’de Google’ın
            bildirim hizmeti de kendi kurulum kimliğini
            tutar. Android’de bunlar uygulamanın kendi alanında durur ve uygulamayla birlikte
            silinir; iOS’ta Anahtar Zinciri’nde tutulur ve uygulamayı sildikten sonra da
            kalabilir. Bildirim tercihlerin cihazda değil, hesabında tutulur.
          </Madde>
          <Madde>
            <Kalin>Bildirim kaydını silme işareti:</Kalin> internet yokken çıkış yaparsan
            sunucudaki bildirim kaydını o an silemeyiz. Bu durumda cihazın güvenli anahtar
            deposuna yalnızca çıkış zamanını taşıyan küçük bir işaret yazılır; uygulama bir
            sonraki açılışta internete ulaşınca kaydı sildirir ve işareti kaldırır.
          </Madde>
          <Madde>
            <Kalin>Ölçüm ve izleme yok:</Kalin> uygulama hiçbir analitik ya da reklam
            bileşeni içermez. “Yüklenir ama veri göndermez” değil — böyle bir bileşen
            uygulamada hiç bulunmuyor.
          </Madde>
          <Madde>
            <Kalin>Veri tercihin hesabına ait:</Kalin> Profil ekranındaki “Veri
            tercihleri”nde yaptığın analitik seçimi dersmate <Kalin>hesabına</Kalin>{' '}
            kaydedilir ve web sitesinde de geçerli olur. Mobil uygulama bugün hiçbir ölçüm
            yapmadığı için bu tercih burada bir şeyi açıp kapatmaz; ileride ölçüm
            eklenirse, eklenmeden önce senin verdiğin cevaba bakılır.
          </Madde>
        </Maddeler>
      </Bolum>

      <Bolum no="5" baslik="Ne kadar saklıyoruz">
        <Maddeler>
          <Madde>
            <Kalin>Ders kanıt görselleri: 180 gün.</Kalin> Sürenin sonunda görsel silinir.
            Görselin parmak izi (özeti) kayıtta kalır: aynı görselin başka bir derste yeniden
            kullanılmasını yalnızca bu tespit ediyor. Hakkında açık bir anlaşmazlık varsa
            kanıt, karar verilene kadar silinmez.
          </Madde>
          <Madde>
            <Kalin>Hesap verileri:</Kalin> hesabın açık olduğu sürece.
          </Madde>
          <Madde>
            <Kalin>Mesajlar:</Kalin> konuşma silinene kadar.
          </Madde>
          {/* Süreler ve silme noktaları sunucudan: PushDevice.cs başındaki liste,
              RefreshToken ömrü (60 gün), temizlik işinin 30 gün / 24 saat değerleri. Son
              cümledeki sınır BİLEREK yazılı — "çıkınca hemen biter" demek yanlış beyan olurdu. */}
          <Madde>
            <Kalin>Bildirim kaydı (telefonunun bildirim adresi):</Kalin> o telefonda çıkış
            yapana kadar. Çıkış yaptığında, “her yerden çıkış” yaptığında ya da parolanı
            sıfırladığında, hesabın kalıcı olarak kapatıldığında ya da hesabını sildiğinde
            hemen silinir. Uygulamayı telefondan kaldırırsan adres geçersizleşir ve kayıt, o adrese
            bir sonraki bildirim denemesinde silinir. Hesabın geçici olarak askıya alınırsa
            kayıt silinmez, yalnızca bildirim gönderilmez. İnternet yokken çıkış yaptıysan
            sunucu çıkışını o an öğrenemez: kayıt, uygulamayı bir sonraki açışında silinir;
            uygulamayı bir daha hiç açmazsan, o telefondaki oturumunun süresi dolana kadar
            (en fazla 60 gün) bu telefona bildirim gelmeye devam edebilir.
          </Madde>
          <Madde>
            <Kalin>Bildirim tercihlerin:</Kalin> hesabın açık olduğu sürece.
          </Madde>
          <Madde>
            <Kalin>Bildirim kayıtları: 30 gün.</Kalin> Bildirim gönderildikten ya da
            gönderilmeyeceği anlaşıldıktan 30 gün sonra silinir. Bildirim hizmetinin teslim
            makbuzları (bildirimin telefona ulaşıp ulaşmadığını gösteren kısa kayıt) ve aynı
            sohbetten art arda bildirim gitmesin diye tutulan son gönderim zamanı ise bir
            gün dolduktan sonraki ilk temizlikte silinir.
          </Madde>
          <Madde>
            <Kalin>Yedekler.</Kalin> Sistemi bir arıza ya da veri kaybından geri
            getirebilmek için düzenli yedek alıyoruz. Bir veri canlı sistemden silindiğinde{' '}
            <Kalin>o an</Kalin> silinir, ama daha önce alınmış yedeklerde bir süre daha
            durur. Sunucudaki yedekler <Kalin>en fazla 14 gün</Kalin> saklanır ve süresi
            dolanlar kendiliğinden silinir. Yedeklerin bir kopyası, sunucunun tümden
            kaybolduğu durumlara karşı ayrı bir bulut deposunda tutulur. Yedekler{' '}
            <Kalin>yalnızca</Kalin> geri yükleme amacıyla kullanılır; içlerinde arama
            yapmıyor, analiz etmiyor, kimseyle paylaşmıyoruz.
          </Madde>
        </Maddeler>
      </Bolum>

      <Bolum no="6" baslik="Kimlerle paylaşıyoruz">
        <Paragraf>
          Profilinde <Kalin>senin girdiğin</Kalin> bilgiler (adın, fotoğrafın, okulun, kendini
          anlattığın metin, anlatabildiğin konular, aldığın değerlendirmeler) platformdaki
          diğer kullanıcılara açıktır. E-posta adresin ve cihaz kimliğin{' '}
          <Kalin>hiçbir kullanıcıya gösterilmez</Kalin>.
        </Paragraf>
        <Paragraf>
          <Kalin>Arkadaş sayın</Kalin> profilinde herkese görünür. Tam arkadaş listeni
          yalnızca sen görürsün; başka bir kullanıcı profiline baktığında yalnızca{' '}
          <Kalin>ortak arkadaşlarınızı</Kalin> — yani zaten ikinizin de arkadaşı olan
          kişileri — görür. Engellediğin kişiler bu sayıya, tam listene ve ortak arkadaş
          listelerine girmez; Arkadaşlar ekranında ise arkadaşlığı sen sonlandırana kadar
          görünmeye devam eder.
        </Paragraf>
        {/* ⚠️ Son cümle web'den AYRIŞTI; web'in yetişmesi gerekiyor (Gizlilik.jsx §6).
            Eski hâli "bu sayıya ve listelere hiç girmez" diyordu. Oysa engelleme kabul
            edilmiş arkadaşlığı kapatmıyor (UserBlocks.cs) ve Arkadaşlar ekranının ucu
            (GetMyMatches) engel süzmüyor: engellenen arkadaş orada ve "Arkadaş (N)"
            sayısında duruyor. Metin gerçeğe daraltıldı, uç süzülmedi: Sonlandır düğmesi
            YALNIZCA o ekranda ve kişiyi oradan gizlemek o arkadaşlığı bitirmenin tek
            yolunu kaldırırdı. */}
        <Paragraf>
          Görünen adınla <Kalin>aranabilirsin</Kalin>: Keşfet’teki “Arkadaş Ekle”
          bölümünde adını bilen bir kullanıcı seni bulup istek gönderebilir. Bu, profilini
          doldurmamış olsan da geçerlidir. İstemediğin kişiyi{' '}
          <Kalin>engelleyebilirsin</Kalin> — engellediğin kişi seni aramada göremez,
          sana istek gönderemez ve açık sohbetinize yazamaz. Engellediğin karşı tarafa
          bildirilmez.
        </Paragraf>
        {/* ⛔ 2026-09-25'e kadar bu paragraf "uygulamanın konuştuğu tek sunucu dersmate'in
            kendi sunucusudur", altındaki "uygulama doğrudan hiçbir üçüncü tarafa
            bağlanmasa da" diyordu. Push ile ikisi de YANLIŞ oldu: bildirimler açılınca
            telefon Expo'ya ve işletim sisteminin bildirim hizmetine bağlanıyor. */}
        <Paragraf>
          Verini pazarlama amacıyla üçüncü taraflara <Kalin>aktarmıyoruz</Kalin> ve
          satmıyoruz. Mobil uygulama, verini dışarı taşıyan hiçbir reklam ağı, analitik ya
          da çökme raporlama bileşeni <Kalin>içermez</Kalin>. Uygulama dersmate’in kendi
          sunucusuyla konuşur; <Kalin>tek istisna bildirimlerdir</Kalin>: bildirimleri
          açarsan telefonun, bildirim adresini almak ve güncel tutmak için Expo’ya ve
          telefonunun bildirim hizmetine (Android’de Google, iPhone’da Apple) bağlanır.
        </Paragraf>
        <Paragraf>
          <Kalin>Hizmet sağlayıcılarımız (veri işleyenler).</Kalin> dersmate’in sunucusu
          platformu çalıştırabilmek için birkaç dış hizmetten yararlanıyor. Bunlar verini{' '}
          <Kalin>bizim adımıza ve yalnızca aşağıdaki amaçla</Kalin> işler; kendi amaçları
          için kullanamazlar.
        </Paragraf>
        <Maddeler>
          <Madde>
            <Kalin>Sunucu barındırma.</Kalin> Platformun sunucusunu ve veritabanını
            barındıran hizmet sağlayıcı. Hesap verilerinin tamamı burada tutulur.
          </Madde>
          <Madde>
            <Kalin>E-posta gönderimi — Resend.</Kalin> Doğrulama kodu, parola sıfırlama ve
            bildirim e-postalarını iletir. Ona giden veri: e-posta adresin ve iletinin
            içeriği.
          </Madde>
          <Madde>
            <Kalin>Yedek deposu — Google Drive.</Kalin> Yedeklerin sunucu dışındaki kopyası
            burada tutulur (bkz. §5).
          </Madde>
          {/* Taşıyıcı cümlesi aydınlatma sorusu (BildirimIzniSorusu → TASIYICI_METNI) ve
              Bildirim ayarları ekranıyla AYNI olguyu söylemeli: kullanıcı "Aç"a basarken
              okuduğundan farklı bir şeyi burada bulmamalı. */}
          <Madde>
            <Kalin>
              Bildirim iletimi — Expo, Google (Firebase Cloud Messaging) ve Apple (Apple Push
              Notification service).
            </Kalin>{' '}
            Yalnızca bildirimleri açtıysan. Sunucumuz bildirimi Expo’ya verir; Expo onu
            Android’de Google’ın, iPhone’da Apple’ın bildirim hizmeti üzerinden telefonuna
            ulaştırır. Onlara giden veri: telefonunun bildirim adresi; bildirimin başlığı ve
            metni; açıldığında doğru ekrana gidebilmek için bildirimin türü ve{' '}
            <Kalin>anlamsız, rastgele bir kayıt numarası</Kalin> (sohbetin ya da dersin
            numarası); aynı telefonda başka bir hesap açıkken bildirimin gösterilmemesi için
            hesabından türetilen ve geri çözülemeyen kısa bir etiket. Bildirim adresini
            alırken uygulama Expo’ya ayrıca bildirim bileşeninin rastgele kurulum numarasını
            gönderir. Mesajlarının içeriği bildirimlere <Kalin>hiçbir zaman</Kalin> girmez;
            kişi adı yalnızca yeni mesaj ve kabul edilen istek bildiriminde, arkadaşının
            görünen adı olarak geçer. İstek ve ders bildirimlerinde kimsenin adı geçmez;
            dersin ya da isteğin konusu geçebilir. E-posta adresin ve cihaz kimliği özetin
            bu hizmetlere gönderilmez.
          </Madde>
        </Maddeler>
        <Paragraf>
          <Kalin>Kilit ekranı.</Kalin> Telefonunun kilit ekranı ayarına göre bildirimin
          başlığı görünebilir; içeriğini telefon ayarlarından gizleyebilirsin. iPhone’da:
          Ayarlar › Bildirimler › Önizlemeleri Göster. Gece 22.00–09.00 arasında acil olmayan
          bildirimler sabaha kalır; yeni mesaj ve yaklaşan ders bildirimleri beklemez.
        </Paragraf>
        <Paragraf>
          <Kalin>Yurt dışına aktarım.</Kalin> Bu sağlayıcıların bir kısmı sunucularını{' '}
          <Kalin>Türkiye dışında</Kalin> işletiyor. Bu, KVKK m.9 anlamında yurt dışına
          aktarım sayılır ve hesap açarken verdiğin onay bunu da kapsar; bildirim iletimi
          için yapılan aktarım ise yalnızca bildirimleri açtığında başlar. Aktarılan veri,
          her sağlayıcı için yalnızca o hizmetin gerektirdiği kadarıdır: e-posta gönderimi
          için adresin ve iletinin içeriği, yedekleme için yedek dosyalarının kendisi,
          bildirim iletimi için yukarıda sayılan bildirim bilgileri.
        </Paragraf>
        <Paragraf>
          Bu listeyi değiştirdiğimizde metni günceller ve üstteki tarihi değiştiririz
          (bkz. §9).
        </Paragraf>
      </Bolum>

      <Bolum no="7" baslik="Haklarını nasıl kullanırsın">
        <Paragraf>
          KVKK kapsamında verine erişme, düzeltme, silinmesini isteme ve işlenmesine itiraz
          etme hakkın var.
        </Paragraf>
        <Maddeler>
          <Madde>
            <Kalin>Düzeltme:</Kalin> profil bilgilerinin çoğunu doğrudan “Profili düzenle”
            ekranından değiştirebilirsin.
          </Madde>
          {/* "Profil sekmesi" 2026-09-23'te bayatladı: sekme çubuğu kalktı, Profil'e sol
              üstteki menüden (çekmece başlığındaki ad) gidiliyor. Silinenler listesi
              profil/index.jsx → "Silinecekler" ile aynı olmalı. */}
          <Madde>
            <Kalin>Silme:</Kalin> hesabını <Kalin>kendin silebilirsin</Kalin> — Profil
            ekranının en altındaki “Hesabımı sil” (Profil’e sol üstteki menüden, adına
            dokunarak gidersin). Onay için parolan yeniden sorulur ve işlem geri alınamaz.
            Kimlik bilgilerin siliniyor; bildirim ayarların, bildirim kayıtların ve bildirim
            alan cihazların da siliniyor. Ders geçmişi, kazandırdığın puanlar ve
            değerlendirmeler karşı tarafa ait olduğu için kalıyor ve orada adın yerine
            “Silinmiş kullanıcı” görünüyor. Yedeklerdeki kopyaların ne zaman düştüğü §5’te
            yazılı.
          </Madde>
          <Madde>
            <Kalin>Bildirimleri kapatma:</Kalin> Profil › Bildirim ayarları’ndan bildirim
            türlerini tek tek kapatabilirsin; kapattığın türler sana hiç gönderilmez.
            Bildirimleri telefonunun ayarlarından da tamamen kapatabilirsin. Bu telefonun
            bildirim kaydını sunucudan kaldırmak için çıkış yapman yeterli (bkz. §5).
          </Madde>
          <Madde>
            <Kalin>Erişim ve hesabına giremiyorsan:</Kalin> verinin bir kopyasını alma
            talebini ya da hesabına hiç erişemediğin durumda silme talebini aşağıdaki
            adrese ilettiğinde işleme alıyoruz.
          </Madde>
        </Maddeler>
        <MetinBaglantisi
          etiket={ILETISIM_EPOSTA}
          onPress={() => Linking.openURL(`mailto:${ILETISIM_EPOSTA}`)}
        />
      </Bolum>

      <Bolum no="8" baslik="Yaş">
        <Paragraf>
          Platform lise ve üniversite öğrencilerine yönelik. 18 yaşından küçüksen hesabını
          velinin bilgisi ve onayıyla açmalısın. Kayıt sırasında bunu beyan etmeni istiyoruz.
        </Paragraf>
      </Bolum>

      {/*
        Web'in kapanışı "çerez tercihini etkileyen değişiklikte seçimi yeniden soruyoruz"
        diyor; mobilde çerez seçimi olmadığı için o cümlenin karşılığı yok. Yerine
        UYDURULMUŞ bir vaat (ör. "uygulama içinde bildiririz") yazılmadı — kodda karşılığı
        olmayan koruma sözü, bu metinlerin en tehlikeli hatası. Yazılan şey gerçekten
        işleyen mekanizma: sürüm değişince yeni kayıtlar yeni metni onaylıyor
        (LegalDocuments.CurrentVersion), eski onaylar kendiliğinden geçersizleşmiyor.
      */}
      <Bolum no="9" baslik="Değişiklikler">
        <Paragraf>
          Bu metin değişirse yayınlanma tarihini güncelliyoruz ve yeni metin uygulamanın
          bir sonraki sürümüyle gelir. Değişiklikten sonra kayıt olan herkes yeni metni
          onaylar; daha önce verdiğin onay, onayladığın tarihle birlikte kayıtlıdır.
        </Paragraf>
      </Bolum>
    </MetinSayfasi>
  )
}
