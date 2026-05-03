// ==========================================
// 1. GLOBALS & INITIALIZATION
// ==========================================
let currentLat = 30.9010; // Default to Punjab, India
let currentLon = 75.8573;
let currentElevation = 0;
let exportDataPayload = {}; // Stores all fetched data for dev export

// Initialize Map
const map = L.map('map').setView([currentLat, currentLon], 10);
const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution: 'Tiles &copy; Esri' });
const darkTerrainLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { attribution: '&copy; CARTO' });
satelliteLayer.addTo(map);
L.control.layers({ "High-Res Satellite": satelliteLayer, "Dark Terrain Map": darkTerrainLayer }).addTo(map);
let farmMarker = L.marker([currentLat, currentLon]).addTo(map);

// Initialize Charts
Chart.defaults.color = '#9fb3aa';
Chart.defaults.font.family = "'Inter', sans-serif";

const ctxClimate = document.getElementById('climateChart').getContext('2d');
let climateChart = new Chart(ctxClimate, {
    type: 'bar', data: { labels: [], datasets: [] },
    options: {
        responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
        plugins: { tooltip: { backgroundColor: 'rgba(22, 33, 28, 0.9)', padding: 12 }, legend: { position: 'top' } },
        scales: {
            x: { grid: { color: 'rgba(255, 255, 255, 0.05)' } },
            y: { type: 'linear', display: true, position: 'left', title: { display: true, text: 'Rainfall (mm)' }, grid: { color: 'rgba(255, 255, 255, 0.05)' } },
            y1: { type: 'linear', display: true, position: 'right', title: { display: true, text: 'Temp (°C)' }, grid: { drawOnChartArea: false } }
        }
    }
});

const ctxMarket = document.getElementById('marketChart').getContext('2d');
let marketChart = new Chart(ctxMarket, {
    type: 'line', data: { labels: [], datasets: [] },
    options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
            x: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { maxTicksLimit: 12 } },
            y: { title: { display: true, text: 'Price Index' }, grid: { color: 'rgba(255, 255, 255, 0.05)' } }
        }
    }
});

const ctxHydro = document.getElementById('hydroChart').getContext('2d');
let hydroChart = new Chart(ctxHydro, {
    type: 'line', data: { labels: [], datasets: [] },
    options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { tooltip: { backgroundColor: 'rgba(22, 33, 28, 0.9)' } },
        scales: {
            x: { grid: { display: false }, ticks: { maxTicksLimit: 12 } },
            y: { title: { display: true, text: 'Water (mm)' }, grid: { color: 'rgba(255, 255, 255, 0.05)' } }
        }
    }
});

const ctxErosion = document.getElementById('erosionChart').getContext('2d');
let erosionChart = new Chart(ctxErosion, {
    type: 'bar', data: { labels: [], datasets: [] },
    options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
            x: { grid: { display: false }, ticks: { maxTicksLimit: 12 } },
            y: { title: { display: true, text: 'Erosion Risk Index' }, grid: { color: 'rgba(255, 255, 255, 0.05)' } }
        }
    }
});

// ==========================================
// 2. MODAL LOGIC
// ==========================================
function toggleModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal.classList.contains('active')) {
        modal.classList.remove('active');
        setTimeout(() => modal.style.display = 'none', 300);
    } else {
        modal.style.display = 'flex';
        setTimeout(() => modal.classList.add('active'), 10);
    }
}
function closeModal(event) { if (event.target.id === 'guideModal') toggleModal('guideModal'); }

// ==========================================
// 3. GEOCODING SEARCH
// ==========================================
async function searchLocation() {
    const query = document.getElementById('locationSearch').value.trim();
    if (!query) return;

    // Check if it's lat/lon "25.9, 85.6"
    const coordsMatch = query.match(/^(-?\d+(\.\d+)?)[,\s]+(-?\d+(\.\d+)?)$/);
    if (coordsMatch) {
        updateMapLocation(parseFloat(coordsMatch[1]), parseFloat(coordsMatch[3]));
        return;
    }

    // Geocoding via Nominatim
    document.getElementById('coordsDisplay').innerText = "Searching...";
    try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`;
        const res = await fetch(url, { headers: { "User-Agent": "AgriWaterOS/1.0" } });
        const data = await res.json();

        if (data && data.length > 0) {
            updateMapLocation(parseFloat(data[0].lat), parseFloat(data[0].lon));
        } else {
            alert("Location not found. Try a different city or region.");
            document.getElementById('coordsDisplay').innerText = `${currentLat.toFixed(4)}° N, ${currentLon.toFixed(4)}° E`;
        }
    } catch (e) {
        alert("Search failed. Check your connection.");
    }
}

function updateMapLocation(lat, lon) {
    currentLat = lat;
    currentLon = lon;
    map.setView([lat, lon], 10);
    farmMarker.setLatLng([lat, lon]);
    runAnalysis();
}

map.on('click', function (e) { updateMapLocation(e.latlng.lat, e.latlng.lng); });

// ==========================================
// 4. KNN MACHINE LEARNING ENGINE
// ==========================================
class CropKNN {
    constructor() {
        this.dataset = [];
        this.datasetLoaded = false;

        Papa.parse("Crop_recommendation.csv", {
            download: true,
            header: true,
            dynamicTyping: true,
            complete: (results) => {
                this.dataset = results.data.filter(row => row.label);
                this.datasetLoaded = true;
                this.mins = {
                    N: Math.min(...this.dataset.map(d => d.N)), P: Math.min(...this.dataset.map(d => d.P)), K: Math.min(...this.dataset.map(d => d.K)),
                    T: Math.min(...this.dataset.map(d => d.temperature)), H: Math.min(...this.dataset.map(d => d.humidity)),
                    pH: Math.min(...this.dataset.map(d => d.ph)), R: Math.min(...this.dataset.map(d => d.rainfall))
                };
                this.maxs = {
                    N: Math.max(...this.dataset.map(d => d.N)), P: Math.max(...this.dataset.map(d => d.P)), K: Math.max(...this.dataset.map(d => d.K)),
                    T: Math.max(...this.dataset.map(d => d.temperature)), H: Math.max(...this.dataset.map(d => d.humidity)),
                    pH: Math.max(...this.dataset.map(d => d.ph)), R: Math.max(...this.dataset.map(d => d.rainfall))
                };
            }
        });
    }

    normalize(val, min, max) { return (max === min) ? 0 : (val - min) / (max - min); }

    predict(inputN, inputP, inputK, inputTemp, inputHumidity, inputPH, inputRain) {
        if (!this.datasetLoaded || this.dataset.length === 0) return [{ name: "Loading Kaggle Dataset...", confidence: 0 }];

        let nN = this.normalize(inputN, this.mins.N, this.maxs.N);
        let nP = this.normalize(inputP, this.mins.P, this.maxs.P);
        let nK = this.normalize(inputK, this.mins.K, this.maxs.K);
        let nT = this.normalize(inputTemp, this.mins.T, this.maxs.T);
        let nH = this.normalize(inputHumidity, this.mins.H, this.maxs.H);
        let nPH = this.normalize(inputPH, this.mins.pH, this.maxs.pH);
        let nR = this.normalize(inputRain, this.mins.R, this.maxs.R);

        let cropMap = {};
        this.dataset.forEach(row => {
            let d = Math.pow(nN - this.normalize(row.N, this.mins.N, this.maxs.N), 2) +
                Math.pow(nP - this.normalize(row.P, this.mins.P, this.maxs.P), 2) +
                Math.pow(nK - this.normalize(row.K, this.mins.K, this.maxs.K), 2) +
                Math.pow(nT - this.normalize(row.temperature, this.mins.T, this.maxs.T), 2) +
                Math.pow(nH - this.normalize(row.humidity, this.mins.H, this.maxs.H), 2) +
                Math.pow(nPH - this.normalize(row.ph, this.mins.pH, this.maxs.pH), 2) +
                Math.pow(nR - this.normalize(row.rainfall, this.mins.R, this.maxs.R), 2);
            let distance = Math.sqrt(d);

            if (!cropMap[row.label]) cropMap[row.label] = [];
            cropMap[row.label].push(distance);
        });

        let results = [];
        for (let crop in cropMap) {
            let minDistance = Math.min(...cropMap[crop]);
            let confidence = Math.max(0, (1 - (minDistance / 1.5))) * 100;
            results.push({ name: crop.charAt(0).toUpperCase() + crop.slice(1), confidence: confidence });
        }

        results.sort((a, b) => b.confidence - a.confidence);
        return results.slice(0, 3);
    }
}
const mlEngine = new CropKNN();

// ==========================================
// 5. CORE LOGIC & DATA FETCHING
// ==========================================
setTimeout(runAnalysis, 500);

async function runAnalysis() {
    document.getElementById('coordsDisplay').innerText = `${currentLat.toFixed(4)}° N, ${currentLon.toFixed(4)}° E`;

    try {
        const liveData = await fetchRealTimeAndForecast();
        const histData = await fetchHistoricalClimate();

        exportDataPayload = { location: { lat: currentLat, lon: currentLon }, live: liveData, historical: histData };

        executeGeochemistryAndML(liveData, histData);

    } catch (error) {
        console.error("Error during analysis:", error);
    }
}

async function fetchRealTimeAndForecast() {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${currentLat}&longitude=${currentLon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,shortwave_radiation,surface_temperature,precipitation&hourly=precipitation,et0_fao_evapotranspiration,soil_moisture_0_to_7cm,soil_moisture_7_to_28cm,soil_moisture_28_to_100cm,soil_temperature_0_to_7cm&elevation=nan&past_days=1&forecast_days=2`;
    const res = await fetch(url);
    const data = await res.json();

    currentElevation = data.elevation || 0;
    document.getElementById('elevationDisplay').innerText = `Elev: ${currentElevation.toFixed(0)}m`;

    const cur = data.current;
    document.getElementById('tempVal').innerHTML = `${cur.temperature_2m.toFixed(1)}<small>°C</small>`;
    document.getElementById('windVal').innerHTML = `${cur.wind_speed_10m.toFixed(1)}<small>km/h</small>`;
    document.getElementById('solarVal').innerHTML = `${cur.shortwave_radiation}<small>W/m²</small>`;
    document.getElementById('humidityVal').innerHTML = `${cur.relative_humidity_2m}<small>%</small>`;

    const lst = cur.surface_temperature || data.hourly.soil_temperature_0_to_7cm[24];
    document.getElementById('lstVal').innerHTML = `${lst.toFixed(1)}<small>°C</small>`;

    // Pollination AI & Spraying Logic
    const sprayBadge = document.getElementById('sprayVal');
    const polBadge = document.getElementById('pollinatorVal');
    const polText = document.getElementById('pollinatorText');

    if (cur.wind_speed_10m > 15) {
        sprayBadge.innerText = "Poor (Drift)"; sprayBadge.className = "value badge bg-red";
        polBadge.innerText = "Low (Windy)"; polBadge.className = "value badge bg-red";
        polText.innerText = "High winds prevent bee flight and precise spraying.";
    } else if (cur.precipitation > 0) {
        sprayBadge.innerText = "Poor (Rain)"; sprayBadge.className = "value badge bg-red";
        polBadge.innerText = "Low (Rain)"; polBadge.className = "value badge bg-red";
        polText.innerText = "Rain washes away chemicals and grounds pollinators.";
    } else if (cur.temperature_2m < 13 || cur.temperature_2m > 35) {
        sprayBadge.innerText = "Optimal"; sprayBadge.className = "value badge bg-green";
        polBadge.innerText = "Low (Temp)"; polBadge.className = "value badge bg-yellow";
        polText.innerText = "Extreme temperatures keep bees inactive.";
    } else {
        sprayBadge.innerText = "Optimal"; sprayBadge.className = "value badge bg-green";
        polBadge.innerText = "High Activity"; polBadge.className = "value badge bg-green";
        polText.innerText = "Perfect conditions for bee foraging and safe spraying.";
    }

    // Irrigation Planner
    const now = new Date(); now.setMinutes(0, 0, 0);
    let startIdx = data.hourly.time.findIndex(t => new Date(t).getTime() >= now.getTime());
    if (startIdx === -1) startIdx = 0;

    const rainData = data.hourly.precipitation.slice(startIdx, startIdx + 24);
    const etData = data.hourly.et0_fao_evapotranspiration.slice(startIdx, startIdx + 24);

    const cropType = document.getElementById('cropType').value;
    let soilDataRaw = cropType === 'shallow' ? data.hourly.soil_moisture_0_to_7cm : (cropType === 'medium' ? data.hourly.soil_moisture_7_to_28cm : data.hourly.soil_moisture_28_to_100cm);
    const soilData = soilDataRaw.slice(startIdx, startIdx + 24).map(v => v === null ? 0 : v);

    let totalRain = rainData.reduce((a, b) => a + b, 0);
    let totalET = etData.reduce((a, b) => a + b, 0);
    let currentMoisture = soilData[0];

    document.getElementById('rainVal').innerHTML = `${totalRain.toFixed(1)}<small>mm</small>`;
    document.getElementById('etVal').innerHTML = `${totalET.toFixed(1)}<small>mm</small>`;
    document.getElementById('moistureVal').innerText = `${currentMoisture.toFixed(3)} m³/m³`;
    document.getElementById('moistureBar').style.width = `${Math.min((currentMoisture / 0.5) * 100, 100)}%`;

    generateIrrigationAdvice(totalRain, totalET, currentMoisture);

    // Erosion Proxy
    let slopeProxy = currentElevation > 1000 ? "Steep" : currentElevation > 300 ? "Moderate" : "Flat";
    document.getElementById('slopeVal').innerText = slopeProxy;
    let erosionBadge = document.getElementById('erosionRiskVal');
    let agronomyList = document.getElementById('agronomyList');
    agronomyList.innerHTML = "";
    if (slopeProxy === "Steep") {
        erosionBadge.innerText = "High Risk"; erosionBadge.className = "value badge bg-red";
        agronomyList.innerHTML += `<li><b>Contour Farming:</b> Essential to slow water runoff.</li><li><b>Strip Cropping:</b> Plant strips of close-growing crops.</li>`;
    } else if (slopeProxy === "Moderate") {
        erosionBadge.innerText = "Medium Risk"; erosionBadge.className = "value badge bg-yellow";
        agronomyList.innerHTML += `<li><b>Contour Plowing:</b> Recommended.</li><li><b>Cover Crops:</b> Keep soil covered off-season.</li>`;
    } else {
        erosionBadge.innerText = "Low Risk"; erosionBadge.className = "value badge bg-green";
        agronomyList.innerHTML += `<li><b>No-Till Farming:</b> Maintain soil structure.</li><li><b>Precision Irrigation:</b> Drip lines.</li>`;
    }

    return { currentMoisture, rawData: data };
}

async function fetchHistoricalClimate() {
    const daysOffset = parseInt(document.getElementById('timeRange').value) || 365;

    const endDate = new Date(); endDate.setDate(endDate.getDate() - 5);
    const startDate = new Date(endDate); startDate.setDate(startDate.getDate() - daysOffset);
    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];

    const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${currentLat}&longitude=${currentLon}&start_date=${startStr}&end_date=${endStr}&daily=precipitation_sum,temperature_2m_max,temperature_2m_min,et0_fao_evapotranspiration_sum`;
    const res = await fetch(url);
    const data = await res.json();

    let totalRain = 0, frostDays = 0, heatDays = 0, tempSum = 0;

    // Monthly aggregations for Climate Chart
    let monthlyRain = new Array(12).fill(0);
    let monthlyTempSum = new Array(12).fill(0);
    let monthlyDays = new Array(12).fill(0);

    // Time-series for Hydrograph and Erosion
    let dates = [];
    let rainSeries = [];
    let etSeries = [];
    let erosionSeries = [];

    // Slope multiplier for erosion (Steep = 2.0, Moderate = 1.2, Flat = 0.5)
    let slopeMult = currentElevation > 1000 ? 2.0 : (currentElevation > 300 ? 1.2 : 0.5);

    data.daily.time.forEach((dateStr, i) => {
        const month = new Date(dateStr).getMonth();
        const rain = data.daily.precipitation_sum[i] || 0;
        const et = data.daily.et0_fao_evapotranspiration_sum[i] || 0;
        const tMax = data.daily.temperature_2m_max[i] || 0;
        const tMin = data.daily.temperature_2m_min[i] || 0;
        const tAvg = (tMax + tMin) / 2;

        monthlyRain[month] += rain;
        monthlyTempSum[month] += tAvg;
        monthlyDays[month]++;

        totalRain += rain;
        tempSum += tAvg;
        if (tMin <= 0) frostDays++;
        if (tMax >= 35) heatDays++;

        // Push to time-series
        dates.push(dateStr);
        rainSeries.push(rain);
        etSeries.push(et);

        // Erosion calculation: intense rain (>10mm/day) * slope multiplier
        let erosionRisk = rain > 10 ? (rain * slopeMult) : 0;
        erosionSeries.push(erosionRisk);
    });

    let yearlyTempAvg = tempSum / data.daily.time.length;
    let monthlyTempAvg = monthlyTempSum.map((sum, i) => monthlyDays[i] > 0 ? sum / monthlyDays[i] : 0);

    document.getElementById('yearlyRain').innerHTML = `${totalRain.toFixed(0)}<small>mm</small>`;
    document.getElementById('yearlyTemp').innerHTML = `${yearlyTempAvg.toFixed(1)}<small>°C</small>`;
    document.getElementById('frostDays').innerText = frostDays;
    document.getElementById('heatDays').innerText = heatDays;

    // Render Climate Chart (Always 12 months)
    climateChart.data.labels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    climateChart.data.datasets = [
        { type: 'bar', label: 'Rainfall (mm)', data: monthlyRain, backgroundColor: 'rgba(56, 189, 248, 0.7)', yAxisID: 'y' },
        { type: 'line', label: 'Avg Temp (°C)', data: monthlyTempAvg, borderColor: '#f87171', backgroundColor: 'transparent', tension: 0.3, borderWidth: 3, yAxisID: 'y1' }
    ];
    climateChart.update();

    // Render Hydrograph
    hydroChart.data.labels = dates;
    hydroChart.data.datasets = [
        { label: 'Rainfall (mm)', data: rainSeries, borderColor: '#38bdf8', backgroundColor: 'rgba(56, 189, 248, 0.1)', fill: true, tension: 0.2 },
        { label: 'Evapotranspiration (ET₀)', data: etSeries, borderColor: '#facc15', backgroundColor: 'transparent', borderDash: [5, 5], tension: 0.2 }
    ];
    hydroChart.update();

    // Render Erosion Chart
    erosionChart.data.labels = dates;
    erosionChart.data.datasets = [
        { label: 'Daily Erosion Risk Index', data: erosionSeries, backgroundColor: '#f87171' }
    ];
    erosionChart.update();

    return { totalRain, yearlyTempAvg, rawData: data };
}

function executeGeochemistryAndML(liveData, histData) {
    let estimatedPH = 7.0, npkCapacity = "Medium", soilType = "Calcareous Silt Loam";
    let nVal = 50, pVal = 50, kVal = 50;

    if (histData.totalRain > 1500) {
        estimatedPH = 5.5; npkCapacity = "Low (Highly Leached)"; soilType = "Lateritic Clay";
        nVal = 20; pVal = 30; kVal = 20;
    } else if (histData.totalRain < 500) {
        estimatedPH = 8.0; npkCapacity = "High (Salinity Risk)"; soilType = "Arid Sandy Loam";
        nVal = 80; pVal = 70; kVal = 80;
    }

    document.getElementById('soilTypeVal').innerText = soilType;
    document.getElementById('phVal').innerText = `${estimatedPH.toFixed(1)} pH`;
    document.getElementById('npkVal').innerText = npkCapacity;

    let liveHumidity = liveData.rawData.current.relative_humidity_2m || 50;
    let scaledRainfall = histData.totalRain > 1000 ? histData.totalRain / 5 : histData.totalRain / 2;

    const mlPredictions = mlEngine.predict(nVal, pVal, kVal, histData.yearlyTempAvg, liveHumidity, estimatedPH, scaledRainfall);
    exportDataPayload.mlPredictions = mlPredictions;

    const mlContainer = document.getElementById('mlResults');
    mlContainer.innerHTML = '';
    mlPredictions.forEach((pred, index) => {
        const color = pred.confidence > 80 ? 'var(--accent-green)' : (pred.confidence > 60 ? 'var(--accent-yellow)' : 'var(--accent-red)');
        mlContainer.innerHTML += `
            <div class="ml-item">
                <div class="ml-item-header">
                    <span>#${index + 1} Match: ${pred.name}</span>
                    <span style="color: ${color}">${pred.confidence.toFixed(1)}%</span>
                </div>
                <div class="ml-bar-container"><div class="ml-bar" style="width: ${pred.confidence}%; background: ${color}"></div></div>
            </div>`;
    });

    const topCrop = mlPredictions[0].name;
    document.getElementById('googleSearchBox').innerHTML = `
        <a href="https://www.google.com/search?q=${encodeURIComponent(topCrop + ' farming market prices news')}" target="_blank" class="btn-google">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
            Fetch Google Results for ${topCrop}
        </a>`;

    simulateMarketGraph(topCrop);
}

function simulateMarketGraph(cropName) {
    document.getElementById('marketCropLabel').innerText = `Crop: ${cropName}`;
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    let basePrice = 100 + Math.random() * 50;
    let prices = months.map((m, i) => {
        let seasonality = Math.sin(i / 1.5) * 20; // Simulated sine wave for harvest season drops
        return basePrice + seasonality + (Math.random() * 10 - 5);
    });

    marketChart.data.labels = months;
    marketChart.data.datasets = [{
        label: `${cropName} Market Price Index`,
        data: prices,
        borderColor: '#c084fc',
        backgroundColor: 'rgba(192, 132, 252, 0.1)',
        fill: true, tension: 0.4
    }];
    marketChart.update();
}

function generateIrrigationAdvice(rain, et, moisture) {
    const recBox = document.getElementById('irrigationRec');
    const deficit = et - rain;
    recBox.className = 'recommendation-box';

    if (moisture < 0.15) {
        if (rain > 10) { recBox.classList.add('bg-yellow'); document.getElementById('irrigTitle').innerText = "Wait - Rain Expected"; document.getElementById('irrigText').innerText = "Soil dry, rain incoming."; }
        else { recBox.style.borderColor = 'var(--accent-red)'; document.getElementById('irrigTitle').style.color = 'var(--accent-red)'; document.getElementById('irrigTitle').innerText = "Irrigate Immediately"; document.getElementById('irrigText').innerText = "Severe stress risk."; }
    } else if (moisture > 0.35) { recBox.classList.add('bg-yellow'); document.getElementById('irrigTitle').innerText = "Do Not Irrigate"; document.getElementById('irrigText').innerText = "Soil is saturated."; }
    else {
        const titleEl = document.getElementById('irrigTitle');
        const textEl = document.getElementById('irrigText');
        if (titleEl) titleEl.innerText = "Moisture Adequate";
        if (textEl) textEl.innerText = "Water balance stable.";
    }
}

// ==========================================
// 6. DEVELOPER EXPORTS
// ==========================================
function exportData(type) {
    if (Object.keys(exportDataPayload).length === 0) return alert("No data available yet.");

    let content, mime, filename;

    if (type === 'json') {
        content = JSON.stringify(exportDataPayload, null, 2);
        mime = "application/json";
        filename = "agriwater_export.json";
    } else {
        // BUGFIX: Access hist.daily.time instead of hist.time
        let csv = "Date,MaxTemp(C),MinTemp(C),Rainfall(mm),ET0(mm)\n";
        let hist = exportDataPayload.historical.rawData;
        hist.daily.time.forEach((t, i) => {
            csv += `${t},${hist.daily.temperature_2m_max[i]},${hist.daily.temperature_2m_min[i]},${hist.daily.precipitation_sum[i]},${hist.daily.et0_fao_evapotranspiration_sum[i]}\n`;
        });
        content = csv;
        mime = "text/csv";
        filename = "agriwater_historical.csv";
    }

    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
