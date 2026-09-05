// حساباتي v6 — توزيع ذكي للدخل مع الحفاظ على بيانات v4/v5
(() => {
  'use strict';

  let transactions = [];
  let installments = [];
  let fixedExpenses = [];
  let goals = [];
  let currentType = 'income';
  let currentCycleOnly = false;

  const SETTINGS_KEY = 'myFinanceSettings';
  const TRANSACTIONS_KEY = 'myFinanceTransactions';
  const INSTALLMENTS_KEY = 'myFinanceInstallments';
  const FIXED_KEY = 'myFinanceFixedExpenses';
  const GOALS_KEY = 'myFinanceGoals';
  const ENVELOPES_KEY = 'myFinanceEnvelopes';

  const defaultSettings = {
    cycleStartDay: 30,
    lesson: { gold: 25, emergency: 20, investment: 15, goals: 20, fun: 10, reserve: 10 },
    other: { gold: 15, emergency: 20, investment: 15, goals: 20, fun: 10, reserve: 20 }
  };

  const labels = {
    gold: '🪙 الذهب',
    emergency: '🛟 الطوارئ',
    investment: '📈 الاستثمار',
    goals: '🎯 الأهداف',
    fun: '🎉 الترفيه',
    reserve: '💰 الاحتياطي'
  };

  let envelopes = { gold: 0, emergency: 0, investment: 0, goals: 0, fun: 0, reserve: 0 };

  const $ = id => document.getElementById(id);
  const money = n => Number(n || 0).toLocaleString('ar-EG') + ' ج.م';

  function esc(s) {
    return String(s ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function dateInput(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function localDate(v) {
    const [y, m, d] = v.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  function fmtDate(d) {
    return new Date(d).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function getSettings() {
    try {
      const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
      return {
        cycleStartDay: Number(saved.cycleStartDay) || defaultSettings.cycleStartDay,
        lesson: { ...defaultSettings.lesson, ...(saved.lesson || {}) },
        other: { ...defaultSettings.other, ...(saved.other || {}) }
      };
    } catch {
      return JSON.parse(JSON.stringify(defaultSettings));
    }
  }

  function saveAll() {
    localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(transactions));
    localStorage.setItem(INSTALLMENTS_KEY, JSON.stringify(installments));
    localStorage.setItem(FIXED_KEY, JSON.stringify(fixedExpenses));
    localStorage.setItem(GOALS_KEY, JSON.stringify(goals));
    localStorage.setItem(ENVELOPES_KEY, JSON.stringify(envelopes));
  }

  function safeArray(key) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || '[]');
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  function safeObject(key) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || '{}');
      return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    } catch {
      return {};
    }
  }

  function load() {
    transactions = safeArray(TRANSACTIONS_KEY);
    installments = safeArray(INSTALLMENTS_KEY);
    fixedExpenses = safeArray(FIXED_KEY);
    goals = safeArray(GOALS_KEY);
    envelopes = { ...envelopes, ...safeObject(ENVELOPES_KEY) };

    populateSettings();
    if ($('transactionDate')) $('transactionDate').value = dateInput(new Date());
    renderAll();
  }

  function cycle(date) {
    const s = getSettings();
    const day = Math.max(1, Math.min(31, Number(s.cycleStartDay) || 30));
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);

    let y = d.getFullYear();
    let m = d.getMonth();
    const daysThisMonth = new Date(y, m + 1, 0).getDate();
    const effectiveDay = Math.min(day, daysThisMonth);

    if (d.getDate() < effectiveDay) m--;
    if (m < 0) { m = 11; y--; }

    const start = new Date(y, m, Math.min(day, new Date(y, m + 1, 0).getDate()));
    let ny = y, nm = m + 1;
    if (nm > 11) { nm = 0; ny++; }
    const next = new Date(ny, nm, Math.min(day, new Date(ny, nm + 1, 0).getDate()));
    const end = new Date(next);
    end.setDate(end.getDate() - 1);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  function inCycle(date, c) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d >= c.start && d <= c.end;
  }

  function allocationFor(category, amount) {
    const s = getSettings();
    const p = category === 'دروس' ? s.lesson : s.other;
    return Object.fromEntries(Object.entries(labels).map(([k]) => [k, Number(amount || 0) * Number(p[k] || 0) / 100]));
  }

  function fixedObligationsTotal() {
    const fixed = fixedExpenses.reduce((sum, x) => sum + Number(x.amount || 0), 0);
    const activeInstallments = installments
      .filter(x => Number(x.paid || 0) < Number(x.total || 0))
      .reduce((sum, x) => sum + Number(x.amount || 0), 0);
    return fixed + activeInstallments;
  }

  function renderAllocation(amount, category) {
    const preview = $('allocationPreview');
    const box = $('incomeAllocationBox');
    if (!preview || !box) return;

    if (category === 'مرتب') {
      const obligations = fixedObligationsTotal();
      const remainder = Math.max(0, Number(amount || 0) - obligations);
      preview.innerHTML = `
        <div class="allocation-row"><span>🏠 الالتزامات الثابتة</span><strong>${money(Math.min(Number(amount || 0), obligations))}</strong></div>
        <div class="allocation-row"><span>💡 المتبقي للتوزيع</span><strong>${money(remainder)}</strong></div>
        ${Object.entries(allocationFor(category, remainder)).map(([k, v]) => `<div class="allocation-row"><span>${labels[k]}</span><strong>${money(v)}</strong></div>`).join('')}
      `;
    } else {
      const a = allocationFor(category, Number(amount || 0));
      preview.innerHTML = Object.entries(a)
        .map(([k, v]) => `<div class="allocation-row"><span>${labels[k]}</span><strong>${money(v)}</strong></div>`)
        .join('');
    }
    box.classList.toggle('hidden', !Number(amount || 0));
  }

  function allocationToApply(category, amount) {
    const value = Number(amount || 0);
    if (category === 'مرتب') {
      const remainder = Math.max(0, value - fixedObligationsTotal());
      return allocationFor(category, remainder);
    }
    return allocationFor(category, value);
  }

  function addEnvelopeAllocation(allocation, direction = 1) {
    Object.entries(allocation || {}).forEach(([k, v]) => {
      if (!(k in envelopes)) envelopes[k] = 0;
      envelopes[k] = Math.max(0, Number(envelopes[k] || 0) + Number(v || 0) * direction);
    });
  }

  function renderEnvelopes() {
    const el = $('envelopes');
    if (!el) return;
    el.innerHTML = Object.entries(labels)
      .map(([k, l]) => `<div class="envelope"><span>${l}</span><strong>${money(envelopes[k])}</strong></div>`)
      .join('');
  }

  function renderPlan() {
    const salary = transactions.filter(t => t.type === 'income' && t.category === 'مرتب').reduce((s, t) => s + Number(t.amount || 0), 0);
    const lessons = transactions.filter(t => t.type === 'income' && t.category === 'دروس').reduce((s, t) => s + Number(t.amount || 0), 0);
    const fixed = fixedObligationsTotal();
    const c = cycle(new Date());
    const cycleSalary = transactions
      .filter(t => t.type === 'income' && t.category === 'مرتب' && inCycle(new Date(t.date), c))
      .reduce((s, t) => s + Number(t.amount || 0), 0);

    const msg = cycleSalary
      ? `المرتب المسجل للدورة: <b>${money(cycleSalary)}</b> — الالتزامات الشهرية: <b>${money(fixed)}</b>. التطبيق يحجز الالتزامات أولًا ثم يوزع المتبقي.`
      : `لم تسجل مرتب الدورة الحالية بعد. عند نزوله سجله كـ <b>مرتب</b> ليحسب لك الالتزامات والمتاح للتوزيع.`;

    const el = $('planSummary');
    if (el) {
      el.innerHTML = `<div class="plan-box">${msg}<div class="plan-stats"><span>إجمالي المرتب<br><b>${money(salary)}</b></span><span>إجمالي الدروس<br><b>${money(lessons)}</b></span></div></div>`;
    }
  }

  function renderGoals() {
    const el = $('goalsList');
    if (!el) return;
    if (!goals.length) {
      el.innerHTML = '<p class="empty">أضف أول هدف: سفر، شراء، خروجة…</p>';
      return;
    }
    el.innerHTML = goals.map(g => {
      const target = Number(g.target || 0);
      const saved = Number(g.saved || 0);
      const pct = target > 0 ? Math.min(100, (saved / target) * 100) : 0;
      return `<div class="goal"><div class="goal-top"><strong>${esc(g.name)}</strong><span>${money(saved)} / ${money(target)}</span></div><div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div><small>${pct.toFixed(0)}% مكتمل <button class="small-btn" onclick="deleteGoal('${g.id}')">حذف</button></small></div>`;
    }).join('');
  }

  function renderFixed() {
    const el = $('fixedExpensesList');
    if (!el) return;
    if (!fixedExpenses.length) {
      el.innerHTML = '<p class="empty">أضف مصروف البيت، العلاج، الكهرباء، الغاز، المياه، الإنترنت…</p>';
      return;
    }
    el.innerHTML = fixedExpenses.map(x => `<div class="fixed-row"><div><strong>${esc(x.name)}</strong><small>${x.priority === 'essential' ? '🔴 ضروري' : '🟠 مهم'}</small></div><strong>${money(x.amount)}</strong><button class="small-btn" onclick="deleteFixed('${x.id}')">حذف</button></div>`).join('');
  }

  function renderDashboard() {
    const c = cycle(new Date());
    let totalIncome = 0, totalExpense = 0, cycleIncome = 0, cycleExpense = 0;

    transactions.forEach(t => {
      const a = Number(t.amount || 0);
      if (t.type === 'income') {
        totalIncome += a;
        if (inCycle(new Date(t.date), c)) cycleIncome += a;
      } else {
        totalExpense += a;
        if (inCycle(new Date(t.date), c)) cycleExpense += a;
      }
    });

    const values = {
      balance: totalIncome - totalExpense,
      totalIncome,
      totalExpense,
      cycleIncome,
      cycleExpense
    };

    Object.entries(values).forEach(([id, value]) => {
      if ($(id)) $(id).textContent = money(value);
    });
    if ($('cycleTitle')) $('cycleTitle').textContent = `${fmtDate(c.start)} → ${fmtDate(c.end)}`;
  }

  function renderTransactions() {
    const el = $('transactionsList');
    if (!el) return;
    const c = cycle(new Date());
    let data = [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date));
    if (currentCycleOnly) data = data.filter(t => inCycle(new Date(t.date), c));

    if (!data.length) {
      el.innerHTML = '<p class="empty">لا توجد عمليات</p>';
      return;
    }

    el.innerHTML = data.map(t => `<div class="transaction"><div><strong>${esc(t.category)}</strong><div class="muted">${esc(t.note || 'بدون ملاحظة')} • ${fmtDate(t.date)}</div><div class="transaction-actions"><button onclick="editTransaction('${t.id}')">✏️ تعديل</button><button class="delete" onclick="deleteTransaction('${t.id}')">🗑️ حذف</button></div></div><strong class="${t.type === 'income' ? 'income' : 'expense'}">${t.type === 'income' ? '+' : '-'}${money(t.amount)}</strong></div>`).join('');
  }

  function renderInstallments() {
    const el = $('installmentsList');
    if (!el) return;
    if (!installments.length) {
      el.innerHTML = '<p class="empty">لا توجد أقساط مضافة</p>';
      return;
    }
    el.innerHTML = installments.map(i => {
      const remaining = Math.max(0, Number(i.total || 0) - Number(i.paid || 0));
      return `<div class="installment"><div class="installment-top"><strong>${esc(i.name)}</strong><strong>${money(i.amount)}</strong></div><div class="installment-meta">يستحق يوم ${i.day}<br>المدفوع: ${i.paid} من ${i.total} • المتبقي: ${remaining}<br>إجمالي المتبقي: ${money(remaining * Number(i.amount || 0))}</div>${remaining ? `<button class="pay-btn" onclick="payInstallment('${i.id}')">💳 سداد القسط القادم</button>` : '<div class="muted">✅ تم الانتهاء</div>'}<button class="small-btn" onclick="deleteInstallment('${i.id}')">حذف</button></div>`;
    }).join('');
  }

  function renderAll() {
    renderDashboard();
    renderPlan();
    renderEnvelopes();
    renderGoals();
    renderFixed();
    renderInstallments();
    renderTransactions();
  }

  function showForm(type, edit = null) {
    currentType = type;
    const category = $('category');
    const form = $('formSection');
    if (!category || !form) return;

    category.innerHTML = type === 'income'
      ? '<option>مرتب</option><option>دروس</option><option>دخل آخر</option>'
      : '<option>أكل</option><option>مواصلات</option><option>فواتير</option><option>أقساط</option><option>تسوق</option><option>ترفيه</option><option>أخرى</option>';

    form.classList.remove('hidden');
    $('formTitle').textContent = edit ? 'تعديل العملية' : (type === 'income' ? 'إضافة دخل' : 'إضافة مصروف');

    if (edit) {
      $('amount').value = edit.amount;
      category.value = edit.category;
      $('note').value = edit.note || '';
      $('transactionDate').value = dateInput(new Date(edit.date));
      form.dataset.editId = edit.id;
    } else {
      $('amount').value = '';
      $('note').value = '';
      $('transactionDate').value = dateInput(new Date());
      delete form.dataset.editId;
    }

    const updatePreview = () => {
      if (currentType === 'income') renderAllocation(Number($('amount').value), category.value);
    };
    $('amount').oninput = updatePreview;
    category.onchange = updatePreview;

    $('incomeAllocationBox').classList.toggle('hidden', type !== 'income');
    if (type === 'income') renderAllocation(Number($('amount').value), category.value);
    form.scrollIntoView({ behavior: 'smooth' });
  }

  function closeForm() {
    if ($('formSection')) $('formSection').classList.add('hidden');
  }

  function saveTransaction() {
    const amount = Number($('amount').value);
    const category = $('category').value;
    const note = $('note').value.trim();
    const dateValue = $('transactionDate').value;
    const form = $('formSection');

    if (amount <= 0 || !dateValue) return alert('أدخل المبلغ والتاريخ بشكل صحيح');

    const date = localDate(dateValue);
    const editId = form.dataset.editId;

    if (editId) {
      const index = transactions.findIndex(t => String(t.id) === String(editId));
      if (index >= 0) {
        const old = transactions[index];
        if (old.type === 'income' && old.allocation) addEnvelopeAllocation(old.allocation, -1);
        const updated = { ...old, amount, type: currentType, category, note, date: date.toISOString() };
        if (currentType === 'income') updated.allocation = allocationToApply(category, amount);
        else delete updated.allocation;
        transactions[index] = updated;
        if (updated.type === 'income') addEnvelopeAllocation(updated.allocation, 1);
      }
      showToast('تم تعديل العملية');
    } else {
      const transaction = { id: Date.now(), amount, type: currentType, category, note, date: date.toISOString() };
      if (currentType === 'income') {
        transaction.allocation = allocationToApply(category, amount);
        addEnvelopeAllocation(transaction.allocation, 1);
      }
      transactions.push(transaction);
      showToast(currentType === 'income' ? 'تم الحفظ وتوزيع الدخل على الأظرف' : 'تم حفظ المصروف');
    }

    saveAll();
    closeForm();
    renderAll();
  }

  function editTransaction(id) {
    const t = transactions.find(x => String(x.id) === String(id));
    if (t) showForm(t.type, t);
  }

  function deleteTransaction(id) {
    if (!confirm('حذف العملية؟')) return;
    const t = transactions.find(x => String(x.id) === String(id));
    if (t && t.type === 'income' && t.allocation) addEnvelopeAllocation(t.allocation, -1);
    transactions = transactions.filter(x => String(x.id) !== String(id));
    saveAll();
    renderAll();
    showToast('تم حذف العملية');
  }

  function showCurrentCycleOnly() {
    currentCycleOnly = !currentCycleOnly;
    renderTransactions();
  }

  function openGoalForm() {
    $('goalForm').classList.remove('hidden');
    $('goalForm').scrollIntoView({ behavior: 'smooth' });
  }

  function closeGoalForm() {
    $('goalForm').classList.add('hidden');
  }

  function saveGoal() {
    const name = $('goalName').value.trim();
    const target = Number($('goalTarget').value);
    if (!name || target <= 0) return alert('أدخل بيانات الهدف');
    goals.push({ id: Date.now(), name, target, saved: 0 });
    saveAll();
    closeGoalForm();
    $('goalName').value = '';
    $('goalTarget').value = '';
    renderGoals();
    showToast('تم إضافة الهدف');
  }

  function deleteGoal(id) {
    if (!confirm('حذف الهدف؟')) return;
    goals = goals.filter(g => String(g.id) !== String(id));
    saveAll();
    renderGoals();
  }

  function openFixedForm() {
    $('fixedForm').classList.remove('hidden');
    $('fixedForm').scrollIntoView({ behavior: 'smooth' });
  }

  function closeFixedForm() {
    $('fixedForm').classList.add('hidden');
  }

  function saveFixedExpense() {
    const name = $('fixedName').value.trim();
    const amount = Number($('fixedAmount').value);
    const priority = $('fixedPriority').value;
    if (!name || amount <= 0) return alert('أدخل بيانات الالتزام');
    fixedExpenses.push({ id: Date.now(), name, amount, priority });
    saveAll();
    closeFixedForm();
    $('fixedName').value = '';
    $('fixedAmount').value = '';
    renderAll();
    showToast('تم إضافة الالتزام');
  }

  function deleteFixed(id) {
    if (!confirm('حذف الالتزام؟')) return;
    fixedExpenses = fixedExpenses.filter(x => String(x.id) !== String(id));
    saveAll();
    renderAll();
  }

  function openInstallmentForm() {
    $('installmentForm').classList.remove('hidden');
    $('installmentForm').scrollIntoView({ behavior: 'smooth' });
  }

  function closeInstallmentForm() {
    $('installmentForm').classList.add('hidden');
  }

  function saveInstallment() {
    const name = $('installmentName').value.trim();
    const amount = Number($('installmentAmount').value);
    const day = Number($('installmentDay').value);
    const total = Number($('installmentTotal').value);
    const paid = Number($('installmentPaid').value);
    if (!name || amount <= 0 || day < 1 || day > 31 || total < 1 || paid < 0 || paid > total) return alert('راجع بيانات القسط');
    installments.push({ id: Date.now(), name, amount, day, total, paid });
    saveAll();
    closeInstallmentForm();
    renderAll();
    showToast('تمت إضافة القسط');
  }

  function payInstallment(id) {
    const installment = installments.find(x => String(x.id) === String(id));
    if (!installment || Number(installment.paid || 0) >= Number(installment.total || 0)) return;
    transactions.push({ id: Date.now(), amount: Number(installment.amount), type: 'expense', category: 'أقساط', note: `${installment.name} - القسط ${Number(installment.paid) + 1}`, date: new Date().toISOString() });
    installment.paid = Number(installment.paid || 0) + 1;
    saveAll();
    renderAll();
    showToast('تم تسجيل سداد القسط');
  }

  function deleteInstallment(id) {
    if (!confirm('حذف القسط؟')) return;
    installments = installments.filter(x => String(x.id) !== String(id));
    saveAll();
    renderAll();
  }

  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  function populateSettings() {
    const s = getSettings();
    if ($('cycleStartDay')) $('cycleStartDay').value = s.cycleStartDay;
    ['lesson', 'other'].forEach(group => {
      Object.keys(labels).forEach(k => {
        const input = $(group + cap(k));
        if (input) input.value = s[group][k];
      });
    });
  }

  function readGroup(prefix) {
    const result = {};
    Object.keys(labels).forEach(k => {
      result[k] = Number($(prefix + cap(k)).value) || 0;
    });
    return result;
  }

  function validGroup(group) {
    return Math.round(Object.values(group).reduce((a, b) => a + b, 0) * 100) / 100 === 100;
  }

  function openSettings() {
    populateSettings();
    $('settingsPanel').classList.remove('hidden');
    $('settingsPanel').scrollIntoView({ behavior: 'smooth' });
  }

  function closeSettings() {
    $('settingsPanel').classList.add('hidden');
  }

  function saveSettings() {
    const day = Number($('cycleStartDay').value);
    const lesson = readGroup('lesson');
    const other = readGroup('other');
    if (day < 1 || day > 31) return alert('اختر يومًا من 1 إلى 31');
    if (!validGroup(lesson) || !validGroup(other)) return alert('كل مجموعة نسب يجب أن يكون مجموعها 100%');
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ cycleStartDay: day, lesson, other }));
    closeSettings();
    renderAll();
    showToast('تم حفظ الإعدادات');
  }

  function showToast(message) {
    const toast = $('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(window.toastTimer);
    window.toastTimer = setTimeout(() => toast.classList.remove('show'), 2000);
  }

  // إتاحة الدوال للأزرار الموجودة في HTML
  Object.assign(window, {
    showForm, closeForm, saveTransaction, editTransaction, deleteTransaction, showCurrentCycleOnly,
    openGoalForm, closeGoalForm, saveGoal, deleteGoal,
    openFixedForm, closeFixedForm, saveFixedExpense, deleteFixed,
    openInstallmentForm, closeInstallmentForm, saveInstallment, payInstallment, deleteInstallment,
    openSettings, closeSettings, saveSettings
  });

  document.addEventListener('DOMContentLoaded', load);
})();
