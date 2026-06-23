let chartInstance = null;
let currentCalendarDate = new Date();

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('txDate').valueAsDate = new Date();
    
    // AMBIL MODAL AWAL DARI STORAGE SAAT PERTAMA KALI WEB DIBUKA
    const savedCapital = localStorage.getItem('rizx_hub_capital');
    if (savedCapital !== null) {
        document.getElementById('txCapital').value = savedCapital;
    } else {
        document.getElementById('txCapital').value = 10000; // Default jika baru pertama pakai
    }

    // SIMPAN MODAL SECARA OTOMATIS SAAT USER MENGETIK PERUBAHAN
    document.getElementById('txCapital').addEventListener('input', (e) => {
        localStorage.setItem('rizx_hub_capital', e.target.value);
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
        pips = (exitPrice - entryPrice) * 10;
    } else if (pair === "US100") {
        pips = (exitPrice - entryPrice);
    } else {
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

    document.getElementById('txLot').value = '';
    document.getElementById('txPriceEntry').value = '';
    document.getElementById('txPriceExit').value = '';
});

btnClearDatabase.addEventListener('click', () => {
    if (confirm('Kosongkan seluruh database jurnal trading secara permanen?')) {
        localStorage.removeItem('rizx_hub_data');
        localStorage.removeItem('rizx_hub_capital'); // Ikut bersihkan data modal
        document.getElementById('txCapital').value = 10000;
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
    const initialCapital = parseFloat(document.getElementById('txCapital').value) || 0;
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

    // Perhitungan PnL uang berdasarkan Pip & Lot ($10 per lot per pip standar)
    const totalPnLMoney = data.reduce((acc, current) => acc + (parseFloat(current.pips) * parseFloat(current.lot) * 10), 0);
    const currentBalance = initialCapital + totalPnLMoney;

    document.getElementById('mxWinRate').innerText = `${winRate}%`;
    document.getElementById('mxTotal').innerText = total;
    
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
            <td style="color: var(--text-muted); font-size:12px;">${row.entry} &rarr; ${row.exit}</td>
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

function renderCalendar(data) {
    const calendarGrid = document.getElementById('calendarGrid');
    const monthYearLabel = document.getElementById('calendarMonthYear');
    
    calendarGrid.innerHTML = '';
    
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();
    
    const firstDayIndex = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();
    
    const monthNames = ["Januari", "Februari", "Maret", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
    monthYearLabel.innerText = `${monthNames[month]} ${year}`;
    
    for (let i = 0; i < firstDayIndex; i++) {
        const emptyDiv = document.createElement('div');
        emptyDiv.classList.add('calendar-day', 'empty');
        calendarGrid.appendChild(emptyDiv);
    }
    
    for (let day = 1; day <= totalDays; day++) {
        const dayDiv = document.createElement('div');
        dayDiv.classList.add('calendar-day');
        
        const currentStringDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
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
        
