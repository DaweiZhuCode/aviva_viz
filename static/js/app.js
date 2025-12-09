let DATASET = [];
let HEADERS = [];
let FILES = {};
let CURRENT_FILE = null;
let CHARTS = {};


if (window.AVIVA_STATE) {
    FILES = window.AVIVA_STATE.files || {};
    CHARTS = window.AVIVA_STATE.charts || {};

    if (window.AVIVA_STATE.ds_state) {
        Object.assign(DS_STATE, window.AVIVA_STATE.ds_state);
    }


    window.addEventListener('DOMContentLoaded', () => {
        if (window.AVIVA_STATE.dashboardHTML) {
            document.getElementById('dashboard').innerHTML = window.AVIVA_STATE.dashboardHTML;

            renderFileList();
            if (Object.keys(FILES).length > 0) {

                document.getElementById('controls').style.opacity = '1';
                document.getElementById('controls').style.pointerEvents = 'all';

                Object.keys(CHARTS).forEach(id => {
                    const cvs = document.getElementById(id);
                    if (cvs) {
                        requestAnimationFrame(() => renderChart(id));
                    }
                });

                const dsScroll = document.querySelector('.ds-scroll-container');
                if (dsScroll) {
                    dsScroll.onscroll = (e) => dsOnScroll(e);

                    dsRenderTable();
                }
            }
        }
    });
}

function saveDashboard() {

    const state = {
        files: FILES,
        charts: CHARTS,
        ds_state: DS_STATE,
        dashboardHTML: document.getElementById('dashboard').innerHTML
    };


    const clone = document.documentElement.cloneNode(true);


    const script = document.createElement('script');
    script.textContent = `window.AVIVA_STATE = ${JSON.stringify(state)};`;
    clone.querySelector('head').insertBefore(script, clone.querySelector('head').firstChild);


    const blob = new Blob([clone.outerHTML], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'aviva_dashboard_modified.html';
    a.click();
    URL.revokeObjectURL(url);
}


const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const dashboard = document.getElementById('dashboard');
const controls = document.getElementById('controls');


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


    renderFileList();


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


    document.getElementById('file-meta').innerText = name;
    document.getElementById('row-count').innerText = `${DATASET.length} RECORD(S)`;
    controls.style.opacity = '1';
    controls.style.pointerEvents = 'all';


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


function openModal() { document.getElementById('config-modal').classList.add('active'); }
function closeModal() { document.getElementById('config-modal').classList.remove('active'); }

function addDataSummary() {
    if (!CURRENT_FILE || !FILES[CURRENT_FILE]) return alert("Load a file first.");


    let catBlock = document.getElementById(`cat-Summary`);
    if (!catBlock) {
        catBlock = document.createElement('div');
        catBlock.id = `cat-Summary`;
        catBlock.className = 'category-block';
        catBlock.innerHTML = `<div class="category-header">Summary</div>`;
        dashboard.insertBefore(catBlock, dashboard.firstChild);
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


        const sqDiff = vals.map(v => (v - mean) ** 2);
        const avgSqDiff = sqDiff.reduce((a, b) => a + b, 0) / n;
        const std = Math.sqrt(avgSqDiff);


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


    const cardId = 'chart-' + Date.now();
    const wrapper = document.createElement('div');
    wrapper.className = 'chart-card';

    let headerSubtitle = config.type.toUpperCase();
    if (config.y2Key) headerSubtitle += ` + ${config.y2Key.toUpperCase()} (${config.type2.toUpperCase()})`;


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


    const canvas = document.getElementById(cardId);
    if (!canvas) {
        console.error("Canvas not found for ID:", cardId);
        return;
    }
    attachListeners(canvas, cardId);
    requestAnimationFrame(() => renderChart(cardId));
}

function attachListeners(canvas, id) {

}

/**
 * Calculates "nice" tick mark values for a graph axis.
 * @param {number} min - The minimum data value.
 * @param {number} max - The maximum data value.
 * @param {number} maxTicks - The maximum number of ticks to generate.
 * @returns {number[]} Array of tick values.
 */
function calculateNiceTicks(min, max, maxTicks = 10) {
    const range = niceNum(max - min, false);
    const tickSpacing = niceNum(range / (maxTicks - 1), true);


    if (tickSpacing === 0) return [min, max];

    const niceMin = Math.floor(min / tickSpacing) * tickSpacing;
    const niceMax = Math.ceil(max / tickSpacing) * tickSpacing;

    const ticks = [];

    for (let x = niceMin; x <= niceMax + 0.5 * tickSpacing; x += tickSpacing) {
        ticks.push(x);
    }
    return ticks;
}

/**
 * Returns a "nice" number approximately equal to x.
 * @param {number} range - The range of the data.
 * @param {boolean} round - Whether to round the result.
 */
function niceNum(range, round) {
    const exponent = Math.floor(Math.log10(range));
    const fraction = range / Math.pow(10, exponent);
    let niceFraction;

    if (round) {
        if (fraction < 1.5) niceFraction = 1;
        else if (fraction < 3) niceFraction = 2;
        else if (fraction < 7) niceFraction = 5;
        else niceFraction = 10;
    } else {
        if (fraction <= 1) niceFraction = 1;
        else if (fraction <= 2) niceFraction = 2;
        else if (fraction <= 5) niceFraction = 5;
        else niceFraction = 10;
    }

    return niceFraction * Math.pow(10, exponent);
}

function renderChart(canvasId) {
    const chart = CHARTS[canvasId];
    if (!chart) return;

    const config = chart.config;
    const state = chart.state;

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


    ctx.clearRect(0, 0, W, H);


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

    let yTicks = calculateNiceTicks(yMin, yMax, 10);
    let renderYMin = yTicks[0];
    let renderYMax = yTicks[yTicks.length - 1];
    let renderYRange = renderYMax - renderYMin;
    if (renderYRange === 0) { renderYRange = 1; }


    let y2Ticks = [];
    let renderY2Min, renderY2Max, renderY2Range;
    if (config.y2Key) {
        y2Ticks = calculateNiceTicks(y2Min, y2Max, 10);
        renderY2Min = y2Ticks[0];
        renderY2Max = y2Ticks[y2Ticks.length - 1];
        renderY2Range = renderY2Max - renderY2Min;
        if (renderY2Range === 0) { renderY2Range = 1; }
    }


    ctx.strokeStyle = '#00539f';
    ctx.lineWidth = 0.5;


    ctx.beginPath();
    yTicks.forEach(tickVal => {
        // Normalize val to height
        let yPct = (tickVal - renderYMin) / renderYRange;
        let y = (H - PADDING) - (yPct * (H - 2 * PADDING));

        ctx.globalAlpha = 0.2;
        ctx.moveTo(PADDING, y);
        ctx.lineTo(W - PADDING, y);
    });
    ctx.stroke();
    ctx.globalAlpha = 1.0;


    ctx.strokeStyle = '#00539f';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(PADDING, PADDING);
    ctx.lineTo(PADDING, H - PADDING);
    ctx.lineTo(W - PADDING, H - PADDING);
    if (config.y2Key) { ctx.lineTo(W - PADDING, PADDING); }
    ctx.stroke();


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

            let cy = (H - PADDING) - ((p.y - renderYMin) / renderYRange) * (H - 2 * PADDING);
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
            let cy = (H - PADDING) - ((p.y - renderYMin) / renderYRange) * (H - 2 * PADDING);
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
            let cy = (H - PADDING) - ((p.y - renderYMin) / renderYRange) * (H - 2 * PADDING);
            ctx.beginPath();
            ctx.arc(cx, cy, 3, 0, 2 * Math.PI);
            ctx.fill();
        });
        ctx.restore();
    }


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
                let cy = (H - PADDING) - ((p.y2 - renderY2Min) / renderY2Range) * (H - 2 * PADDING);
                if (k === 0) ctx.moveTo(cx, cy); else ctx.lineTo(cx, cy);
            });
            ctx.stroke();
        } else if (config.type2 === 'bar') {
            const viewCount = state.xEnd - state.xStart;
            const barW = (W - 2 * PADDING) / viewCount;
            data.forEach((p) => {
                let cx = getX(p.origIndex);
                let cy = (H - PADDING) - ((p.y2 - renderY2Min) / renderY2Range) * (H - 2 * PADDING);
                let h = (H - PADDING) - cy;
                ctx.fillRect(cx, cy, barW * 0.4, h);
            });
        } else if (config.type2 === 'scatter') {
            data.forEach((p) => {
                let cx = getX(p.origIndex);
                let cy = (H - PADDING) - ((p.y2 - renderY2Min) / renderY2Range) * (H - 2 * PADDING);
                ctx.beginPath();
                ctx.arc(cx, cy, 3, 0, 2 * Math.PI);
                ctx.fill();
            });
        }
        ctx.restore();
    }


    ctx.font = '10px monospace';


    ctx.fillStyle = '#00539f';
    ctx.textAlign = 'right';
    yTicks.forEach(tickVal => {
        let yPct = (tickVal - renderYMin) / renderYRange;
        let y = (H - PADDING) - (yPct * (H - 2 * PADDING));

        if (y > PADDING - 5 && y < H - PADDING + 5) {
            let label = Number.isInteger(tickVal) ? tickVal : tickVal.toFixed(2);
            ctx.fillText(String(label), PADDING - 5, y + 3);
        }
    });


    if (config.y2Key) {
        ctx.textAlign = 'left';
        ctx.fillStyle = '#fed100';
        y2Ticks.forEach(tickVal => {
            let yPct = (tickVal - renderY2Min) / renderY2Range;
            let y = (H - PADDING) - (yPct * (H - 2 * PADDING));
            if (y > PADDING - 5 && y < H - PADDING + 5) {
                let label = Number.isInteger(tickVal) ? tickVal : tickVal.toFixed(2);
                ctx.fillText(String(label), W - PADDING + 5, y + 3);
            }
        });
    }


    ctx.fillStyle = '#00539f';
    ctx.textAlign = 'right';
    ctx.save();


    data.forEach((p) => {
        let cx = getX(p.origIndex);
        let label = String(p.x);

        ctx.save();
        ctx.translate(cx, H - PADDING + 10);
        ctx.rotate(-Math.PI / 4);
        ctx.fillText(label, 0, 0);
        ctx.restore();
    });

    ctx.restore();
}

function clearDashboard() {
    dashboard.innerHTML = '';
}

window.onresize = () => {
    // Re-render
};


let DS_STATE = {
    data: [],
    headers: [],
    sortCol: null,
    sortAsc: true,
    filters: {},
    searchTerm: "",
    selectedRow: null,
    scrollTop: 0
};

function openDataScienceTable() {
    if (!CURRENT_FILE || !FILES[CURRENT_FILE]) return alert("Please load a file first.");


    DS_STATE.headers = [...HEADERS];
    DS_STATE.data = [...FILES[CURRENT_FILE].data];
    DS_STATE.sortCol = null;
    DS_STATE.filters = {};
    DS_STATE.searchTerm = "";
    DS_STATE.selectedRow = null;


    let category = "Data Science Table";
    let catId = 'cat-' + category.replace(/\s+/g, '-').toLowerCase();
    let catSection = document.getElementById(catId);

    if (!catSection) {
        catSection = document.createElement('section');
        catSection.id = catId;
        catSection.className = 'category-block';
        catSection.innerHTML = `<h2 class="category-title"><div class="category-header" style="font-weight:400;">${category}</div></h2><div class="category-grid" id="grid-${catId}"></div>`;
        dashboard.appendChild(catSection);


        setTimeout(() => catSection.scrollIntoView({ behavior: 'smooth' }), 100);
    }

    const grid = document.getElementById(`grid-${catId}`);

    grid.innerHTML = '';


    const card = document.createElement('div');
    card.className = 'viz-card';
    card.style.gridColumn = "1 / -1";
    card.style.height = "600px";
    card.style.display = "flex";
    card.style.flexDirection = "column";



    const container = document.createElement('div');
    container.className = 'ds-container';
    container.style.height = "100%";


    const wrapper = document.createElement('div');
    wrapper.className = 'ds-table-wrapper';


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


    const scrollContainer = document.createElement('div');
    scrollContainer.className = 'ds-scroll-container';
    scrollContainer.onscroll = (e) => dsOnScroll(e);


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



    card.appendChild(container);
    grid.appendChild(card);


    dsRenderTable();
}

function dsGlobalSearch(val) {
    DS_STATE.searchTerm = val.toLowerCase();
    dsApplyFilters();
}

function dsToggleFilter(col) {
    const current = DS_STATE.filters[col] || "";
    const val = prompt(`Filter ${col} by (contains):`, current);

    if (val === null) return;

    if (val.trim() === "") {
        delete DS_STATE.filters[col];
    } else {
        DS_STATE.filters[col] = val.toLowerCase();
    }


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

    let result = FILES[CURRENT_FILE].data;


    if (DS_STATE.searchTerm) {
        result = result.filter(row => {
            return Object.values(row).some(v => String(v).toLowerCase().includes(DS_STATE.searchTerm));
        });
    }


    Object.keys(DS_STATE.filters).forEach(col => {
        const criteria = DS_STATE.filters[col];
        result = result.filter(row => {
            return String(row[col]).toLowerCase().includes(criteria);
        });
    });

    DS_STATE.data = result;


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


