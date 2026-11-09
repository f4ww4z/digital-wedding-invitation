import type { InvitationContent } from './content.js';

/**
 * Demo content seeded on first boot. Everything here is editable from /admin.
 * Names, dates and places are fictional.
 */
export const defaultContent: InvitationContent = {
  meta: {
    title: 'The Wedding of Alya & Rayhan',
    description: 'Dengan penuh syukur, kami mengundang Anda di hari bahagia kami.',
    ogImage: '/demo/og.jpg',
  },
  theme: {
    preset: 'garden',
    primary: '#c7848f',
    accent: '#7a9883',
    background: '#f3f5ef',
    surface: '#ffffff',
    text: '#3d3345',
    muted: '#8d8395',
  },
  defaultLocale: 'id',
  cover: {
    eyebrow: { id: 'Undangan Pernikahan', en: 'Wedding Invitation' },
    guestPrefix: { id: 'Kepada Yth. Bapak/Ibu/Saudara/i', en: 'Dear' },
    defaultGuest: { id: 'Tamu Undangan', en: 'Honored Guest' },
    openButton: { id: 'Buka Undangan', en: 'Open Invitation' },
  },
  music: { enabled: true, src: '/demo/music.mp3', title: 'Garden Waltz (demo)' },
  couple: {
    order: 'bride-first',
    bride: {
      nickname: 'Alya',
      fullName: 'Alya Kirana Putri, S.Ds.',
      photo: '/demo/bride.svg',
      childOrder: { id: 'Putri kedua dari', en: 'Second daughter of' },
      parents: { id: 'Bapak Hendra Wijaya & Ibu Sari Lestari', en: 'Mr. Hendra Wijaya & Mrs. Sari Lestari' },
      instagram: 'alya.kirana',
    },
    groom: {
      nickname: 'Rayhan',
      fullName: 'Rayhan Aditya Pratama, S.T.',
      photo: '/demo/groom.svg',
      childOrder: { id: 'Putra pertama dari', en: 'First son of' },
      parents: { id: 'Bapak Budi Santoso & Ibu Ratna Dewi', en: 'Mr. Budi Santoso & Mrs. Ratna Dewi' },
      instagram: 'rayhan.aditya',
    },
  },
  opening: {
    greeting: {
      id: "Assalamu'alaikum Warahmatullahi Wabarakatuh",
      en: "Assalamu'alaikum Warahmatullahi Wabarakatuh",
    },
    intro: {
      id: 'Maha Suci Allah yang telah menciptakan makhluk-Nya berpasang-pasangan. Dengan memohon rahmat dan ridho-Nya, kami bermaksud menyelenggarakan pernikahan kami:',
      en: 'Glory be to Allah who created all things in pairs. Seeking His grace and blessing, we joyfully invite you to celebrate our wedding:',
    },
    verseEnabled: true,
    verseArabic:
      'وَمِنْ آيَاتِهِ أَنْ خَلَقَ لَكُمْ مِنْ أَنْفُسِكُمْ أَزْوَاجًا لِتَسْكُنُوا إِلَيْهَا وَجَعَلَ بَيْنَكُمْ مَوَدَّةً وَرَحْمَةً',
    verseText: {
      id: '“Dan di antara tanda-tanda kebesaran-Nya ialah Dia menciptakan pasangan-pasangan untukmu dari jenismu sendiri, agar kamu cenderung dan merasa tenteram kepadanya, dan Dia menjadikan di antaramu rasa kasih dan sayang.”',
      en: '“And among His signs is that He created for you spouses from among yourselves so that you may find tranquility in them, and He placed between you affection and mercy.”',
    },
    verseSource: 'QS. Ar-Rum: 21',
  },
  events: [
    {
      id: 'akad',
      name: { id: 'Akad Nikah', en: 'Marriage Ceremony' },
      date: '2027-05-22',
      startTime: '08:00',
      endTime: '10:00',
      timezoneLabel: 'WIB',
      utcOffsetMinutes: 420,
      venue: 'Masjid Raya Baiturrahman',
      address: 'Jl. Pandanaran No.126, Semarang, Jawa Tengah',
      mapsUrl: 'https://maps.google.com/?q=Masjid+Raya+Baiturrahman+Semarang',
      mapsEmbedQuery: 'Masjid Raya Baiturrahman Semarang',
    },
    {
      id: 'resepsi',
      name: { id: 'Resepsi', en: 'Reception' },
      date: '2027-05-22',
      startTime: '11:00',
      endTime: '14:00',
      timezoneLabel: 'WIB',
      utcOffsetMinutes: 420,
      venue: 'Gedung Garden Hall',
      address: 'Jl. Pemuda No.1, Semarang, Jawa Tengah',
      mapsUrl: 'https://maps.google.com/?q=Simpang+Lima+Semarang',
      mapsEmbedQuery: 'Simpang Lima Semarang',
    },
  ],
  countdown: { enabled: true },
  story: {
    enabled: true,
    items: [
      {
        title: { id: 'Awal Bertemu', en: 'First Meeting' },
        date: { id: 'Maret 2022', en: 'March 2022' },
        text: {
          id: 'Kami pertama kali bertemu di sebuah pameran seni. Obrolan singkat tentang lukisan bunga menjadi awal dari segalanya.',
          en: 'We first met at an art exhibition. A short chat about a flower painting turned out to be the beginning of everything.',
        },
        image: '',
      },
      {
        title: { id: 'Lamaran', en: 'The Proposal' },
        date: { id: 'Desember 2026', en: 'December 2026' },
        text: {
          id: 'Dengan restu kedua keluarga, kami melangkah ke jenjang yang lebih serius dalam acara lamaran yang hangat dan sederhana.',
          en: 'With the blessing of both families, we took the next step in a warm and simple engagement ceremony.',
        },
        image: '',
      },
      {
        title: { id: 'Menuju Akad', en: 'Towards the Vows' },
        date: { id: 'Mei 2027', en: 'May 2027' },
        text: {
          id: 'Dengan penuh syukur, kami siap memulai babak baru kehidupan bersama. Doakan kami, ya!',
          en: 'With gratitude, we are ready to begin a new chapter together. Please keep us in your prayers!',
        },
        image: '',
      },
    ],
  },
  gallery: {
    enabled: true,
    images: [
      { src: '/demo/gallery-1.svg', alt: 'Garden' },
      { src: '/demo/gallery-2.svg', alt: 'Bouquet' },
      { src: '/demo/gallery-3.svg', alt: 'Arch' },
      { src: '/demo/gallery-4.svg', alt: 'Rings' },
    ],
  },
  livestream: {
    enabled: false,
    url: '',
    platform: 'YouTube',
    text: {
      id: 'Bagi yang berhalangan hadir, saksikan momen bahagia kami secara langsung.',
      en: 'If you cannot attend, join our special moment live.',
    },
  },
  etiquette: {
    enabled: true,
    items: [
      { icon: 'clock', text: { id: 'Hadir tepat waktu', en: 'Arrive on time' } },
      { icon: 'dress', text: { id: 'Berpakaian sopan', en: 'Dress modestly' } },
      { icon: 'camera', text: { id: 'Abadikan momen dengan bijak', en: 'Take photos considerately' } },
      { icon: 'pray', text: { id: 'Doakan kedua mempelai', en: 'Pray for the couple' } },
    ],
  },
  gift: {
    enabled: true,
    intro: {
      id: 'Doa restu Anda merupakan karunia yang sangat berarti bagi kami. Namun jika Anda ingin memberikan tanda kasih, dapat melalui:',
      en: 'Your prayers and presence mean the world to us. Should you wish to send a gift, you may do so via:',
    },
    accounts: [
      { type: 'bank', provider: 'BCA', number: '1234567890', holder: 'Alya Kirana Putri', qrImage: '' },
      { type: 'ewallet', provider: 'GoPay', number: '081234567890', holder: 'Rayhan Aditya Pratama', qrImage: '' },
    ],
    addressEnabled: true,
    addressRecipient: 'Alya Kirana Putri',
    address: 'Jl. Melati No. 8, Semarang, Jawa Tengah 50241',
    addressPhone: '081234567890',
    confirmationEnabled: true,
    wishlistEnabled: true,
  },
  rsvp: { enabled: true, deadline: '', maxPaxDefault: 2 },
  wishes: { enabled: true, requireApproval: false },
  closing: {
    text: {
      id: 'Merupakan suatu kehormatan dan kebahagiaan bagi kami apabila Bapak/Ibu/Saudara/i berkenan hadir dan memberikan doa restu.',
      en: 'It would be an honor and a joy for us if you could attend and give your blessings.',
    },
    signature: { id: 'Kami yang berbahagia', en: 'With love' },
    image: '',
  },
  share: {
    whatsappTemplate: {
      id: "Assalamu'alaikum {name},\n\nTanpa mengurangi rasa hormat, kami mengundang Anda untuk hadir di acara pernikahan kami.\n\nInfo lengkap acara:\n{link}\n\nMerupakan kebahagiaan bagi kami apabila Anda berkenan hadir dan memberikan doa restu.\n\nTerima kasih 🌸",
      en: 'Dear {name},\n\nWe would be delighted to invite you to our wedding.\n\nAll the details are here:\n{link}\n\nIt would mean so much to have you with us.\n\nThank you 🌸',
    },
  },
};
