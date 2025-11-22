// js/display.js

import { db, ref, onValue } from "./firebaseConfig.js";
import { callPatient, isSystemCalling, playInstantAudio, textToSpeech } from "./textToSpeech.js";

// ... (متغيرات وعناصر HTML) ...
const NOTIFICATION_DURATION = 6000; // 6 ثواني

// ... (باقي الدوال: updateDateTime, updateClinicCard, setupMediaPlayer) ...

// --- وظيفة التعامل مع النداء (Flash/Banner) ---
function handleCallStart(text, type = 'standard', clinicId = null) {
    // 1. عرض الـ Banner
    const now = new Date();
    // عرض الوقت بنمط 24 ساعة ليكون أكثر دقة
    const timeString = now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', hour12: false });
    notificationText.textContent = text;
    notificationTime.textContent = `(الساعة: ${timeString})`;

    notificationBanner.style.top = '0px';
    notificationBanner.classList.remove('bg-red-600', 'bg-blue-600', 'bg-yellow-600'); 

    if (type === 'emergency') {
        notificationBanner.classList.add('bg-red-600');
        notificationBanner.classList.add('blink-animation');
    } else if (type === 'repeat') {
        notificationBanner.classList.add('bg-yellow-600');
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

function handleCallEnd(clinicId = null, duration = 0) {
    // إذا كانت المدة 0 (أي بعد انتهاء الصوت مباشرة)، نستخدم 500ms للانتقال السلس
    const timeout = duration > 0 ? duration : 500; 

    setTimeout(() => {
        notificationBanner.style.top = '-100px';
        notificationBanner.classList.remove('blink-animation');
        // إيقاف وميض كارت العيادة
        if (clinicId) {
            const card = document.getElementById(`clinic-card-${clinicId}`);
            if (card) {
                card.classList.remove('blink-animation', 'bg-yellow-100');
            }
        }
    }, timeout);
}


// --- الاستماع لتغييرات Firebase ---

// ... (onValue settings & clinics) ...


onValue(ref(db, '/callQueue/lastCall'), (snapshot) => {
    const lastCall = snapshot.val();
    if (!lastCall) return;
    
    if (isSystemCalling()) return; 

    const clinicId = lastCall.clinicId;
    const clinic = clinicsData[clinicId];
    
    if (clinic && clinic.currentNumber === lastCall.patientNumber) {
        const callText = `على العميل رقم ${lastCall.patientNumber} التوجه إلى عيادة ${clinic.name}.`;
        
        const onStart = () => handleCallStart(callText, lastCall.callType, clinicId);
        const onEnd = () => handleCallEnd(clinicId, 0); // إخفاء بعد انتهاء الصوت
        
        if (!isMuted) {
            // نداء العميل باستخدام ملفات الصوت + TTS احتياطي
            callPatient(clinicId, lastCall.patientNumber, clinic.name, 1.0, onStart, onEnd);
        } else {
            // إذا كان صامتًا، قم بالعرض المرئي لمدة 6 ثواني
            handleCallStart(callText, lastCall.callType, clinicId);
            setTimeout(() => handleCallEnd(clinicId), NOTIFICATION_DURATION); 
        }
    }
});

onValue(ref(db, '/callQueue/customNotification'), (snapshot) => {
    const notification = snapshot.val();
    if (!notification || !notification.text) return;
    
    if (isSystemCalling()) return; 

    const text = notification.text;
    const duration = notification.duration || NOTIFICATION_DURATION; 
    const type = notification.callType || 'standard';
    
    const onStart = () => handleCallStart(text, type);
    const onEnd = () => handleCallEnd(null, 0); // إخفاء بعد انتهاء الصوت
    
    let hideAfterTimeout = false;
    
    if (!isMuted && (notification.useTTS || notification.instantAudio)) {
        if (notification.useTTS) {
            textToSpeech(text, 1.0, onStart, onEnd);
        } else if (notification.instantAudio) {
            playInstantAudio(notification.instantAudio, onStart, onEnd);
        }
    } else {
        // العرض المرئي فقط، يتم إخفاؤه بالمدة المحددة
        handleCallStart(text, type);
        hideAfterTimeout = true;
    }
    
    if (hideAfterTimeout) {
        setTimeout(() => handleCallEnd(null), duration); 
    }
    
    // حذف الإشعار المخصص
    set(ref(db, '/callQueue/customNotification'), null);
});


// ... (باقي الدوال: التحكم في كتم الصوت) ...
