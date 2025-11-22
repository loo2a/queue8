// js/display.js

import { db, ref, onValue } from "./firebaseConfig.js";
import { callPatient, isSystemCalling, playInstantAudio, textToSpeech } from "./textToSpeech.js";

// متغيرات العناصر
const centerNameEl = document.getElementById('center-name');
const currentTimeEl = document.getElementById('current-time');
const currentDateEl = document.getElementById('current-date');
const scrollTextEl = document.getElementById('scroll-text');
const clinicsContainer = document.getElementById('clinics-container');
const mediaPlayer = document.getElementById('media-player');
const notificationBanner = document.getElementById('notification-banner');
const notificationText = document.getElementById('notification-text');
const notificationTime = document.getElementById('notification-time');
const muteToggle = document.getElementById('mute-toggle');
let isMuted = false;
let clinicsData = {}; // لتخزين بيانات العيادات محلياً

// --- تحديث الوقت والتاريخ ---
function updateDateTime() {
    const now = new Date();
    
    // التوقيت (hh:mm:ss)
    const timeOptions = { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };
    currentTimeEl.textContent = now.toLocaleTimeString('ar-EG', timeOptions);

    // التاريخ (يوم-شهر-سنة)
    const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    currentDateEl.textContent = now.toLocaleDateString('ar-EG', dateOptions);
}
setInterval(updateDateTime, 1000);
updateDateTime(); // تشغيل فوري

// --- وظيفة إنشاء وتحديث كارت العيادة ---
function updateClinicCard(id, data) {
    let card = document.getElementById(`clinic-card-${id}`);
    
    if (!card) {
        // إنشاء الكارت إذا لم يكن موجوداً
        card = document.createElement('div');
        card.id = `clinic-card-${id}`;
        card.className = 'clinic-card bg-white p-4 rounded-lg shadow-xl border-r-4 border-blue-500';
        card.innerHTML = `
            <div class="flex justify-between items-center">
                <h3 class="text-3xl font-extrabold text-blue-800" id="clinic-name-${id}"></h3>
                <div class="text-sm font-semibold text-green-600" id="clinic-status-${id}"></div>
            </div>
            <div class="mt-2 flex justify-between items-end">
                <div>
                    <p class="text-gray-500 text-lg">الرقم الحالي:</p>
                    <p id="clinic-number-${id}" class="text-6xl font-black text-blue-900"></p>
                    <p class="text-sm text-gray-400" id="clinic-waiting-${id}"></p>
                </div>
                <div class="text-center">
                    <canvas id="clinic-qr-canvas-${id}" class="w-16 h-16 mx-auto mb-1"></canvas>
                    <p class="text-xs text-gray-400">تقييم وخدمات</p>
                </div>
            </div>
        `;
        clinicsContainer.appendChild(card);
        // إنشاء QR Code (مثال: رابط لصفحة التقييم/الخدمات)
        QRCode.toCanvas(document.getElementById(`clinic-qr-canvas-${id}`), 
            `https://yourcenter.com/rate?clinic=${id}`, 
            { errorCorrectionLevel: 'H', width: 64 });
    }

    // تحديث البيانات
    document.getElementById(`clinic-name-${id}`).textContent = data.name;
    document.getElementById(`clinic-number-${id}`).textContent = data.currentNumber || '---';

    const statusEl = document.getElementById(`clinic-status-${id}`);
    const waitingEl = document.getElementById(`clinic-waiting-${id}`);

    if (data.status === 'paused') {
        card.classList.add('opacity-50', 'grayscale');
        card.classList.remove('border-blue-500');
        statusEl.textContent = 'متوقفة حالياً';
        statusEl.classList.remove('text-green-600');
        statusEl.classList.add('text-red-600');
    } else {
        card.classList.remove('opacity-50', 'grayscale');
        card.classList.add('border-blue-500');
        statusEl.textContent = 'نشط';
        statusEl.classList.remove('text-red-600');
        statusEl.classList.add('text-green-600');
    }

    // اقتراح إضافي: عرض الأرقام المنتظرة
    const waitingCount = (data.queueStart || 0) > data.currentNumber 
                        ? 0 
                        : (data.queueStart || 0) === 0 // افتراضياً اذا كان 0 يعني لم يتم طباعة تذاكر
                        ? 0
                        : (data.queueStart || 0) > 0 && data.currentNumber > (data.queueStart || 0) // إذا كان هناك رقم بداية
                        ? data.currentNumber - data.queueStart
                        : data.currentNumber;
    waitingEl.textContent = waitingCount > 0 ? `المنتظرون: ${waitingCount}` : 'لا يوجد انتظار حالياً';

    // حفظ البيانات محلياً
    clinicsData[id] = data;
}

// --- وظيفة تشغيل الميديا بالتسلسل ---
let mediaFiles = [];
let currentMediaIndex = 0;

function setupMediaPlayer(mediaPath) {
    // هذه الدالة تحتاج إلى مساعدة خارجية للحصول على قائمة ملفات الميديا،
    // حيث لا يمكن لـ JS في المتصفح قراءة محتويات المجلد مباشرة.
    // كحل مؤقت، سنفترض وجود ملفات video1.mp4, video2.mp4...
    // وفي النظام الاحترافي، يجب استخدام ملف JSON يتم تحديثه على الخادم.
    
    // افتراض قائمة ملفات فيديو
    mediaFiles = ['video1.mp4', 'video2.mp4', 'video3.mp4'];

    if (mediaFiles.length === 0) {
        document.getElementById('media-placeholder').style.display = 'block';
        return;
    }

    const playNextMedia = () => {
        if (mediaFiles.length === 0) return;
        currentMediaIndex = (currentMediaIndex + 1) % mediaFiles.length;
        mediaPlayer.src = mediaPath + mediaFiles[currentMediaIndex];
        mediaPlayer.load();
        mediaPlayer.play().catch(e => console.error("فشل التشغيل التلقائي للميديا:", e));
    };

    mediaPlayer.addEventListener('ended', playNextMedia);
    mediaPlayer.addEventListener('error', playNextMedia);
    
    // تشغيل أول ملف
    mediaPlayer.src = mediaPath + mediaFiles[currentMediaIndex];
    mediaPlayer.load();
    mediaPlayer.play().catch(e => console.error("فشل التشغيل التلقائي للميديا:", e));
}


// --- وظيفة التعامل مع النداء (Flash/Banner) ---
function handleCallStart(text, type = 'standard', clinicId = null) {
    if (isMuted) return;

    // 1. عرض الـ Banner
    const now = new Date();
    const timeString = now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
    notificationText.textContent = text;
    notificationTime.textContent = `(الساعة: ${timeString})`;

    notificationBanner.style.top = '0px';
    notificationBanner.classList.remove('bg-red-600', 'bg-blue-600');

    if (type === 'emergency') {
        notificationBanner.classList.add('bg-red-600');
        notificationBanner.classList.add('blink-animation'); // وميض للبلاغ
    } else {
        notificationBanner.classList.add('bg-blue-600');
    }

    // 2. وميض كارت العيادة
    if (clinicId) {
        const card = document.getElementById(`clinic-card-${clinicId}`);
        if (card) {
            card.classList.add('blink-animation', 'bg-yellow-100');
        }
    }
}

function handleCallEnd(clinicId = null) {
    // 1. إخفاء الـ Banner
    // تأخير بسيط لضمان إخفاء Banner بعد انتهاء الصوت تماماً
    setTimeout(() => {
        notificationBanner.style.top = '-100px';
        notificationBanner.classList.remove('blink-animation');
    }, 500);

    // 2. إيقاف وميض كارت العيادة
    if (clinicId) {
        const card = document.getElementById(`clinic-card-${clinicId}`);
        if (card) {
            card.classList.remove('blink-animation', 'bg-yellow-100');
        }
    }
}


// --- الاستماع لتغييرات Firebase ---
onValue(ref(db, '/settings'), (snapshot) => {
    const settings = snapshot.val();
    if (settings) {
        centerNameEl.textContent = settings.centerName || 'المركز الطبي';
        scrollTextEl.textContent = settings.scrollText || 'مرحباً بكم في المركز الطبي.';
        scrollTextEl.setAttribute('scrollamount', settings.scrollSpeed || 6);
        setupMediaPlayer(settings.mediaPath || 'media/');
    }
});

onValue(ref(db, '/clinics'), (snapshot) => {
    const clinics = snapshot.val();
    if (clinics) {
        Object.entries(clinics).forEach(([id, data]) => {
            updateClinicCard(id, data);
        });
        clinicsData = clinics;
    }
});

onValue(ref(db, '/callQueue/lastCall'), (snapshot) => {
    const lastCall = snapshot.val();
    if (!lastCall) return;
    
    // منع النداء إذا كان النظام يقوم بالنداء بالفعل
    if (isSystemCalling()) return; 

    const clinicId = lastCall.clinicId;
    const clinic = clinicsData[clinicId];
    
    if (clinic && clinic.currentNumber === lastCall.patientNumber) {
        const callText = `على العميل رقم ${lastCall.patientNumber} التوجه إلى عيادة ${clinic.name}.`;
        
        // وظيفة البدء: عرض الـ Banner والوميض
        const onStart = () => handleCallStart(callText, lastCall.callType, clinicId);
        // وظيفة الانتهاء: إخفاء الـ Banner والوميض
        const onEnd = () => handleCallEnd(clinicId);
        
        if (!isMuted) {
            // نداء العميل باستخدام ملفات الصوت + TTS احتياطي
            callPatient(clinicId, lastCall.patientNumber, clinic.name, 1.0, onStart, onEnd);
        } else {
            // إذا كان صامتًا، قم بالعرض المرئي فقط
            handleCallStart(callText, lastCall.callType, clinicId);
            setTimeout(onEnd, 3000); // إظهار لمدة 3 ثواني
        }
    }
});

onValue(ref(db, '/callQueue/customNotification'), (snapshot) => {
    const notification = snapshot.val();
    if (!notification || !notification.text) return;
    
    if (isSystemCalling()) return; 

    const text = notification.text;
    const duration = notification.duration || 5000;
    const type = notification.callType || 'standard';
    
    // وظيفة البدء: عرض الـ Banner
    const onStart = () => handleCallStart(text, type);
    // وظيفة الانتهاء: إخفاء الـ Banner
    const onEnd = () => handleCallEnd();

    if (!isMuted && notification.useTTS) {
        textToSpeech(text, 1.0, onStart, onEnd);
    } else if (!isMuted && notification.instantAudio) {
        playInstantAudio(notification.instantAudio, onStart, onEnd);
    } else {
        // العرض المرئي فقط أو رسالة نصية بسيطة (في حالة النداء باسم)
        handleCallStart(text, type);
        setTimeout(onEnd, duration); 
    }
    
    // حذف الإشعار المخصص لضمان تفعيله مرة أخرى
    set(ref(db, '/callQueue/customNotification'), null);
});


// --- التحكم في كتم الصوت ---
muteToggle.addEventListener('click', () => {
    isMuted = !isMuted;
    if (isMuted) {
        muteToggle.classList.replace('bg-red-500', 'bg-gray-500');
        muteToggle.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l.66-1.32a1 1 0 011.75-.436l3.586 7.172a1 1 0 01-.174 1.348l-.758.758M17.5 13H21a1 1 0 011 1v4a1 1 0 01-1 1h-3.5L15 17.5M19 13v6M17.5 13H21a1 1 0 011 1v4a1 1 0 01-1 1h-3.5L15 17.5M19 13v6" />
            </svg>
        `; // أيقونة كتم الصوت
        mediaPlayer.muted = true;
    } else {
        muteToggle.classList.replace('bg-gray-500', 'bg-red-500');
        muteToggle.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15.536 8.464a5 5 0 110 7.072L10.96 11H7a1 1 0 01-1-1V9a1 1 0 011-1h3.96l4.576-2.536z" />
            </svg>
        `; // أيقونة الصوت
        mediaPlayer.muted = false;
    }
});
