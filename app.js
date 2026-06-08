import { db } from "./firebase-config.js";
import { doc, getDoc, setDoc, collection, getDocs, updateDoc, deleteDoc, query, where } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ==========================================
// ตัวแปรสถานะและข้อมูลจำลองระบบ (State & Fallback)
// ==========================================

let currentUser = null;

// ข้อมูลผู้ใช้งานเริ่มต้นระบบบัญชีเสมือน (Fallback Accounts)
const defaultUsers = {
    "sxaiq54": { password: "sxxnga2011", name: "คุณครูมัลติกา ยอดเพชร", role: "teacher" },
    "tt01": { password: "12345", name: "นายเพชรยุทธ์ ยอดทราย", role: "registrar" },
    "ty1234": { password: "112233", name: "นายวิสิษฐ์ เกลี้ยงสง", role: "director" }
};

// ==========================================
// 1. ระบบควบคุมการเข้าสู่ระบบ (LOGIN & LOGOUT)
// ==========================================

const loginForm = document.getElementById('login-form');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        Swal.fire({
            title: 'กำลังเข้าสู่ระบบ...',
            text: 'โปรดรอสักครู่ขณะตรวจสอบข้อมูลความปลอดภัย',
            allowOutsideClick: false,
            didOpen: () => { Swal.showLoading(); }
        });

        const usernameInput = document.getElementById('login-username').value.trim();
        const passwordInput = document.getElementById('login-password').value;

        let userFound = null;

        try {
            // ดึงข้อมูลผู้ใช้จาก Firestore
            const userDoc = await getDoc(doc(db, "users", usernameInput));
            if (userDoc.exists()) {
                const userData = userDoc.data();
                if (userData.password === passwordInput) {
                    userFound = userData;
                }
            }
        } catch (err) {
            console.warn("ไม่สามารถติดต่อ Firebase ได้, สลับการทำงานไปใช้ระบบบัญชีสำรอง (Fallback Mode)");
        }

        // หากไม่พบในฐานข้อมูลออนไลน์ ให้ตรวจสอบจากบัญชีเริ่มต้นภายในระบบ
        if (!userFound && defaultUsers[usernameInput] && defaultUsers[usernameInput].password === passwordInput) {
            userFound = defaultUsers[usernameInput];
        }

        if (userFound) {
            currentUser = userFound;
            
            document.getElementById('login-view').classList.add('hidden');
            document.getElementById('main-view').classList.remove('hidden');
            
            document.getElementById('user-display-name').innerText = userFound.name;
            
            let roleLabelText = "คุณครูผู้สอน";
            if (userFound.role === 'registrar') roleLabelText = "ฝ่ายทะเบียน";
            if (userFound.role === 'director') roleLabelText = "ผู้อำนวยการสถานศึกษา";
            document.getElementById('user-display-role').innerText = roleLabelText;

            loginForm.reset();

            Swal.fire({
                icon: 'success',
                title: 'เข้าสู่ระบบสำเร็จ',
                text: `ยินดีต้อนรับเข้าสู่ระบบงานระเบียนผลการเรียน คุณ ${userFound.name}`,
                timer: 2000,
                showConfirmButton: false
            });

            loadPanelByRole(userFound.role);
        } else {
            Swal.fire({
                icon: 'error',
                title: 'การเข้าสู่ระบบล้มเหลว',
                text: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง'
            });
        }
    });
}

const btnLogout = document.getElementById('btn-logout');
if (btnLogout) {
    btnLogout.addEventListener('click', () => {
        Swal.fire({
            title: 'ยืนยันการออกจากระบบ?',
            text: "คุณต้องการออกจากเซสชันการทำงานปัจจุบันหรือไม่",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#1e3a8a',
            cancelButtonColor: '#64748b',
            confirmButtonText: 'ใช่, ออกจากระบบ',
            cancelButtonText: 'ยกเลิก'
        }).then((result) => {
            if (result.isConfirmed) {
                currentUser = null;
                document.getElementById('main-view').classList.add('hidden');
                document.getElementById('login-view').classList.remove('hidden');
                
                Swal.fire({
                    icon: 'success',
                    title: 'ออกจากระบบเรียบร้อย',
                    timer: 1500,
                    showConfirmButton: false
                });
            }
        });
    });
}

function loadPanelByRole(role) {
    document.getElementById('panel-teacher').classList.add('hidden');
    document.getElementById('panel-registrar').classList.add('hidden');
    document.getElementById('panel-director').classList.add('hidden');

    if (role === 'teacher') {
        document.getElementById('panel-teacher').classList.remove('hidden');
        fetchTeacherStudents();
    } else if (role === 'registrar') {
        document.getElementById('panel-registrar').classList.remove('hidden');
        fetchRegistrarQueue();
    } else if (role === 'director') {
        document.getElementById('panel-director').classList.remove('hidden');
        fetchDirectorQueue();
    }
}

// ==========================================
// 2. ฟังก์ชันเสริม: แปลงอารบิกเป็นตัวเลขไทยอักษรทางการ
// ==========================================

function toThaiNumerals(str) {
    if (!str) return '';
    const thaiNums = ['๐', '๑', '๒', '๓', '๔', '๕', '๖', '๗', '๘', '๙'];
    return str.toString().replace(/[0-9]/g, ch => thaiNums[ch]);
}

// ==========================================
// 3. ระบบแผงควบคุมคุณครูผู้สอน (TEACHER PANEL LOGIC)
// ==========================================

async function fetchTeacherStudents() {
    const tbody = document.getElementById('teacher-student-table');
    tbody.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-slate-400"><i class="fa-solid fa-spinner fa-spin mr-2"></i> กำลังโหลดข้อมูลนักเรียน...</td></tr>`;
    
    try {
        const querySnapshot = await getDocs(collection(db, "students"));
        
        if (querySnapshot.empty) {
            tbody.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-slate-400"><i class="fa-regular fa-folder-open text-2xl block mb-2"></i> ไม่พบข้อมูลนักเรียนในระบบ</td></tr>`;
            return;
        }

        let htmlString = '';

        querySnapshot.forEach((docSnap) => {
            const s = docSnap.data();
            const id = docSnap.id;
            const status = s.status || 'draft';
            
            let badgeHTML = '';
            let actionButtonsHTML = '';

            if (status === 'draft') {
                badgeHTML = `<span class="status-badge status-draft"><i class="fa-solid fa-file-pen"></i> ร่างบันทึก</span>`;
            } else if (status === 'pending_registrar') {
                badgeHTML = `<span class="status-badge status-pending"><i class="fa-solid fa-hourglass-half"></i> ส่งทะเบียนตรวจ</span>`;
            } else if (status === 'pending_director') {
                badgeHTML = `<span class="status-badge status-pending"><i class="fa-solid fa-stamp"></i> รอ ผอ.อนุมัติ</span>`;
            } else if (status === 'approved') {
                badgeHTML = `<span class="status-badge status-approved"><i class="fa-solid fa-circle-check"></i> อนุมัติแล้ว</span>`;
            } else if (status === 'rejected_by_registrar') {
                badgeHTML = `<span class="status-badge status-rejected"><i class="fa-solid fa-circle-xmark"></i> ทะเบียนตีกลับ</span>`;
            } else if (status === 'rejected_by_director_to_registrar' || status === 'rejected_by_director_to_teacher') {
                badgeHTML = `<span class="status-badge status-rejected"><i class="fa-solid fa-triangle-exclamation"></i> ผอ.ตีกลับแก้ไข</span>`;
            }

            if (s.reject_reason) {
                badgeHTML += `<div class="text-rose-600 text-xs mt-1 font-medium"><i class="fa-solid fa-comment-dots"></i> เหตุผล: ${s.reject_reason}</div>`;
            }

            if (status === 'draft' || status === 'rejected_by_registrar' || status === 'rejected_by_director_to_teacher') {
                actionButtonsHTML = `
                    <button onclick="window.submitToRegistrar('${id}')" class="bg-amber-600 hover:bg-amber-700 text-white px-2.5 py-1.5 rounded-md text-xs font-semibold mr-1 transition shadow-sm"><i class="fa-solid fa-paper-plane"></i> ส่งตรวจ</button>
                    <button onclick="window.editStudent('${id}')" class="bg-slate-600 hover:bg-slate-700 text-white px-2.5 py-1.5 rounded-md text-xs font-semibold mr-1 transition shadow-sm"><i class="fa-solid fa-pen-to-square"></i> แก้ไข</button>
                    <button onclick="window.deleteStudent('${id}')" class="bg-rose-600 hover:bg-rose-700 text-white px-2.5 py-1.5 rounded-md text-xs font-semibold transition shadow-sm"><i class="fa-solid fa-trash-can"></i></button>
                `;
            } else if (status === 'approved') {
                actionButtonsHTML = `
                    <button onclick="window.printPDF('${id}', false)" class="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-md text-xs font-semibold mr-1 transition shadow-sm"><i class="fa-solid fa-print mr-1"></i> พิมพ์ต้นฉบับ</button>
                    <button onclick="window.printPDF('${id}', true)" class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-md text-xs font-semibold transition shadow-sm"><i class="fa-solid fa-copy mr-1"></i> สำเนา</button>
                `;
            } else {
                actionButtonsHTML = `<span class="text-xs text-slate-400 italic font-medium"><i class="fa-solid fa-lock mr-1"></i> ล็อกสิทธิ์ตรวจสอบ</span>`;
            }

            htmlString += `
                <tr class="hover:bg-slate-50 border-b border-slate-100">
                    <td class="p-4 font-bold text-slate-700">${s.student_id}</td>
                    <td class="p-4 font-medium">${s.name}</td>
                    <td class="p-4 text-slate-500">${s.class || '-'}</td>
                    <td class="p-4">${badgeHTML}</td>
                    <td class="p-4 text-right">${actionButtonsHTML}</td>
                </tr>
            `;
        });

        tbody.innerHTML = htmlString;
    } catch (error) {
        console.error(error);
        tbody.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-rose-500 font-semibold"><i class="fa-solid fa-circle-exclamation mr-1"></i> เกิดข้อผิดพลาดในการโหลดข้อมูลฐานข้อมูล</td></tr>`;
    }
}

window.submitToRegistrar = async (id) => {
    try {
        await updateDoc(doc(db, "students", id), {
            status: "pending_registrar",
            reject_reason: ""
        });
        Swal.fire({ icon: 'success', title: 'ส่งข้อมูลสำเร็จ', text: 'ส่งระเบียนผลการเรียนให้ฝ่ายทะเบียนตรวจสอบแล้ว', timer: 1500, showConfirmButton: false });
        fetchTeacherStudents();
    } catch (err) {
        Swal.fire({ icon: 'error', title: 'ผิดพลาด', text: 'ไม่สามารถดำเนินการส่งข้อมูลได้ในขณะนี้' });
    }
};

window.deleteStudent = async (id) => {
    Swal.fire({
        title: 'ยืนยันการลบข้อมูล?',
        text: "ข้อมูลของนักเรียนและผลการเรียนทั้งหมดจะถูกลบออกจากคลังระบบถาวร",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'ลบข้อมูลถาวร',
        cancelButtonText: 'ยกเลิก'
    }).then(async (result) => {
        if (result.isConfirmed) {
            try {
                await deleteDoc(doc(db, "students", id));
                Swal.fire('ลบข้อมูลสำเร็จ!', 'ลบฐานข้อมูลนักเรียนเรียบร้อยแล้ว', 'success');
                fetchTeacherStudents();
            } catch (err) {
                Swal.fire('ผิดพลาด!', 'ไม่สามารถลบข้อมูลได้ในระบบ', 'error');
            }
        }
    });
};

window.openStudentModal = async () => {
    const { value: formValues } = await Swal.fire({
        title: '<span class="text-xl font-bold text-slate-800">➕ เพิ่มประวัตินักเรียนรายบุคคล</span>',
        html: `
            <div class="text-left space-y-3 p-1">
                <div>
                    <label class="block text-xs font-bold text-slate-600 mb-1">รหัสประจำตัวนักเรียน</label>
                    <input id="swal-student-id" class="swal2-input m-0 w-full px-3 py-2 border rounded-lg outline-none" style="margin:0; width:100%; box-sizing:border-box;" placeholder="ตัวอย่าง: 1001">
                </div>
                <div>
                    <label class="block text-xs font-bold text-slate-600 mb-1">ชื่อ-นามสกุล (เด็กชาย / เด็กหญิง / นาย / นางสาว)</label>
                    <input id="swal-name" class="swal2-input m-0 w-full px-3 py-2 border rounded-lg outline-none" style="margin:0; width:100%; box-sizing:border-box;" placeholder="ชื่อ - นามสกุลนักเรียน">
                </div>
                <div>
                    <label class="block text-xs font-bold text-slate-600 mb-1">เลขประจำตัวประชาชน (13 หลัก)</label>
                    <input id="swal-citizen" class="swal2-input m-0 w-full px-3 py-2 border rounded-lg outline-none" style="margin:0; width:100%; box-sizing:border-box;" placeholder="เลขบัตรประชาชน">
                </div>
                <div>
                    <label class="block text-xs font-bold text-slate-600 mb-1">ระดับชั้นเรียน</label>
                    <input id="swal-class" class="swal2-input m-0 w-full px-3 py-2 border rounded-lg outline-none" style="margin:0; width:100%; box-sizing:border-box;" placeholder="ตัวอย่าง: ป.6/1">
                </div>
            </div>
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonColor: '#1e3a8a',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'บันทึกข้อมูล',
        cancelButtonText: 'ปิดหน้าต่าง',
        preConfirm: () => {
            const sid = document.getElementById('swal-student-id').value.trim();
            const nm = document.getElementById('swal-name').value.trim();
            const cz = document.getElementById('swal-citizen').value.trim();
            const cl = document.getElementById('swal-class').value.trim();
            
            if (!sid || !nm) {
                Swal.showValidationMessage('กรุณากรอกรหัสประจำตัวและชื่อ-นามสกุลนักเรียน');
                return false;
            }
            return { student_id: sid, name: nm, citizen_id: cz, class: cl, status: 'draft', reject_reason: '' };
        }
    });

    if (formValues) {
        try {
            await setDoc(doc(db, "students", formValues.student_id), formValues);
            Swal.fire('สำเร็จ', 'บันทึกโปรไฟล์นักเรียนเข้าสู่ระบบเรียบร้อย', 'success');
            fetchTeacherStudents();
        } catch (error) {
            Swal.fire('ข้อผิดพลาด', 'ไม่สามารถเชื่อมต่อการบันทึกฐานข้อมูลได้', 'error');
        }
    }
};

window.editStudent = async (id) => {
    try {
        const docSnap = await getDoc(doc(db, "students", id));
        if (!docSnap.exists()) return;
        const s = docSnap.data();

        const { value: formValues } = await Swal.fire({
            title: '<span class="text-xl font-bold text-slate-800">✏️ แก้ไขประวัตินักเรียน</span>',
            html: `
                <div class="text-left space-y-3 p-1">
                    <div>
                        <label class="block text-xs font-bold text-slate-600 mb-1">รหัสประจำตัวนักเรียน</label>
                        <input id="swal-student-id" value="${s.student_id}" disabled class="swal2-input m-0 w-full px-3 py-2 border rounded-lg outline-none bg-slate-100 text-slate-500" style="margin:0; width:100%; box-sizing:border-box;">
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-slate-600 mb-1">ชื่อ-นามสกุล</label>
                        <input id="swal-name" value="${s.name}" class="swal2-input m-0 w-full px-3 py-2 border rounded-lg outline-none" style="margin:0; width:100%; box-sizing:border-box;">
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-slate-600 mb-1">เลขประจำตัวประชาชน</label>
                        <input id="swal-citizen" value="${s.citizen_id || ''}" class="swal2-input m-0 w-full px-3 py-2 border rounded-lg outline-none" style="margin:0; width:100%; box-sizing:border-box;">
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-slate-600 mb-1">ระดับชั้นเรียน</label>
                        <input id="swal-class" value="${s.class || ''}" class="swal2-input m-0 w-full px-3 py-2 border rounded-lg outline-none" style="margin:0; width:100%; box-sizing:border-box;">
                    </div>
                </div>
            `,
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonColor: '#1e3a8a',
            cancelButtonColor: '#64748b',
            confirmButtonText: 'บันทึกการแก้ไข',
            cancelButtonText: 'ยกเลิก',
            preConfirm: () => {
                const nm = document.getElementById('swal-name').value.trim();
                const cz = document.getElementById('swal-citizen').value.trim();
                const cl = document.getElementById('swal-class').value.trim();
                if (!nm) {
                    Swal.showValidationMessage('กรุณากรอกชื่อ-นามสกุลนักเรียน');
                    return false;
                }
                return { name: nm, citizen_id: cz, class: cl };
            }
        });

        if (formValues) {
            await updateDoc(doc(db, "students", id), formValues);
            Swal.fire('แก้ไขสำเร็จ', 'อัปเดตข้อมูลนักเรียนเรียบร้อยแล้ว', 'success');
            fetchTeacherStudents();
        }
    } catch (err) {
        Swal.fire('ข้อผิดพลาด', 'ไม่สามารถดึงข้อมูลเพื่อแก้ไขได้', 'error');
    }
};

window.downloadCSVTemplate = () => {
    const csvHeaderAndRow = "student_id,name,class,citizen_id\n1001,เด็กชายสมชาย สายดี,ป.6/1,1234567890123\n1002,เด็กหญิงสมศรี ดีเลิศ,ป.6/1,9876543210987";
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvHeaderAndRow], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "student_template_anubanpt.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

window.importCSV = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    Swal.fire({
        title: 'กำลังตรวจสอบข้อมูล CSV...',
        text: 'ระบบกำลังวิเคราะห์โครงสร้างไฟล์และเตรียมนำเข้าข้อมูล',
        allowOutsideClick: false,
        didOpen: () => { Swal.showLoading(); }
    });

    Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: async function(results) {
            let successCount = 0;
            try {
                for (let row of results.data) {
                    if (row.student_id && row.name) {
                        const sId = row.student_id.trim();
                        await setDoc(doc(db, "students", sId), {
                            student_id: sId,
                            name: row.name.trim(),
                            class: row.class ? row.class.trim() : '-',
                            citizen_id: row.citizen_id ? row.citizen_id.trim() : '-',
                            status: 'draft',
                            reject_reason: ''
                        });
                        successCount++;
                    }
                }
                Swal.fire('นำเข้าสำเร็จ!', `อัปโหลดรายชื่อข้อมูลนักเรียนใหม่จำนวน ${successCount} รายการเรียบร้อย`, 'success');
                fetchTeacherStudents();
                document.getElementById('csv-file-input').value = '';
            } catch (err) {
                Swal.fire('นำข้อมูลเข้าล้มเหลว', 'เกิดข้อผิดพลาดในการตรวจสอบคีย์โครงสร้างหัวตารางตรรกะเอกสาร', 'error');
            }
        }
    });
};

// ==========================================
// 4. ระบบฝ่ายทะเบียนตรวจสอบ (REGISTRAR PANEL LOGIC)
// ==========================================

async function fetchRegistrarQueue() {
    const tbody = document.getElementById('registrar-table');
    tbody.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-slate-400"><i class="fa-solid fa-spinner fa-spin mr-2"></i> กำลังเรียกคิวงานตรวจสอบเอกสาร...</td></tr>`;

    try {
        // ใช้ Query คัดกรองเฉพาะสถานะที่เกี่ยวข้องเพื่อลดค่าใช้จ่าย (Firestore Reads)
        const q = query(collection(db, "students"), where("status", "in", ["pending_registrar", "rejected_by_director_to_registrar"]));
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
            tbody.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-slate-400"><i class="fa-regular fa-square-check text-2xl block mb-2"></i> ไม่มีคิวงานเอกสารคงค้างในฝ่ายทะเบียน</td></tr>`;
            return;
        }

        let htmlString = '';

        querySnapshot.forEach((docSnap) => {
            const s = docSnap.data();
            let stateTextHTML = '';
            
            if (s.status === 'pending_registrar') {
                stateTextHTML = `<span class="text-amber-600 font-semibold"><i class="fa-solid fa-circle-exclamation animate-pulse"></i> รอตรวจ</span>`;
            } else {
                stateTextHTML = `<span class="text-rose-600 font-bold"><i class="fa-solid fa-triangle-exclamation"></i> ผอ. ตีกลับแก้ไข</span>`;
            }

            htmlString += `
                <tr class="hover:bg-slate-50 border-b border-slate-100">
                    <td class="p-4 font-bold text-slate-700">${s.student_id}</td>
                    <td class="p-4 font-medium">${s.name}</td>
                    <td class="p-4 text-slate-500">${s.class || '-'}</td>
                    <td class="p-4 text-sm">${stateTextHTML}</td>
                    <td class="p-4 text-right">
                        <button onclick="window.reviewRegistrar('${docSnap.id}', '${s.name}')" class="bg-blue-900 hover:bg-blue-800 text-white px-3 py-1.5 rounded-md text-xs font-semibold transition shadow-sm"><i class="fa-solid fa-magnifying-glass-chart mr-1"></i> ตรวจสอบไฟล์</button>
                    </td>
                </tr>
            `;
        });

        tbody.innerHTML = htmlString;
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-rose-500"><i class="fa-solid fa-triangle-exclamation"></i> ไม่สามารถเรียกคิวงานฝ่ายทะเบียนได้</td></tr>`;
    }
}

window.reviewRegistrar = async (id, name) => {
    Swal.fire({
        title: `<span class="text-lg font-bold text-slate-800 border-b pb-1 block">ตรวจสอบใบรายงานผล: ${name}</span>`,
        icon: 'question',
        showCancelButton: true,
        showDenyButton: true,
        confirmButtonColor: '#059669',
        denyButtonColor: '#dc2626',
        cancelButtonColor: '#64748b',
        confirmButtonText: '✍️ ลงนามและส่งให้ ผอ.',
        denyButtonText: '❌ ตีกลับให้ครูผู้สอน',
        cancelButtonText: 'ปิดหน้าจอพิจารณา'
    }).then(async (result) => {
        if (result.isConfirmed) {
            try {
                await updateDoc(doc(db, "students", id), { status: "pending_director", reject_reason: "" });
                Swal.fire('ส่งต่อไปยัง ผอ. สำเร็จ', 'เอกสารถูกเซ็นตรวจผ่านระบบและตั้งคิวรอพิจารณาแล้ว', 'success');
                fetchRegistrarQueue();
            } catch (e) {
                Swal.fire('ข้อผิดพลาด', 'ไม่สามารถปรับปรุงสถานะได้', 'error');
            }
        } else if (result.isDenied) {
            const { value: reasonText } = await Swal.fire({
                title: 'โปรดระบุสาเหตุการตีกลับเอกสาร',
                input: 'text',
                inputPlaceholder: 'ตัวอย่างเช่น: เกรดรายวิชาพื้นฐานไม่ครบถ้วน, พิมพ์ชื่อผิด...',
                inputValidator: (value) => {
                    if (!value.trim()) return 'คุณจำเป็นต้องระบุเหตุผลเพื่อเป็นข้อมูลให้คุณครูที่ปรึกษา!';
                }
            });

            if (reasonText) {
                try {
                    await updateDoc(doc(db, "students", id), { status: "rejected_by_registrar", reject_reason: reasonText });
                    Swal.fire('ส่งกลับเรียบร้อย', 'ตีคืนแบบฟอร์มเอกสารกลับไปยังคุณครูเรียบร้อยแล้ว', 'info');
                    fetchRegistrarQueue();
                } catch (e) {
                    Swal.fire('ข้อผิดพลาด', 'ไม่สามารถบันทึกข้อความปฏิเสธได้', 'error');
                }
            }
        }
    });
};

// ==========================================
// 5. ระบบแผงควบคุมผู้อำนวยการสถานศึกษา (DIRECTOR LOGIC)
// ==========================================

async function fetchDirectorQueue() {
    const tbody = document.getElementById('director-table');
    tbody.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-slate-400"><i class="fa-solid fa-spinner fa-spin mr-2"></i> กำลังเรียกใบงานนำเสนอพิจารณา...</td></tr>`;

    try {
        const q = query(collection(db, "students"), where("status", "==", "pending_director"));
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
            tbody.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-slate-400"><i class="fa-solid fa-folder-minus text-xl block mb-1"></i> ไม่มีคิวงานระเบียนเสนออนุมัติในขณะนี้</td></tr>`;
            return;
        }

        let htmlString = '';

        querySnapshot.forEach((docSnap) => {
            const s = docSnap.data();
            htmlString += `
                <tr class="hover:bg-slate-50 border-b border-slate-100">
                    <td class="p-4 font-bold text-slate-700">${s.student_id}</td>
                    <td class="p-4 font-medium">${s.name}</td>
                    <td class="p-4 text-slate-500">${s.class || '-'}</td>
                    <td class="p-4"><span class="text-blue-700 font-bold animate-pulse"><i class="fa-solid fa-file-invoice mr-1"></i> เสนอพิจารณาอนุมัติ</span></td>
                    <td class="p-4 text-right">
                        <button onclick="window.reviewDirector('${docSnap.id}', '${s.name}')" class="bg-blue-900 hover:bg-blue-800 text-white px-3 py-1.5 rounded-md text-xs font-semibold transition shadow-sm"><i class="fa-solid fa-stamp mr-1"></i> ตรวจวินิจฉัย</button>
                    </td>
                </tr>
            `;
        });

        tbody.innerHTML = htmlString;
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-rose-500"><i class="fa-solid fa-triangle-exclamation"></i> ล้มเหลวในการเชื่อมต่อระบบเสนอเซ็น</td></tr>`;
    }
}

window.reviewDirector = async (id, name) => {
    Swal.fire({
        title: `<span class="text-lg font-bold text-slate-800">🖋️ สิทธิ์พิจารณาผู้บริหารเอกสาร: ${name}</span>`,
        icon: 'warning',
        showCancelButton: true,
        showDenyButton: true,
        confirmButtonColor: '#10b981',
        denyButtonColor: '#f43f5e',
        cancelButtonColor: '#64748b',
        confirmButtonText: '🖋️ อนุมัติแบบฟอร์มสำเร็จ',
        denyButtonText: '❌ ปฏิเสธและส่งกลับ',
        cancelButtonText: 'ปิดคำสั่งรับรอง'
    }).then(async (result) => {
        if (result.isConfirmed) {
            try {
                await updateDoc(doc(db, "students", id), { status: "approved", reject_reason: "" });
                Swal.fire('ใบระเบียนอนุมัติเสร็จสิ้น', 'อนุมัติเอกสาร ปพ. เพื่ออนุญาตพิมพ์ออกให้กับทางผู้ปกครองและนักเรียนแล้ว', 'success');
                fetchDirectorQueue();
            } catch (e) {
                Swal.fire('ผิดพลาด', 'ระบบเซ็นล้มเหลว', 'error');
            }
        } else if (result.isDenied) {
            const { value: targetRole } = await Swal.fire({
                title: 'เป้าหมายส่งกลับแก้ไขชั้นเอกสาร',
                input: 'radio',
                inputOptions: {
                    'teacher': 'ส่งคืนคุณครูผู้สอนโดยตรง',
                    'registrar': 'ส่งคืนให้ฝ่ายทะเบียนทบทวนใหม่'
                },
                inputValidator: (value) => {
                    if (!value) return 'คุณจำเป็นต้องเลือกช่องทางการรับเอกสารตีกลับครับ!';
                }
            });

            if (targetRole) {
                const { value: reasonText } = await Swal.fire({
                    title: 'ข้อความแจ้งจุดแก้ไขจากผู้บริหาร',
                    input: 'text',
                    inputPlaceholder: 'ระบุจุดที่ต้องการให้ปรับปรุง...',
                    inputValidator: (value) => {
                        if (!value.trim()) return 'ท่านผู้อำนวยการจำเป็นต้องระบุข้อความวินิจฉัยเพื่อส่งกลับครับ';
                    }
                });

                if (reasonText) {
                    try {
                        let finalStatus = targetRole === 'teacher' ? 'rejected_by_director_to_teacher' : 'rejected_by_director_to_registrar';
                        await updateDoc(doc(db, "students", id), {
                            status: finalStatus,
                            reject_reason: `[ผอ. ปฏิเสธ] - ${reasonText}`
                        });
                        Swal.fire('ส่งกลับชั้นเอกสารสำเร็จ', 'คำสั่งส่งกลับและข้อวินิจฉัยลงบันทึกในระบบเรียบร้อย', 'info');
                        fetchDirectorQueue();
                    } catch (e) {
                        Swal.fire('ข้อผิดพลาด', 'ไม่สามารถประมวลผลคำสั่งตีกลับได้', 'error');
                    }
                }
            }
        }
    });
};

const addUserForm = document.getElementById('add-user-form');
if (addUserForm) {
    addUserForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const role = document.getElementById('new-user-role').value;
        const title = document.getElementById('new-user-title').value;
        const username = document.getElementById('new-user-username').value.trim();
        const password = document.getElementById('new-user-password').value;
        const fullName = document.getElementById('new-user-name').value.trim();

        Swal.fire({ title: 'กำลังบันทึกผู้ใช้...', didOpen: () => { Swal.showLoading(); } });

        try {
            await setDoc(doc(db, "users", username), {
                password: password,
                name: `${title}${fullName}`,
                role: role
            });
            Swal.fire('สำเร็จ', `สร้างสิทธิ์การเข้าใช้งานบัญชีของคุณ ${title}${fullName} เรียบร้อยแล้ว`, 'success');
            addUserForm.reset();
        } catch (err) {
            Swal.fire('ล้มเหลว', 'ไม่สามารถเพิ่มผู้ใช้งานลงใน Firestore ได้', 'error');
        }
    });
}

window.switchDirectorTab = (tab) => {
    const btnApprove = document.getElementById('tab-dir-approve');
    const btnUsers = document.getElementById('tab-dir-users');
    const secApprove = document.getElementById('director-approve-section');
    const secUsers = document.getElementById('director-users-section');

    if (tab === 'approve') {
        secApprove.classList.remove('hidden');
        secUsers.classList.add('hidden');
        
        btnApprove.className = "bg-white shadow-sm text-blue-900 py-1.5 px-4 rounded-md text-sm font-bold flex items-center gap-2 transition";
        btnUsers.className = "text-slate-500 hover:text-slate-700 py-1.5 px-4 rounded-md text-sm font-medium flex items-center gap-2 transition";
        fetchDirectorQueue();
    } else {
        secApprove.classList.add('hidden');
        secUsers.classList.remove('hidden');

        btnApprove.className = "text-slate-500 hover:text-slate-700 py-1.5 px-4 rounded-md text-sm font-medium flex items-center gap-2 transition";
        btnUsers.className = "bg-white shadow-sm text-blue-900 py-1.5 px-4 rounded-md text-sm font-bold flex items-center gap-2 transition";
    }
};

// ==========================================
// 6. โครงสร้างคำสั่งการประมวลผลพิมพ์เอกสาร ปพ. (PRINT ENGINE)
// ==========================================

window.printPDF = async (id, isCopy) => {
    Swal.fire({
        title: 'กำลังจัดหน้าเอกสาร ปพ...',
        text: 'โปรดรอระบบแปลงรหัสตัวเลขและประมวลรูปแบบโครงสร้างตารางพิมพ์',
        allowOutsideClick: false,
        didOpen: () => { Swal.showLoading(); }
    });

    try {
        const docSnap = await getDoc(doc(db, "students", id));
        if (!docSnap.exists()) {
            Swal.fire('ข้อผิดพลาด', 'ไม่พบเอกสารข้อมูลรายชื่อของนักเรียนคนนี้ในสารบบ', 'error');
            return;
        }

        const s = docSnap.data();
        const printArea = document.getElementById('print-section');

        if (isCopy) {
            printArea.classList.add('is-copy');
        } else {
            printArea.classList.remove('is-copy');
        }

        document.getElementById('p-student-name').innerText = s.name || '-';
        document.getElementById('p-student-id').innerText = toThaiNumerals(s.student_id);
        document.getElementById('p-student-class').innerText = toThaiNumerals(s.class || '-');
        document.getElementById('p-student-citizen').innerText = toThaiNumerals(s.citizen_id || '-');

        const currentDate = new Date();
        const thaiMonths = [
            "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", 
            "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
        ];
        
        const day = currentDate.getDate();
        const monthName = thaiMonths[currentDate.getMonth()];
        const yearBE = currentDate.getFullYear() + 543;
        const hour = String(currentDate.getHours()).padStart(2, '0');
        const minute = String(currentDate.getMinutes()).padStart(2, '0');

        let printFooterLog = `พิมพ์เมื่อวันที่ ${day} เดือน ${monthName} พ.ศ. ${yearBE} เวลา ${hour}:${minute} น. ผู้พิมพ์ ${currentUser ? currentUser.name : 'ระบบจัดเก็บข้อมูลการศึกษา'}`;
        document.getElementById('p-footer-text').innerText = toThaiNumerals(printFooterLog);

        setTimeout(() => {
            Swal.close();
            window.print();
        }, 800);

    } catch (err) {
        console.error(err);
        Swal.fire('ล้มเหลว', 'เกิดข้อผิดพลาดทางเทคนิคภายในขบวนการแปลงสคริปต์หน้าโครงสร้างกระดาษพิมพ์', 'error');
    }
};
