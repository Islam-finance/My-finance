// ================================
// حساباتي - نظام التخزين المحلي
// ================================

let transactions = [];

let currentType = "income";


// ================================
// تحميل البيانات المحفوظة
// ================================

function loadTransactions() {

    const savedData = localStorage.getItem("myFinanceTransactions");

    if (savedData) {
        transactions = JSON.parse(savedData);
    }

    updateDashboard();
    displayTransactions();
}


// ================================
// حفظ البيانات على الجهاز
// ================================

function saveTransactions() {

    localStorage.setItem(
        "myFinanceTransactions",
        JSON.stringify(transactions)
    );
}


// ================================
// إظهار نموذج الدخل أو المصروف
// ================================

function showForm(type) {

    currentType = type;

    const form = document.getElementById("formSection");
    const title = document.getElementById("formTitle");
    const category = document.getElementById("category");

    form.classList.remove("hidden");

    if (type === "income") {

        title.textContent = "إضافة دخل";

        category.innerHTML = `
            <option value="مرتب">مرتب</option>
            <option value="دروس">دروس</option>
            <option value="دخل آخر">دخل آخر</option>
        `;

    } else {

        title.textContent = "إضافة مصروف";

        category.innerHTML = `
            <option value="أكل">أكل</option>
            <option value="مواصلات">مواصلات</option>
            <option value="فواتير">فواتير</option>
            <option value="أقساط">أقساط</option>
            <option value="تسوق">تسوق</option>
            <option value="ترفيه">ترفيه</option>
            <option value="أخرى">أخرى</option>
        `;
    }
}


// ================================
// إضافة عملية جديدة
// ================================

function saveTransaction() {

    const amountInput = document.getElementById("amount");
    const category = document.getElementById("category").value;
    const note = document.getElementById("note").value;

    const amount = Number(amountInput.value);

    if (!amount || amount <= 0) {

        alert("من فضلك أدخل مبلغ صحيح");

        return;
    }


    const transaction = {

        id: Date.now(),

        amount: amount,

        type: currentType,

        category: category,

        note: note,

        date: new Date().toISOString()

    };


    transactions.push(transaction);


    // حفظ البيانات على الجهاز
    saveTransactions();


    // تنظيف الحقول
    amountInput.value = "";

    document.getElementById("note").value = "";


    // تحديث الشاشة
    updateDashboard();

    displayTransactions();
}


// ================================
// حساب إجمالي الدخل والمصروفات
// ================================

function updateDashboard() {

    let income = 0;

    let expense = 0;


    transactions.forEach(transaction => {

        if (transaction.type === "income") {

            income += transaction.amount;

        } else {

            expense += transaction.amount;

        }

    });


    const balance = income - expense;


    document.getElementById("totalIncome").textContent =
        income.toLocaleString("ar-EG") + " ج.م";


    document.getElementById("totalExpense").textContent =
        expense.toLocaleString("ar-EG") + " ج.م";


    document.getElementById("balance").textContent =
        balance.toLocaleString("ar-EG") + " ج.م";
}


// ================================
// عرض العمليات
// ================================

function displayTransactions() {

    const list = document.getElementById("transactionsList");


    if (transactions.length === 0) {

        list.innerHTML =
            `<p class="empty">لا توجد عمليات حتى الآن</p>`;

        return;
    }


    list.innerHTML = "";


    transactions
        .slice()
        .reverse()
        .forEach(transaction => {


            const div = document.createElement("div");

            div.className = "transaction";


            const sign =
                transaction.type === "income"
                    ? "+"
                    : "-";


            const className =
                transaction.type === "income"
                    ? "transaction-income"
                    : "transaction-expense";


            const date =
                new Date(transaction.date)
                    .toLocaleDateString("ar-EG");


            div.innerHTML = `

                <div>

                    <strong>
                        ${transaction.category}
                    </strong>

                    <br>

                    <small>
                        ${transaction.note || ""}
                    </small>

                    <br>

                    <small>
                        ${date}
                    </small>

                </div>


                <div class="${className}">

                    ${sign}
                    ${transaction.amount.toLocaleString("ar-EG")}
                    ج.م

                </div>

            `;


            list.appendChild(div);

        });
}


// ================================
// تشغيل التطبيق
// ================================

loadTransactions();