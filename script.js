let chartInstance = null;
let currentCalendarDate = new Date();

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('txDate').valueAsDate = new Date();
    
    // Sinkronisasi Modal Awal jika diubah manual
    document.getElementById('txCapital').addEventListener('input', () => {
        refreshHub();
    });

    buildChart();
    refreshHub();
});

const btnCommit = document.getElementById('btnCommit');
const btnClearDatabase = document.getElementById('btnClearDatabase');
const dbLogRoot = document.getElementById('dbLogRoot');

// PIPS COMPUTATION LOGIC ENGINE
function calculatePips(pair, type, entry, exit) {
    let pips = 0;
    const entryPrice = parseFloat(entry);
    const exitPrice = parseFloat(exit);
    
    if (isNaN(entryPrice) || isNaN(exitPrice)) return 0;

    if (pair === "XAUUSD") {
        // Gold: 1 Point pergerakan penuh (misal 2300.00 ke 2301.00 = 10 pips / 1 point)
        pips = (exitPrice - entryPrice) * 10;
    } else if (pair === "US100") {
        // Indices / Nasdaq: Perhitungan point mutlak
        pips = (exitPrice - entryPrice);
    } else {
        // Forex standar (EURUSD/GBPUSD): Pip berada di desimal ke-4 (0.0001)
        pips = (exitPrice - entryPrice) * 10000;
    }

    return type === "BUY" ? parseFloat(pips.toFixed(1)) : parseFloat((-pips).toFixed(1));
}

btnCommit.addEventListener('click', () => {
    const date = document.getElementById('txDate').value;
    const pair = document.getElementById('txPair').value;
    const type = document.getElementById('txType').value;
    const lot = document.getElementById('txLot').value;
    const entry = document.getElementById('txPriceEntry').value;
    const exit = document.getElementById('txPriceExit').value;
    const status = document.getElementById('txStatus').value;

    if (!lot || !entry || !exit) {
        alert('Harap isi Lot, Entry Price, dan Exit Price!');
        return;
    }

    // Auto Hitung Pips murni dari pergerakan harga masuk/keluar
    const netPips = calculatePips(pair, type, entry, exit);

    const record = {
        uid: Date.now(),
        date, pair, type, lot, entry, exit, status,
        pips: netPips
    };

    let storage = getStorage();
    storage.push(record);
    setStorage(storage);

    refreshHub();

    // Reset Form Input
    document.getElementById('txLot').value = '';
    document.getElementById('txPriceEntry').value = '';
    document.getElementById('txPriceExit').value = '';
});

btnClearDatabase.addEventListener('click', () => {
    if (confirm('Kosongkan seluruh database jurnal trading secara permanen?')) {
        localStorage.removeItem('rizx_hub_data');
        refreshHub();
    }
});

function getStorage() {
    return localStorage.getItem('rizx_hub_data') ? JSON.parse(localStorage.getItem('rizx_hub_data')) : [];
}

function setStorage(data) {
    localStorage.setItem('rizx_hub_data', JSON.stringify(data));
}

function refreshHub() {
    const data = getStorage();
    data.sort((a, b) => new Date(a.date) - new Date(b.date));

    renderTable(data);
    runMetrics(data);
    renderChartCurve(data);
    renderCalendar(data);
}

function runMetrics(data) {
    const initialCapital = parseFloat(document.getElementById('txCapital').value) || 10000;
    const total = data.length;
    
    if (total === 0) {
        document.getElementById('mxWinRate').innerText = '0%';
        document.getElementById('mxTotal').innerText = '0';
        document.getElementById('mxNetPips').innerText = '0.0';
        document.getElementById('mxNetPips').style.color = '#fff';
        document.getElementById('mxCurrentBalance').innerText = `$${initialCapital.toLocaleString()}`;
        document.getElementById('mxRatio').innerText = '0 W - 0 L';
        return;
    }

    const wins = data.filter(d => d.status === 'TP').length;
    const losses = total - wins;
    const winRate = ((wins / total) * 100).toFixed(1);
    const netPips = data.reduce((acc, current) => acc + parseFloat(current.pips), 0);

    // Simulasi Saldo Akun (Asumsi simpel: 1 Pip senilai $1 per Lot standar, bisa disesuaikan rumus leverage)
    const totalPnLMoney = data.reduce((acc, current) => acc + (parseFloat(current.pips) * parseFloat(current.lot) * 10), 0);
    const currentBalance = initialCapital + totalPnLMoney;

    document.getElementById('mxWinRate').innerText = `${winRate}%`;
    document.getElementById('mxTotal').innerText = total;
    
    // Panel Finansial (Kiri Atas)
    const pipsPanel = document.getElementById('mxNetPips');
    pipsPanel.innerText = (netPips >= 0 ? '+' : '') + netPips.toFixed(1);
    pipsPanel.style.color = netPips >= 0 ? 'var(--green-tp)' : 'var(--red-sl)';
    
    document.getElementById('mxCurrentBalance').innerText = `$${currentBalance.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    document.getElementById('mxRatio').innerText = `${wins} W - ${losses} L`;
}

function renderTable(data) {
    dbLogRoot.innerHTML = '';
    if (data.length === 0) {
        dbLogRoot.innerHTML = `<tr><td colspan="8" class="empty-state">Belum ada data jurnal. Masukkan data posisi Anda.</td></tr>`;
        return;
    }

    const chronologicalInverse = [...data].reverse();

    chronologicalInverse.forEach(row => {
        const tr = document.createElement('tr');
        const typeStyle = row.type === 'BUY' ? 'b-buy' : 'b-sell';
        const statusStyle = row.status === 'TP' ? 'pill-tp' : 'pill-sl';
        const pipsDisplay = row.pips >= 0 ? `+${row.pips}` : row.pips;

        tr.innerHTML = `
            <td>${row.date}</td>
            <td><strong>${row.pair}</strong></td>
            <td><span class="badge-type ${typeStyle}">${row.type}</span></td>
            <td>${row.lot}</td>
            <td style="color: var(--text-muted); font-size:12px;">${row.entry} $\rightarrow$ ${row.exit}</td>
            <td style="font-weight: 600; color: ${row.pips >= 0 ? 'var(--green-tp)' : 'var(--red-sl)'}">${pipsDisplay}</td>
            <td><span class="status-pill ${statusStyle}">${row.status}</span></td>
            <td><button class="btn-action-del" onclick="purgeRecord(${row.uid})">🗑️</button></td>
        `;
        dbLogRoot.appendChild(tr);
    });
}

window.purgeRecord = function(uid) {
    let currentData = getStorage();
    currentData = currentData.filter(d => d.uid !== uid);
    setStorage(currentData);
    refreshHub();
}

// CALENDAR SYSTEM IMPLEMENTATION
function renderCalendar(data) {
    const calendarGrid = document.getElementById('calendarGrid');
    const monthYearLabel = document.getElementById('calendarMonthYear');
    
    calendarGrid.innerHTML = '';
    
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();
    
    const firstDayIndex = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();
    
    const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
    monthYearLabel.innerText = `${monthNames[month]} ${year}`;
    
    // Slot Kosong Bulan Sebelumnya
    for (let i = 0; i < firstDayIndex; i++) {
        const emptyDiv = document.createElement('div');
        emptyDiv.classList.add('calendar-day', 'empty');
        calendarGrid.appendChild(emptyDiv);
    }
    
    // Cetak Hari Aktif Bulanan
    for (let day = 1; day <= totalDays; day++) {
        const dayDiv = document.createElement('div');
        dayDiv.classList.add('calendar-day');
        
        // Format tanggal YYYY-MM-DD lokal untuk dicocokkan ke database
        const currentStringDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        
        // Hitung akumulasi pips di hari tersebut
        const dailyTrades = data.filter(t => t.date === currentStringDate);
        let dailyPipsSum = 0;
        
        if (dailyTrades.length > 0) {
            dailyPipsSum = dailyTrades.reduce((acc, cur) => acc + parseFloat(cur.pips), 0);
            dayDiv.classList.add(dailyPipsSum >= 0 ? 'p-win' : 'p-loss');
        }
        
        dayDiv.innerHTML = `
            <span class="day-num">${day}</span>
            <span class="day-pips">${dailyTrades.length > 0 ? (dailyPipsSum >= 0 ? '+' : '') + dailyPipsSum.toFixed(1) : ''}</span>
        `;
        
        calendarGrid.appendChild(dayDiv);
    }
}

document.getElementById('btnPrevMonth').addEventListener('click', () => {
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
    refreshHub();
});

document.getElementById('btnNextMonth').addEventListener('click', () => {
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
    refreshHub();
});

// CHART BUILD ENGINE
function buildChart() {
    const canvasContext = document.getElementById('ctxChart').getContext('2d');
    let gradient = canvasContext.createLinearGradient(0, 0, 0, 240);
    gradient.addColorStop(0, 'rgba(0, 240, 255, 0.15)');
    gradient.addColorStop(1, 'rgba(0, 240, 255, 0.0)');

    chartInstance = new Chart(canvasContext, {
        type: 'line',
        data: {
            labels: ['Origin'],
            datasets: [{
                data: [0],
                borderColor: '#00f0ff',
                backgroundColor: gradient,
                borderWidth: 3,
                fill: true,
                tension: 0.15,
                pointRadius: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { grid: { color: '#171b2f' }, ticks: { color: '#6b7a99', font: { size: 10 } } },
                y: { grid: { color: '#171b2f' }, ticks: { color: '#6b7a99', font: { size: 10 } } }
            },
            plugins: { legend: { display: false } }
        }
    });
}

function renderChartCurve(data) {
    if (!chartInstance) return;
    let axisLabels = ['Origin'];
    let absolutePoints = [0];
    let runningPipsSum = 0;

    data.forEach((item, index) => {
        runningPipsSum += parseFloat(item.pips);
        axisLabels.push(`#${index + 1}`);
        absolutePoints.push(runningPipsSum);
    });

    chartInstance.data.labels = axisLabels;
    chartInstance.data.datasets[0].data = absolutePoints;
    chartInstance.update();
}

// ==========================================
// SCAN SCREENSHOT (AUTO DETECT ENTRY & EXIT)
// ==========================================
const txOcrImage = document.getElementById('txOcrImage');
const btnUploadTrigger = document.getElementById('btnUploadTrigger');
const ocrStatus = document.getElementById('ocrStatus');

btnUploadTrigger.addEventListener('click', () => txOcrImage.click());

txOcrImage.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;

    ocrStatus.innerText = "⏳ Membaca data screenshot...";
    ocrStatus.style.color = "var(--cyan-glow)";

    Tesseract.recognize(file, 'eng').then(({ data: { text } }) => {
        ocrStatus.innerText = "✅ Scan sukses!";
        ocrStatus.style.color = "var(--green-tp)";
        
        const cleanText = text.toUpperCase();
        console.log("OCR Result:", cleanText);

        // 1. Deteksi Pair
        if (cleanText.includes("XAUUSD") || cleanText.includes("GOLD")) document.getElementById('txPair').value = "XAUUSD";
        else if (cleanText.includes("US100") || cleanText.includes("NASDAQ")) document.getElementById('txPair').value = "US100";
        else if (cleanText.includes("EURUSD")) document.getElementById('txPair').value = "EURUSD";
        else if (cleanText.includes("GBPUSD")) document.getElementById('txPair').value = "GBPUSD";

        // 2. Deteksi Arah Order
        if (/\bBUY\b/.test(cleanText)) document.getElementById('txType').value = "BUY";
        else if (/\bSELL\b/.test(cleanText)) document.getElementById('txType').value = "SELL";

        // 3. Deteksi Lot
        const lotMatch = cleanText.match(/(?:BUY|SELL)\s*([0-9]+\.[0-9]{2})/);
        if (lotMatch && lotMatch[1]) document.getElementById('txLot').value = lotMatch[1];

        // 4. Deteksi Harga Entry & Exit otomatis dari riwayat MT4/MT5
        // Pola mendeteksi dua deret angka berdekatan (misal: 30148.80 -> 30139.25 atau berurutan)
        const priceMatches = cleanText.match(/\b([0-9]{4,5}\.[0-9]{2})\b/g);
        if (priceMatches && priceMatches.length >= 2) {
            document.getElementById('txPriceEntry').value = priceMatches[0];
            document.getElementById('txPriceExit').value = priceMatches[1];
        }

        alert("Auto Input Berhasil! Silakan periksa harga entry & exit.");
    }).catch(err => {
        ocrStatus.innerText = "❌ Gagal membaca gambar.";
        ocrStatus.style.color = "var(--red-sl)";
    });
});
