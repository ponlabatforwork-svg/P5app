import { db } from "./firebase-config.js";
import { doc, getDoc, setDoc, collection, getDocs, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let currentUser = null;

const defaultUsers = {
    "sxaiq54": { password: "sxxnga2011", name: "นางสาวมัลติกา จันทร์คง", role: "teacher" },
    "tt01": { password: "12345", name: "นายเพชรยุทธ์ ยอดทราย", role: "registrar" },
    "ty1234": { password: "112233", name: "นายเพชร สงข์ยุทธ", role: "director" }
};

// ตรวจสอบระบบล็อกอิน
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const u = document.getElementById('login-username').value.trim();
    const p = document.getElementById('login-password').value;

    let userFound = null;
    try {
        const userDoc = await getDoc(doc(db, "users", u));
        if (userDoc.exists() && userDoc.data().password === p) {
            userFound = userDoc.data();
        }
    } catch (err) { console.log("Firebase fallback activated."); }

    if (!userFound && defaultUsers[u] && defaultUsers[u].password === p) {
        userFound = defaultUsers[u];
    }

    if (userFound) {
        currentUser = userFound;
        document.getElementById('login-view').classList.add('hidden');
        document.getElementById('main-view').classList.remove('hidden');
        document.getElementById('user-display-name').innerText = userFound.name;
        
        let roleThai = userFound.role === 'registrar' ? "ฝ่ายทะเบียน" : userFound.role === 'director' ? "ผู้อำนวยการสถานศึกษา" : "คุณครูผู้สอน";
        document.getElementById('user-display-role').innerText = roleThai;

        loadPanelByRole(userFound.role);
    } else {
        Swal.fire({ icon: 'error', title: 'ผิดพลาด', text: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง!' });
    }
});

document.getElementById('btn-logout').addEventListener('click', () => {
    currentUser = null;
    document.getElementById('main-view').classList.add('hidden');
    document.getElementById('login-view').classList.remove('hidden');
});

function loadPanelByRole(role) {
    document.getElementById('panel-teacher').classList.add('hidden');
    document.getElementById('panel-registrar').classList.add('hidden');
    document.getElementById('panel-director').classList.add('hidden');

    if (role === 'teacher') { document.getElementById('panel-teacher').classList.remove('hidden'); fetchTeacherStudents(); }
    else if (role === 'registrar') { document.getElementById('panel-registrar').classList.remove('hidden'); fetchRegistrarQueue(); }
    else if (role === 'director') { document.getElementById('panel-director').classList.remove('hidden'); fetchDirectorQueue(); }
}

function toThaiNumerals(str) {
    const thaiNums = ['๐','๑','๒','๓','๔','๕','๖','๗','๘','๙'];
    return str.toString().replace(/[0-9]/g, c => thaiNums[c]);
}

async function fetchTeacherStudents() {
    const tbody = document.getElementById('teacher-student-table');
    tbody.innerHTML = '';
    const querySnapshot = await getDocs(collection(db, "students"));
    
    querySnapshot.forEach((docSnap) => {
        const s = docSnap.data();
        const id = docSnap.id;
        const status = s.status || 'draft';
        
        let stepperHTML = renderHorizontalStepper(status, s.reject_reason);
        let btnActionHTML = '';

        if (status === 'draft' || status === 'rejected_by_registrar' || status === 'rejected_by_director_to_teacher') {
            btnActionHTML = `
                <button onclick="window.submitToRegistrar('${id}')" class="bg-amber-500 hover:bg-amber-600 text-white px-2.5 py-1 rounded-lg text-xs font-semibold mr-1">ส่งตรวจ</button>
                <button onclick="window.deleteStudent('${id}')" class="bg-rose-500 hover:bg-rose-600 text-white px-2.5 py-1 rounded-lg text-xs font-semibold">ลบ</button>
            `;
        } else if (status === 'approved') {
            btnActionHTML = `
                <button onclick="window.printPDF('${id}', false)" class="bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 rounded-lg text-xs font-semibold mr-1">พิมพ์ต้นฉบับ</button>
                <button onclick="window.printPDF('${id}', true)" class="bg-rose-600 hover:bg-rose-700 text-white px-2.5 py-1 rounded-lg text-xs font-semibold">พิมพ์สำเนา</button>
            `;
        } else {
            btnActionHTML = `<span class="text-xs text-slate-400 italic">ล็อกการแก้ไข</span>`;
        }

        tbody.innerHTML += `
            <tr class="hover:bg-slate-50">
                <td class="p-4 font-semibold">${s.student_id}</td>
                <td class="p-4">${s.name}</td>
                <td class="p-4">${s.class}</td>
                <td class="p-4">${stepperHTML}</td>
                <td class="p-4 text-right">${btnActionHTML}</td>
            </tr>
        `;
    });
}

function renderHorizontalStepper(status, reason) {
    let steps = [{ label: 'ร่าง', state: 'normal' }, { label: 'ทะเบียนตรวจ', state: 'normal' }, { label: 'ผอ. อนุมัติ', state: 'normal' }];
    if (status === 'draft') steps[0].state = 'active';
    if (status === 'pending_registrar') { steps[0].state = 'success'; steps[1].state = 'active'; }
    if (status === 'pending_director') { steps[0].state = 'success'; steps[1].state = 'success'; steps[2].state = 'active'; }
    if (status === 'approved') { steps[0].state = 'success'; steps[1].state = 'success'; steps[2].state = 'success'; }
    if (status === 'rejected_by_registrar') steps[0].state = 'danger';
    if (status === 'rejected_by_director_to_registrar') { steps[0].state = 'success'; steps[1].state = 'danger'; }
    if (status === 'rejected_by_director_to_teacher') steps[0].state = 'danger';

    let html = `<div class="flex items-center space-x-2 text-xs">`;
    steps.forEach((st, idx) => {
        let bg = st.state === 'active' ? "bg-blue-600 text-white font-bold" : st.state === 'success' ? "bg-emerald-600 text-white" : st.state === 'danger' ? "bg-rose-500 text-white font-bold" : "bg-slate-200 text-slate-600";
        html += `<span class="px-2 py-0.5 rounded-md ${bg}">${st.label}</span>`;
        if(idx < 2) html += `<span class="text-slate-300">➔</span>`;
    });
    if(reason) html += `<div class="text-rose-500 text-[11px] mt-0.5">⚠️ เหตุผล: ${reason}</div>`;
    return html + `</div>`;
}

// ผูกฟังก์ชันเข้ากับหน้าต่าง Window เพื่อให้ HTML สามารถมองเห็นฟังก์ชันจาก Module ได้
window.submitToRegistrar = async (id) => {
    await updateDoc(doc(db, "students", id), { status: "pending_registrar", reject_reason: "" });
    fetchTeacherStudents();
};

window.deleteStudent = async (id) => {
    const res = await Swal.fire({ title: 'ยืนยันการลบ?', icon: 'warning', showCancelButton: true });
    if(res.isConfirmed) { await deleteDoc(doc(db, "students", id)); fetchTeacherStudents(); }
};

async function fetchRegistrarQueue() {
    const tbody = document.getElementById('registrar-table');
    tbody.innerHTML = '';
    const querySnapshot = await getDocs(collection(db, "students"));
    querySnapshot.forEach((docSnap) => {
        const s = docSnap.data();
        if(s.status === 'pending_registrar' || s.status === 'rejected_by_director_to_registrar') {
            tbody.innerHTML += `<tr><td class="p-4">${s.student_id}</td><td class="p-4 font-semibold">${s.name}</td><td class="p-4">${s.class}</td><td class="p-4 text-amber-600">${s.status==='pending_registrar'?'รอตรวจ':'⚠️ ผอ. ตีกลับมา'}</td><td class="p-4 text-right"><button onclick="window.reviewRegistrar('${docSnap.id}', '${s.name}')" class="bg-blue-600 text-white px-3 py-1 rounded-xl text-xs font-semibold">🔍 ตรวจสอบ</button></td></tr>`;
        }
    });
}

window.reviewRegistrar = async (id, name) => {
    const { value: action } = await Swal.fire({ title: `ตรวจสอบ: ${name}`, icon: 'question', showCancelButton: true, confirmButtonText: '✍️ เซ็นส่ง ผอ.', denyButtonText: '❌ ตีกลับให้ครู', showDenyButton: true });
    if (Swal.getConfirmedButton() && action) {
        await updateDoc(doc(db, "students", id), { status: "pending_director" });
        fetchRegistrarQueue();
    } else if (Swal.getDeniedButton() || action === false) {
        const { value: reason } = await Swal.fire({ title: 'ระบุเหตุผล', input: 'text', required: true });
        if(reason) { await updateDoc(doc(db, "students", id), { status: "rejected_by_registrar", reject_reason: reason }); fetchRegistrarQueue(); }
    }
};

async function fetchDirectorQueue() {
    const tbody = document.getElementById('director-table');
    tbody.innerHTML = '';
    const querySnapshot = await getDocs(collection(db, "students"));
    querySnapshot.forEach((docSnap) => {
        const s = docSnap.data();
        if(s.status === 'pending_director') {
            tbody.innerHTML += `<tr><td class="p-4">${s.student_id}</td><td class="p-4 font-semibold">${s.name}</td><td class="p-4">${s.class}</td><td class="p-4 text-indigo-600">รออนุมัติ</td><td class="p-4 text-right"><button onclick="window.reviewDirector('${docSnap.id}', '${s.name}')" class="bg-blue-600 text-white px-3 py-1 rounded-xl text-xs font-semibold">🔍 พิจารณา</button></td></tr>`;
        }
    });
}

window.reviewDirector = async (id, name) => {
    const result = await Swal.fire({ title: `พิจารณาของ ผอ.: ${name}`, showCancelButton: true, showDenyButton: true, confirmButtonText: '🖋️ อนุมัติ (พิมพ์ได้)', denyButtonText: '❌ ตีกลับแก้ไข' });
    if(result.isConfirmed) {
        await updateDoc(doc(db, "students", id), { status: "approved" });
        fetchDirectorQueue();
    } else if(result.isDenied) {
        const { value: target } = await Swal.fire({ title: 'ตีกลับไปที่ใคร?', input: 'radio', inputOptions: { 'teacher': 'คุณครู', 'registrar': 'ฝ่ายทะเบียน' } });
        if(target) {
            const { value: reason } = await Swal.fire({ title: 'ระบุเหตุผล', input: 'text' });
            if(reason) {
                let finalStatus = target === 'teacher' ? 'rejected_by_director_to_teacher' : 'rejected_by_director_to_registrar';
                await updateDoc(doc(db, "students", id), { status: finalStatus, reject_reason: reason });
                fetchDirectorQueue();
            }
        }
    }
};

document.getElementById('add-user-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const role = document.getElementById('new-user-role').value;
    const title = document.getElementById('new-user-title').value;
    const username = document.getElementById('new-user-username').value.trim();
    const password = document.getElementById('new-user-password').value;
    const name = document.getElementById('new-user-name').value.trim();

    await setDoc(doc(db, "users", username), { password: password, name: `${title}${name}`, role: role });
    Swal.fire('สำเร็จ', 'สร้างบัญชีแล้ว', 'success');
    document.getElementById('add-user-form').reset();
});

window.switchDirectorTab = (tab) => {
    if(tab === 'approve') {
        document.getElementById('director-approve-section').classList.remove('hidden');
        document.getElementById('director-users-section').classList.add('hidden');
        fetchDirectorQueue();
    } else {
        document.getElementById('director-approve-section').classList.add('hidden');
        document.getElementById('director-users-section').classList.remove('hidden');
    }
};

window.printPDF = async (id, isCopy) => {
    const docSnap = await getDoc(doc(db, "students", id));
    if(!docSnap.exists()) return;
    const s = docSnap.data();

    const pSection = document.getElementById('print-section');
    if(isCopy) pSection.classList.add('is-copy');
    else pSection.classList.remove('is-copy');

    [span_4](start_span)document.getElementById('p-school-name').innerText = "โรงเรียนอนุบาลพัทลุง";[span_4](end_span)
    [span_5](start_span)document.getElementById('p-school-address').innerText = "เลขที่ 45 ถนนสุรินทร์ ตำบลคูหาสวรรค์ อำเภอเมืองพัทลุง จังหวัดพัทลุง 93000";[span_5](end_span)
    document.getElementById('p-school-logo').src = "https://upload.wikimedia.org/wikipedia/commons/thumb/0/06/Garuda_Emblem_of_Thailand_%28Alternative%29.svg/1200px-Garuda_Emblem_of_Thailand_%28Alternative%29.svg.png";
    
    document.getElementById('p-student-name').innerText = s.name;
    document.getElementById('p-student-id').innerText = s.student_id;
    document.getElementById('p-student-class').innerText = s.class;
    document.getElementById('p-student-citizen').innerText = s.citizen_id || '-';

    const now = new Date();
    const months = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
    let timeText = `พิมพ์เมื่อวันที่ ${now.getDate()} เดือน ${months[now.getMonth()]} พ.ศ. ${now.getFullYear()+543} เวลา ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')} น. [span_6](start_span)ผู้พิมพ์ ${currentUser.name}`;[span_6](end_span)
    document.getElementById('p-footer-text').innerText = toThaiNumerals(timeText);

    window.print();
};

window.openStudentModal = async () => {
    const { value: f } = await Swal.fire({
        title: '➕ เพิ่มนักเรียนรายบุคคล',
        html: '<input id="swal-sid" class="swal2-input" placeholder="รหัสประจำตัว"><input id="swal-name" class="swal2-input" placeholder="ชื่อ-นามสกุล"><input id="swal-class" class="swal2-input" placeholder="ชั้น">',
        focusConfirm: false,
        preConfirm: () => ({ student_id: document.getElementById('swal-sid').value, name: document.getElementById('swal-name').value, class: document.getElementById('swal-class').value, status: 'draft' })
    });
    if (f && f.student_id && f.name) { await setDoc(doc(db, "students", f.student_id), f); fetchTeacherStudents(); }
};

window.downloadCSVTemplate = () => {
    let csvContent = "data:text/csv;charset=utf-8,student_id,name,class,citizen_id\n1001,เด็กชายสมชาย สายดี,ป.6/1,1234567890123";
    var encodedUri = encodeURI(csvContent);
    var link = document.createElement("a"); link.setAttribute("href", encodedUri); link.setAttribute("download", "student_template.csv");
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
};

window.importCSV = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    Papa.parse(file, {
        header: true, skipEmptyLines: true,
        complete: async function(results) {
            for(let row of results.data) {
                if(row.student_id && row.name) {
                    await setDoc(doc(db, "students", row.student_id.trim()), { student_id: row.student_id.trim(), name: row.name.trim(), class: row.class ? row.class.trim() : '-', citizen_id: row.citizen_id ? row.citizen_id.trim() : '-', status: 'draft' });
                }
            }
            fetchTeacherStudents();
            document.getElementById('csv-file-input').value = '';
        }
    });
};
