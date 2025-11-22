// js/admin.js

import { db, ref, set, onValue, push, remove } from "./firebaseConfig.js";
import { textToSpeech, playInstantAudio } from "./textToSpeech.js";

// متغيرات العناصر
const settingsForm = document.getElementById('settings-form');
const clinicForm = document.getElementById('clinic-form');
const clinicsList = document.getElementById('clinics-list');
const ttsCallText = document.getElementById('tts-call-text');
const btnTtsCall = document.getElementById('btn-tts-call');
const instantAudioSelect = document.getElementById('instant-audio-select');
const btnInstantCall = document.getElementById('btn-instant-call');
const callsLog = document.getElementById('calls-log');
const avgRatingEl = document.getElementById('avg-rating');

// --- 1. إدارة الإعدادات العامة ---
onValue(ref(db, '/settings'), (snapshot) => {
    const settings = snapshot.val() || {};
    document.getElementById('center-name-input').value = settings.centerName || '';
    document.getElementById('audio-speed-input').value = settings.audioSpeed || 1.0;
    document.getElementById('scroll-text-input').value = settings.scrollText || '';
    document.getElementById('audio-path-input').value = settings.audioPath || 'audio/';
    document.getElementById('media-path-input').value = settings.mediaPath || 'media/';
});

settingsForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const settingsData = {
        centerName: document.getElementById('center-name-input').value,
        audioSpeed: parseFloat(document.getElementById('audio-speed-input').value),
        scrollText: document.getElementById('scroll-text-input').value,
        audioPath: document.getElementById('audio-path-input').value,
        mediaPath: document.getElementById('media-path-input').value,
    };
    set(ref(db, '/settings'), settingsData)
        .then(() => alert('تم حفظ الإعدادات بنجاح!'))
        .catch(error => alert('فشل الحفظ: ' + error.message));
});

// --- 2. إدارة العيادات (CRUD) ---
let editClinicId = null;

function renderClinic(id, data) {
    const div = document.createElement('div');
    div.id = `clinic-item-${id}`;
    div.className = 'flex justify-between items-center p-3 bg-white rounded-lg shadow-sm border-l-4 border-green-500';
    div.innerHTML = `
        <span class="text-lg font-medium">${data.name} (ID: ${id})</span>
        <div>
            <button class="text-blue-500 hover:text-blue-700 mx-2 edit-btn" data-id="${id}">تعديل</button>
            <button class="text-red-500 hover:text-red-700 delete-btn" data-id="${id}">حذف</button>
        </div>
    `;
    clinicsList.appendChild(div);
}

onValue(ref(db, '/clinics'), (snapshot) => {
    clinicsList.innerHTML = '';
    const clinics = snapshot.val();
    if (clinics) {
        Object.entries(clinics).forEach(([id, data]) => {
            renderClinic(id, data);
        });
        
        // إعداد أزرار التعديل والحذف
        document.querySelectorAll('.edit-btn').forEach(btn => {
            btn.onclick = () => {
                editClinicId = btn.dataset.id;
                document.getElementById('clinic-name-input').value = clinics[editClinicId].name;
                document.getElementById('clinic-password-input').value = clinics[editClinicId].password;
                document.getElementById('clinic-submit-btn').textContent = 'حفظ التعديلات';
            };
        });

        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.onclick = () => {
                if (confirm(`هل أنت متأكد من حذف عيادة: ${clinics[btn.dataset.id].name}?`)) {
                    remove(ref(db, `/clinics/${btn.dataset.id}`))
                        .then(() => alert('تم الحذف بنجاح.'))
                        .catch(error => alert('فشل الحذف: ' + error.message));
                }
            };
        });
    }
});

clinicForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('clinic-name-input').value;
    const password = document.getElementById('clinic-password-input').value;
    const clinicData = { name, password, currentNumber: 0, lastCalledNumber: 0, queueStart: 0, status: 'active' };

    if (editClinicId) {
        // تعديل
        set(ref(db, `/clinics/${editClinicId}`), { ...clinicData, ...{ currentNumber: currentClinicData[editClinicId]?.currentNumber || 0, lastCalledNumber: currentClinicData[editClinicId]?.lastCalledNumber || 0 } })
            .then(() => {
                alert('تم تعديل العيادة بنجاح!');
                editClinicId = null;
                document.getElementById('clinic-form').reset();
                document.getElementById('clinic-submit-btn').textContent = 'إضافة عيادة';
            })
            .catch(error => alert('فشل التعديل: ' + error.message));
    } else {
        // إضافة
        const newClinicRef = push(ref(db, '/clinics'));
        // استخدام key الـ Firebase كـ ID للعيادة
        const newId = newClinicRef.key.replace(/[^0-9]/g, '').slice(-3); // اقتراح: استخدام رقم بسيط كـ ID
        set(ref(db, `/clinics/${newId}`), clinicData)
            .then(() => {
                alert('تم إضافة العيادة بنجاح!');
                document.getElementById('clinic-form').reset();
            })
            .catch(error => alert('فشل الإضافة: ' + error.message));
    }
});

// --- 3. النداءات الفورية ---
btnTtsCall.addEventListener('click', () => {
    const text = ttsCallText.value;
    if (text) {
        set(ref(db, '/callQueue/customNotification'), {
            text: text,
            duration: 6000,
            useTTS: true // لإخبار شاشة العرض باستخدام TTS
        });
        textToSpeech(text, 1.0, () => alert('جاري نطق الرسالة...'), () => {});
    }
});

btnInstantCall.addEventListener('click', () => {
    const fileName = instantAudioSelect.value;
    if (fileName) {
        set(ref(db, '/callQueue/customNotification'), {
            text: `إذاعة ملف صوتي جاهز: ${fileName}`,
            duration: 6000,
            instantAudio: fileName // لإخبار شاشة العرض بتشغيل الملف الجاهز
        });
        playInstantAudio(fileName, () => alert('جاري إذاعة الملف الجاهز...'), () => {});
    }
});


// --- 4. سجل النداءات (اقتراح إضافي) ---
onValue(ref(db, '/callQueue/lastCall'), (snapshot) => {
    const lastCall = snapshot.val();
    if (!lastCall) return;

    // إضافة النداء الأخير إلى السجل
    push(ref(db, '/callLog'), lastCall);
});

onValue(ref(db, '/callLog'), (snapshot) => {
    const log = snapshot.val();
    callsLog.innerHTML = '';
    if (log) {
        // تحويل الكائنات إلى مصفوفة وفرزها حسب التوقيت (الأحدث أولاً)
        const sortedLog = Object.values(log).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        sortedLog.slice(0, 20).forEach(call => {
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-gray-100';
            const time = new Date(call.timestamp).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            const type = call.callType === 'emergency' ? 'طوارئ' : call.callType === 'repeat' ? 'تكرار' : 'معياري';

            tr.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${call.patientNumber || call.customText}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${currentClinicData[call.clinicId]?.name || '---'}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${type}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${time}</td>
            `;
            callsLog.appendChild(tr);
        });
    }
});

// --- 5. إحصائيات التقييم (اقتراح إضافي) ---
// يتم تخزين التقييمات في فرع جديد (مثلاً: /ratings) عبر QR Code
onValue(ref(db, '/ratings'), (snapshot) => {
    const ratings = snapshot.val();
    if (ratings) {
        const ratingValues = Object.values(ratings).map(r => r.score || 0);
        const totalScore = ratingValues.reduce((sum, score) => sum + score, 0);
        const average = ratingValues.length > 0 ? (totalScore / ratingValues.length).toFixed(1) : 0;
        avgRatingEl.textContent = `${average} (${ratingValues.length} تقييم)`;
    } else {
        avgRatingEl.textContent = 'لا يوجد تقييمات';
    }
});
