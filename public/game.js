const socket = io();
const canvas = document.getElementById('board');
if (!canvas) {
  console.error('Canvas element not found!');
  alert('Không thể tải bàn cờ. Vui lòng làm mới trang.');
} else {
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    console.error('Failed to get 2D context!');
    alert('Không thể khởi tạo bàn cờ. Vui lòng thử lại.');
  }
  const status = document.getElementById('status');
  const score = document.getElementById('score');
  const timer = document.getElementById('timer');
  const urlParams = new URLSearchParams(window.location.search);
  const size = urlParams.get('size') || '15x15';
  const [rows, cols] = size.split('x').map(Number);
  const cellSize = canvas.width / cols;
  const winLength = size === '3x3' ? 3 : 5;
  let mySymbol = 'X';
  let board = Array(rows).fill().map(() => Array(cols).fill(null));
  let roomId = '';
  let isAIMode = false;
  let aiTurn = false;
  let currentPlayer = 'X';
  let playerCount = 0; // Thêm biến đếm số người chơi
  let isGameReady = false; // Thêm biến kiểm tra trạng thái sẵn sàng

  console.log(`Game initialized: rows=${rows}, cols=${cols}, cellSize=${cellSize}, canvas.width=${canvas.width}, canvas.height=${canvas.height}, winLength=${winLength}`);

  isAIMode = urlParams.get('mode') === 'ai';
  const urlRoomId = urlParams.get('roomId');
  if (!isAIMode && urlRoomId) {
    roomId = urlRoomId;
  }

  function drawBoard(board) {
    if (!ctx) {
      console.error('Canvas context is null or undefined!');
      return;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i <= cols; i++) {
      ctx.beginPath();
      ctx.moveTo(i * cellSize, 0);
      ctx.lineTo(i * cellSize, canvas.height);
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    for (let i = 0; i <= rows; i++) {
      ctx.beginPath();
      ctx.moveTo(0, i * cellSize);
      ctx.lineTo(canvas.width, i * cellSize);
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        if (board[row][col] === 'X') {
          ctx.strokeStyle = 'red';
          ctx.lineWidth = 4;
          ctx.beginPath();
          const margin = cellSize * 0.1;
          ctx.moveTo(col * cellSize + margin, row * cellSize + margin);
          ctx.lineTo(col * cellSize + cellSize - margin, row * cellSize + cellSize - margin);
          ctx.moveTo(col * cellSize + cellSize - margin, row * cellSize + margin);
          ctx.lineTo(col * cellSize + margin, row * cellSize + cellSize - margin);
          ctx.stroke();
        } else if (board[row][col] === 'O') {
          ctx.strokeStyle = 'blue';
          ctx.lineWidth = 4;
          ctx.beginPath();
          const radius = cellSize * 0.3;
          ctx.arc(col * cellSize + cellSize / 2, row * cellSize + cellSize / 2, radius, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    }
  }

  function checkWin(row, col, player, board) {
    const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];
    console.log(`Checking win at row=${row}, col=${col}, player=${player}, winLength=${winLength}, currentPlayer=${currentPlayer}`);

    for (let [dx, dy] of directions) {
      let count = 1;
      console.log(`Direction: dx=${dx}, dy=${dy}, starting at ${row},${col}`);
      for (let i = 1; i < winLength; i++) {
        const newRow = row + i * dx;
        const newCol = col + i * dy;
        if (newRow >= 0 && newRow < rows && newCol >= 0 && newCol < cols && board[newRow][newCol] === player) {
          count++;
          console.log(`Found match at ${newRow},${newCol}, count=${count}`);
        } else {
          console.log(`Stopped at ${newRow},${newCol}, value=${board[newRow]?.[newCol] || 'out of bounds'}`);
          break;
        }
      }
      for (let i = 1; i < winLength; i++) {
        const newRow = row - i * dx;
        const newCol = col - i * dy;
        if (newRow >= 0 && newRow < rows && newCol >= 0 && newCol < cols && board[newRow][newCol] === player) {
          count++;
          console.log(`Found match at ${newRow},${newCol}, count=${count}`);
        } else {
          console.log(`Stopped at ${newRow},${newCol}, value=${board[newRow]?.[newCol] || 'out of bounds'}`);
          break;
        }
      }
      if (count >= winLength) {
        console.log(`Win detected with count=${count} in direction dx=${dx}, dy=${dy} for player=${player}`);
        return true;
      }
    }
    console.log('No win detected.');
    return false;
  }

  function joinRoom() {
    if (!isAIMode && roomId) {
      const user = JSON.parse(localStorage.getItem('user'));
      const username = user ? user.username : 'Khách';
      socket.emit('joinRoom', roomId, size, username, urlParams.get('mode') || 'normal');
      drawBoard(board);
    } else if (!isAIMode) {
      alert('Không có mã phòng để tham gia!');
    }
  }

  // Thêm hàm kiểm tra điều kiện đánh cờ
  function canMakeMove() {
    if (isAIMode) return !aiTurn;
    return isGameReady && currentPlayer === mySymbol;
  }

  // Bọc sự kiện click gốc để thêm kiểm tra
  const originalOnClick = canvas.onclick;
  canvas.onclick = function(e) {
    if (!canMakeMove()) {
      if (!isGameReady && !isAIMode) {
        alert('Vui lòng chờ đủ 2 người chơi để bắt đầu!');
      }
      return;
    }
    
    if (originalOnClick) {
      originalOnClick.call(canvas, e);
    } else {
      const rect = canvas.getBoundingClientRect();
      const row = Math.floor((e.clientY - rect.top) / cellSize);
      const col = Math.floor((e.clientX - rect.left) / cellSize);
      console.log(`Click event: clientY=${e.clientY}, rect.top=${rect.top}, row=${row}, clientX=${e.clientX}, rect.left=${rect.left}, col=${col}, rows=${rows}, cols=${cols}`);

      if (row >= 0 && row < rows && col >= 0 && col < cols) {
        if (isAIMode && !aiTurn && !board[row][col]) {
          handleAIMode(row, col);
        } else if (!isAIMode && socket.connected && roomId && !board[row][col] && currentPlayer === mySymbol) {
          socket.emit('move', { roomId, row, col });
          console.log(`Sent move to server: row=${row}, col=${col}`);
        }
      }
    }
  };

  function handleAIMode(row, col) {
    if (row >= 0 && row < rows && col >= 0 && col < cols && !board[row][col] && !aiTurn) {
      board[row][col] = mySymbol;
      drawBoard(board);
      console.log(`Player move: row=${row}, col=${col}, board=`, board);
      currentPlayer = mySymbol;
      if (checkWin(row, col, mySymbol, board)) {
        status.textContent = 'Bạn thắng!';
        alert('Bạn thắng!');
        return;
      }
      aiTurn = true;
      setTimeout(aiMove, 500);
    }
  }

  function aiMove() {
    if (!aiTurn) return;

    let found = false;
    let bestRow, bestCol;

    for (let row = 0; row < rows && !found; row++) {
      for (let col = 0; col < cols && !found; col++) {
        if (!board[row][col]) {
          board[row][col] = 'O';
          if (checkWin(row, col, 'O', board)) {
            bestRow = row;
            bestCol = col;
            found = true;
          }
          board[row][col] = null;
        }
      }
    }

    if (!found) {
      while (!found) {
        const row = Math.floor(Math.random() * rows);
        const col = Math.floor(Math.random() * cols);
        if (!board[row][col]) {
          bestRow = row;
          bestCol = col;
          found = true;
        }
      }
    }

    board[bestRow][bestCol] = 'O';
    drawBoard(board);
    console.log(`AI move: row=${bestRow}, col=${bestCol}, board=`, board);
    currentPlayer = 'O';
    if (checkWin(bestRow, bestCol, 'O', board)) {
      status.textContent = 'Máy thắng!';
      alert('Máy thắng!');
      aiTurn = false;
      return;
    }
    aiTurn = false;
  }

  function resetGameForAI() {
    board = Array(rows).fill().map(() => Array(cols).fill(null));
    mySymbol = 'X';
    aiTurn = false;
    currentPlayer = 'X';
    drawBoard(board);
    status.textContent = 'Chế độ chơi với máy. Bạn đi trước!';
  }

  socket.on('playerUpdate', ({ players, usernames, size, mode }) => {
    if (!isAIMode) {
      mySymbol = players[socket.id]?.symbol || 'X';
      currentPlayer = mySymbol;
      playerCount = Object.keys(players).length;
      isGameReady = playerCount >= 2; // Cập nhật trạng thái sẵn sàng
      const user = JSON.parse(localStorage.getItem('user'));
      const myUsername = user ? user.username : 'Khách';
      const opponentUsername = Object.values(usernames).find(u => u !== myUsername) || 'Chưa có đối thủ';
      status.textContent = `Bạn là ${mySymbol} (${myUsername}). Đối thủ: ${opponentUsername}. Số người chơi: ${playerCount}/2`;
      if (mode === 'timed' && playerCount === 2) {
        timer.textContent = `Thời gian còn lại: 30s`;
      }
      drawBoard(board);
    }
  });

  socket.on('opponentLeft', (message) => {
    if (!isAIMode) {
      status.textContent = message;
      timer.textContent = '';
      alert(message);
      board = Array(rows).fill().map(() => Array(cols).fill(null));
      isGameReady = false; // Đặt lại trạng thái sẵn sàng
      drawBoard(board);
      window.location.href = `/home.html?mode=${urlParams.get('mode') || 'normal'}&size=${size}`;
    }
  });

  socket.on('updateBoard', ({ board: newBoard, currentPlayer: serverCurrentPlayer }) => {
    if (!isAIMode) {
      board = newBoard.map(row => [...row]);
      drawBoard(board);
      currentPlayer = serverCurrentPlayer;
      const user = JSON.parse(localStorage.getItem('user'));
      const myUsername = user ? user.username : 'Khách';
      status.textContent = `Lượt của: ${currentPlayer === mySymbol ? 'Bạn' : 'Đối thủ'}`;
    }
  });

  socket.on('updateTimer', ({ timeLeft }) => {
    if (!isAIMode && timer) {
      timer.textContent = `Thời gian còn lại: ${timeLeft}s`;
    }
  });

  socket.on('gameOver', (message) => {
    if (!isAIMode) {
      status.textContent = message;
      timer.textContent = '';
      alert(message);
    }
  });

  socket.on('roomFull', (message) => {
    if (!isAIMode) {
      alert(message);
      window.location.href = `/home.html?mode=${urlParams.get('mode') || 'normal'}&size=${size}`;
    }
  });

  socket.on('updateScores', (scores) => {
    if (score) {
      score.textContent = `Điểm của bạn: ${scores[socket.id] || 0}`;
    }
  });

  document.getElementById('reset').addEventListener('click', () => {
    if (isAIMode) {
      resetGameForAI();
    } else if (socket.connected && roomId) {
      socket.emit('resetGame', roomId);
    }
  });

  socket.on('resetGame', () => {
    if (!isAIMode) {
      board = Array(rows).fill().map(() => Array(cols).fill(null));
      isGameReady = false; // Đặt lại trạng thái sẵn sàng khi reset
      drawBoard(board);
      timer.textContent = '';
      status.textContent = `Bạn là ${mySymbol}. Chờ đối thủ...`;
    }
  });

  window.addEventListener('beforeunload', () => {
    if (!isAIMode && socket.connected && roomId) {
      socket.emit('leaveRoom', roomId);
    }
  });

  window.onload = () => {
    console.log('Window loaded, initializing game...');
    if (ctx) {
      drawBoard(board);
      console.log('Board drawn successfully.');
    } else {
      console.error('Context is null after onload!');
    }
    if (isAIMode) {
      resetGameForAI();
    } else if (roomId) {
      joinRoom();
    }
  };
}