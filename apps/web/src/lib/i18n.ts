import i18n from 'i18next';
import { initReactI18next, useTranslation } from 'react-i18next';
import { useCallback } from 'react';
import type { LText, Locale } from '@sakinah/shared';

/** UI chrome strings. Invitation content itself is localized in the admin-edited content. */
const resources = {
  id: {
    translation: {
      openingMusic: 'Putar musik',
      pauseMusic: 'Jeda musik',
      language: 'Bahasa',
      switchTo: 'English',
      couple: 'Mempelai',
      and: '&',
      instagram: 'Instagram {{handle}}',
      countdown: 'Menuju hari bahagia',
      days: 'Hari',
      hours: 'Jam',
      minutes: 'Menit',
      seconds: 'Detik',
      saveTheDate: 'Simpan ke kalender',
      googleCalendar: 'Google Calendar',
      downloadIcs: 'Apple / Outlook (.ics)',
      events: 'Rangkaian acara',
      time: 'Pukul {{start}}{{end}} {{tz}}',
      until: ' – {{end}}',
      untilDone: ' – selesai',
      openMaps: 'Buka peta',
      showMap: 'Lihat peta',
      hideMap: 'Tutup peta',
      story: 'Kisah kami',
      gallery: 'Galeri',
      close: 'Tutup',
      prev: 'Sebelumnya',
      next: 'Berikutnya',
      livestream: 'Siaran langsung',
      watchLive: 'Tonton di {{platform}}',
      etiquette: 'Adab walimah',
      gift: 'Tanda kasih',
      copy: 'Salin',
      copied: 'Tersalin',
      copiedToast: 'Nomor disalin',
      addressCopied: 'Alamat disalin',
      showQr: 'Tampilkan QR',
      accountHolder: 'a.n. {{holder}}',
      sendGiftTo: 'Kirim kado ke alamat',
      confirmGift: 'Konfirmasi kirim hadiah',
      swipeHint: 'ketuk segel atau geser ke atas',
      scrollHint: 'Gulir ke bawah',
      digitalEnvelope: 'Amplop digital',
      alreadySent: 'Sudah mengirim?',
      giftOptions: 'Kirim tanda kasih',
      confirmGiftHint: 'Beri tahu kami agar bisa berterima kasih secara langsung.',
      giftMethod: 'Metode',
      method_transfer: 'Transfer bank',
      method_ewallet: 'Dompet digital',
      method_physical: 'Kado fisik',
      method_other: 'Lainnya',
      amountOptional: 'Nominal (opsional)',
      giftTarget: 'Ke rekening / tujuan (opsional)',
      noteOptional: 'Catatan (opsional)',
      sendConfirmation: 'Kirim konfirmasi',
      giftConfirmed: 'Terima kasih! Konfirmasi hadiah terkirim.',
      wishlist: 'Daftar kado',
      wishlistHint: 'Pilih kado agar tidak ada yang sama. Hanya kami yang melihat siapa yang memilih.',
      claim: 'Saya akan memberi ini',
      unclaim: 'Batalkan pilihan',
      claimed: 'Sudah dipilih',
      yourPick: 'Pilihan Anda',
      claimedToast: 'Terima kasih! Kado ditandai.',
      unclaimedToast: 'Pilihan dibatalkan',
      viewItem: 'Lihat',
      claimNamePrompt: 'Nama Anda',
      rsvp: 'Konfirmasi kehadiran',
      rsvpHint: 'Mohon konfirmasi kehadiran Anda.',
      rsvpClosed: 'Konfirmasi kehadiran sudah ditutup.',
      yourName: 'Nama',
      attendance: 'Kehadiran',
      att_yes: 'Hadir',
      att_no: 'Tidak hadir',
      att_maybe: 'Masih ragu',
      pax: 'Jumlah tamu',
      paxCount_one: '{{count}} orang',
      paxCount_other: '{{count}} orang',
      messageOptional: 'Pesan (opsional)',
      sendRsvp: 'Kirim konfirmasi',
      updateRsvp: 'Perbarui konfirmasi',
      rsvpSaved: 'Konfirmasi tersimpan. Terima kasih!',
      rsvpCurrent: 'Konfirmasi Anda: {{status}}',
      wishes: 'Ucapan & doa',
      wishesCount_one: '{{count}} ucapan',
      wishesCount_other: '{{count}} ucapan',
      yourWish: 'Tulis ucapan dan doa',
      sendWish: 'Kirim ucapan',
      wishSent: 'Ucapan terkirim',
      wishPending: 'Ucapan terkirim dan akan tampil setelah disetujui',
      noWishes: 'Belum ada ucapan. Jadilah yang pertama!',
      loadMore: 'Muat lebih banyak',
      thankYou: 'Terima kasih',
      required: 'Wajib diisi',
      somethingWrong: 'Gagal memuat undangan. Periksa koneksi lalu muat ulang.',
      retry: 'Muat ulang',
      madeWith: 'Dibuat dengan Sakinah',
      justNow: 'baru saja',
    },
  },
  en: {
    translation: {
      openingMusic: 'Play music',
      pauseMusic: 'Pause music',
      language: 'Language',
      switchTo: 'Bahasa Indonesia',
      couple: 'The couple',
      and: '&',
      instagram: 'Instagram {{handle}}',
      countdown: 'Counting down to the day',
      days: 'Days',
      hours: 'Hours',
      minutes: 'Minutes',
      seconds: 'Seconds',
      saveTheDate: 'Save to calendar',
      googleCalendar: 'Google Calendar',
      downloadIcs: 'Apple / Outlook (.ics)',
      events: 'The celebration',
      time: '{{start}}{{end}} {{tz}}',
      until: ' – {{end}}',
      untilDone: ' – end',
      openMaps: 'Open in Maps',
      showMap: 'Show map',
      hideMap: 'Hide map',
      story: 'Our story',
      gallery: 'Gallery',
      close: 'Close',
      prev: 'Previous',
      next: 'Next',
      livestream: 'Live stream',
      watchLive: 'Watch on {{platform}}',
      etiquette: 'Guest etiquette',
      gift: 'Wedding gift',
      copy: 'Copy',
      copied: 'Copied',
      copiedToast: 'Number copied',
      addressCopied: 'Address copied',
      showQr: 'Show QR',
      accountHolder: 'Account name: {{holder}}',
      sendGiftTo: 'Send a gift to',
      confirmGift: 'Send or confirm a gift',
      swipeHint: 'tap the seal or swipe up',
      scrollHint: 'Scroll down',
      digitalEnvelope: 'Digital envelope',
      alreadySent: 'Already sent one?',
      giftOptions: 'Send a gift',
      confirmGiftHint: 'So we can thank you personally.',
      giftMethod: 'Method',
      method_transfer: 'Bank transfer',
      method_ewallet: 'E-wallet',
      method_physical: 'Physical gift',
      method_other: 'Other',
      amountOptional: 'Amount (optional)',
      giftTarget: 'Sent to account (optional)',
      noteOptional: 'Note (optional)',
      sendConfirmation: 'Send confirmation',
      giftConfirmed: 'Thank you! Your gift confirmation was sent.',
      wishlist: 'Gift registry',
      wishlistHint: 'Pick a gift so nobody doubles up. Only we can see who picked what.',
      claim: "I'll give this",
      unclaim: 'Undo my pick',
      claimed: 'Already picked',
      yourPick: 'Your pick',
      claimedToast: 'Thank you! Gift marked.',
      unclaimedToast: 'Pick removed',
      viewItem: 'View',
      claimNamePrompt: 'Your name',
      rsvp: 'RSVP',
      rsvpHint: 'Please let us know if you can make it.',
      rsvpClosed: 'RSVP is now closed.',
      yourName: 'Name',
      attendance: 'Attendance',
      att_yes: 'Attending',
      att_no: 'Not attending',
      att_maybe: 'Not sure yet',
      pax: 'Number of guests',
      paxCount_one: '{{count}} person',
      paxCount_other: '{{count}} people',
      messageOptional: 'Message (optional)',
      sendRsvp: 'Send RSVP',
      updateRsvp: 'Update RSVP',
      rsvpSaved: 'RSVP saved. Thank you!',
      rsvpCurrent: 'Your RSVP: {{status}}',
      wishes: 'Wishes & prayers',
      wishesCount_one: '{{count}} wish',
      wishesCount_other: '{{count}} wishes',
      yourWish: 'Write your wishes and prayers',
      sendWish: 'Send wish',
      wishSent: 'Wish sent',
      wishPending: 'Wish sent. It will appear once approved.',
      noWishes: 'No wishes yet. Be the first!',
      loadMore: 'Load more',
      thankYou: 'Thank you',
      required: 'Required',
      somethingWrong: "Couldn't load the invitation. Check your connection and reload.",
      retry: 'Reload',
      madeWith: 'Made with Sakinah',
      justNow: 'just now',
    },
  },
} as const;

const LS_KEY = 'sakinah.lang';

export function initI18n(fallback: Locale = 'id') {
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(LS_KEY);
  } catch {
    /* ignore */
  }
  const lng = stored === 'id' || stored === 'en' ? stored : fallback;
  if (!i18n.isInitialized) {
    void i18n.use(initReactI18next).init({
      resources,
      lng,
      fallbackLng: 'id',
      interpolation: { escapeValue: false },
    });
  }
  document.documentElement.lang = lng;
  return i18n;
}

export function setLocale(l: Locale) {
  void i18n.changeLanguage(l);
  document.documentElement.lang = l;
  try {
    localStorage.setItem(LS_KEY, l);
  } catch {
    /* ignore */
  }
}

export function hasStoredLocale(): boolean {
  try {
    return !!localStorage.getItem(LS_KEY);
  } catch {
    return false;
  }
}

/** Pick the current-locale value of a localized content string. */
export function useL() {
  const { i18n: inst } = useTranslation();
  const lang = (inst.language === 'en' ? 'en' : 'id') as Locale;
  const l = useCallback((t: LText | undefined) => (t ? t[lang] || t.id || t.en : ''), [lang]);
  return { l, lang };
}
