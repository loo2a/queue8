// js/ticket.js

import { db, ref, onValue, set } from "./firebaseConfig.js";

const clinicSelect = document.getElementById('print-clinic-select');
const currentQueueNumberEl = document.getElementById('current-queue-number');
const startTicketInput = document.getElementById('start-ticket');
const endTicketInput = document.getElementById('end-ticket');
const printTicketsBtn = document.getElementById('print-tickets-btn');
const printArea = document.getElementById('print-area');

let currentClinicData = {};
let selectedClinicId = null;

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
        });
        currentClinicData = clinics;
    }
});

clinicSelect.addEventListener('change', (e) => {
    selectedClinicId = e.target.value;
    if (selectedClinicId && currentClinicData[selectedClinicId]) {
        const data = currentClinicData[selectedClinicId];
        const lastPrinted = data.queueStart || 0;
        currentQueueNumberEl.value = data.currentNumber || 0;
        startTicketInput.value = lastPrinted + 1;
        endTicketInput.value = lastPrinted + 20; // طباعة 20 تذكرة افتراضياً
    } else {
        currentQueueNumberEl.value = '';
    }
});

// --- وظيفة توليد التذاكر ---
printTicketsBtn.addEventListener('click', () => {
    if (!selectedClinicId) {
        alert("يرجى اختيار العيادة أولاً.");
        return;
    }

    const start = parseInt(startTicketInput.value);
    const end = parseInt(endTicketInput.value);
    const clinic = currentClinicData[selectedClinicId];
    
    if (isNaN(start) || isNaN(end) || start > end || start < 1) {
        alert("يرجى إدخال نطاق أرقام صحيح.");
        return;
    }

    printArea.innerHTML = '';
    
    // عدد العملاء أمام العميل المنتظر (تقديري)
    const currentNumber = clinic.currentNumber || 0;

    for (let i = start; i <= end; i++) {
        const ticketsAhead = Math.max(0, currentNumber - i + 1); // +1 لأن العميل الحالي لا يزال ينتظر

        const ticket = document.createElement('div');
        ticket.className = 'ticket flex flex-col justify-between items-center text-center';
        ticket.innerHTML = `
            <div class="text-xs font-semibold text-gray-600 w-full text-right border-b pb-1">الرقم: ${i}</div>
            <div class="flex flex-col flex-grow justify-center items-center">
                <p class="text-xl font-bold text-blue-800">${clinic.name}</p>
                <p class="text-6xl font-black text-red-600 my-1">${i}</p>
            </div>
            <div class="text-xs text-gray-500 w-full text-center border-t pt-1">
                ${ticketsAhead > 0 ? `أمامك حوالي: ${ticketsAhead} عميل` : 'الانتظار قصير'}
            </div>
        `;
        printArea.appendChild(ticket);
    }
    
    // حفظ آخر رقم تمت طباعته في Firebase
    set(ref(db, `/clinics/${selectedClinicId}/queueStart`), end)
        .then(() => {
            // تنفيذ الطباعة بعد توليد التذاكر
            setTimeout(() => {
                window.print();
                alert(`تم طباعة التذاكر من ${start} إلى ${end}.`);
            }, 500); 
        })
        .catch(error => alert('فشل تحديث بداية الدور: ' + error.message));
});
