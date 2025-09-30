const FACE_LABELS = ['U','R','F','D','L','B'];
const COLOR_ORDER = ['W','Y','R','O','G','B'];
const COLOR_MAP = { 'W':'#fff','Y':'#ff0','R':'#f00','O':'#fa0','G':'#0f0','B':'#00f' };

let sessionId = localStorage.getItem('rubiks_session_id') || Math.random().toString(36).slice(2);
localStorage.setItem('rubiks_session_id', sessionId);

const video = document.getElementById('video');
const faceButtonsDiv = document.getElementById('face-buttons');
const statusDiv = document.getElementById('status');
const resultDiv = document.getElementById('result');
const solveBtn = document.getElementById('solve-btn');

let scanned = [false,false,false,false,false,false];
let faceColors = [[],[],[],[],[],[]]; // corrected colors

async function startCamera(){
    try{
        const stream = await navigator.mediaDevices.getUserMedia({video:{facingMode:"environment"}});
        video.srcObject = stream;
    }catch(e){statusDiv.innerText='Camera error: '+e;}
}

function makeFaceButtons(){
    FACE_LABELS.forEach((label, idx)=>{
        const btn=document.createElement('button');
        btn.innerText=`Scan ${label}`;
        btn.disabled = idx>0;
        btn.onclick=()=>captureFace(idx,btn);
        faceButtonsDiv.appendChild(btn);
    });
}

function updateSolveButton(){solveBtn.disabled=scanned.includes(false);}

async function captureFace(faceIndex, btn){
    statusDiv.innerText=`Capturing ${FACE_LABELS[faceIndex]}...`;
    const canvas=document.createElement('canvas');
    canvas.width=video.videoWidth || 640;
    canvas.height=video.videoHeight || 480;
    const ctx=canvas.getContext('2d');
    ctx.drawImage(video,0,0,canvas.width,canvas.height);
    const dataUrl=canvas.toDataURL('image/jpeg',0.9);

    try{
        const res = await fetch('/api/scan',{
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({session_id:sessionId, face_index:faceIndex, image:dataUrl})
        });
        const j = await res.json();
        if(j.ok){
            faceColors[faceIndex] = j.colors.slice();
            showCorrectionGrid(faceIndex,j.grid);
            btn.innerText=`Scanned ${FACE_LABELS[faceIndex]} ✓`;
            btn.style.background='#2d7';
            scanned[faceIndex]=true;
            if(faceIndex+1<FACE_LABELS.length) faceButtonsDiv.children[faceIndex+1].disabled=false;
            updateSolveButton();
        }else{statusDiv.innerText='Error: '+j.error;}
    }catch(e){statusDiv.innerText='Error: '+e;}
}

function showCorrectionGrid(faceIndex, grid){
    const gridDiv=document.createElement('div');
    gridDiv.className='preview-grid';
    grid.forEach((row,rowIdx)=>{
        const rowDiv=document.createElement('div');
        rowDiv.className='preview-row';
        row.forEach((c,colIdx)=>{
            const cell=document.createElement('div');
            cell.className='preview-cell';
            cell.style.background=COLOR_MAP[c];
            cell.dataset.pos=rowIdx*3+colIdx;
            cell.dataset.face=faceIndex;
            cell.dataset.color=c;
            cell.onclick=()=>{
                let idx=COLOR_ORDER.indexOf(cell.dataset.color);
                idx=(idx+1)%COLOR_ORDER.length;
                cell.dataset.color=COLOR_ORDER[idx];
                cell.style.background=COLOR_MAP[COLOR_ORDER[idx]];
                faceColors[faceIndex][cell.dataset.pos]=COLOR_ORDER[idx];
            };
            rowDiv.appendChild(cell);
        });
        gridDiv.appendChild(rowDiv);
    });
    resultDiv.appendChild(gridDiv);
}

solveBtn.onclick=async()=>{
    // build facelet string from corrected colors
    const color2face={};
    FACE_LABELS.forEach((f,i)=>{ color2face[faceColors[i][4]]=f; }); // center color mapping

    let facelet_string='';
    for(let i=0;i<6;i++){
        for(let j=0;j<9;j++){
            let c=faceColors[i][j];
            let f=color2face[c];
            if(!f){ statusDiv.innerText=`Unknown color at face ${FACE_LABELS[i]} sticker ${j}`; return; }
            facelet_string+=f;
        }
    }

    statusDiv.innerText='Solving...';
    try{
        const res=await fetch('/api/solve',{
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({session_id:sessionId, facelet_string:facelet_string})
        });
        const j=await res.json();
        if(j.ok){
            resultDiv.innerHTML+='<h3>Solution:</h3><p>'+j.solution+'</p>';
            statusDiv.innerText='Solved!';
        }else{
            statusDiv.innerText='Error: '+j.error+(j.detail?': '+j.detail:'');
        }
    }catch(e){statusDiv.innerText='Error: '+e;}
}

startCamera();
makeFaceButtons();
