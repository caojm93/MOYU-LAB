// ==========================================
// 🔴 配置区域: Bmob 云后端
// ==========================================
const BMOB_APP_ID  = "909d88911b4256680a5bb5d9df1f84e2";
const BMOB_API_KEY = "921bf8d038ac6e5a904e1fab0e8f7ac3";
// ==========================================

// --- 成就配置 ---
const ACHIEVEMENTS = [
    { id: 'first_blood', icon: '🩸', title: '欢迎来到黑魂', desc: '第一次倒酒失败' },
    { id: 'perfect',     icon: '🌞', title: '赞美太阳',    desc: '单次得分超过 1200 分' },
    { id: 'godlike',     icon: '👑', title: '薪王化身',    desc: '单次得分超过 1450 分' },
    { id: 'hollow',      icon: '💀', title: '活尸化',      desc: '累计游玩达到 10 次' },
    { id: 'greed',       icon: '😈', title: '贪婪的诅咒',  desc: '倒酒溢出 (失败)' }
];

// --- 全局变量 ---
let state = 'MENU'; 
let pouring = false;
let liquidHeight = 0, foamHeight = 0, flowRate = 0;
let particles = [];
let currentPlayerName = localStorage.getItem('moyu_username') || "";
let myPlayCount = parseInt(localStorage.getItem('moyu_playcount') || '0');
let myUnlockedAch = JSON.parse(localStorage.getItem('moyu_achievements') || '[]');

// DOM 元素
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
let canvasW, canvasH, glassW, glassH, glassX, glassY;

const startScreen = document.getElementById('start-screen');
const resultScreen = document.getElementById('result-screen');
const resultText = document.getElementById('result-text');
const resultDetail = document.getElementById('result-detail');
const uploadStatus = document.getElementById('upload-status');
const scoreVal = document.getElementById('score-val');
const nameInput = document.getElementById('player-name-input');
const startBtn = document.getElementById('start-btn');

// --- 初始化 ---
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

// 面板控制
function openPanel(id) {
    document.getElementById(id).classList.remove('hidden');
    if(id === 'leaderboard-panel') fetchLeaderboard();
    if(id === 'achievement-panel') renderAchievements();
}
window.closePanel = function(id) { document.getElementById(id).classList.add('hidden'); }

document.getElementById('check-rank-btn').addEventListener('click', (e) => { e.stopPropagation(); openPanel('leaderboard-panel'); });
document.getElementById('open-lb-btn').addEventListener('click', (e) => { e.stopPropagation(); openPanel('leaderboard-panel'); });
document.getElementById('open-ach-btn').addEventListener('click', (e) => { e.stopPropagation(); openPanel('achievement-panel'); });

// 触控处理 (含白名单)
const container = document.getElementById('game-container');
function handleStart(e) {
    const tag = e.target.tagName;
    // 白名单：输入框、按钮、关闭图标、面板内部
    if (tag === 'INPUT' || tag === 'BUTTON' || e.target.classList.contains('lb-close') || e.target.closest('.panel-common')) {
        return; 
    }
    if(e.cancelable) e.preventDefault();
    
    // 如果任何面板打开中，不倒酒
    if(!document.getElementById('leaderboard-panel').classList.contains('hidden')) return;
    if(!document.getElementById('achievement-panel').classList.contains('hidden')) return;

    if (state === 'PLAYING' && !pouring) {
        pouring = true;
        vibrate(20);
    }
}
function handleEnd(e) {
    const tag = e.target.tagName;
    if (tag === 'INPUT' || tag === 'BUTTON' || e.target.classList.contains('lb-close')) return;
    if(e.cancelable) e.preventDefault();
    if (state === 'PLAYING' && pouring) {
        pouring = false; // 惯性模式：仅松手，不立即结算
    }
}
container.addEventListener('touchstart', handleStart, {passive: false});
container.addEventListener('touchend', handleEnd, {passive: false});
container.addEventListener('mousedown', handleStart);
container.addEventListener('mouseup', handleEnd);

// --- 游戏逻辑 ---
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

// 物理循环 (含惯性)
function loop() {
    if (pouring && state === 'PLAYING') {
        flowRate = Math.min(flowRate + 0.15, 5.5); // 加速
    } else {
        if (flowRate > 0) {
            flowRate -= 0.25; // 惯性减速
            if (flowRate < 0) flowRate = 0;
        }
    }

    if (flowRate > 0 && state === 'PLAYING') {
        liquidHeight += flowRate * 0.4;
        foamHeight = Math.min(foamHeight + 0.2, glassH * 0.12);
        if(Math.random() > (0.8 - flowRate * 0.1)) {
            particles.push({
                x: glassX + 10 + Math.random() * (glassW - 20),
                y: glassY + glassH - liquidHeight,
                v: 2 + Math.random() * 3, size: 1 + Math.random() * 3
            });
        }
    }

    // 溢出判定
    if (state === 'PLAYING' && liquidHeight > glassH + 3) {
        pouring = false; flowRate = 0;
        endGame(true); // true = spilled
        return;
    }
    
    // 停止判定
    if (state === 'PLAYING' && !pouring && flowRate <= 0 && liquidHeight > 0) {
        endGame(false);
        return;
    }

    // 绘图
    ctx.fillStyle = '#050505'; ctx.fillRect(0, 0, canvasW, canvasH);
    if (flowRate > 0.1) {
        let w = Math.max(1, flowRate * 2);
        ctx.fillStyle = '#f2c94c'; ctx.fillRect(canvasW/2 - w/2, 0, w, glassY + glassH - liquidHeight + 5);
    }
    const curH = Math.min(liquidHeight, glassH + 20);
    if (liquidHeight > 0) {
        ctx.fillStyle = '#f2994a'; ctx.fillRect(glassX + 6, glassY + glassH - curH, glassW - 12, curH);
        let bob = Math.sin(Date.now() / 150) * 1.5;
        ctx.fillStyle = '#fff5e6'; ctx.fillRect(glassX + 6, glassY + glassH - curH - bob, glassW - 12, foamHeight);
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
    ctx.strokeStyle = 'rgba(200, 50, 50, 0.3)'; ctx.lineWidth = 1; ctx.setLineDash([5, 5]);
    ctx.beginPath(); ctx.moveTo(0, glassY); ctx.lineTo(canvasW, glassY); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = '#333'; ctx.fillRect(canvasW/2 - 20, -10, 40, 60);
    ctx.fillStyle = '#cfaa68'; ctx.fillRect(canvasW/2 - 20, 40, 40, 6);

    if (state === 'PLAYING') requestAnimationFrame(loop);
}

// --- 结算与成就逻辑 ---
function endGame(spilled) {
    state = 'END';
    const fillRatio = liquidHeight / glassH;
    let score = 0;
    let mainText="", cssClass="", flavorText="";

    // 更新本地游玩次数
    myPlayCount++;
    localStorage.setItem('moyu_playcount', myPlayCount);
    
    // 检查成就: 活尸化
    if(myPlayCount >= 10) unlockAch('hollow');

    if (spilled) {
        score = 0; mainText = "YOU SPILLED"; cssClass = "spilled"; flavorText = "贪婪蒙蔽了双眼";
        vibrate([50, 50, 200]);
        // 检查成就: 失败 & 溢出
        if(myPlayCount === 1) unlockAch('first_blood'); 
        unlockAch('greed');
    } else {
        if (fillRatio >= 0.93) {
            const curve = Math.pow((fillRatio - 0.93) / 0.07, 4);
            score = 1000 + Math.floor(curve * 500);
            if (score >= 1480) {
                mainText = "GODLIKE"; flavorText = "神一般的技艺 (S+)"; cssClass = "success";
                vibrate([100, 50, 100, 50, 100]);
                unlockAch('godlike');
            } else if (score >= 1200) {
                mainText = "LEGENDARY"; flavorText = "传火者的荣耀 (S)"; cssClass = "success";
                vibrate([50, 100, 50]);
                unlockAch('perfect');
            } else {
                mainText = "WELL DONE"; flavorText = "尚可一战 (A)"; cssClass = "success";
                vibrate(50);
            }
        } else if (fillRatio < 0.2) {
            score = Math.floor(fillRatio * 100); mainText = "HOLLOWED"; cssClass = "spilled"; flavorText = "活尸化";
            if(myPlayCount === 1) unlockAch('first_blood');
        } else {
            score = Math.floor(fillRatio * 800); mainText = "MEDIOCRE"; cssClass = "spilled"; flavorText = "平平无奇的余灰";
        }
    }

    resultText.innerText = mainText;
    resultText.className = cssClass;
    resultDetail.innerHTML = `得分: <span style="color:#fff;font-size:1.4em">${score}</span><br><span style="font-size:0.8rem;color:#666">${flavorText}</span>`;
    
    resultScreen.classList.remove('hidden');
    setTimeout(() => { resultText.classList.add('show-result'); }, 50);

    // 云端同步
    if(score > 0) uploadScore(score);
    updatePlayerStats(); // 更新受苦次数
}

function unlockAch(id) {
    if(myUnlockedAch.includes(id)) return;
    myUnlockedAch.push(id);
    localStorage.setItem('moyu_achievements', JSON.stringify(myUnlockedAch));
    
    // 显示弹窗
    const achData = ACHIEVEMENTS.find(a => a.id === id);
    if(achData) {
        document.getElementById('toast-name').innerText = achData.title;
        const toast = document.getElementById('ach-toast');
        toast.classList.add('show');
        setTimeout(() => { toast.classList.remove('show'); }, 3000);
    }
}

function renderAchievements() {
    const list = document.getElementById('ach-list');
    document.getElementById('stat-name').innerText = currentPlayerName || '无名不死人';
    document.getElementById('stat-count').innerText = myPlayCount;

    list.innerHTML = ACHIEVEMENTS.map(ach => {
        const isUnlocked = myUnlockedAch.includes(ach.id);
        return `
            <div class="ach-item ${isUnlocked ? 'unlocked' : ''}">
                <div class="ach-img">${ach.icon}</div>
                <div class="ach-detail">
                    <div class="ach-h">${ach.title}</div>
                    <div class="ach-d">${isUnlocked ? ach.desc : '??? (条件未达成)'}</div>
                </div>
            </div>
        `;
    }).join('');
}

// --- Bmob API ---
function vibrate(p) { if(navigator.vibrate) navigator.vibrate(p); }

function formatTime(iso) {
    const d = new Date(iso);
    return `${d.getMonth()+1}/${d.getDate()} ${d.getHours()}:${d.getMinutes() < 10 ? '0'+d.getMinutes() : d.getMinutes()}`;
}

// 1. 上传分数 (GameScore)
function uploadScore(score) {
    if(BMOB_APP_ID.includes("填入")) { uploadStatus.innerText = "API Key 未配置"; return; }
    uploadStatus.innerText = "正在铭刻...";
    fetch("https://api.bmobcloud.com/1/classes/GameScore", {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Bmob-Application-Id': BMOB_APP_ID, 'X-Bmob-REST-API-Key': BMOB_API_KEY },
        body: JSON.stringify({ playerName: currentPlayerName, score: score })
    }).then(() => uploadStatus.innerText = "分数已铭刻").catch(() => uploadStatus.innerText = "连接失败");
}

// 2. 更新受苦次数 (PlayerStats) - 稍微复杂，需要先查后更
function updatePlayerStats() {
    if(BMOB_APP_ID.includes("填入")) return;
    const headers = { 'Content-Type': 'application/json', 'X-Bmob-Application-Id': BMOB_APP_ID, 'X-Bmob-REST-API-Key': BMOB_API_KEY };
    
    // 第一步：查询该玩家是否存在
    const queryUrl = `https://api.bmobcloud.com/1/classes/PlayerStats?where={"playerName":"${currentPlayerName}"}`;
    
    fetch(queryUrl, { method: 'GET', headers: headers })
    .then(res => res.json())
    .then(data => {
        if(data.results && data.results.length > 0) {
            // 玩家存在，更新次数 (+1)
            const objId = data.results[0].objectId;
            const currentCount = data.results[0].playCount || 0;
            fetch(`https://api.bmobcloud.com/1/classes/PlayerStats/${objId}`, {
                method: 'PUT', headers: headers,
                body: JSON.stringify({ playCount: currentCount + 1 })
            });
        } else {
            // 玩家不存在，创建新记录
            fetch(`https://api.bmobcloud.com/1/classes/PlayerStats`, {
                method: 'POST', headers: headers,
                body: JSON.stringify({ playerName: currentPlayerName, playCount: 1 })
            });
        }
    });
}

// 3. 获取排行榜
function fetchLeaderboard() {
    const list = document.getElementById('lb-content');
    list.innerHTML = '<div style="text-align:center;color:#666;padding:20px;">正在召唤灵魂...</div>';
    if(BMOB_APP_ID.includes("填入")) return;

    fetch("https://api.bmobcloud.com/1/classes/GameScore?order=-score&limit=20", {
        headers: { 'X-Bmob-Application-Id': BMOB_APP_ID, 'X-Bmob-REST-API-Key': BMOB_API_KEY }
    })
    .then(res => res.json())
    .then(data => {
        list.innerHTML = '';
        if(!data.results || data.results.length === 0) { list.innerHTML = '<div style="text-align:center;padding:20px;">暂无记录</div>'; return; }
        data.results.forEach((entry, i) => {
            list.innerHTML += `
                <div class="lb-item">
                    <div style="font-weight:bold;width:25px;">${i+1}</div>
                    <div class="lb-name">${entry.playerName}</div>
                    <div style="text-align:right;">
                        <span class="lb-score">${entry.score}</span>
                        <span class="lb-date">${formatTime(entry.createdAt)}</span>
                    </div>
                </div>`;
        });
    });
}
