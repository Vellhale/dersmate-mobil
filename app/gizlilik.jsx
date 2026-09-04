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
import { ILETISIM_EPOSTA, SOZLESME_TARIHI } from '../src/lib/yasalMetinler'

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

  ─── 2026-09-05'te DÜZELTİLEN YANLIŞ BEYAN ─────────────────────────────────
  §7 "hesabını kendi başına silebileceğin bir düğme YOK, e-posta at" diyordu. Uç ve
  ekran ÇOKTAN eklenmişti (app/(tabs)/profil.jsx → "Hesabımı sil"), metin güncellenmemişti.
  Bir gizlilik metninin yapabileceği en kötü hatalardan biri: kullanıcıya, yapabildiği
  bir şeyi yapamadığını söylemek. Silme hakkını kullanmak isteyen kişi ya haftalarca
  e-posta bekler ya vazgeçer.
*/
export default function Gizlilik() {
  return (
    <MetinSayfasi
      baslik="Gizlilik ve KVKK aydınlatma metni"
      ozet="Hangi verini topluyoruz, neden topluyoruz, ne kadar saklıyoruz ve ne isteyebilirsin."
      sonGuncelleme={SOZLESME_TARIHI}
    >
      <Bolum no="1" baslik="Kısaca">
        <Paragraf>
          dersmate, öğrencilerin birbirine ders anlattığı bir platformdur. Verini reklam
          için kullanmıyoruz, satmıyoruz ve üçüncü taraflara pazarlama amacıyla
          aktarmıyoruz. Topladığımız her şey ya hesabını çalıştırmak ya da platformu
          kötüye kullanımdan korumak için.
        </Paragraf>
      </Bolum>

      <Bolum no="2" baslik="Topladığımız veriler">
        <Paragraf>
          <Kalin>Hesap bilgileri:</Kalin> e-posta adresin, adın (görünen ad), şifrenin geri
          döndürülemez özeti (hash). Şifreni düz metin olarak hiçbir yerde saklamıyoruz.
        </Paragraf>
        <Paragraf>
          <Kalin>İsteğe bağlı profil bilgileri:</Kalin> profil fotoğrafın, kendini anlattığın
          metin, okulun ve bölümün, telefon numaran. Bunların hiçbiri zorunlu değildir; boş
          bırakabilirsin.
        </Paragraf>
        <Paragraf>
          <Kalin>Kullanım verileri:</Kalin> anlattığın ders sayısı ve süresi, kazandığın puan,
          aldığın değerlendirmeler, son giriş zamanın.
        </Paragraf>
        <Paragraf>
          <Kalin>İçerik:</Kalin> eşleştiğin kişilerle yazıştığın mesajlar ve dersin yapıldığını
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
      </Bolum>

      <Bolum no="3" baslik="Neden topluyoruz">
        <Maddeler>
          <Madde>
            <Kalin>Hesabını çalıştırmak için:</Kalin> e-posta, ad, şifre özeti. Bunlar olmadan
            giriş yapamazsın.
          </Madde>
          <Madde>
            <Kalin>Eşleşme ve ders için:</Kalin> profil bilgilerin ve konu tercihlerin — kimin
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
          <Madde>
            <Kalin>Ölçüm ve izleme yok:</Kalin> uygulama hiçbir analitik ya da reklam
            bileşeni içermez. “Yüklenir ama veri göndermez” değil — böyle bir bileşen
            uygulamada hiç bulunmuyor.
          </Madde>
          <Madde>
            <Kalin>Veri tercihin hesabına ait:</Kalin> Profil ekranındaki “Veri
            tercihleri”nde yaptığın analitik seçimi dersmate <Kalin>hesabına</Kalin>
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
          diğer kullanıcılara açıktır. E-posta adresin, telefon numaran ve cihaz kimliğin{' '}
          <Kalin>hiçbir kullanıcıya gösterilmez</Kalin>.
        </Paragraf>
        <Paragraf>
          Verini pazarlama amacıyla üçüncü taraflara <Kalin>aktarmıyoruz</Kalin> ve
          satmıyoruz. Mobil uygulama, verini dışarı taşıyan hiçbir üçüncü taraf bileşen
          (reklam ağı, analitik, çökme raporlama) <Kalin>içermez</Kalin>; uygulamanın
          konuştuğu tek sunucu dersmate’in kendi sunucusudur.
        </Paragraf>
        <Paragraf>
          <Kalin>Sunucu tarafındaki hizmet sağlayıcılarımız (veri işleyenler).</Kalin>{' '}
          Uygulama doğrudan hiçbir üçüncü tarafa bağlanmasa da, dersmate’in sunucusu
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
        </Maddeler>
        <Paragraf>
          <Kalin>Yurt dışına aktarım.</Kalin> Bu sağlayıcıların bir kısmı sunucularını{' '}
          <Kalin>Türkiye dışında</Kalin> işletiyor. Bu, KVKK m.9 anlamında yurt dışına
          aktarım sayılır ve hesap açarken verdiğin onay bunu da kapsar. Aktarılan veri,
          her sağlayıcı için yalnızca o hizmetin gerektirdiği kadarıdır: e-posta gönderimi
          için adresin ve iletinin içeriği, yedekleme için yedek dosyalarının kendisi.
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
          <Madde>
            <Kalin>Silme:</Kalin> hesabını <Kalin>kendin silebilirsin</Kalin> — Profil
            sekmesinin en altındaki “Hesabımı sil”. Onay için parolan yeniden sorulur ve
            işlem geri alınamaz. Kimlik bilgilerin siliniyor; ders geçmişi, kazandırdığın
            puanlar ve değerlendirmeler karşı tarafa ait olduğu için kalıyor ve orada adın
            yerine “Silinmiş kullanıcı” görünüyor. Yedeklerdeki kopyaların ne zaman
            düştüğü §5’te yazılı.
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
