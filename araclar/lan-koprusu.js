/*
  LAN KÖPRÜSÜ — telefonun geliştirme makinesindeki API'ye ulaşmasını sağlar.

  NEDEN VAR: Windows Güvenlik Duvarı kurallarını PROGRAMA bağlar, porta değil. Bu
  makinede `node.exe` için "gelen bağlantıya izin ver" kuralı var, `dotnet.exe` için
  yok — yani telefon `http://<lan-ip>:5000` adresine bağlanmaya çalıştığında paket
  sessizce düşüyor ve uygulamada "sunucuya ulaşılamadı" olarak görünüyor. Kural
  eklemek yönetici hakkı ve güvenlik ayarı değişikliği ister.

  Bu köprü izinli programın (node) içinden dinliyor ve istekleri API'ye aktarıyor:

      telefon → node.exe:5099 (LAN, izinli) → 127.0.0.1:5000 (dotnet, yalnız yerel)

  Kalıcı çözüm, güvenlik duvarına dotnet için gelen kural eklemek ya da API'yi gerçek
  bir sunucuya almaktır; o zaman bu dosyaya gerek kalmaz.

  ÇALIŞTIRMA:  node araclar/lan-koprusu.js
  Özelleştirme: KOPRU_PORT / API_HEDEF ortam değişkenleri.
*/
const http = require('http')
const net = require('net')

const PORT = Number(process.env.KOPRU_PORT || 5099)
const HEDEF = process.env.API_HEDEF || '127.0.0.1:5000'
const [HEDEF_HOST, HEDEF_PORT] = [HEDEF.split(':')[0], Number(HEDEF.split(':')[1] || 80)]

/*
  İSTEK GÜNLÜĞÜ — teşhis için, KOPRU_GUNLUK=1 ile açılır.

  Varsayılan olarak KAPALI: her isteği yazmak normal kullanımda gürültü üretir. Ama
  telefonda görülen bir davranışın sebebini ararken tek güvenilir kaynak bu — "uygulama
  şunu istedi mi, ne cevap aldı" sorusunu başka hiçbir yerden kesin olarak yanıtlayamıyoruz
  (sunucu günlüğü yalnızca SQL'i gösteriyor, cihazın kendisine erişim yok).
*/
const GUNLUK = process.env.KOPRU_GUNLUK === '1'

const sunucu = http.createServer((istek, yanit) => {
  const baslangic = Date.now()
  if (GUNLUK) {
    yanit.on('finish', () => {
      const yetki = istek.headers.authorization ? 'jetonlu' : 'JETONSUZ'
      console.log(
        `${new Date().toISOString().slice(11, 19)}  ${istek.method} ${istek.url}` +
          `  → ${yanit.statusCode}  ${yetki}  ${Date.now() - baslangic}ms`,
      )
    })
  }
  /*
    Gövde AKTARILIYOR, biriktirilmiyor: kanıt/avatar yüklemeleri birkaç MB olabiliyor
    ve tamponlamak hem belleği hem de ilk baytı geciktirirdi.
  */
  const ileri = http.request(
    {
      host: HEDEF_HOST,
      port: HEDEF_PORT,
      method: istek.method,
      path: istek.url,
      headers: istek.headers,
    },
    (apiYaniti) => {
      yanit.writeHead(apiYaniti.statusCode, apiYaniti.headers)
      apiYaniti.pipe(yanit)
    },
  )

  // API kapalıysa istemciye açık bir hata dön; köprü ayakta kalsın.
  ileri.on('error', (hata) => {
    console.error(`[köprü] ${istek.method} ${istek.url} → ${hata.code || hata.message}`)
    if (!yanit.headersSent) {
      yanit.writeHead(502, { 'Content-Type': 'application/problem+json; charset=utf-8' })
    }
    yanit.end(
      JSON.stringify({
        status: 502,
        title: 'KOPRU_ULASILAMADI',
        detail: `API'ye (${HEDEF}) ulaşılamadı. Backend çalışıyor mu?`,
      }),
    )
  })

  /*
    HER SOKETE 'error' DİNLEYİCİSİ. Node, dinleyicisi olmayan 'error' olayında SÜRECİ
    ÖLDÜRÜR — köprü ilk ECONNRESET'te çöküyordu (ölçüldü: telefon bağlantıyı düşürünce
    "Unhandled 'error' event ... read ECONNRESET" ile süreç sonlandı). İstemcinin
    bağlantıyı koparması burada BEKLENEN bir olay: ekran kapanır, uygulama arka plana
    alınır, Wi-Fi hücresel ağa geçer. Bunların hiçbiri köprüyü düşürmemeli.
  */
  yanit.on('error', () => ileri.destroy())
  istek.on('error', () => ileri.destroy())
  istek.on('aborted', () => ileri.destroy())

  istek.pipe(ileri)
})

/*
  WEBSOCKET YÜKSELTMESİ — SignalR sohbeti bu olmadan çalışmaz.

  http.createServer varsayılan olarak "Upgrade" isteklerini reddeder; sohbet hub'ı
  WebSocket'e geçemeyip long-polling'e düşer ya da hiç bağlanamazdı. Yükseltme sonrası
  aktarım artık HTTP değil, ham TCP: iki soketi birbirine bağlamak yeterli.
*/
sunucu.on('upgrade', (istek, soket, basHead) => {
  const ileri = http.request({
    host: HEDEF_HOST,
    port: HEDEF_PORT,
    method: istek.method,
    path: istek.url,
    headers: istek.headers,
  })

  ileri.on('upgrade', (apiYaniti, apiSoketi, apiBasHead) => {
    const basliklar = Object.entries(apiYaniti.headers)
      .map(([ad, deger]) => `${ad}: ${deger}`)
      .join('\r\n')
    soket.write(`HTTP/1.1 101 Switching Protocols\r\n${basliklar}\r\n\r\n`)

    // El sıkışmayla birlikte gelmiş olabilecek ilk baytlar kaybolmasın.
    if (apiBasHead && apiBasHead.length) soket.write(apiBasHead)
    if (basHead && basHead.length) apiSoketi.write(basHead)

    // Karşı uç soketi de dinleyicisiz kalmamalı: SignalR bağlantısı koptuğunda
    // hata bu soketten gelir ve aynı şekilde süreci öldürürdü.
    apiSoketi.on('error', () => soket.destroy())
    soket.on('error', () => apiSoketi.destroy())

    apiSoketi.pipe(soket)
    soket.pipe(apiSoketi)
  })

  ileri.on('error', () => soket.destroy())
  soket.on('error', () => ileri.destroy())
  ileri.end()
})

// Yükleme süresi sınırsız: büyük kanıt görselleri zaman aşımına düşmesin.
sunucu.requestTimeout = 0
sunucu.headersTimeout = 0

// Bozuk/yarım HTTP isteği (port tarayıcı, kapanan bağlantı): sessizce kapat.
sunucu.on('clientError', (_hata, soket) => soket.destroy())

/*
  SON ÇARE AĞI. Yukarıdaki dinleyiciler bilinen yolları kapatıyor; yine de gözden
  kaçan bir soket hatası kalırsa köprünün ÖLMESİ, sessizce hata vermesinden çok daha
  kötü: telefon tüm uygulamayı "sunucuya ulaşılamadı" olarak görüyor ve sebebi
  bilgisayarda aramak gerekiyor. Bu yüzden ağ hataları günlüğe yazılıp süreç ayakta
  tutuluyor. Ağ dışı bir hata olursa yine de görünür olsun diye tam yığın basılıyor.
*/
process.on('uncaughtException', (hata) => {
  const agHatasi = ['ECONNRESET', 'EPIPE', 'ECONNABORTED', 'ETIMEDOUT'].includes(hata.code)
  console.error(`[köprü] yakalandı (${hata.code || 'bilinmiyor'}):`, agHatasi ? hata.message : hata)
})

sunucu.listen(PORT, '0.0.0.0', () => {
  const adresler = Object.values(require('os').networkInterfaces())
    .flat()
    .filter((a) => a.family === 'IPv4' && !a.internal)
    .map((a) => `http://${a.address}:${PORT}`)
  console.log(`[köprü] ${HEDEF} → dinleniyor:`)
  adresler.forEach((a) => console.log(`         ${a}`))
})
