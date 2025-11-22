// js/control.js

import { db, ref, set, onValue } from "./firebaseConfig.js";
import { callPatient, textToSpeech } from "./textToSpeech.js";

const loginScreen = document.getElementById('login-screen');
const controlPanel = document.getElementById('control-panel');
const loginForm = document.getElementById('login-form');
const clinicSelect = document.getElementById('clinic-select');
const clinicPassword = document.getElementById('clinic-password');
const controlClinicNameEl = document.getElementById('control-clinic-name');
const currentPatientNumberEl = document.getElementById('current-patient-number');
const toggleStatusBtn = document.getElementById('toggle-clinic-status');

let currentClinicId = null;
let currentClinicData = {};
let clinicsPasswords = {};
let isControlMuted = false;

// --- تحميل بيانات العيادات ---
onValue(ref(db, '/clinics'), (snapshot) => {
    const clinics = snapshot.val();
    if (clinics) {
        clinicSelect.innerHTML = '<option value="">اختر العيادة...</option>';
        Object.entries(clinics).forEach(([id, data]) => {
            const option = document.createElement('option');
            option.value = id;
            option.textContent = data.name;
            clinicSelect.appendChild(option);
            clinicsPasswords[id] = data.password;
        });
        currentClinicData = clinics; // حفظ البيانات للاستخدام
    }
});

// --- تحديث حالة العيادة الحالية في لوحة التحكم ---
function updateControlPanelData(clinicData) {
    currentClinicData[currentClinicId] = clinicData; // تحديث البيانات المحلية
    controlClinicNameEl.textContent = clinicData.name;
    currentPatientNumberEl.textContent = clinicData.currentNumber;
    
    if (clinicData.status === 'paused') {
        toggleStatusBtn.textContent = 'استئناف العيادة';
        toggleStatusBtn.classList.replace('bg-gray-500', 'bg-green-500');
        toggleStatusBtn.classList.replace('hover:bg-gray-600', 'hover:bg-green-600');
    } else {
        toggleStatusBtn.textContent = 'إيقاف العيادة';
        toggleStatusBtn.classList.replace('bg-green-500', 'bg-gray-500');
        toggleStatusBtn.classList.replace('hover:bg-green-600', 'hover:bg-gray-600');
    }
}

// --- تسجيل الدخول ---
loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const clinicId = clinicSelect.value;
    const password = clinicPassword.value;

    if (clinicsPasswords[clinicId] === password) {
        currentClinicId = clinicId;
        loginScreen.classList.add('hidden');
        controlPanel.classList.remove('hidden');
        
        // البدء في مراقبة بيانات العيادة الحالية
        onValue(ref(db, `/clinics/${currentClinicId}`), (snapshot) => {
            const data = snapshot.val();
            if (data) {
                updateControlPanelData(data);
            }
        });
    } else {
        alert("كلمة السر أو اختيار العيادة غير صحيح.");
    }
});

// --- وظيفة النداء المشتركة ---
function triggerCall(patientNumber, callType = 'standard', customText = null) {
    if (!currentClinicId) return;
    
    const clinicName = currentClinicData[currentClinicId].name;
    const callData = {
        clinicId: parseInt(currentClinicId),
        patientNumber: patientNumber,
        timestamp: new Date().toISOString(),
        callType: callType,
        customText: customText // لحفظ النص إذا كان نداء باسم/طوارئ
    };
    
    // 1. تحديث الرقم الحالي في العيادة (لـ 'العميل التالي' و 'نداء عميل معين')
    if (callType === 'standard') {
        set(ref(db, `/clinics/${currentClinicId}/currentNumber`), patientNumber);
        set(ref(db, `/clinics/${currentClinicId}/lastCalledNumber`), patientNumber);
    }
    
    // 2. تحديث قائمة النداء ليتم عرضها وتشغيل صوتها على شاشة العرض
    set(ref(db, '/callQueue/lastCall'), callData);
    
    // 3. نداء صوتي محلي للتنبيه
    if (!isControlMuted) {
        const onStart = () => alert(`جاري نداء رقم ${patientNumber} لعيادة ${clinicName}...`);
        callPatient(parseInt(currentClinicId), patientNumber, clinicName, 1.0, onStart, () => {});
    }
}

// --- التعامل مع أزرار التحكم ---

// العميل التالي
document.getElementById('next-client').addEventListener('click', () => {
    if (currentClinicData[currentClinicId].status === 'paused') {
        alert('العيادة متوقفة حالياً. يرجى استئنافها أولاً.');
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
        alert('لا يوجد رقم حالي لتكرار نداءه.');
    }
});

// العميل السابق
document.getElementById('prev-client').addEventListener('click', () => {
    const prevNumber = Math.max(0, (currentClinicData[currentClinicId].currentNumber || 0) - 1);
    set(ref(db, `/clinics/${currentClinicId}/currentNumber`), prevNumber);
    alert(`تم تعديل الرقم الحالي يدوياً إلى ${prevNumber}`);
});

// تصفير العيادة
document.getElementById('reset-clinic').addEventListener('click', () => {
    if (confirm("هل أنت متأكد من تصفير عداد هذه العيادة؟")) {
        set(ref(db, `/clinics/${currentClinicId}/currentNumber`), 0);
        set(ref(db, `/clinics/${currentClinicId}/lastCalledNumber`), 0);
        set(ref(db, `/clinics/${currentClinicId}/queueStart`), 0); // تصفير بداية الدور
        alert('تم تصفير العيادة بنجاح.');
    }
});

// نداء عميل معين
document.getElementById('btn-call-specific').addEventListener('click', () => {
    const specificNumber = parseInt(document.getElementById('call-specific-number').value);
    if (specificNumber > 0) {
        triggerCall(specificNumber, 'standard');
    } else {
        alert('يرجى إدخال رقم صحيح للنداء.');
    }
});

// عرض اسم معين (TTS)
document.getElementById('btn-display-custom').addEventListener('click', () => {
    const customText = document.getElementById('display-custom-name').value;
    if (customText) {
        set(ref(db, '/callQueue/customNotification'), {
            text: customText,
            duration: 6000,
            useTTS: true // لإخبار شاشة العرض باستخدام TTS
        });
        if (!isControlMuted) {
            textToSpeech(customText, 1.0, () => alert('جارٍ الإذاعة...'), () => {});
        }
    }
});

// نداء الطوارئ
document.getElementById('btn-emergency-call').addEventListener('click', () => {
    const emergencyText = document.getElementById('emergency-text').value + currentClinicData[currentClinicId].name;
    set(ref(db, '/callQueue/customNotification'), {
        text: emergencyText,
        duration: 10000,
        callType: 'emergency', // لوميض أحمر على شاشة العرض
        useTTS: true
    });
    if (!isControlMuted) {
        textToSpeech(emergencyText, 1.0, () => alert('نداء طوارئ جاري...'), () => {});
    }
});

// إيقاف/استئناف العيادة
toggleStatusBtn.addEventListener('click', () => {
    const newStatus = currentClinicData[currentClinicId].status === 'paused' ? 'active' : 'paused';
    set(ref(db, `/clinics/${currentClinicId}/status`), newStatus);
});

// الخروج
document.getElementById('logout-btn').addEventListener('click', () => {
    currentClinicId = null;
    clinicPassword.value = '';
    controlPanel.classList.add('hidden');
    loginScreen.classList.remove('hidden');
    window.location.reload(); // إعادة تحميل للتنظيف
});

// كتم الصوت في صفحة التحكم
document.getElementById('control-mute-toggle').addEventListener('click', () => {
    isControlMuted = !isControlMuted;
    const icon = document.getElementById('control-mute-toggle');
    if (isControlMuted) {
        icon.classList.replace('bg-blue-500', 'bg-gray-500');
        icon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l.66-1.32a1 1 0 011.75-.436l3.586 7.172a1 1 0 01-.174 1.348l-.758.758M17.5 13H21a1 1 0 011 1v4a1 1 0 01-1 1h-3.5L15 17.5M19 13v6M17.5 13H21a1 1 0 011 1v4a1 1 0 01-1 1h-3.5L15 17.5M19 13v6" /></svg>`;
    } else {
        icon.classList.replace('bg-gray-500', 'bg-blue-500');
        icon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15.536 8.464a5 5 0 110 7.072L10.96 11H7a1 1 0 01-1-1V9a1 1 0 011-1h3.96l4.576-2.536z" /></svg>`;
    }
});
