// ==========================================
// 🔴 配置区域: Bmob 云后端
// ==========================================
const BMOB_APP_ID  = "909d88911b4256680a5bb5d9df1f84e2";
const BMOB_API_KEY = "921bf8d038ac6e5a904e1fab0e8f7ac3";
// ==========================================

// --- 全局变量 ---
let state = 'MENU'; 
let pouring = false;
let liquidHeight = 0, foamHeight = 0, flowRate = 0;
let particles = [];
let currentPlayerName = localStorage.getItem('moyu_username') || "";
let unlockedAch = JSON.parse(localStorage.getItem('moyu_achievements') || '[]');

// 画布设置
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
let canvasW, canvasH, glassW, glassH, glassX, glassY;

// DOM 元素
const startScreen = document.getElementById('start-screen');
const resultScreen = document.getElementById('result-screen');
const resultText = document.getElementById('result-text');
const resultDetail = document.getElementById('result-detail');
const uploadStatus = document.getElementById('upload-status');
const scoreVal = document.getElementById('score-val');
const lbPanel = document.getElementById('leaderboard-panel');
const nameInput = document.getElementById('player-name-input');
const startBtn = document.getElementById('start-btn');

// --- 初始化与适配 ---
function resize() {
    canvasW = window.innerWidth;
    canvasH = window.innerHeight;
    canvas.width = canvasW;
    canvas.height = canvasH;
    
    glassH = canvasH * 0.4;
    glassW = glassH * 0.6;
    if (glassW > canvasW * 0.7) glassW = canvasW * 0.7;
    
    glassX = canvasW / 2 - glassW / 2;
    glassY = canvasH * 0.75 - glassH;
}
window.addEventListener('resize', resize);
resize();

if(currentPlayerName) {
    nameInput.value = currentPlayerName;
    startBtn.disabled = false;
}

// --- 事件监听 ---
nameInput.addEventListener('input', (e) => {
    if(e.target.value.trim().length > 0) {
        startBtn.disabled = false;
        currentPlayerName = e.target.value.trim();
    } else {
        startBtn.disabled = true;
    }
});

startBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    localStorage.setItem('moyu_username', currentPlayerName);
    resetGame();
});

document.getElementById('restart-btn').addEventListener('click', (e) => { e.stopPropagation(); resetGame(); });
document.getElementById('check-rank-btn').addEventListener('click', (e) => { 
    e.stopPropagation(); 
    lbPanel.classList.remove('hidden');
    fetchLeaderboard();
});
document.getElementById('open-lb-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    lbPanel.classList.remove('hidden');
    fetchLeaderboard();
});

window.closeLeaderboard = function() { lbPanel.classList.add('hidden'); }

const container = document.getElementById('game-container');
function handleStart(e) {
    if(e.cancelable) e.preventDefault();
    if(!lbPanel.classList.contains('hidden')) return;
    if (state === 'PLAYING' && !pouring) {
        pouring = true;
        vibrate(20);
    }
}
function handleEnd(e) {
    if(e.cancelable) e.preventDefault();
    if (state === 'PLAYING' && pouring) {
        pouring = false;
        endGame();
    }
}
container.addEventListener('touchstart', handleStart, {passive: false});
container.addEventListener('touchend', handleEnd, {passive: false});
container.addEventListener('mousedown', handleStart);
container.addEventListener('mouseup', handleEnd);

// --- 游戏核心逻辑 ---
function resetGame() {
    state = 'PLAYING';
    liquidHeight = 0; foamHeight = 0; pouring = false; flowRate = 0; particles = [];
    scoreVal.innerText = '0';
    startScreen.classList.add('hidden');
    resultScreen.classList.add('hidden');
    resultText.classList.remove('show-result');
    uploadStatus.innerText = "";
    vibrate(50);
    loop();
}

function endGame() {
    state = 'END';
    const fillRatio = liquidHeight / glassH;
    let score = 0;
    let mainText = "", cssClass = "", flavorText = "";

    if (fillRatio > 1.0) {
        score = 0; mainText = "YOU SPILLED"; cssClass = "spilled"; flavorText = "贪婪的诅咒";
        vibrate([50, 50, 200]);
    } else if (fillRatio >= 0.95) {
        score = Math.floor(fillRatio * 1000) + 500; mainText = "POUR RESTORED"; cssClass = "success"; flavorText = "传火成功";
        vibrate([50, 100, 50, 100]);
    } else if (fillRatio < 0.2) {
        score = Math.floor(fillRatio * 100); mainText = "HOLLOWED"; cssClass = "spilled"; flavorText = "活尸化";
    } else {
        score = Math.floor(fillRatio * 1000); mainText = "RETRIEVED"; cssClass = "success"; flavorText = "平平无奇";
    }

    resultText.innerText = mainText;
    resultText.className = cssClass;
    resultDetail.innerHTML = `得分: ${score}<br><span style="font-size:0.8rem;color:#666">${flavorText}</span>`;
    
    resultScreen.classList.remove('hidden');
    setTimeout(() => { resultText.classList.add('show-result'); }, 50);

    if(score > 0) uploadScore(score);
}

function loop() {
    if (pouring && state === 'PLAYING') {
        let noise = (Math.random() - 0.5) * 1.5; 
        flowRate = Math.min(flowRate + 0.2, 5 + noise);
        liquidHeight += flowRate * 0.4; 
        foamHeight = Math.min(foamHeight + 0.3, glassH * 0.1);
        if(Math.random() > 0.4) {
            particles.push({
                x: glassX + 10 + Math.random() * (glassW - 20),
                y: glassY + glassH - liquidHeight,
                v: 2 + Math.random() * 3, size: 1 + Math.random() * 3
            });
        }
    } else { flowRate = 0; }

    if (state === 'PLAYING' && liquidHeight > glassH + 10) {
        pouring = false; endGame(); return;
    }

    ctx.fillStyle = '#050505'; ctx.fillRect(0, 0, canvasW, canvasH);
    
    if (pouring) {
        ctx.fillStyle = '#f2c94c'; ctx.fillRect(canvasW/2 - 4, 0, 8, glassY + glassH - liquidHeight + 5);
    }
    const currentLiquidH = Math.min(liquidHeight, glassH + 20);
    if (liquidHeight > 0) {
        ctx.fillStyle = '#f2994a'; 
        ctx.fillRect(glassX + 6, glassY + glassH - currentLiquidH, glassW - 12, currentLiquidH);
        ctx.fillStyle = '#fff5e6';
        ctx.fillRect(glassX + 6, glassY + glassH - currentLiquidH, glassW - 12, foamHeight);
    }
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    for(let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i]; p.y -= p.v;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
        if (p.y < glassY + glassH - liquidHeight) particles.splice(i, 1);
    }
    ctx.strokeStyle = '#cfaa68'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(glassX, glassY);
    ctx.lineTo(glassX, glassY + glassH); ctx.lineTo(glassX + glassW, glassY + glassH);
    ctx.lineTo(glassX + glassW, glassY); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(glassX + glassW*0.15, glassY + glassH*0.1);
    ctx.lineTo(glassX + glassW*0.15, glassY + glassH - glassH*0.1); ctx.stroke();
    ctx.strokeStyle = 'rgba(200, 50, 50, 0.5)'; ctx.lineWidth = 1; ctx.setLineDash([5, 5]);
    ctx.beginPath(); ctx.moveTo(0, glassY); ctx.lineTo(canvasW, glassY); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = '#333'; ctx.fillRect(canvasW/2 - 20, -10, 40, 60);
    ctx.fillStyle = '#cfaa68'; ctx.fillRect(canvasW/2 - 20, 40, 40, 6);

    if (state === 'PLAYING') requestAnimationFrame(loop);
}

function vibrate(pattern) { if (navigator.vibrate) navigator.vibrate(pattern); }

// --- 🔴 Bmob API 核心逻辑 ---

function formatTime(isoString) {
    const date = new Date(isoString);
    return `${date.getMonth()+1}/${date.getDate()} ${date.getHours().toString().padStart(2,'0')}:${date.getMinutes().toString().padStart(2,'0')}`;
}

function uploadScore(score) {
    if(!BMOB_APP_ID.includes("Application")) {
        uploadStatus.innerText = "正在向云端铭刻...";
        
        // 构建请求
        const url = "https://api.bmobcloud.com/1/classes/GameScore";
        const data = {
            playerName: currentPlayerName,
            score: score
        };

        fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Bmob-Application-Id': BMOB_APP_ID,
                'X-Bmob-REST-API-Key': BMOB_API_KEY
            },
            body: JSON.stringify(data)
        })
        .then(res => res.json())
        .then(data => {
            uploadStatus.innerText = "记录已铭刻于云端";
            console.log("Success:", data);
        })
        .catch(err => {
            console.error(err);
            uploadStatus.innerText = "云端连接中断";
        });
    } else {
        uploadStatus.innerText = "API Key 未配置";
    }
}

function fetchLeaderboard() {
    const list = document.getElementById('lb-content');
    list.innerHTML = '<div class="lb-loading">正在召唤灵魂...</div>';

    if(BMOB_APP_ID.includes("Application")) {
        list.innerHTML = '<div class="lb-loading">请配置 API Key</div>';
        return;
    }

    // 查询 GameScore 表，按 score 降序排列，取前 20 个
    const url = "https://api.bmobcloud.com/1/classes/GameScore?order=-score&limit=20";

    fetch(url, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'X-Bmob-Application-Id': BMOB_APP_ID,
            'X-Bmob-REST-API-Key': BMOB_API_KEY
        }
    })
    .then(res => res.json())
    .then(data => {
        list.innerHTML = '';
        if (!data.results || data.results.length === 0) {
            list.innerHTML = '<div class="lb-loading">暂无记录</div>';
            return;
        }

        data.results.forEach((entry, index) => {
            const item = document.createElement('div');
            item.className = 'lb-item';
            // Bmob 自动生成的创建时间是 createdAt
            const timeStr = formatTime(entry.createdAt);
            
            item.innerHTML = `
                <div style="font-weight:bold; width:30px; text-align:center;">${index + 1}</div>
                <div class="lb-name">${entry.playerName}</div>
                <div>
                    <span class="lb-score">${entry.score}</span>
                    <span class="lb-date">${timeStr}</span>
                </div>
            `;
            list.appendChild(item);
        });
    })
    .catch(err => {
        console.error(err);
        list.innerHTML = '<div class="lb-loading">连接中断</div>';
    });
}
