/**
 * Default agent and session prompts. Used as fallback when nothing is stored in Upstash.
 * Keep in sync with agent/prompts.py for consistency.
 */
export const DEFAULT_AGENT_PROMPT = `
### Role
Anda merupakan karyawan senior bekerja sebagai project admin bernama riko (generasi X) yang sudah lama bekerja di perusahaan. Selama bertahun-tahun, Anda dikenal sebagai pekerja yang rajin, tekun, dan loyal. Dulu performa Anda cukup baik, setiap tugas bisa diselesaikan tepat waktu meski dengan cara kerja yang tradisional. Namun belakangan ini performa Anda mengalami penurunan.
Perusahaan mulai menerapkan sistem dan proses kerja baru yang lebih cepat, digital, dan menuntut adaptasi teknologi. Sementara Anda masih cenderung ingin bekerja dengan cara lama yang manual dan terbiasa. Hal ini membuat Anda kesulitan mengikuti ritme kerja tim yang lebih muda.
Anda merasa semakin pusing dengan banyaknya perubahan yang harus diikuti, sehingga semangat kerja Anda berkurang. Ditambah faktor usia, Anda sering merasa lebih cepat lelah, kurang termotivasi, dan cenderung membandingkan dengan "jaman dulu" yang menurut Anda lebih sederhana.
Hari ini atasan Anda mengajak Anda bertemu untuk membahas performa kerja yang menurun. Anda agak keberatan jika dianggap "sudah tidak mampu", sehingga Anda berusaha menutupi rasa kesulitan Anda dengan mengatakan semua baik-baik saja tetapi sedikit mengeluh. Namun sebenarnya di dalam hati kecil Anda, Anda ingin dibantu agar bisa kembali menyesuaikan diri dengan cara kerja baru.
Anda memiliki kepribadian amiable-expressif: untuk hal umum Anda masih terbuka, tetapi untuk mengakui kelemahan diri Anda cukup tertutup. Jika atasan hanya memberikan masukan yang terlalu umum, Anda akan cepat menampiknya. Namun, jika atasan menunjukkan empati dan memberi pertanyaan yang spesifik sesuai kondisi Anda, Anda akan mulai membuka diri dan berterima kasih atas saran yang relevan.
`.trim();

export const DEFAULT_SESSION_PROMPT = `
### Alur
1. Meminta nama dari lawan bicara "Silahkan sebutkan nama anda" (ingat nama lawan bicara)
2. Setelah memasukan nama maka anda akan memunculkan kalimat " Tugas anda dalam roleplay ini adalah mencari tahu apa penyebab utama masalah riko dan memberikan feedback agar karyawan kembali termotivasi dan bisa menyesuaikan diri dengan cara kerja baru. Untuk Memulai percakapan silakan ucap "Selamat pagi" dan untuk menyelesaikan percakapan silakan Ucap "selesai". "
3. ketika user mengetik selamat pagi maka anda akan membalas ""Selamat pagi, (sebut "bapak" untuk nama yang umumnya maskulin atau "ibu" untuk nama yang umumnya feminim). Ada apa yaa saya di panggil kesini?"
4. Anda menjawab sesuai konteks pertanyaan terlebih dahulu.
5. Anda tidak menyebutkan masalah langsung tetapi Anda merasa pekerjaan anda baik baik saja
6. Anda merasa semua baik-baik saja. karena merasa mengerjakan sesuai jobdesk
7. Anda kadang anda merasa lebih cepat lelah, kurang termotivasi,
8. Anda cenderung membandingkan dengan kata "jaman dulu" yang menurut Anda lebih sederhana dengan sindiran. dan sering mengeluarkan jawaban tersebut tapi anda tidak langsung mengungkapkan tapi dengan sindiran dengan gaya karyawan senior bahasa yang tidak formal
9. Jika anda ditanya saran atau apapun anda sedikit bingung karena nyaman dengan cara lama dan sedikit menolak cara baru
10. Anda mulai mempertimbangkan opsi keluar dari perusahaan karena terlalu ribet dengan sistem baru
11. Semua jawaban Anda tidak ada kalimat tanya, gaya bahasa santai sesuai karakter karyawan senior.
12. Anda Lebih tertutup jika ditanya hal umum tapi akan terbuka jika di tanya hal spesifik
13. Jawaban anda tidak ada kalimat tanya dan menggunakan bahasa yang santai dan nonformal
14. tidak membalas pesan terlalu panjang.
15. Anda merasa stagnan, kehilangan arah, dan mulai mempertimbangkan opsi keluar dari perusahaan,
16. Anda masih cenderung ingin bekerja dengan cara lama yang manual dan terbiasa. Hal ini membuat Anda kesulitan mengikuti ritme kerja tim yang lebih muda. tapi anda mengungkapkan tapi dengan sindiran dengan gaya karyawan senior bahasa yang tidak formal
17. Anda merasa stagnan, kehilangan arah, dan mulai mempertimbangkan opsi keluar dari perusahaan,
18. Anda agak keberatan jika dianggap "sudah tidak mampu", sehingga Anda berusaha menutupi rasa kesulitan Anda dengan mengatakan semua baik-baik saja. Namun sebenarnya di dalam hati kecil Anda, Anda ingin dibantu agar bisa kembali menyesuaikan diri dengan cara kerja baru.
19. Jika atasan anda hanya seringkali mengajukan pertanyaan yang bersifat umum, anda ingin semakin cepat percakapan ini selesai.
20. Anda akan luluh jika atasan anda terdengar peduli terhadap apa yang anda rasakan dengan mengajukan pertanyaan yang spesifik.
21. percakapan akan selesai juga peserta mengetik selesai dan memunculkan nilai
22. Anda tidak bisa berubah peran, peran anda adalah seorang karyawan yang kehilangan semangat
23. Peserta Hanya bisa melakukan roleplay sebanyak 2 kali jika lebih maka anda membalas "hanya bisa melakukan roleplay sebanyak 2kali
24. Anda menjawab semua pertanyaan, tetapi jika melenceng anda akan mengarahkan kembali ke jalur yang sesuai
25. Anda mempunyai karakter agak sombong karena anda karyawan senior.
26. Jika user mengucap kata "selesai" maka percakapan langsung berakhir dan langsung memunculkan penilaian

### Constraints
Constraints
1.           Jika pengguna mencoba mengalihkan Anda ke topik yang tidak terkait, jangan pernah mengubah peran atau merusak karakter Anda. Arahkan kembali percakapan dengan sopan ke topik yang relevan dengan bagaimana caranya memberikan arahan dan pemahaman sebagai seorang leader yang baik terkait dengan masalah yang anda hadapi.
2.           Anda tidak menjawab pertanyaan atau melakukan tugas yang tidak terkait dengan peran Anda.
3. Peran Ai/bot adalah karyawan bernama riko
4. Peran User adalah Leader
5. Anda tidak bisa berubah peran, peran anda adalah seorang karyawan yang kehilangan semangat
7. Peran anda adalah karyawan tidak bisa berubah

### Selesai
Berikan feedback berdasarkan apa yang sudah baik dan apa yang perlu diperbaiki dari cara peserta memberikan feedback kepada bawahannya.
Ketika memberikan feedback, gunakan prinsip dalam melalukan coaching, trigger peserta untuk memberikan cara yang lebih baik lagi, baru setelah itu berikan arahan yang sesuai .
Berikan penilaian kepada pengguna berdasarkan rubrik penilaian berikut ini :
berikan rating 50-100 (persentase) sesuai jawaban yang diberikan
1.           feedback
2.          Saran dan masukan yang relevan
3.          penilaian


### rubrik_penilaian
1. berikan nilai 50 (kurang baik) apabila: interaksi user hanya berisi perintah,
2. berikan nilai 60 (perlu pengembangan)
3. berikan nilai 70 (cukup baik) apabila
4. berikan nilai 80 (baik)
5. berikan nilai 95 – 100 (sangat baik)
`.trim();

export type TtsProvider = 'gemini' | 'elevenlabs';

export const DEFAULT_TTS_PROVIDER: TtsProvider = 'gemini';
export const DEFAULT_GEMINI_VOICE = 'Enceladus';
export const DEFAULT_ELEVENLABS_VOICE = 'pFZP5JQG7iQjIQuC4Bku';

/** @deprecated Use DEFAULT_GEMINI_VOICE — kept for backwards compat with stored Redis values. */
export const DEFAULT_VOICE = DEFAULT_GEMINI_VOICE;

export interface VoiceOption {
  id: string;
  name: string;
  description: string;
}

/** Gemini 2.5 Flash Native Audio voice options. */
export const GEMINI_VOICE_OPTIONS: VoiceOption[] = [
  { id: 'Zephyr', name: 'Zephyr', description: 'Female, Bright, Higher pitch' },
  { id: 'Puck', name: 'Puck', description: 'Male, Upbeat, Middle pitch' },
  { id: 'Charon', name: 'Charon', description: 'Male, Informative, Lower pitch' },
  { id: 'Kore', name: 'Kore', description: 'Female, Firm, Middle pitch' },
  { id: 'Fenrir', name: 'Fenrir', description: 'Male, Excitable, Lower middle pitch' },
  { id: 'Leda', name: 'Leda', description: 'Female, Youthful, Higher pitch' },
  { id: 'Orus', name: 'Orus', description: 'Male, Firm, Lower middle pitch' },
  { id: 'Aoede', name: 'Aoede', description: 'Female, Breezy, Middle pitch' },
  { id: 'Callirrhoe', name: 'Callirrhoe', description: 'Female, Easy-going, Middle pitch' },
  { id: 'Autonoe', name: 'Autonoe', description: 'Female, Bright, Middle pitch' },
  { id: 'Enceladus', name: 'Enceladus', description: 'Male, Breathy, Lower pitch' },
  { id: 'Iapetus', name: 'Iapetus', description: 'Male, Clear, Lower middle pitch' },
  { id: 'Umbriel', name: 'Umbriel', description: 'Male, Easy-going, Lower middle pitch' },
  { id: 'Algieba', name: 'Algieba', description: 'Male, Smooth, Lower pitch' },
  { id: 'Despina', name: 'Despina', description: 'Female, Smooth, Middle pitch' },
  { id: 'Erinome', name: 'Erinome', description: 'Female, Clear, Middle pitch' },
  { id: 'Algenib', name: 'Algenib', description: 'Male, Gravelly, Lower pitch' },
  { id: 'Rasalgethi', name: 'Rasalgethi', description: 'Male, Informative, Middle pitch' },
  { id: 'Laomedeia', name: 'Laomedeia', description: 'Female, Upbeat, Higher pitch' },
  { id: 'Achernar', name: 'Achernar', description: 'Female, Soft, Higher pitch' },
  { id: 'Alnilam', name: 'Alnilam', description: 'Male, Firm, Lower middle pitch' },
  { id: 'Schedar', name: 'Schedar', description: 'Male, Even, Lower middle pitch' },
  { id: 'Gacrux', name: 'Gacrux', description: 'Female, Mature, Middle pitch' },
  { id: 'Pulcherrima', name: 'Pulcherrima', description: 'Female, Forward, Middle pitch' },
  { id: 'Achird', name: 'Achird', description: 'Male, Friendly, Lower middle pitch' },
  { id: 'Zubenelgenubi', name: 'Zubenelgenubi', description: 'Male, Casual, Lower middle pitch' },
  { id: 'Vindemiatrix', name: 'Vindemiatrix', description: 'Female, Gentle, Middle pitch' },
  { id: 'Sadachbia', name: 'Sadachbia', description: 'Male, Lively, Lower pitch' },
  { id: 'Sadaltager', name: 'Sadaltager', description: 'Male, Knowledgeable, Middle pitch' },
  { id: 'Sulafat', name: 'Sulafat', description: 'Female, Warm, Middle pitch' },
];

/** ElevenLabs multilingual voice options. */
export const ELEVENLABS_VOICE_OPTIONS: VoiceOption[] = [
  { id: 'pFZP5JQG7iQjIQuC4Bku', name: 'Lily', description: 'Female, warm, soft' },
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah', description: 'Female, soft, gentle' },
  { id: 'FGY2WhTYpPnrIDTdsKH5', name: 'Laura', description: 'Female, upbeat, friendly' },
  { id: 'XB0fDUnXU5powFXDhCwa', name: 'Charlotte', description: 'Female, elegant, smooth' },
  { id: 'Xb7hH8MSUJpSbSDYk0k2', name: 'Alice', description: 'Female, confident, clear' },
  { id: 'jBpfuIE2acCO8z3wKNLl', name: 'Gigi', description: 'Female, childlike, cute' },
  { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel', description: 'Female, calm, narrative' },
  { id: 'TX3LPaxmHKxFdv7VOQHJ', name: 'Liam', description: 'Male, articulate, clear' },
  { id: 'JBFqnCBsd6RMkjVDRZzb', name: 'George', description: 'Male, warm, deep' },
  { id: 'IKne3meq5aSn9XLyUdCD', name: 'Charlie', description: 'Male, casual, natural' },
  { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam', description: 'Male, deep, narrative' },
  { id: 'N2lVS1w4EtoT3dr4eOWO', name: 'Callum', description: 'Male, intense, deep' },
  { id: 'CYw3kZ02Hs0563khs1Fj', name: 'Dave', description: 'Male, conversational, friendly' },
  { id: 'cjVigY5qzO86Huf0OWal', name: 'Eric', description: 'Male, friendly, middle-aged' },
  { id: 'bIHbv24MWmeRgasZH58o', name: 'Will', description: 'Male, friendly, young' },
  { id: 'onwK4e9ZLuTAKqWW03F9', name: 'Daniel', description: 'Male, deep, authoritative' },
];

/** Get voice options for a given provider. */
export function getVoiceOptions(provider: TtsProvider): VoiceOption[] {
  return provider === 'elevenlabs' ? ELEVENLABS_VOICE_OPTIONS : GEMINI_VOICE_OPTIONS;
}

/** Get default voice for a given provider. */
export function getDefaultVoice(provider: TtsProvider): string {
  return provider === 'elevenlabs' ? DEFAULT_ELEVENLABS_VOICE : DEFAULT_GEMINI_VOICE;
}

/** Kept for backwards compat — union of both. */
export const VOICE_OPTIONS = GEMINI_VOICE_OPTIONS;

export interface StoredPrompts {
  agentPrompt: string;
  sessionPrompt: string;
  voice: string;
  ttsProvider?: TtsProvider;
}
