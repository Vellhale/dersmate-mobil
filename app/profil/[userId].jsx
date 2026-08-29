import { Pressable, ScrollView, Text, View } from 'react-native'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ProfilGorunumu } from '../../src/components/ProfilGorunumu'
import { useAuth } from '../../src/state/AuthContext'

/*
  BAŞKASININ PROFİLİ — tab çubuğunun ÜSTÜNDE açılan yığın ekranı (akış kartından,
  sohbet başlığından gelinir). Web'de /profil/:userId aynı bileşene gidiyordu; mobilde
  kendi profil sekmesi düzenleme eylemlerini taşır, bu rota salt görüntülemedir.

  Kendi id'sine gelen kullanıcı da aynı görünümü alır (düzenleme yine sekmesinde) —
  yönlendirme karmaşası yerine tek doğru davranış.
*/
export default function BaskasininProfili() {
  const { userId } = useLocalSearchParams()
  const router = useRouter()
  const { session } = useAuth()

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

      <ScrollView contentContainerClassName="p-4">
        <ProfilGorunumu userId={userId} kendiProfilim={session?.userId === userId} />
      </ScrollView>
    </SafeAreaView>
  )
}
