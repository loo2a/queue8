// ==========================================================
// 1. Firebase Configuration (استبدل هذا بمعلوماتك)
// ==========================================================
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyA3SLxFOgHihiZ-PPt-_BWWRYa3wMNDPXs",
  authDomain: "queue8-e4ba6.firebaseapp.com",
  databaseURL: "https://queue8-e4ba6-default-rtdb.firebaseio.com",
  projectId: "queue8-e4ba6",
  storageBucket: "queue8-e4ba6.firebasestorage.app",
  messagingSenderId: "957739657206",
  appId: "1:957739657206:web:33d52aea84d9f6b920c9d7",
  measurementId: "G-6W02DB5GNC"
};
// ==========================================================

// تهيئة Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// متغيرات عامة للصوت
let audioQueue = [];
let isPlaying = false;
let audioSpeed = 1.0; // سيتم تحديثها من الإعدادات

// ==========================================================
// 2. وظيفة نطق الأرقام وتحويلها إلى قائمة ملفات صوتية
// ==========================================================

const units = ['', 'واحد', 'اثنين', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة', 'عشرة', 'أحد_عشر', 'اثنا_عشر', 'ثلاثة_عشر', 'أربعة_عشر', 'خمسة_عشر', 'ستة_عشر', 'سبعة_عشر', 'ثمانية_عشر', 'تسعة_عشر'];
const tens = ['', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
const hundreds = ['', 'مائة', 'مائتان', 'ثلاثمائة', 'أربعمائة', 'خمسمائة', 'ستمائة', 'سبعمائة', 'ثمانمائة', 'تسعمائة'];

/**
 * يحول رقماً إلى تسلسل ملفات صوتية (MP3) للنداء الصحيح
 * @param {number} num - الرقم المراد نطقه
 * @param {string} audioPath - مسار الملفات الصوتية (مثلاً: /audio/)
 * @returns {Array<string>} قائمة بمسارات ملفات الصوت بالترتيب
 */
function numberToAudioSequence(num, audioPath) {
    if (num === 0) return [`${audioPath}0.mp3`];
    const sequence = [];
    let remainingNum = num;

    // المئات
    const h = Math.floor(remainingNum / 100);
    if (h > 0) {
        sequence.push(`${audioPath}${h}00.mp3`); // 400.mp3, 100.mp3
        remainingNum %= 100;
        if (remainingNum > 0) sequence.push(`${audioPath}and.mp3`); // و
    }

    // الآحاد والعشرات
    if (remainingNum > 0) {
        if (remainingNum < 20) {
            // الأعداد من 1 إلى 19
            sequence.push(`${audioPath}${remainingNum}.mp3`);
        } else {
            // الأعداد من 20 فما فوق
            const t = Math.floor(remainingNum / 10);
            const u = remainingNum % 10;
            
            // الآحاد أولاً (مثلاً: خمسة)
            if (u > 0) {
                sequence.push(`${audioPath}${u}.mp3`);
                sequence.push(`${audioPath}and.mp3`); // و
            }
            
            // العشرات (مثلاً: ثمانون)
            sequence.push(`${audioPath}${t}0.mp3`);
        }
    }

    // لإضافة 'على العميل رقم' (prefix.mp3) قبل الرقم
    sequence.unshift(`${audioPath}preifex.mp3`);
    sequence.unshift(`${audioPath}ding.mp3`);

    return sequence;
}

// ==========================================================
// 3. محرك تشغيل الصوت (Queue Engine)
// ==========================================================

/**
 * تشغيل ملف صوتي معين أو استخدام TTS كبديل
 * @param {string} src - مسار ملف الصوت
 * @param {string} ttsText - النص البديل لـ TTS إذا فشل تحميل الملف
 * @returns {Promise<void>}
 */
function playAudio(src, ttsText) {
    return new Promise(resolve => {
        const audio = new Audio(src);
        audio.playbackRate = audioSpeed;

        const useTTS = (text) => {
            console.warn(`Audio playback failed for: ${src}. Falling back to TTS.`);
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'ar-SA';
            utterance.rate = audioSpeed;
            
            utterance.onend = () => {
                resolve();
            };
            utterance.onerror = (e) => {
                console.error('TTS Error:', e);
                resolve(); // حل الوعد حتى لو فشل TTS للانتقال إلى التالي
            };
            window.speechSynthesis.speak(utterance);
        };

        audio.oncanplaythrough = () => {
            audio.play().catch(e => {
                console.error("Audio Play Error (user interaction needed?):", e);
                useTTS(ttsText);
            });
        };

        audio.onerror = () => {
            // فشل التحميل، نستخدم TTS
            useTTS(ttsText);
        };

        audio.onended = () => {
            resolve();
        };

        // وقت انتهاء احتياطي (لمنع المشاكل في حالة عدم تشغيل الأحداث)
        setTimeout(() => {
            if (audio.paused || audio.ended) resolve();
        }, 5000 * (1 / audioSpeed)); // 5 ثواني كحد أقصى
    });
}

/**
 * معالجة قائمة انتظار ملفات الصوت
 */
async function processQueue() {
    if (isPlaying || audioQueue.length === 0) return;

    isPlaying = true;
    const currentCall = audioQueue.shift();
    const { clinicId, number, type, text, audioPath, clinicName } = currentCall;

    // 1. تفعيل المؤثرات البصرية (Notification Banner والوميض)
    if (window.showCallNotification) {
        let callText = `على العميل رقم ${number} التوجه لعيادة ${clinicName}`;
        if (type === 'emergency') {
            callText = text || 'نداء طوارئ، يرجى الانتباه!';
        } else if (type === 'name') {
             callText = text || 'يرجى الانتباه لنداء خاص';
        }
        window.showCallNotification(callText, type, clinicId);
        window.toggleClinicBlink(clinicId, true);
    }
    
    let audioSequence = [];
    if (type === 'normal') {
        // نطق الرقم
        audioSequence = numberToAudioSequence(number, audioPath);
        audioSequence.push(`${audioPath}clinic${clinicId}.mp3`);
    } else if (type === 'instant') {
        // ملف صوتي جاهز
        audioSequence = [`${audioPath}ding.mp3`, text];
    } else if (type === 'record') {
        // التسجيل الصوتي المباشر (يفترض أن النص هو مسار التسجيل المؤقت)
        audioSequence = [`${audioPath}ding.mp3`, text];
    } else if (type === 'name' || type === 'emergency') {
         // استخدام TTS مباشرة
        const ttsText = type === 'emergency' ? text : `على السيد/ة ${text} التوجه لعيادة ${clinicName}`;
        await playAudio(null, ttsText);
        
    }


    // 2. تشغيل تسلسل الصوت
    for (const src of audioSequence) {
        if (type === 'normal' || type === 'instant' || type === 'record') {
            // النص البديل لـ TTS (معقد، لذا نستخدم فقط اسم الملف)
            await playAudio(src, src.split('/').pop().replace('.mp3', ''));
        }
    }


    // 3. إيقاف المؤثرات البصرية
    if (window.showCallNotification) {
        window.hideCallNotification();
        window.toggleClinicBlink(clinicId, false);
    }

    isPlaying = false;
    processQueue(); // الانتقال إلى النداء التالي إذا وجد
}

/**
 * إضافة نداء جديد لقائمة الانتظار
 * @param {object} callData - بيانات النداء
 */
window.addCallToQueue = (callData) => {
    audioQueue.push(callData);
    processQueue();
};

// ==========================================================
// 4. وظيفة مشتركة (لتحديث سرعة الصوت من الإعدادات)
// ==========================================================
db.ref('settings/speed').on('value', snapshot => {
    audioSpeed = snapshot.val() || 1.0;
});


// وظيفة لإضافة نداء (تستخدم في admin.html و control.html)
window.callNumber = (clinicId, number, type = 'normal', text = null) => {
    db.ref('callsQueue').push({
        timestamp: firebase.database.ServerValue.TIMESTAMP,
        clinicId: clinicId,
        number: number,
        type: type,
        text: text
    });
};
