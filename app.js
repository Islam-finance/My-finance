// حساباتي - الإصدار 2
let transactions = [];
let installments = [];
let currentType = "income";
let currentCycleOnly = false;

const SETTINGS_KEY = "myFinanceSettings";
const TRANSACTIONS_KEY = "myFinanceTransactions";
const INSTALLMENTS_KEY = "myFinanceInstallments";

function getSettings() {
    const saved = localStorage.getItem(SETTINGS_KEY);
    const settings = saved ? JSON.parse(saved) : {};
    return {
        cycleStartDay: Number(settings.cycleStartDay) || 30
    };
}

function loadData() {
    try {
        transactions = JSON.parse(localStorage.getItem(TRANSACTIONS_KEY) || "[]");
        installments = JSON.parse(localStorage.getItem(INSTALLMENTS_KEY) || "[]");
    } catch {
        transactions = [];
        installments = [];
    }

    document.getElementById("cycleStartDay").value = getSettings().cycleStartDay;
    document.getElementById("transactionDate").value = formatInputDate(new Date());

    updateDashboard();
    displayTransactions();
    displayInstallments();
}

function saveTransactions() {
    localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(transactions));
}

function saveInstallmentsData() {
    localStorage.setItem(INSTALLMENTS_KEY, JSON.stringify(installments));
}

function formatInputDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

function parseLocalDate(value) {
    const [y, m, d] = value.split("-").map(Number);
    return new Date(y, m - 1, d);
}

function formatMoney(value) {
    return Number(value || 0).toLocaleString("ar-EG") + " ج.م";
}

function getCycleForDate(inputDate) {
    const settings = getSettings();
    const startDay = settings.cycleStartDay;
    const date = new Date(inputDate);
    date.setHours(0, 0, 0, 0);

    let year = date.getFullYear();
    let month = date.getMonth();

    const daysInCurrentMonth = new Date(year, month + 1, 0).getDate();
    const actualStartDay = Math.min(startDay, daysInCurrentMonth);

    if (date.getDate() < actualStartDay) {
        month -= 1;
        if (month < 0) {
            month = 11;
            year -= 1;
        }
    }

    const startDays = new Date(year, month + 1, 0).getDate();
    const actualStart = Math.min(startDay, startDays);
    const start = new Date(year, month, actualStart);

    let nextYear = year;
    let nextMonth = month + 1;
    if (nextMonth > 11) {
        nextMonth = 0;
        nextYear++;
    }

    const nextDays = new Date(nextYear, nextMonth + 1, 0).getDate();
    const actualNextStart = Math.min(startDay, nextDays);
    const nextStart = new Date(nextYear, nextMonth, actualNextStart);

    const end = new Date(nextStart);
    end.setDate(end.getDate() - 1);

    return { start, end };
}

function cycleKey(cycle) {
    return formatInputDate(cycle.start) + "_" + formatInputDate(cycle.end);
}

function getCurrentCycle() {
    return getCycleForDate(new Date());
}

function isInCycle(date, cycle) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d >= cycle.start && d <= cycle.end;
}

function formatDate(date) {
    return new Date(date).toLocaleDateString("ar-EG", {
        day: "numeric",
        month: "short",
        year: "numeric"
    });
}

function cycleLabel(cycle) {
    return `${formatDate(cycle.start)} → ${formatDate(cycle.end)}`;
}


function getCategoryTotals(type, cycle) {
    const totals = {};
    transactions.forEach(t => {
        if (t.type !== type || !isInCycle(new Date(t.date), cycle)) return;
        const amount = Number(t.amount) || 0;
        totals[t.category] = (totals[t.category] || 0) + amount;
    });
    return Object.entries(totals).sort((a, b) => b[1] - a[1]);
}

function renderBreakdown(elementId, items, emptyText) {
    const el = document.getElementById(elementId);
    if (!el) return;
    if (!items.length) {
        el.innerHTML = `<p class="empty mini-empty">${emptyText}</p>`;
        return;
    }
    const max = items[0][1] || 1;
    el.innerHTML = items.slice(0, 6).map(([name, value]) => `
        <div class="bar-row">
            <div class="bar-label"><span>${escapeHtml(name)}</span><strong>${formatMoney(value)}</strong></div>
            <div class="bar-track"><div class="bar-fill" style="width:${Math.max(4, (value / max) * 100)}%"></div></div>
        </div>
    `).join("");
}

function renderInstallmentOverview() {
    const el = document.getElementById("installmentOverview");
    if (!el) return;
    const active = installments
        .filter(i => i.paid < i.total)
        .slice()
        .sort((a, b) => Number(a.day) - Number(b.day));

    if (!active.length) {
        el.innerHTML = `<p class="empty">لا توجد أقساط مستحقة أو متبقية 🎉</p>`;
        return;
    }

    el.innerHTML = active.slice(0, 5).map(i => {
        const remaining = i.total - i.paid;
        return `
            <div class="upcoming-installment">
                <div>
                    <strong>${escapeHtml(i.name)}</strong>
                    <span>يستحق يوم ${i.day} • متبقي ${remaining} قسط</span>
                </div>
                <strong>${formatMoney(i.amount)}</strong>
            </div>
        `;
    }).join("");
}

function updateAnalytics(currentCycle) {
    const incomeItems = getCategoryTotals("income", currentCycle);
    const expenseItems = getCategoryTotals("expense", currentCycle);
    renderBreakdown("expenseBreakdown", expenseItems, "لا توجد مصروفات في الدورة الحالية");
    renderBreakdown("incomeBreakdown", incomeItems, "لا يوجد دخل في الدورة الحالية");

    const remainingInstallments = installments.reduce((sum, i) => {
        const remaining = Math.max(0, Number(i.total) - Number(i.paid));
        return sum + remaining * (Number(i.amount) || 0);
    }, 0);
    const remainingCount = installments.reduce((sum, i) => sum + Math.max(0, Number(i.total) - Number(i.paid)), 0);

    const amountEl = document.getElementById("installmentsRemaining");
    const hintEl = document.getElementById("installmentsHint");
    if (amountEl) amountEl.textContent = formatMoney(remainingInstallments);
    if (hintEl) hintEl.textContent = remainingCount ? `${remainingCount} قسط متبقي` : "تم الانتهاء من جميع الأقساط";

    renderInstallmentOverview();
}

function updateDashboard() {
    const currentCycle = getCurrentCycle();

    let totalIncome = 0;
    let totalExpense = 0;
    let cycleIncome = 0;
    let cycleExpense = 0;

    transactions.forEach(t => {
        const amount = Number(t.amount) || 0;
        const date = new Date(t.date);

        if (t.type === "income") {
            totalIncome += amount;
            if (isInCycle(date, currentCycle)) cycleIncome += amount;
        } else {
            totalExpense += amount;
            if (isInCycle(date, currentCycle)) cycleExpense += amount;
        }
    });

    const balance = totalIncome - totalExpense;

    document.getElementById("balance").textContent = formatMoney(balance);
    document.getElementById("totalIncome").textContent = formatMoney(totalIncome);
    document.getElementById("totalExpense").textContent = formatMoney(totalExpense);
    document.getElementById("cycleIncome").textContent = formatMoney(cycleIncome);
    document.getElementById("cycleExpense").textContent = formatMoney(cycleExpense);
    document.getElementById("cycleTitle").textContent = cycleLabel(currentCycle);

    const cycleRemaining = cycleIncome - cycleExpense;
    const remainingEl = document.getElementById("cycleRemaining");
    const remainingHint = document.getElementById("cycleRemainingHint");
    if (remainingEl) {
        remainingEl.textContent = formatMoney(cycleRemaining);
        remainingEl.className = cycleRemaining >= 0 ? "positive" : "negative";
    }
    if (remainingHint) remainingHint.textContent = cycleRemaining >= 0 ? "المتاح بعد مصروفات الدورة" : "المصروفات تجاوزت دخل الدورة";

    updateAnalytics(currentCycle);
}

function showForm(type, transactionToEdit = null) {
    currentType = type;

    const form = document.getElementById("formSection");
    const title = document.getElementById("formTitle");
    const category = document.getElementById("category");

    form.classList.remove("hidden");

    category.innerHTML = type === "income"
        ? `
            <option value="مرتب">مرتب</option>
            <option value="دروس">دروس</option>
            <option value="دخل آخر">دخل آخر</option>
        `
        : `
            <option value="أكل">أكل</option>
            <option value="مواصلات">مواصلات</option>
            <option value="فواتير">فواتير</option>
            <option value="أقساط">أقساط</option>
            <option value="تسوق">تسوق</option>
            <option value="ترفيه">ترفيه</option>
            <option value="أخرى">أخرى</option>
        `;

    if (transactionToEdit) {
        title.textContent = "تعديل العملية";
        document.getElementById("amount").value = transactionToEdit.amount;
        document.getElementById("category").value = transactionToEdit.category;
        document.getElementById("note").value = transactionToEdit.note || "";
        document.getElementById("transactionDate").value = formatInputDate(new Date(transactionToEdit.date));
        form.dataset.editId = transactionToEdit.id;
    } else {
        title.textContent = type === "income" ? "إضافة دخل" : "إضافة مصروف";
        document.getElementById("amount").value = "";
        document.getElementById("note").value = "";
        document.getElementById("transactionDate").value = formatInputDate(new Date());
        delete form.dataset.editId;
    }

    form.scrollIntoView({ behavior: "smooth", block: "start" });
}

function closeForm() {
    document.getElementById("formSection").classList.add("hidden");
    delete document.getElementById("formSection").dataset.editId;
}

function saveTransaction() {
    const amount = Number(document.getElementById("amount").value);
    const category = document.getElementById("category").value;
    const note = document.getElementById("note").value.trim();
    const dateValue = document.getElementById("transactionDate").value;
    const form = document.getElementById("formSection");
    const editId = form.dataset.editId;

    if (!amount || amount <= 0 || !dateValue) {
        alert("من فضلك أدخل المبلغ والتاريخ بشكل صحيح");
        return;
    }

    const date = parseLocalDate(dateValue);

    if (editId) {
        const index = transactions.findIndex(t => String(t.id) === String(editId));
        if (index !== -1) {
            transactions[index] = {
                ...transactions[index],
                amount,
                type: currentType,
                category,
                note,
                date: date.toISOString()
            };
        }
        showToast("تم تعديل العملية");
    } else {
        transactions.push({
            id: Date.now(),
            amount,
            type: currentType,
            category,
            note,
            date: date.toISOString()
        });
        showToast("تم حفظ العملية");
    }

    saveTransactions();
    closeForm();
    updateDashboard();
    displayTransactions();
}

function editTransaction(id) {
    const transaction = transactions.find(t => String(t.id) === String(id));
    if (!transaction) return;
    showForm(transaction.type, transaction);
}

function deleteTransaction(id) {
    if (!confirm("هل تريد حذف هذه العملية؟")) return;

    transactions = transactions.filter(t => String(t.id) !== String(id));
    saveTransactions();
    updateDashboard();
    displayTransactions();
    showToast("تم حذف العملية");
}

function showCurrentCycleOnly() {
    currentCycleOnly = !currentCycleOnly;
    displayTransactions();
}

function displayTransactions() {
    const list = document.getElementById("transactionsList");
    const currentCycle = getCurrentCycle();

    let data = transactions.slice().sort((a, b) => new Date(b.date) - new Date(a.date));

    if (currentCycleOnly) {
        data = data.filter(t => isInCycle(new Date(t.date), currentCycle));
    }

    if (!data.length) {
        list.innerHTML = `<p class="empty">${currentCycleOnly ? "لا توجد عمليات في الدورة الحالية" : "لا توجد عمليات حتى الآن"}</p>`;
        return;
    }

    list.innerHTML = data.map(t => {
        const sign = t.type === "income" ? "+" : "-";
        const cls = t.type === "income" ? "income" : "expense";

        return `
            <div class="transaction">
                <div class="transaction-info">
                    <strong>${escapeHtml(t.category)}</strong>
                    <div class="muted">${escapeHtml(t.note || "بدون ملاحظة")} • ${formatDate(t.date)}</div>
                    <div class="transaction-actions">
                        <button onclick="editTransaction('${t.id}')">✏️ تعديل</button>
                        <button class="delete" onclick="deleteTransaction('${t.id}')">🗑️ حذف</button>
                    </div>
                </div>
                <strong class="${cls}">${sign}${formatMoney(t.amount)}</strong>
            </div>
        `;
    }).join("");
}

function openInstallmentForm() {
    document.getElementById("installmentForm").classList.remove("hidden");
    document.getElementById("installmentForm").scrollIntoView({ behavior: "smooth", block: "start" });
}

function closeInstallmentForm() {
    document.getElementById("installmentForm").classList.add("hidden");
}

function saveInstallment() {
    const name = document.getElementById("installmentName").value.trim();
    const amount = Number(document.getElementById("installmentAmount").value);
    const day = Number(document.getElementById("installmentDay").value);
    const total = Number(document.getElementById("installmentTotal").value);
    const paid = Number(document.getElementById("installmentPaid").value);

    if (!name || !amount || amount <= 0 || !day || day < 1 || day > 31 || !total || total < 1 || paid < 0 || paid > total) {
        alert("من فضلك راجع بيانات القسط");
        return;
    }

    installments.push({
        id: Date.now(),
        name,
        amount,
        day,
        total,
        paid
    });

    saveInstallmentsData();
    displayInstallments();
    closeInstallmentForm();

    document.getElementById("installmentName").value = "";
    document.getElementById("installmentAmount").value = "";
    document.getElementById("installmentDay").value = 5;
    document.getElementById("installmentTotal").value = "";
    document.getElementById("installmentPaid").value = 0;

    showToast("تمت إضافة القسط");
}

function payInstallment(id) {
    const installment = installments.find(i => String(i.id) === String(id));
    if (!installment || installment.paid >= installment.total) return;

    const today = new Date();

    transactions.push({
        id: Date.now(),
        amount: installment.amount,
        type: "expense",
        category: "أقساط",
        note: `${installment.name} - القسط ${installment.paid + 1}`,
        date: today.toISOString()
    });

    installment.paid += 1;

    saveTransactions();
    saveInstallmentsData();

    updateDashboard();
    displayTransactions();
    displayInstallments();

    showToast("تم تسجيل سداد القسط");
}

function deleteInstallment(id) {
    if (!confirm("حذف هذا القسط من قائمة الأقساط؟")) return;

    installments = installments.filter(i => String(i.id) !== String(id));
    saveInstallmentsData();
    displayInstallments();
    showToast("تم حذف القسط");
}

function displayInstallments() {
    const list = document.getElementById("installmentsList");

    if (!installments.length) {
        list.innerHTML = `<p class="empty">لا توجد أقساط مضافة</p>`;
        return;
    }

    list.innerHTML = installments.map(i => {
        const remaining = i.total - i.paid;
        const done = remaining <= 0;

        return `
            <div class="installment">
                <div class="installment-top">
                    <strong>${escapeHtml(i.name)}</strong>
                    <strong>${formatMoney(i.amount)}</strong>
                </div>
                <div class="installment-meta">
                    الاستحقاق: يوم ${i.day}<br>
                    المدفوع: ${i.paid} من ${i.total} • المتبقي: ${remaining}<br>
                    إجمالي المتبقي: ${formatMoney(remaining * i.amount)}
                </div>
                ${done
                    ? `<div class="muted">✅ تم الانتهاء من القسط</div>`
                    : `<button class="pay-btn" onclick="payInstallment('${i.id}')">💳 سداد القسط القادم</button>`
                }
                <button class="small-btn" onclick="deleteInstallment('${i.id}')" style="margin-top:8px">حذف</button>
            </div>
        `;
    }).join("");
}

function openSettings() {
    document.getElementById("cycleStartDay").value = getSettings().cycleStartDay;
    document.getElementById("settingsPanel").classList.remove("hidden");
    document.getElementById("settingsPanel").scrollIntoView({ behavior: "smooth", block: "start" });
}

function closeSettings() {
    document.getElementById("settingsPanel").classList.add("hidden");
}

function saveSettings() {
    let day = Number(document.getElementById("cycleStartDay").value);

    if (!day || day < 1 || day > 31) {
        alert("اختر يومًا من 1 إلى 31");
        return;
    }

    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ cycleStartDay: day }));
    closeSettings();
    updateDashboard();
    displayTransactions();
    showToast("تم حفظ نظام الدورة المالية");
}

function showToast(message) {
    const toast = document.getElementById("toast");
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(window.toastTimer);
    window.toastTimer = setTimeout(() => toast.classList.remove("show"), 1800);
}

function escapeHtml(text) {
    return String(text)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

loadData();
