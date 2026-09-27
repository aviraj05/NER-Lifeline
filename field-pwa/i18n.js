const translations = {
  en: {
    "app_title": "NER GROUND PATROL",
    "app_org": "BRO / PWD Field Incident Unit",
    "net_online": "ONLINE — CONNECTED",
    "net_offline": "OFFLINE — ZERO CONNECTIVITY",
    "lbl_queued": "Queued:",
    "toggle_offline": "Simulate Zero-Connectivity Mode",
    "card_new": "📝 New Incident Report",
    "lbl_hazard": "Hazard Type",
    "haz_landslide": "Landslide<br>Rockfall",
    "haz_flood": "Flash<br>Flood",
    "haz_bridge": "Bridge<br>Failure",
    "haz_other": "Other<br>Incident",
    "lbl_severity": "Severity Impact",
    "sev_block": "🔴 Total Blockade",
    "sev_caution": "🟡 Single-Lane",
    "lbl_gps": "GPS Coordinates",
    "inp_lat": "Latitude",
    "inp_lon": "Longitude",
    "lbl_notes": "Incident Notes",
    "inp_notes": "e.g., Heavy slope failure...",
    "lbl_photo": "Evidence Photo",
    "btn_photo": "📷 Tap to Capture Photo",
    "btn_submit": "⚡ Log Incident Report",
    "card_queue": "📡 Offline Sync Queue",
    "queue_empty": "No pending incidents. All synced. ✅",
    "btn_sync": "🔄 Force Sync Now",
    "card_history": "✅ Recently Synced",
    "history_empty": "No recent syncs.",
    "voice_sos": "SOS alert sent. Stay calm. Move to higher ground. Do not cross moving water.",
    "voice_offline": "You are now offline. Reports will be saved locally.",
    "voice_restored": "Network restored. Syncing your reports now.",
    "voice_uploaded": "Report sent to command center.",
    "voice_queued": "Report saved. It will sync when you're back online."
  },
  hi: {
    "app_title": "एनईआर ग्राउंड पेट्रोल",
    "app_org": "बीआरओ / लोक निर्माण विभाग",
    "net_online": "ऑनलाइन — कनेक्टेड",
    "net_offline": "ऑफ़लाइन — कोई नेटवर्क नहीं",
    "lbl_queued": "कतार में:",
    "toggle_offline": "शून्य-कनेक्टिविटी मोड अनुकरण करें",
    "card_new": "📝 नई घटना रिपोर्ट",
    "lbl_hazard": "खतरे का प्रकार",
    "haz_landslide": "भूस्खलन<br>चट्टान गिरना",
    "haz_flood": "अचानक<br>बाढ़",
    "haz_bridge": "पुल<br>टूटना",
    "haz_other": "अन्य<br>घटना",
    "lbl_severity": "प्रभाव की गंभीरता",
    "sev_block": "🔴 पूर्ण नाकाबंदी",
    "sev_caution": "🟡 सिंगल-लेन",
    "lbl_gps": "जीपीएस निर्देशांक",
    "inp_lat": "अक्षांश",
    "inp_lon": "देशांतर",
    "lbl_notes": "घटना विवरण",
    "inp_notes": "जैसे, भारी ढलान विफलता...",
    "lbl_photo": "प्रमाण फोटो",
    "btn_photo": "📷 फोटो लें",
    "btn_submit": "⚡ रिपोर्ट दर्ज करें",
    "card_queue": "📡 ऑफ़लाइन सिंक कतार",
    "queue_empty": "कोई लंबित घटना नहीं। सभी सिंक हो गए। ✅",
    "btn_sync": "🔄 अभी सिंक करें",
    "card_history": "✅ हाल ही में सिंक किया गया",
    "history_empty": "कोई हालिया सिंक नहीं।",
    "voice_sos": "आपातकालीन संकेत भेजा गया। शांत रहें। ऊंचे स्थान पर जाएं।",
    "voice_offline": "नेटवर्क नहीं है। रिपोर्ट स्थानीय रूप से सहेजी जाएगी।",
    "voice_restored": "नेटवर्क बहाल। रिपोर्ट भेजी जा रही है।",
    "voice_uploaded": "रिपोर्ट भेज दी गई।",
    "voice_queued": "रिपोर्ट सहेजी गई। नेटवर्क मिलने पर भेजी जाएगी।"
  },
  as: {
    "app_title": "এনইআৰ গ্ৰাউণ্ড পেট্ৰ'ল",
    "app_org": "বিআৰঅ' / পিডব্লিউডি",
    "net_online": "অনলাইন — সংযুক্ত",
    "net_offline": "অফলাইন — সংযোগ নাই",
    "lbl_queued": "শাৰীত:",
    "toggle_offline": "অফলাইন মোড",
    "card_new": "📝 নতুন ঘটনা ৰিপৰ্ট",
    "lbl_hazard": "বিপদৰ প্ৰকাৰ",
    "haz_landslide": "ভূমিস্খলন",
    "haz_flood": "বানপানী",
    "haz_bridge": "দলং ভঙা",
    "haz_other": "অন্যান্য<br>ঘটনা",
    "lbl_severity": "গুৰুতৰতা",
    "sev_block": "🔴 সম্পূৰ্ণ আৱদ্ধ",
    "sev_caution": "🟡 এটা লেন",
    "lbl_gps": "জিঅ' অৱস্থান",
    "inp_lat": "অক্ষাংশ",
    "inp_lon": "দ্ৰাঘিমাংশ",
    "lbl_notes": "বিৱৰণ",
    "inp_notes": "যেনে, ৰাস্তা বন্ধ...",
    "lbl_photo": "ফটো",
    "btn_photo": "📷 ফটো লওক",
    "btn_submit": "⚡ ৰিপৰ্ট কৰক",
    "card_queue": "📡 অফলাইন শাৰী",
    "queue_empty": "খালি। ✅",
    "btn_sync": "🔄 চিংক কৰক",
    "card_history": "✅ শেহতীয়া",
    "history_empty": "খালি।",
    "voice_sos": "SOS sent. Stay calm. Move to higher ground.",
    "voice_offline": "Network lost. Reports will be saved locally.",
    "voice_restored": "Network restored. Syncing now.",
    "voice_uploaded": "Report sent.",
    "voice_queued": "Report saved locally."
  },
  bn: {
    "app_title": "এনইআর গ্রাউন্ড প্যাট্রোল",
    "app_org": "বিআরও / পূর্ত বিভাগ",
    "net_online": "অনলাইন — সংযুক্ত",
    "net_offline": "অফলাইন — সংযোগ নেই",
    "lbl_queued": "সারিতে:",
    "toggle_offline": "অফলাইন মোড",
    "card_new": "📝 নতুন রিপোর্ট",
    "lbl_hazard": "বিপদের ধরন",
    "haz_landslide": "ভূমিধস",
    "haz_flood": "বন্যা",
    "haz_bridge": "সেতু ভাঙা",
    "haz_other": "অন্যান্য<br>ঘটনা",
    "lbl_severity": "তীব্রতা",
    "sev_block": "🔴 রাস্তা বন্ধ",
    "sev_caution": "🟡 এক লেন",
    "lbl_gps": "অবস্থান",
    "inp_lat": "অক্ষাংশ",
    "inp_lon": "দ্রাঘিমাংশ",
    "lbl_notes": "বিবরণ",
    "inp_notes": "যেমন, রাস্তা ধসে গেছে...",
    "lbl_photo": "ছবি",
    "btn_photo": "📷 ছবি তুলুন",
    "btn_submit": "⚡ রিপোর্ট জমা দিন",
    "card_queue": "📡 অফলাইন সারি",
    "queue_empty": "খালি। ✅",
    "btn_sync": "🔄 সিঙ্ক করুন",
    "card_history": "✅ সাম্প্রতিক",
    "history_empty": "খালি।",
    "voice_sos": "জরুরি সংকেত পাঠানো হয়েছে। শান্ত থাকুন। উঁচু জায়গায় যান।",
    "voice_offline": "নেটওয়ার্ক নেই। রিপোর্ট স্থানীয়ভাবে সংরক্ষিত হবে।",
    "voice_restored": "নেটওয়ার্ক পুনরুদ্ধার হয়েছে। রিপোর্ট পাঠানো হচ্ছে।",
    "voice_uploaded": "রিপোর্ট পাঠানো হয়েছে।",
    "voice_queued": "রিপোর্ট সংরক্ষিত হয়েছে।"
  }
};

window.setLanguage = function(lang) {
  const dict = translations[lang] || translations['en'];
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (dict[key]) {
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        el.placeholder = dict[key];
      } else {
        el.innerHTML = dict[key];
      }
    }
  });
  localStorage.setItem('ner_pwa_lang', lang);
};

window.getVoiceTranslation = function(key) {
  const lang = localStorage.getItem('ner_pwa_lang') || 'en';
  const dict = translations[lang] || translations['en'];
  return dict[key] || translations['en'][key] || key;
};

// Check stored pref
document.addEventListener('DOMContentLoaded', () => {
  const pref = localStorage.getItem('ner_pwa_lang') || 'en';
  document.getElementById('lang-select').value = pref;
  setLanguage(pref);
});
