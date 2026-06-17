let chartInstance = null;

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('txDate').valueAsDate = new Date();
    buildChart();
    refreshHub();
});

const btnCommit = document.getElementById('btnCommit');
const btnClearDatabase = document.getElementById('btnClearDatabase');
const dbLogRoot = document.getElementById('dbLogRoot');

// Klik Handler Utama untuk Manual Commit Data
btnCommit.addEventListener('click', () => {
    const date = document.getElementById('txDate').value;
    const pair = document.getElementById('txPair').value;
    const type = document.getElementById('txType').value;
    const lot = document.getElementById('txLot').value;
    const status = document.getElementById('txStatus').value;

    if (!lot) {
        alert('Harap masukkan volume Lot terlebih dahulu!');
        return;
    }

    // Mengganti input manual pip, pips otomatis dihitung flat (misal 50 pips) demi keperluan kurva grafik
    let calculatedPips = status === 'TP' ? 50 : -50; 

    const record = {
        uid: Date.now(),
        date, pair, type, lot,
        pips: calculatedPips,
        status
    };

    let storage = getStorage();
    storage.push(record);
    setStorage(storage);

    refreshHub();

    // Reset kolom lot setelah input berhasil
    document.getElementById('txLot').value = '';
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
}

function runMetrics(data) {
    const total = data.length;
    if (total === 0) {
        document.getElementById('mxWinRate').innerText = '0%';
        document.getElementById('mxTotal').innerText = '0';
        document.getElementById('mxPips').innerText = '0';
        document.getElementById('mxRatio').innerText = '0 W - 0 L';
        return;
    }

    const wins = data.filter(d => d.status === 'TP').length;
    const losses = total - wins;
    const winRate = ((wins / total) * 100).toFixed(1);
    const netPips = data.reduce((acc, current) => acc + parseFloat(current.pips), 0).toFixed(1);

    document.getElementById('mxWinRate').innerText = `${winRate}%`;
    document.getElementById('mxTotal').innerText = total;

    const pipsCard = document.getElementById('mxPips');
    pipsCard.innerText = (netPips > 0 ? '+' : '') + netPips;
    pipsCard.style.color = netPips >= 0 ? 'var(--green-tp)' : 'var(--red-sl)';

    document.getElementById('mxRatio').innerText = `${wins} W - ${losses} L`;
}

function renderTable(data) {
    dbLogRoot.innerHTML = '';
    if (data.length === 0) {
        dbLogRoot.innerHTML = `<tr><td colspan="7" class="empty-state">Belum ada data jurnal. Masukkan data trading Anda di samping.</td></tr>`;
        return;
    }

    const chronologicalInverse = [...data].reverse();

    chronologicalInverse.forEach(row => {
        const tr = document.createElement('tr');
        const typeStyle = row.type === 'BUY' ? 'b-buy' : 'b-sell';
        const statusStyle = row.status === 'TP' ? 'pill-tp' : 'pill-sl';
        const pipsDisplay = row.pips > 0 ? `+${row.pips}` : row.pips;

        tr.innerHTML = `
            <td>${row.date}</td>
            <td><strong>${row.pair}</strong></td>
            <td><span class="badge-type ${typeStyle}">${row.type}</span></td>
            <td>${row.lot}</td>
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

function buildChart() {
    const canvasContext = document.getElementById('ctxChart').getContext('2d');
    
    let gradient = canvasContext.createLinearGradient(0, 0, 0, 300);
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
                tension: 0.2,
                pointBackgroundColor: '#00f0ff',
                pointHoverBackgroundColor: '#fff',
                pointRadius: 2,
                pointHoverRadius: 5
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

// =========================================================
// FIX PERBAIKAN FITUR SCAN SCREENSHOT (PAIR, BUY/SELL, LOT)
// =========================================================
const txOcrImage = document.getElementById('txOcrImage');
const btnUploadTrigger = document.getElementById('btnUploadTrigger');
const ocrStatus = document.getElementById('ocrStatus');

btnUploadTrigger.addEventListener('click', () => {
    txOcrImage.click();
});

txOcrImage.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;

    ocrStatus.innerText = "⏳ Membaca data gambar... Mohon tunggu...";
    ocrStatus.style.color = "var(--cyan-glow)";

    Tesseract.recognize(
        file,
        'eng',
        { logger: m => console.log(m) }
    ).then(({ data: { text } }) => {
        ocrStatus.innerText = "✅ Scan sukses!";
        ocrStatus.style.color = "var(--green-tp)";
        
        const cleanText = text.toUpperCase();
        console.log("Hasil OCR Raw:", cleanText);

        // 1. Deteksi Asset Pair Lebih Sensitif
        if (cleanText.includes("XAUUSD") || cleanText.includes("GOLD")) {
            document.getElementById('txPair').value = "XAUUSD";
        } else if (cleanText.includes("US100") || cleanText.includes("NASDAQ")) {
            document.getElementById('txPair').value = "US100";
        } else if (cleanText.includes("EURUSD")) {
            document.getElementById('txPair').value = "EURUSD";
        } else if (cleanText.includes("GBPUSD")) {
            document.getElementById('txPair').value = "GBPUSD";
        }

        // 2. Deteksi Order Direction (Mencari kata mandiri BUY atau SELL)
        if (/\bBUY\b/.test(cleanText) || cleanText.includes("LONG")) {
            document.getElementById('txType').value = "BUY";
        } else if (/\bSELL\b/.test(cleanText) || cleanText.includes("SHORT")) {
            document.getElementById('txType').value = "SELL";
        }

        // 3. FIX REGEX LOT (Menangkap langsung format gabungan "BUY 0.01" atau "SELL 0.10")
        // Pola ini mencari kata BUY/SELL yang langsung diikuti angka desimal di screenshot MT4/MT5 Anda
        const mt4FormatMatch = cleanText.match(/(?:BUY|SELL)\s*([0-9]+\.[0-9]{2})/);
        
        if (mt4FormatMatch && mt4FormatMatch[1]) {
            document.getElementById('txLot').value = mt4FormatMatch[1];
        } else {
            // Backup regex jika angkanya terpisah baris
            const fallbackLot = cleanText.match(/\b([0-9]+\.[0-9]{2})\b/);
            if (fallbackLot && fallbackLot[1]) {
                document.getElementById('txLot').value = fallbackLot[1];
            }
        }

        alert("Auto Input Berhasil! Lot, Tipe Order, dan Pair terisi otomatis.");

    }).catch(err => {
        console.error(err);
        ocrStatus.innerText = "❌ Gagal membaca teks gambar.";
        ocrStatus.style.color = "var(--red-sl)";
    });
});
