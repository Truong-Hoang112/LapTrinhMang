const socket = io();
const canvas = document.getElementById('board');

if (!canvas) {
    alert('Lỗi nghiêm trọng: Không tìm thấy element #board!');
} else {
    const ctx = canvas.getContext('2d');
    const statusEl = document.getElementById('status');
    const timerEl = document.getElementById('timer');
    const rematchBtn = document.getElementById('rematchBtn');
    const surrenderBtn = document.getElementById('surrenderBtn');
    const offerDrawBtn = document.getElementById('offerDrawBtn');
    const undoBtn = document.getElementById('undoBtn');

    let board = [], rows, cols, cellSize, winLength, mySymbol = '', currentPlayer = '', isGameReady = false;

    const urlParams = new URLSearchParams(window.location.search);
    const roomId = urlParams.get('roomId');
    const requestedSize = urlParams.get('size');
    const requestedMode = urlParams.get('mode');

    function initializeBoard(sizeStr) {
        if (!sizeStr) return;
        [rows, cols] = sizeStr.split('x').map(Number);
        winLength = sizeStr === '3x3' ? 3 : 5;
        cellSize = 600 / cols;
        canvas.width = 600;
        canvas.height = (rows / cols) * 600;
        drawGrid();
    }
    function drawGrid() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        for (let i = 0; i <= cols; i++) { ctx.beginPath(); ctx.moveTo(i * cellSize, 0); ctx.lineTo(i * cellSize, canvas.height); ctx.stroke(); }
        for (let i = 0; i <= rows; i++) { ctx.beginPath(); ctx.moveTo(0, i * cellSize); ctx.lineTo(canvas.width, i * cellSize); ctx.stroke(); }
    }
    function drawPieces() {
        if (!board) return;
        ctx.lineWidth = 4;
        for (let r = 0; r < rows; r++) { for (let c = 0; c < cols; c++) { const p = board[r][c]; if (!p) continue; const cx = c * cellSize + cellSize / 2, cy = r * cellSize + cellSize / 2; ctx.beginPath(); if (p === 'X') { ctx.strokeStyle = 'red'; const m = cellSize * 0.15; ctx.moveTo(cx - m, cy - m); ctx.lineTo(cx + m, cy + m); ctx.moveTo(cx + m, cy - m); ctx.lineTo(cx - m, cy + m); } else { ctx.strokeStyle = 'blue'; ctx.arc(cx, cy, cellSize * 0.35, 0, Math.PI * 2); } ctx.stroke(); } }
    }

    // --- XỬ LÝ SỰ KIỆN TỪ SERVER ---
    socket.on('playerUpdate', (data) => {
        isGameReady = Object.keys(data.players).length === 2;
        [surrenderBtn, offerDrawBtn, undoBtn].forEach(btn => btn.disabled = !isGameReady);
        if(rematchBtn) rematchBtn.style.display = 'none';
        
        initializeBoard(data.size);
        board = data.board;
        currentPlayer = data.currentPlayer;
        mySymbol = data.players[socket.id]?.symbol || '';
        drawPieces();
        const turnText = (currentPlayer === mySymbol) ? 'Lượt của BẠN' : 'Lượt của đối thủ';
        statusEl.textContent = !isGameReady ? `Phòng: ${roomId}. Chờ đối thủ...` : `Bạn là quân ${mySymbol}. ${turnText}.`;
    });
    socket.on('updateBoard', (data) => {
        board = data.board;
        currentPlayer = data.currentPlayer;
        drawGrid();
        drawPieces();
        const turnText = (currentPlayer === mySymbol) ? 'Lượt của BẠN' : 'Lượt của đối thủ';
        statusEl.textContent = `Bạn là quân ${mySymbol}. ${turnText}.`;
    });
    socket.on('gameOver', (message) => {
        isGameReady = false;
        alert(message);
        if (rematchBtn) { rematchBtn.style.display = 'block'; rematchBtn.disabled = false; rematchBtn.textContent = 'Chơi Lại'; }
        [surrenderBtn, offerDrawBtn, undoBtn].forEach(btn => btn.disabled = true);
    });
    socket.on('drawOffered', (message) => {
        if (confirm(message + '\nBạn có đồng ý không?')) {
            socket.emit('respondToDraw', { roomId, accepted: true });
        } else {
            socket.emit('respondToDraw', { roomId, accepted: false });
        }
    });
    socket.on('drawResponse', (message) => { alert(message); });
    socket.on('undoRequested', (message) => {
        if (confirm(message + '\nBạn có đồng ý không?')) {
            socket.emit('respondToUndo', { roomId, accepted: true });
        } else {
            socket.emit('respondToUndo', { roomId, accepted: false });
        }
    });
    socket.on('undoResponse', (message) => { alert(message); });
    socket.on('opponentWantsRematch', () => {
        alert('Đối thủ muốn chơi lại!');
        statusEl.textContent = 'Đối thủ muốn chơi lại! Nhấn "Chơi Lại" để bắt đầu.';
    });
    
    // --- TƯƠNG TÁC NGƯỜI DÙNG ---
    canvas.addEventListener('click', (e) => {
        if (!isGameReady || currentPlayer !== mySymbol) return;
        const rect = canvas.getBoundingClientRect();
        const row = Math.floor((e.clientY - rect.top) / cellSize);
        const col = Math.floor((e.clientX - rect.left) / cellSize);
        if (row >= 0 && row < rows && col >= 0 && col < cols && !board[row][col]) {
            socket.emit('move', { roomId, row, col });
        }
    });
    if (rematchBtn) {
        rematchBtn.addEventListener('click', () => {
            socket.emit('requestRematch', roomId);
            rematchBtn.disabled = true;
            rematchBtn.textContent = 'Đang chờ...';
        });
    }
    if (surrenderBtn) {
        surrenderBtn.addEventListener('click', () => {
            if (confirm('Bạn có chắc muốn đầu hàng?')) {
                socket.emit('surrender', roomId);
            }
        });
    }
    if (offerDrawBtn) {
        offerDrawBtn.addEventListener('click', () => {
            offerDrawBtn.disabled = true;
            setTimeout(() => { if(isGameReady) offerDrawBtn.disabled = false; }, 5000); // Mở lại sau 5s nếu game còn chạy
            socket.emit('offerDraw', roomId);
            alert('Đã gửi lời cầu hòa.');
        });
    }
    if (undoBtn) {
        undoBtn.addEventListener('click', () => {
            undoBtn.disabled = true;
            setTimeout(() => { if(isGameReady) undoBtn.disabled = false; }, 5000); // Mở lại sau 5s nếu game còn chạy
            socket.emit('requestUndo', roomId);
        });
    }

    // --- KHỞI ĐỘNG KHI TẢI TRANG ---
    if (roomId && requestedSize) {
        const user = JSON.parse(localStorage.getItem('user'));
        socket.emit('joinRoom', { roomId, size: requestedSize, username: user ? user.username : 'Khách', mode: requestedMode || 'normal' });
        statusEl.textContent = `Đang vào phòng ${roomId}...`;
    } else {
        statusEl.textContent = 'Lỗi: Không có thông tin phòng.';
    }
}