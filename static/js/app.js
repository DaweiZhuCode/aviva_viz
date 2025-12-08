let DATASET = [];
let HEADERS = [];
let FILES = {}; // { filename: { data: [], headers: [] } }
let CURRENT_FILE = null;
let CHARTS = {}; // Registry: { id: { config, state } }

// RESTORE STATE IF PRESENT
if (window.AVIVA_STATE) {
    FILES = window.AVIVA_STATE.files || {};
    CHARTS = window.AVIVA_STATE.charts || {};
    // Restore DS_STATE if exists, otherwise default
    if (window.AVIVA_STATE.ds_state) {
        Object.assign(DS_STATE, window.AVIVA_STATE.ds_state);
    }

    // Wait for DOM
    window.addEventListener('DOMContentLoaded', () => {
        if (window.AVIVA_STATE.dashboardHTML) {
            document.getElementById('dashboard').innerHTML = window.AVIVA_STATE.dashboardHTML;
            // Restore file list UI
            renderFileList();
            if (Object.keys(FILES).length > 0) {
                // Activate controls
                document.getElementById('controls').style.opacity = '1';
                document.getElementById('controls').style.pointerEvents = 'all';
                // Re-attach charts
                Object.keys(CHARTS).forEach(id => {
                    const cvs = document.getElementById(id);
                    if (cvs) {
                        requestAnimationFrame(() => renderChart(id));
                    }
                });
                // Re-bind Data Science Scroll & Sync
                const dsScroll = document.querySelector('.ds-scroll-container');
                if (dsScroll) {
                    dsScroll.onscroll = (e) => dsOnScroll(e);
                    // Force render to sync phantom height and real body
                    dsRenderTable();
                }
            }
        }
    });
}

function saveDashboard() {
    // 1. Snapshot State
    // 1. Snapshot State
    const state = {
        files: FILES,
        charts: CHARTS,
        ds_state: DS_STATE, // Save Data Science Table State
        dashboardHTML: document.getElementById('dashboard').innerHTML
    };

    // 2. Clone Document
    const clone = document.documentElement.cloneNode(true);

    // 3. Inject State Script
    const script = document.createElement('script');
    script.textContent = `window.AVIVA_STATE = ${JSON.stringify(state)};`;
    clone.querySelector('head').insertBefore(script, clone.querySelector('head').firstChild);

    // 4. Download
    const blob = new Blob([clone.outerHTML], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'aviva_dashboard_modified.html';
    a.click();
    URL.revokeObjectURL(url);
}

// DOM ELEMENTS
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const dashboard = document.getElementById('dashboard');
const controls = document.getElementById('controls');

// DRAG & DROP HANDLERS
dropZone.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
dropZone.addEventListener('drop', handleDrop);
fileInput.addEventListener('change', (e) => {
    Array.from(e.target.files).forEach(file => processFile(file));
});

function handleDrop(e) {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    if (e.dataTransfer.files.length) {
        Array.from(e.dataTransfer.files).forEach(file => processFile(file));
    }
}

function processFile(file) {
    if (!file) return;
    const name = file.name;
    const ext = name.split('.').pop().toLowerCase();

    // BINARY CHECK
    if (['pkl', 'pickle', 'parquet'].includes(ext)) {
        alert(`[LIMITATION] Cannot read '${name}' directly in browser.\n\nThis is a standalone HTML dashboard without a backend. Binary formats like Pickle or Parquet require a Python server.\n\nPlease convert your data to CSV or JSON.`);
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        const text = e.target.result;
        if (ext === 'json') {
            parseJSON(text, name);
        } else {
            // Default to CSV
            parseCSV(text, name);
        }
    };
    reader.readAsText(file);
}

function parseJSON(text, filename) {
    try {
        const data = JSON.parse(text);
        if (!Array.isArray(data) || data.length === 0) return alert("Invalid JSON: Must be an array of objects.");
        const headers = Object.keys(data[0]);
        onFileLoaded(filename, data, headers);
    } catch (err) {
        alert("Error parsing JSON: " + err.message);
    }
}

function parseCSV(text, filename) {
    const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
    if (lines.length < 2) return alert("Invalid CSV");

    const headers = lines[0].split(',').map(h => h.trim());
    const data = lines.slice(1).map(line => {
        const values = line.split(',');
        let obj = {};
        headers.forEach((h, i) => {
            const val = values[i] ? values[i].trim() : '';
            obj[h] = isNaN(Number(val)) ? val : Number(val);
        });
        return obj;
    });

    onFileLoaded(filename, data, headers);
}

function onFileLoaded(name, data, headers) {
    FILES[name] = { data, headers };

    // UI: Add to List
    renderFileList();

    // If first file or explicit, switch to it
    if (!CURRENT_FILE) {
        switchFile(name);
    }
}

function renderFileList() {
    const list = document.getElementById('file-list');
    list.innerHTML = '';
    Object.keys(FILES).forEach(name => {
        const div = document.createElement('div');
        div.innerText = name;
        div.style.padding = '5px 8px';
        div.style.borderRadius = '4px';
        div.style.cursor = 'pointer';
        div.style.fontSize = '11px';
        div.style.background = (name === CURRENT_FILE) ? 'rgba(0, 83, 159, 1)' : 'rgba(0, 83, 159, 0.1)';
        div.style.color = (name === CURRENT_FILE) ? '#fff' : '#00539f';
        div.onclick = () => switchFile(name);
        list.appendChild(div);
    });
}

function switchFile(name) {
    if (CURRENT_FILE === name) return;
    CURRENT_FILE = name;
    DATASET = FILES[name].data;
    HEADERS = FILES[name].headers;

    // UI Update
    document.getElementById('file-meta').innerText = name;
    document.getElementById('row-count').innerText = `${DATASET.length} RECORD(S)`;
    controls.style.opacity = '1';
    controls.style.pointerEvents = 'all';

    // Rerender list to update selection highlight
    renderFileList();
    const xSel = document.getElementById('axis-x');
    const ySel = document.getElementById('axis-y');
    const y2Sel = document.getElementById('axis-y2');
    xSel.innerHTML = ''; ySel.innerHTML = ''; y2Sel.innerHTML = '<option value="">-- None --</option>';

    HEADERS.forEach(h => {
        const opt1 = document.createElement('option'); opt1.value = h; opt1.innerText = h;
        const opt2 = document.createElement('option'); opt2.value = h; opt2.innerText = h;
        const opt3 = document.createElement('option'); opt3.value = h; opt3.innerText = h;
        xSel.appendChild(opt1);
        ySel.appendChild(opt2);
        y2Sel.appendChild(opt3);
    });
}

// MODAL LOGIC
function openModal() { document.getElementById('config-modal').classList.add('active'); }
function closeModal() { document.getElementById('config-modal').classList.remove('active'); }

function addDataSummary() {
    if (!CURRENT_FILE || !FILES[CURRENT_FILE]) return alert("Load a file first.");

    // Container Logic (Auto-create "Summary/Stats")
    let catBlock = document.getElementById(`cat-Summary`);
    if (!catBlock) {
        catBlock = document.createElement('div');
        catBlock.id = `cat-Summary`;
        catBlock.className = 'category-block';
        catBlock.innerHTML = `<div class="category-header">Summary</div>`;
        dashboard.insertBefore(catBlock, dashboard.firstChild); // Put at top
    }

    let subId = `sub-Summary-Stats`;
    let subBlock = document.getElementById(subId);
    if (!subBlock) {
        subBlock = document.createElement('div');
        subBlock.id = subId;
        subBlock.className = 'subcategory-block';
        subBlock.innerHTML = `
            <div class="subcategory-header">Data Description</div>
            <div class="chart-grid" id="grid-${subId}" style="grid-template-columns: 1fr;"></div>
        `;
        catBlock.appendChild(subBlock);
    }

    // CALC LOGIC
    const numericHeaders = HEADERS.filter(h => {
        return FILES[CURRENT_FILE].data.slice(0, 50).every(row => !isNaN(Number(row[h])));
    });

    const stats = numericHeaders.map(h => {
        const vals = FILES[CURRENT_FILE].data.map(r => Number(r[h])).sort((a, b) => a - b);
        const n = vals.length;
        const sum = vals.reduce((a, b) => a + b, 0);
        const mean = sum / n;
        const min = vals[0];
        const max = vals[n - 1];

        // Std Dev
        const sqDiff = vals.map(v => (v - mean) ** 2);
        const avgSqDiff = sqDiff.reduce((a, b) => a + b, 0) / n;
        const std = Math.sqrt(avgSqDiff);

        // Quantiles
        const q25 = vals[Math.floor(n * 0.25)];
        const q50 = vals[Math.floor(n * 0.50)];
        const q75 = vals[Math.floor(n * 0.75)];

        return { name: h, count: n, mean: mean, std: std, min: min, "25%": q25, "50%": q50, "75%": q75, max: max };
    });

    const wrapper = document.createElement('div');
    wrapper.className = 'chart-card';
    wrapper.style.overflow = 'auto';

    let ths = `<th></th>` + stats.map(s => `<th>${s.name}</th>`).join('');
    let rows = ['count', 'mean', 'std', 'min', '25%', '50%', '75%', 'max'].map(metric => {
        return `<tr><td><b>${metric}</b></td>` + stats.map(s => {
            let v = s[metric];
            if (typeof v === 'number' && v % 1 !== 0) v = v.toFixed(6);
            return `<td>${v}</td>`;
        }).join('') + `</tr>`;
    }).join('');

    wrapper.innerHTML = `
        <div class="chart-header">
            <span style="color: #00539f; font-weight: 600;">Data Description</span>
            <span style="opacity: 0.5; font-size: 10px;">${CURRENT_FILE}</span>
        </div>
        <div class="chart-body" style="padding: 0;">
            <table class="aviva-table">
                <thead><tr>${ths}</tr></thead>
                <tbody>${rows}</tbody>
            </table>
        </div>
    `;

    subBlock.querySelector('.chart-grid').appendChild(wrapper);
}

// CHARTING ENGINE
function addGraph() {
    const config = {
        type: document.getElementById('chart-type').value,
        type2: document.getElementById('chart-type-2').value,
        xKey: document.getElementById('axis-x').value,
        yKey: document.getElementById('axis-y').value,
        y2Key: document.getElementById('axis-y2').value,
        title: document.getElementById('graph-title').value,
        subtitle: document.getElementById('graph-subtitle').value,
        category: document.getElementById('graph-category').value.trim() || "General",
        subcategory: document.getElementById('graph-subcategory').value.trim() || "Overview"
    };

    const mainTitle = config.title ? config.title : `${config.yKey.toUpperCase()} vs ${config.xKey.toUpperCase()}`;

    // DOM Creation
    let catBlock = document.getElementById(`cat-${config.category}`);
    if (!catBlock) {
        catBlock = document.createElement('div');
        catBlock.id = `cat-${config.category}`;
        catBlock.className = 'category-block';
        catBlock.innerHTML = `<div class="category-header">${config.category}</div>`;
        dashboard.appendChild(catBlock);
    }

    let subId = `sub-${config.category}-${config.subcategory}`;
    let subBlock = document.getElementById(subId);
    if (!subBlock) {
        subBlock = document.createElement('div');
        subBlock.id = subId;
        subBlock.className = 'subcategory-block';
        subBlock.innerHTML = `
            <div class="subcategory-header">${config.subcategory}</div>
            <div class="chart-grid" id="grid-${subId}"></div>
        `;
        catBlock.appendChild(subBlock);
    }

    // Chart Card
    const cardId = 'chart-' + Date.now();
    const wrapper = document.createElement('div');
    wrapper.className = 'chart-card';

    let headerSubtitle = config.type.toUpperCase();
    if (config.y2Key) headerSubtitle += ` + ${config.y2Key.toUpperCase()} (${config.type2.toUpperCase()})`;

    // LEGEND
    let legendHTML = `
        <div class="chart-legend">
            <div class="legend-item">
                <div class="legend-color" style="background: #00539f; box-shadow: 0 0 5px #00539f;"></div>
                <span>${config.yKey}</span>
            </div>
    `;

    if (config.y2Key) {
        legendHTML += `
            <div class="legend-item">
                <div class="legend-color" style="background: #fed100; box-shadow: 0 0 5px #fed100;"></div>
                <span>${config.y2Key}</span>
            </div>
        `;
    }
    legendHTML += `</div>`;

    wrapper.innerHTML = `
        <div class="chart-header" style="flex-direction: column; align-items: flex-start; gap: 2px;">
            <div style="display: flex; justify-content: space-between; width: 100%;">
                <span style="color: #00539f; font-weight: 600;">${mainTitle}</span>
                <span style="opacity: 0.5; font-size: 10px;">${headerSubtitle}</span>
            </div>
            ${config.subtitle ? `<span style="font-size: 10px; color: #00539f; opacity: 0.8;">${config.subtitle}</span>` : ''}
        </div>
        <div class="chart-body" style="display: flex; flex-direction: column; overflow: hidden;">
            <div class="canvas-wrapper" style="flex: 1; position: relative; width: 100%; overflow: hidden;">
                <canvas id="${cardId}"></canvas>
            </div>
            ${legendHTML}
        </div>
    `;

    subBlock.querySelector('.chart-grid').appendChild(wrapper);
    closeModal();

    // REGISTER CHART
    CHARTS[cardId] = {
        config: config,
        datasetName: CURRENT_FILE,
        state: {
            xStart: 0,
            xEnd: FILES[CURRENT_FILE].data.length - 1,
            isDragging: false,
            lastMouseX: 0
        }
    };

    // ATTACH LISTENERS
    const canvas = document.getElementById(cardId);
    if (!canvas) {
        console.error("Canvas not found for ID:", cardId);
        return;
    }
    attachListeners(canvas, cardId);
    requestAnimationFrame(() => renderChart(cardId));
}

function attachListeners(canvas, id) {
    // Zoom/Pan removed per user request.
    // Charts are now static views of the full dataset.
}

function renderChart(canvasId) {
    const chart = CHARTS[canvasId];
    if (!chart) return;

    const config = chart.config;
    const state = chart.state;
    // Check if file exists in FILES, if not return (safe guard)
    if (!FILES[chart.datasetName]) return;
    const fileData = FILES[chart.datasetName].data;

    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const parent = canvas.parentElement;

    if (canvas.width !== parent.clientWidth || canvas.height !== parent.clientHeight) {
        canvas.width = parent.clientWidth;
        canvas.height = parent.clientHeight;
    }

    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    const PADDING = 40;

    // CLEAR
    ctx.clearRect(0, 0, W, H);

    // DATA SLICING (static view now, but keeping structure for robustness)
    let iStart = Math.floor(state.xStart);
    let iEnd = Math.ceil(state.xEnd);

    iStart = Math.max(0, iStart);
    iEnd = Math.min(fileData.length - 1, iEnd);

    const subsetIndices = [];
    for (let i = iStart; i <= iEnd; i++) subsetIndices.push(i);

    const data = subsetIndices.map(i => ({
        x: fileData[i][config.xKey],
        y: fileData[i][config.yKey],
        y2: config.y2Key ? fileData[i][config.y2Key] : null,
        origIndex: i
    }));

    if (data.length === 0) return;

    const yVals = data.map(d => typeof d.y === 'number' ? d.y : 0);
    let yMax = Math.max(...yVals);
    let yMin = Math.min(...yVals);
    let yRange = yMax - yMin;
    if (yRange === 0) yRange = 1;

    let y2Max, y2Min, y2Range;
    if (config.y2Key) {
        const y2Vals = data.map(d => typeof d.y2 === 'number' ? d.y2 : 0);
        y2Max = Math.max(...y2Vals);
        y2Min = Math.min(...y2Vals);
        y2Range = y2Max - y2Min;
        if (y2Range === 0) y2Range = 1;
    }

    const getX = (idx) => {
        const relativePos = (idx - state.xStart) / (state.xEnd - state.xStart);
        return PADDING + relativePos * (W - 2 * PADDING);
    };

    // Grid Lines
    ctx.strokeStyle = '#00539f';
    ctx.lineWidth = 0.5;
    ctx.globalAlpha = 0.2;
    ctx.beginPath();
    for (let i = 0; i <= 4; i++) {
        let y = (H - PADDING) - (i / 4) * (H - 2 * PADDING);
        ctx.moveTo(PADDING, y);
        ctx.lineTo(W - PADDING, y);
    }
    ctx.stroke();
    ctx.globalAlpha = 1.0;

    // Axes
    ctx.strokeStyle = '#00539f';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(PADDING, PADDING); ctx.lineTo(PADDING, H - PADDING);
    ctx.lineTo(W - PADDING, H - PADDING);
    if (config.y2Key) { ctx.lineTo(W - PADDING, PADDING); }
    ctx.stroke();

    // Primary Series
    ctx.strokeStyle = '#00539f';
    ctx.fillStyle = 'rgba(0, 83, 159, 0.6)';
    ctx.lineWidth = 2;

    if (config.type === 'line') {
        ctx.beginPath();
        ctx.save();
        ctx.rect(PADDING, PADDING, W - 2 * PADDING, H - 2 * PADDING);
        ctx.clip();
        data.forEach((p, k) => {
            let cx = getX(p.origIndex);
            let cy = (H - PADDING) - ((p.y - yMin) / yRange) * (H - 2 * PADDING);
            if (k === 0) ctx.moveTo(cx, cy); else ctx.lineTo(cx, cy);
        });
        ctx.stroke();
        ctx.restore();
    } else if (config.type === 'bar') {
        ctx.save();
        ctx.rect(PADDING, PADDING, W - 2 * PADDING, H - 2 * PADDING);
        ctx.clip();
        const viewCount = state.xEnd - state.xStart;
        const barW = (W - 2 * PADDING) / viewCount;
        data.forEach((p) => {
            let cx = getX(p.origIndex);
            let cy = (H - PADDING) - ((p.y - yMin) / yRange) * (H - 2 * PADDING);
            let h = (H - PADDING) - cy;
            ctx.fillRect(cx - barW * 0.4, cy, barW * 0.8, h);
        });
        ctx.restore();
    } else if (config.type === 'scatter') {
        ctx.save();
        ctx.rect(PADDING, PADDING, W - 2 * PADDING, H - 2 * PADDING);
        ctx.clip();
        data.forEach((p) => {
            let cx = getX(p.origIndex);
            let cy = (H - PADDING) - ((p.y - yMin) / yRange) * (H - 2 * PADDING);
            ctx.beginPath();
            ctx.arc(cx, cy, 3, 0, 2 * Math.PI);
            ctx.fill();
        });
        ctx.restore();
    }

    // Secondary Series
    if (config.y2Key) {
        ctx.strokeStyle = '#fed100';
        ctx.fillStyle = 'rgba(254, 209, 0, 0.6)';
        ctx.lineWidth = 2;
        ctx.save();
        ctx.rect(PADDING, PADDING, W - 2 * PADDING, H - 2 * PADDING);
        ctx.clip();
        if (config.type2 === 'line') {
            ctx.beginPath();
            data.forEach((p, k) => {
                let cx = getX(p.origIndex);
                let cy = (H - PADDING) - ((p.y2 - y2Min) / y2Range) * (H - 2 * PADDING);
                if (k === 0) ctx.moveTo(cx, cy); else ctx.lineTo(cx, cy);
            });
            ctx.stroke();
        } else if (config.type2 === 'bar') {
            const viewCount = state.xEnd - state.xStart;
            const barW = (W - 2 * PADDING) / viewCount;
            data.forEach((p) => {
                let cx = getX(p.origIndex);
                let cy = (H - PADDING) - ((p.y2 - y2Min) / y2Range) * (H - 2 * PADDING);
                let h = (H - PADDING) - cy;
                ctx.fillRect(cx, cy, barW * 0.4, h);
            });
        } else if (config.type2 === 'scatter') {
            data.forEach((p) => {
                let cx = getX(p.origIndex);
                let cy = (H - PADDING) - ((p.y2 - y2Min) / y2Range) * (H - 2 * PADDING);
                ctx.beginPath();
                ctx.arc(cx, cy, 3, 0, 2 * Math.PI);
                ctx.fill();
            });
        }
        ctx.restore();
    }

    // Labels
    ctx.fillStyle = '#00539f';
    ctx.font = '10px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(yMax.toFixed(2), PADDING - 5, PADDING + 10);
    ctx.fillText(yMin.toFixed(2), PADDING - 5, H - PADDING);

    if (config.y2Key) {
        ctx.textAlign = 'left';
        ctx.fillStyle = '#fed100';
        ctx.fillText(y2Max.toFixed(2), W - PADDING + 5, PADDING + 10);
        ctx.fillText(y2Min.toFixed(2), W - PADDING + 5, H - PADDING);
    }

    ctx.fillStyle = '#00539f';
    if (data.length > 0) {
        const tStart = String(data[0].x);
        ctx.textAlign = 'left';
        ctx.fillText(tStart, PADDING, H - 10);
        const tEnd = String(data[data.length - 1].x);
        ctx.textAlign = 'right';
        ctx.fillText(tEnd, W - PADDING, H - 10);
    }
}

function clearDashboard() {
    dashboard.innerHTML = '';
}

window.onresize = () => {
    // Re-render
};

/* =========================================
   DATA SCIENCE TABLE MODULE
   ========================================= */
/* =========================================
   DATA SCIENCE TABLE MODULE
   ========================================= */
let DS_STATE = {
    data: [], // Filtered & Sorted
    headers: [],
    sortCol: null,
    sortAsc: true,
    filters: {}, // { col: "value" }
    searchTerm: "",
    selectedRow: null,
    scrollTop: 0
};

function openDataScienceTable() {
    if (!CURRENT_FILE || !FILES[CURRENT_FILE]) return alert("Please load a file first.");

    // reset state
    DS_STATE.headers = [...HEADERS];
    DS_STATE.data = [...FILES[CURRENT_FILE].data];
    DS_STATE.sortCol = null;
    DS_STATE.filters = {};
    DS_STATE.searchTerm = "";
    DS_STATE.selectedRow = null;

    // INTEGRATION: Create/Find Category Block
    // We want "Data Science" -> "Table"
    let category = "Data Science Table";
    let catId = 'cat-' + category.replace(/\s+/g, '-').toLowerCase();
    let catSection = document.getElementById(catId);

    if (!catSection) {
        catSection = document.createElement('section');
        catSection.id = catId;
        catSection.className = 'category-block';
        catSection.innerHTML = `<h2 class="category-title"><div class="category-header" style="font-weight:400;">${category}</div></h2><div class="category-grid" id="grid-${catId}"></div>`;
        dashboard.appendChild(catSection);

        // Scroll to it
        setTimeout(() => catSection.scrollIntoView({ behavior: 'smooth' }), 100);
    }

    const grid = document.getElementById(`grid-${catId}`);
    // Clear previous table to prevent duplicates or just append? 
    // Let's clear for now to have one table instance.
    grid.innerHTML = '';

    // MAIN CONTAINER (Card style)
    const card = document.createElement('div');
    card.className = 'viz-card'; // Reuse viz-card for styling consistency? Or custom.
    card.style.gridColumn = "1 / -1"; // Full width
    card.style.height = "600px"; // Fixed height
    card.style.display = "flex";
    card.style.flexDirection = "column";

    // Header REMOVED per user request
    /*
    const cardHeader = document.createElement('div');
    cardHeader.className = 'viz-header';
    cardHeader.innerHTML = `
        <div class="viz-title">Table Analysis</div>
        <div class="viz-subtitle">Interactive Data Grid</div>
    `;
    card.appendChild(cardHeader);
    */

    const container = document.createElement('div');
    container.className = 'ds-container'; // Adjusted in CSS to fit
    container.style.height = "100%"; // Take remaining space in card

    // WRAPPER
    const wrapper = document.createElement('div');
    wrapper.className = 'ds-table-wrapper';

    // Toolbar
    const toolbar = document.createElement('div');
    toolbar.className = 'ds-toolbar';
    toolbar.innerHTML = `
        <input type="text" class="ds-search" placeholder="Global Search..." onkeyup="dsGlobalSearch(this.value)">
        <div style="font-size:10px; color:#888;">Expected: Click header chips to filter</div>
    `;

    // Chips Area
    const chips = document.createElement('div');
    chips.className = 'ds-chips';
    chips.id = 'ds-chips-area';
    DS_STATE.headers.forEach(h => {
        const chip = document.createElement('div');
        chip.className = 'ds-chip';
        chip.innerText = h;
        chip.onclick = () => dsToggleFilter(h);
        chips.appendChild(chip);
    });
    toolbar.appendChild(chips);
    wrapper.appendChild(toolbar);

    // Scroll Container
    const scrollContainer = document.createElement('div');
    scrollContainer.className = 'ds-scroll-container';
    scrollContainer.onscroll = (e) => dsOnScroll(e);

    // Table Structure
    const headerRow = document.createElement('div');
    headerRow.className = 'ds-table-header';
    headerRow.innerHTML = DS_STATE.headers.map(h =>
        `<div class="ds-th" onclick="dsSort('${h}')">
            ${h}
            <span style="font-size:9px; opacity:0.5;">▲▼</span>
         </div>`
    ).join('');

    const phantom = document.createElement('div');
    phantom.className = 'ds-phantom-body';
    phantom.id = 'ds-phantom';

    const realBody = document.createElement('div');
    realBody.className = 'ds-real-body';
    realBody.id = 'ds-real-body';

    scrollContainer.appendChild(phantom);
    scrollContainer.appendChild(realBody);
    scrollContainer.appendChild(headerRow);
    scrollContainer.insertBefore(headerRow, scrollContainer.firstChild);

    wrapper.appendChild(scrollContainer);
    container.appendChild(wrapper);

    // NO DETAILS PANE

    card.appendChild(container); // Add container to Viz Card
    grid.appendChild(card); // Add card to Grid

    // Initial Render
    dsRenderTable();
}

function dsGlobalSearch(val) {
    DS_STATE.searchTerm = val.toLowerCase();
    dsApplyFilters();
}

function dsToggleFilter(col) {
    const current = DS_STATE.filters[col] || "";
    const val = prompt(`Filter ${col} by (contains):`, current);

    if (val === null) return; // Cancelled

    if (val.trim() === "") {
        delete DS_STATE.filters[col];
    } else {
        DS_STATE.filters[col] = val.toLowerCase();
    }

    // Update Chips UI
    dsUpdateChips();
    dsApplyFilters();
}

function dsUpdateChips() {
    const chips = document.getElementById('ds-chips-area');
    if (!chips) return;
    Array.from(chips.children).forEach(chip => {
        const col = chip.innerText;
        if (DS_STATE.filters[col]) {
            chip.classList.add('active');
            chip.title = `Filtered by: ${DS_STATE.filters[col]}`;
        } else {
            chip.classList.remove('active');
            chip.title = "";
        }
    });
}

function dsApplyFilters() {
    // Start with full data
    let result = FILES[CURRENT_FILE].data;

    // 1. Global Search
    if (DS_STATE.searchTerm) {
        result = result.filter(row => {
            return Object.values(row).some(v => String(v).toLowerCase().includes(DS_STATE.searchTerm));
        });
    }

    // 2. Column Filters
    Object.keys(DS_STATE.filters).forEach(col => {
        const criteria = DS_STATE.filters[col];
        result = result.filter(row => {
            return String(row[col]).toLowerCase().includes(criteria);
        });
    });

    DS_STATE.data = result;

    // Re-apply Sort if active
    if (DS_STATE.sortCol) dsSort(DS_STATE.sortCol, true);
    else dsRenderTable();
}

function dsSort(col, keepOrder) {
    if (!keepOrder) {
        if (DS_STATE.sortCol === col) DS_STATE.sortAsc = !DS_STATE.sortAsc;
        else { DS_STATE.sortCol = col; DS_STATE.sortAsc = true; }
    }

    DS_STATE.data.sort((a, b) => {
        let vA = a[col], vB = b[col];
        if (typeof vA === 'number' && typeof vB === 'number') {
            return DS_STATE.sortAsc ? vA - vB : vB - vA;
        }
        return DS_STATE.sortAsc ? String(vA).localeCompare(String(vB)) : String(vB).localeCompare(String(vA));
    });
    dsRenderTable();
}

function dsRenderTable() {
    const ROW_HEIGHT = 40;
    const totalH = DS_STATE.data.length * ROW_HEIGHT;
    const phantom = document.getElementById('ds-phantom');
    if (phantom) phantom.style.height = totalH + 'px';

    // Trigger scroll handler to force render visible
    const container = document.querySelector('.ds-scroll-container');
    if (container) dsOnScroll({ target: container });
}

function dsOnScroll(e) {
    const el = e.target;
    if (!el) return;

    const scrollTop = el.scrollTop;
    const clientH = el.clientHeight || 600;

    const ROW_HEIGHT = 40;
    const startIdx = Math.floor(scrollTop / ROW_HEIGHT);
    const endIdx = Math.min(DS_STATE.data.length, Math.ceil((scrollTop + clientH) / ROW_HEIGHT) + 2);

    const body = document.getElementById('ds-real-body');
    if (!body) return;

    body.style.top = (startIdx * ROW_HEIGHT) + 'px';

    const visibleData = DS_STATE.data.slice(startIdx, endIdx);

    // Detect Numeric Helpers
    const numericCols = DS_STATE.headers.filter(h => typeof DS_STATE.data[0]?.[h] === 'number');
    const ranges = {};
    numericCols.forEach(h => {
        let vals = DS_STATE.data.map(r => r[h]);
        ranges[h] = { min: Math.min(...vals), max: Math.max(...vals) };
    });

    body.innerHTML = visibleData.map((row, i) => {
        const realIndex = startIdx + i;
        const isSelected = DS_STATE.selectedRow === row;

        let cells = DS_STATE.headers.map(h => {
            let val = row[h];
            let extraStyle = '';
            let extraContent = '';

            if (typeof val === 'number') {
                const rng = ranges[h];
                if (rng && rng.max !== rng.min) {
                    const pct = (val - rng.min) / (rng.max - rng.min);
                    extraContent = `<div class="ds-bar-bg" style="width:${pct * 100}%"></div>`;
                }
                if (val % 1 !== 0) val = val.toFixed(2);
            }

            return `<div class="ds-cell" contenteditable="true" style="${extraStyle}">
                ${extraContent}
                <span style="position:relative; z-index:1;">${val}</span>
            </div>`;
        }).join('');

        return `<div class="ds-row ${isSelected ? 'selected' : ''}" style="height:${ROW_HEIGHT}px;">
                    ${cells}
                </div>`;
    }).join('');
}


