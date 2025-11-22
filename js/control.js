// js/control.js

import { db, ref, set, onValue } from "./firebaseConfig.js";
import { callPatient, textToSpeech, isSystemCalling } from "./textToSpeech.js";

// ... (متغيرات العناصر) ...

let isControlMuted = false;

// --- دالة إنشاء إشعار لحظي (Toast Notification) - تحل محل alert() ---
function createToast(message, duration = 3000) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;

    // لضمان وجود الحاوية في الصفحة
    if (!container) {
         console.warn("Toast container not found.");
         return;
    }

    container.appendChild(toast);
    
    // إظهار الإشعار
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);

    // إخفاء وحذف الإشعار تلقائيًا
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            if (container.contains(toast)) {
                container.removeChild(toast);
            }
        }, 300); // يتطابق مع مدة الانتقال CSS
    }, duration);
}


// --- تحميل بيانات العيادات ---
// ... (onValue clinics) ...


// --- تسجيل الدخول ---
loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const clinicId = clinicSelect.value;
    const password = clinicPassword.value;

    if (clinicsPasswords[clinicId] === password) {
        currentClinicId = clinicId;
        loginScreen.classList.add('hidden');
        controlPanel.classList.remove('hidden');
        
        createToast(`تم تسجيل الدخول بنجاح لعيادة ${currentClinicData[currentClinicId].name}`, 3000);
        
        onValue(ref(db, `/clinics/${currentClinicId}`), (snapshot) => {
            const data = snapshot.val();
            if (data) {
                updateControlPanelData(data);
            }
        });
    } else {
        createToast("كلمة السر أو اختيار العيادة غير صحيح.", 4000);
    }
});

// ... (دالة updateControlPanelData) ...

// --- وظيفة النداء المشتركة (تشمل النطق المحلي) ---
function triggerCall(patientNumber, callType = 'standard', customText = null) {
    if (!currentClinicId) return;
    
    const clinicName = currentClinicData[currentClinicId].name;
    const callData = {
        clinicId: parseInt(currentClinicId),
        patientNumber: patientNumber,
        timestamp: new Date().toISOString(),
        callType: callType,
        customText: customText 
    };
    
    if (callType === 'standard') {
        set(ref(db, `/clinics/${currentClinicId}/currentNumber`), patientNumber);
        set(ref(db, `/clinics/${currentClinicId}/lastCalledNumber`), patientNumber);
    }
    
    set(ref(db, '/callQueue/lastCall'), callData);
    
    // نداء صوتي محلي للتنبيه
    if (!isControlMuted) {
        const onStart = () => createToast(`جارٍ نداء رقم ${patientNumber} لعيادة ${clinicName} على الشاشة الرئيسية...`, 5000);
        // نطق محلي أسرع (1.5) للتأكيد
        callPatient(parseInt(currentClinicId), patientNumber, clinicName, 1.5, onStart, () => {});
    } else {
        createToast(`تم إرسال نداء رقم ${patientNumber} لعيادة ${clinicName} (صامت محلياً).`, 3000);
    }
}

// --- التعامل مع أزرار التحكم (تم استبدال alert بـ createToast) ---

// العميل التالي
document.getElementById('next-client').addEventListener('click', () => {
    if (currentClinicData[currentClinicId].status === 'paused') {
        createToast('العيادة متوقفة حالياً. يرجى استئنافها أولاً.', 4000);
        return;
    }
    const nextNumber = (currentClinicData[currentClinicId].currentNumber || 0) + 1;
    triggerCall(nextNumber);
});

// تكرار النداء
document.getElementById('repeat-call').addEventListener('click', () => {
    const currentNumber = currentClinicData[currentClinicId].currentNumber;
    if (currentNumber) {
        triggerCall(currentNumber, 'repeat');
    } else {
        createToast('لا يوجد رقم حالي لتكرار نداءه.', 4000);
    }
});

// العميل السابق
document.getElementById('prev-client').addEventListener('click', () => {
    const prevNumber = Math.max(0, (currentClinicData[currentClinicId].currentNumber || 0) - 1);
    set(ref(db, `/clinics/${currentClinicId}/currentNumber`), prevNumber)
        .then(() => {
            createToast(`تم تعديل الرقم الحالي يدوياً إلى ${prevNumber}`, 3000);
        });
});

// تصفير العيادة
document.getElementById('reset-clinic').addEventListener('click', () => {
    if (window.confirm("هل أنت متأكد من تصفير عداد هذه العيادة؟")) {
        set(ref(db, `/clinics/${currentClinicId}/currentNumber`), 0);
        set(ref(db, `/clinics/${currentClinicId}/lastCalledNumber`), 0);
        set(ref(db, `/clinics/${currentClinicId}/queueStart`), 0) 
            .then(() => {
                createToast('تم تصفير العيادة بنجاح.', 3000);
            });
    }
});

// نداء عميل معين
document.getElementById('btn-call-specific').addEventListener('click', () => {
    const specificNumber = parseInt(document.getElementById('call-specific-number').value);
    if (specificNumber > 0) {
        triggerCall(specificNumber, 'standard');
    } else {
        createToast('يرجى إدخال رقم صحيح للنداء.', 4000);
    }
});

// عرض اسم معين (TTS)
document.getElementById('btn-display-custom').addEventListener('click', () => {
    const customText = document.getElementById('display-custom-name').value;
    if (customText) {
        set(ref(db, '/callQueue/customNotification'), {
            text: customText,
            duration: 6000, 
            useTTS: true 
        });
        if (!isControlMuted) {
            textToSpeech(customText, 1.5, () => createToast('جارٍ نطق الرسالة على الشاشة الرئيسية...'), () => {});
        } else {
            createToast('تم إرسال رسالة نصية/صوتية مخصصة (صامت محلياً).', 3000);
        }
    }
});

// نداء الطوارئ
document.getElementById('btn-emergency-call').addEventListener('click', () => {
    const emergencyText = document.getElementById('emergency-text').value + currentClinicData[currentClinicId].name;
    set(ref(db, '/callQueue/customNotification'), {
        text: emergencyText,
        duration: 10000,
        callType: 'emergency', 
        useTTS: true
    });
    if (!isControlMuted) {
        textToSpeech(emergencyText, 1.5, () => createToast('نداء طوارئ جاري الإذاعة على الشاشة الرئيسية!', 5000), () => {});
    } else {
        createToast('تم إرسال نداء الطوارئ (صامت محلياً).', 4000);
    }
});

// إيقاف/استئناف العيادة
toggleStatusBtn.addEventListener('click', () => {
    const newStatus = currentClinicData[currentClinicId].status === 'paused' ? 'active' : 'paused';
    set(ref(db, `/clinics/${currentClinicId}/status`), newStatus)
        .then(() => {
            if (newStatus === 'paused') {
                createToast('تم إيقاف العيادة مؤقتاً.', 3000);
            } else {
                createToast('تم استئناف العيادة.', 3000);
            }
        });
});

// الخروج
document.getElementById('logout-btn').addEventListener('click', () => {
    currentClinicId = null;
    clinicPassword.value = '';
    controlPanel.classList.add('hidden');
    loginScreen.classList.remove('hidden');
    createToast('تم تسجيل الخروج بنجاح.', 3000);
    setTimeout(() => {
        window.location.reload(); 
    }, 500);
});

// كتم الصوت في صفحة التحكم
document.getElementById('control-mute-toggle').addEventListener('click', () => {
    isControlMuted = !isControlMuted;
    const icon = document.getElementById('control-mute-toggle');
    if (isControlMuted) {
        icon.classList.replace('bg-blue-500', 'bg-gray-500');
        icon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l.66-1.32a1 1 0 011.75-.436l3.586 7.172a1 1 0 01-.174 1.348l-.758.758M17.5 13H21a1 1 0 011 1v4a1 1 0 01-1 1h-3.5L15 17.5M19 13v6M17.5 13H21a1 1 0 011 1v4a1 1 0 01-1 1h-3.5L15 17.5M19 13v6" /></svg>`;
        createToast('تم كتم الصوت في لوحة التحكم.', 2000);
    } else {
        icon.classList.replace('bg-gray-500', 'bg-blue-500');
        icon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15.536 8.464a5 5 0 110 7.072L10.96 11H7a1 1 0 01-1-1V9a1 1 0 011-1h3.96l4.576-2.536z" /></svg>`;
        createToast('تم استئناف الصوت في لوحة التحكم.', 2000);
        textToSpeech('تم إلغاء كتم الصوت.', 1.5, () => {}, () => {});
    }
});
