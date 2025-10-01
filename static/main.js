// static/main.js
const video = document.getElementById('video');
const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');
const resultDiv = document.getElementById('result');
const statusDiv = document.getElementById('status');
const solveBtn = document.getElementById('solve-btn');
const faceButtonsDiv = document.getElementById('face-buttons');

const FACE_LABELS = ['U','R','F','D','L','B'];
const COLOR_ORDER = ['W','Y','R','O','G','B'];
const COLOR_MAP = {W:'#fff',Y:'#ff0',R:'#f00',O:'#f90',G:'#0f0',B:'#09f'};

let sessionId = localStorage.getItem('rubiks_session_id') || Math.random().toString(36).substring(2,10);
localStorage.setItem('rubiks_session_id', sessionId);

let faceColors = Array(6).fill(null); // each entry will be an array of 9 letters
let scanned = Array(6).fill(false);

async function startCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        video.srcObject = stream;
        await video.play();
    } catch (e) {
        statusDiv.innerText = 'Camera error: ' + e;
    }
}

function clearResultGrids() {
    // remove previous preview grids so UI doesn't pile up
    const existing = resultDiv.querySelectorAll('.preview-grid');
    existing.forEach(n => n.remove());
}

function makeFaceButtons() {
    for (let i = 0; i < FACE_LABELS.length; i++) {
        const btn = document.createElement('button');
        btn.innerText = `Scan ${FACE_LABELS[i]}`;
        btn.disabled = i !== 0;
        btn.className = 'scan-btn';
        btn.onclick = () => scanFace(i, btn);
        faceButtonsDiv.appendChild(btn);
    }
}

function updateSolveButton() {
    solveBtn.disabled = scanned.some(s => !s);
}

async function scanFace(faceIndex, btn) {
    if (video.readyState !== 4) { statusDiv.innerText = 'Video not ready'; return; }
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg');

    statusDiv.innerText = `Scanning ${FACE_LABELS[faceIndex]}...`;
    try {
        const res = await fetch('/api/scan', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ session_id: sessionId, face_index: faceIndex, image: dataUrl })
        });

        const text = await res.text();
        let j;
        try { j = JSON.parse(text); }
        catch (e) {
            statusDiv.innerText = 'Server returned non-JSON (HTML?). Response: ' + text;
            return;
        }

        if (!j.ok) {
            statusDiv.innerText = 'Scan error: ' + (j.error || 'unknown');
            return;
        }

        // Save detected colors (W/Y/R/O/G/B)
        faceColors[faceIndex] = j.colors.slice();
        scanned[faceIndex] = true;

        // update UI
        clearResultGrids();
        showCorrectionGrid(faceIndex, j.grid);

        btn.innerText = `Scanned ${FACE_LABELS[faceIndex]} ✓`;
        btn.style.background = '#2d7';
        // enable next face button
        if (faceIndex + 1 < FACE_LABELS.length) {
            faceButtonsDiv.children[faceIndex + 1].disabled = false;
        }
        updateSolveButton();
        statusDiv.innerText = `Scanned ${FACE_LABELS[faceIndex]}. Center detected as ${j.center}`;
    } catch (e) {
        statusDiv.innerText = 'Scan failed: ' + e;
    }
}

function showCorrectionGrid(faceIndex, grid) {
    // grid is 2D array of letters
    const gridDiv = document.createElement('div');
    gridDiv.className = 'preview-grid';
    gridDiv.dataset.faceIndex = faceIndex;

    for (let r = 0; r < 3; r++) {
        const rowDiv = document.createElement('div');
        rowDiv.className = 'preview-row';
        for (let c = 0; c < 3; c++) {
            const pos = r * 3 + c;
            const letter = grid[r][c];
            const cell = document.createElement('div');
            cell.className = 'preview-cell';
            cell.style.background = COLOR_MAP[letter] || '#333';
            cell.dataset.pos = pos;
            cell.dataset.face = faceIndex;
            cell.dataset.color = letter;
            // clicking cycles color
            cell.onclick = () => {
                let idx = COLOR_ORDER.indexOf(cell.dataset.color);
                idx = (idx + 1) % COLOR_ORDER.length;
                cell.dataset.color = COLOR_ORDER[idx];
                cell.style.background = COLOR_MAP[COLOR_ORDER[idx]];
                // update faceColors so correction is persisted
                if (!faceColors[faceIndex]) faceColors[faceIndex] = Array(9).fill('W');
                faceColors[faceIndex][pos] = COLOR_ORDER[idx];
            };
            rowDiv.appendChild(cell);
            // ensure initial value in faceColors too
            if (!faceColors[faceIndex]) faceColors[faceIndex] = Array(9).fill('W');
            faceColors[faceIndex][pos] = letter;
        }
        gridDiv.appendChild(rowDiv);
    }
    resultDiv.appendChild(gridDiv);
}

solveBtn.onclick = async () => {
    // ensure all faces are present
    for (let i = 0; i < 6; i++) {
        if (!faceColors[i] || faceColors[i].length !== 9) {
            statusDiv.innerText = `Face ${FACE_LABELS[i]} not ready. Please scan and confirm.`;
            return;
        }
    }

    // build mapping from center color letter to face letter
    const color2face = {};
    for (let i = 0; i < 6; i++) {
        const centerColor = faceColors[i][4];
        color2face[centerColor] = FACE_LABELS[i];
    }

    // validate that we have 6 distinct center colors (recommended)
    const centers = Object.keys(color2face);
    if (centers.length < 6) {
        // not necessarily fatal, but warn user
        statusDiv.innerText = 'Warning: centers not all distinct. Please check center stickers.';
        // continue anyway
    }

    // build facelet string in order U R F D L B, each 9 stickers left->right top->bottom
    let facelet_string = '';
    for (let i = 0; i < 6; i++) {
        for (let j = 0; j < 9; j++) {
            const col = faceColors[i][j];
            const mapped = color2face[col];
            if (!mapped) {
                statusDiv.innerText = `Unknown color ${col} at face ${FACE_LABELS[i]} sticker ${j}. Please correct.`;
                return;
            }
            facelet_string += mapped;
        }
    }

    statusDiv.innerText = 'Solving...';
    try {
        const res = await fetch('/api/solve', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ session_id: sessionId, facelet_string: facelet_string })
        });

        const text = await res.text();
        let j;
        try { j = JSON.parse(text); }
        catch (e) {
            statusDiv.innerText = 'Solver returned non-JSON: ' + text;
            return;
        }

        if (!j.ok) {
            statusDiv.innerText = 'Solve error: ' + (j.error || 'unknown') + (j.detail ? (': ' + j.detail) : '');
            return;
        }

        resultDiv.innerHTML += '<h3>Solution:</h3><p>' + j.solution + '</p>';
        statusDiv.innerText = 'Solved!';
    } catch (e) {
        statusDiv.innerText = 'Solve failed: ' + e;
    }
};

// init
startCamera();
makeFaceButtons();
