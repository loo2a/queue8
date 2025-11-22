// js/textToSpeech.js

const DEFAULT_AUDIO_PATH = 'audio/';
let isCalling = false; // لمنع تداخل الأصوات

/**
 * وظيفة تشغيل قائمة من الملفات الصوتية بالتتابع.
 * @param {string[]} queue - مصفوفة بأسماء الملفات الصوتية (مثل ['ding.mp3', 'preifex.mp3', ...])
 * @param {number} speed - سرعة التشغيل (1.0 هو الافتراضي)
 * @param {function} onStart - دالة يتم تنفيذها عند بدء النداء (مثل وميض الكارت)
 * @param {function} onEnd - دالة يتم تنفيذها عند انتهاء النداء (مثل إيقاف الوميض)
 */
export function playQueue(queue, speed = 1.0, onStart = () => {}, onEnd = () => {}) {
    if (isCalling) {
        console.warn("النظام مشغول بالنداء حالياً.");
        return;
    }

    isCalling = true;
    onStart();
    let index = 0;
    const audio = new Audio();
    audio.playbackRate = speed;

    audio.addEventListener('ended', playNext);
    audio.addEventListener('error', handleAudioError);

    function playNext() {
        if (index < queue.length) {
            const fileName = queue[index];
            audio.src = DEFAULT_AUDIO_PATH + fileName;
            audio.load();
            audio.play().catch(e => {
                console.error(`خطأ في تشغيل الملف الصوتي ${fileName}:`, e);
                // محاولة تجاوز هذا الملف
                index++;
                playNext();
            });
            index++;
        } else {
            // انتهى النداء
            isCalling = false;
            onEnd();
            audio.removeEventListener('ended', playNext);
            audio.removeEventListener('error', handleAudioError);
        }
    }

    function handleAudioError(e) {
        console.error("خطأ عام في مشغل الصوت:", e);
        // في حالة الخطأ، حاول الانتقال إلى الملف التالي
        index++;
        playNext();
    }
    
    // بدء التشغيل
    playNext();
}

/**
 * وظيفة تحويل رقم إلى تسلسل ملفات صوتية باللغة العربية (آحاد قبل العشرات).
 * @param {number} number - رقم العميل.
 * @returns {string[]} مصفوفة بأسماء الملفات الصوتية.
 */
function numberToAudioFiles(number) {
    if (number === 0) return ['0.mp3'];
    
    let files = [];
    const num = Math.floor(number);

    // 1. المئات (100, 200, ..., 900)
    const hundreds = Math.floor(num / 100) * 100;
    if (hundreds > 0) {
        files.push(`${hundreds}.mp3`);
    }

    // 2. الباقي (العشرات والآحاد)
    let remainder = num % 100;

    if (remainder > 0) {
        if (hundreds > 0) {
            files.push('and.mp3'); // و
        }
        
        // الأرقام من 1 إلى 19 (تنطق كوحدة واحدة)
        if (remainder > 0 && remainder <= 19) {
            files.push(`${remainder}.mp3`);
        } else if (remainder >= 20) {
            const units = remainder % 10;
            const tens = Math.floor(remainder / 10) * 10;

            // الآحاد أولاً (مثلاً: خمسة)
            if (units > 0) {
                files.push(`${units}.mp3`);
                files.push('and.mp3'); // و
            }
            
            // العشرات ثانياً (مثلاً: ثمانون)
            files.push(`${tens}.mp3`);
        }
    }

    return files;
}

/**
 * وظيفة النداء الأساسية التي تستخدم ملفات الصوت أو TTS كاحتياطي.
 * @param {number} clinicId - رقم العيادة.
 * @param {number} patientNumber - رقم العميل.
 * @param {string} clinicName - اسم العيادة للنطق الاحتياطي.
 * @param {number} speed - سرعة النطق.
 * @param {function} onStart - كولباك عند البدء.
 * @param {function} onEnd - كولباك عند الانتهاء.
 */
export function callPatient(clinicId, patientNumber, clinicName, speed = 1.0, onStart, onEnd) {
    const numberFiles = numberToAudioFiles(patientNumber);
    const clinicFile = `clinic${clinicId}.mp3`;
    
    const callQueue = [
        'ding.mp3', 
        'preifex.mp3', // على العميل رقم
        ...numberFiles,
        clinicFile
    ];

    // نداء النص الكامل لاستخدامه في TTS إذا فشل الصوت
    const fallbackText = `على العميل رقم ${patientNumber} التوجه إلى عيادة ${clinicName}.`;

    const handleCallEnd = () => {
        // إيقاف الوميض وإخفاء الـ Banner
        onEnd();
    }
    
    // محاولة التشغيل بملفات الصوت
    try {
        playQueue(callQueue, speed, onStart, handleCallEnd);
    } catch (e) {
        console.error("فشل في التشغيل بالملفات الصوتية، الانتقال إلى TTS.", e);
        // الانتقال إلى TTS كاحتياطي
        textToSpeech(fallbackText, speed, onStart, handleCallEnd);
    }
}

/**
 * وظيفة نطق نص معين باستخدام Web Speech API (TTS).
 * @param {string} text - النص المراد نُطقه.
 * @param {number} speed - سرعة النطق.
 * @param {function} onStart - كولباك عند البدء.
 * @param {function} onEnd - كولباك عند الانتهاء.
 */
export function textToSpeech(text, speed = 1.0, onStart, onEnd) {
    if ('speechSynthesis' in window) {
        if (isCalling) {
            console.warn("النظام مشغول بالنداء حالياً (TTS).");
            return;
        }

        isCalling = true;
        onStart();
        
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'ar-SA'; // اللغة العربية السعودية
        utterance.rate = speed;
        
        utterance.onend = () => {
            isCalling = false;
            onEnd();
        };

        utterance.onerror = (e) => {
            console.error('خطأ في TTS:', e);
            isCalling = false;
            onEnd();
        };

        speechSynthesis.speak(utterance);
    } else {
        alert("متصفحك لا يدعم TTS. يرجى استخدام متصفح حديث.");
        onEnd();
    }
}

/**
 * نداء ملف صوتي جاهز من مسار الـ instant.
 * @param {string} fileName - اسم الملف الصوتي.
 * @param {function} onStart - كولباك عند البدء.
 * @param {function} onEnd - كولباك عند الانتهاء.
 */
export function playInstantAudio(fileName, onStart, onEnd) {
    const instantQueue = ['ding.mp3', `instant/${fileName}`];
    playQueue(instantQueue, 1.0, onStart, onEnd);
}

// دالة لمعرفة حالة النداء
export function isSystemCalling() {
    return isCalling;
}
