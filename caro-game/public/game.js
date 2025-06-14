const socket = io();
const canvas = document.getElementById('board');
if (!canvas) {
  console.error('Canvas element not found!');
} else {
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    console.error('Failed to get 2D context!');
  }
  const status = document.getElementById('status');
  const cellSize = 40;
  let mySymbol = 'X';
  let board = Array(15).fill().map(() => Array(15).fill(null));
  let roomId = 'phong1';
  let isAIMode = false;
  let aiTurn = false;

  // Hàm vẽ bàn cờ
  function drawBoard(board) {
    if (!ctx) {
      console.error('Canvas context is not available');
      return;
    }
    console.log('Drawing board...');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i <= 15; i++) {
      ctx.beginPath();
      ctx.moveTo(i * cellSize, 0);
      ctx.lineTo(i * cellSize, canvas.height);
      ctx.moveTo(0, i * cellSize);
      ctx.lineTo(canvas.width, i * cellSize);
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    for (let row = 0; row < 15; row++) {
      for (let col = 0; col < 15; col++) {
        if (board[row][col] === 'X') {
          ctx.fillStyle = 'red';
          ctx.beginPath();
          ctx.moveTo(col * cellSize + 5, row * cellSize + 5);
          ctx.lineTo(col * cellSize + cellSize - 5, row * cellSize + cellSize - 5);
          ctx.moveTo(col * cellSize + cellSize - 5, row * cellSize + 5);
          ctx.lineTo(col * cellSize + 5, row * cellSize + cellSize - 5);
          ctx.stroke();
        } else if (board[row][col] === 'O') {
          ctx.fillStyle = 'blue';
          ctx.beginPath();
          ctx.arc(col * cellSize + cellSize / 2, row * cellSize + cellSize / 2, 15, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    }
  }

  // Hàm kiểm tra chiến thắng
  function checkWin(row, col, player, board) {
    const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];
    for (let [dx, dy] of directions) {
      let count = 1;
      for (let i = 1; i <= 4; i++) {
        if (row + i * dx < 15 && row + i * dx >= 0 && col + i * dy < 15 && col + i * dy >= 0 && board[row + i * dx][col + i * dy] === player) count++;
        else break;
      }
      for (let i = 1; i <= 4; i++) {
        if (row - i * dx < 15 && row - i * dx >= 0 && col - i * dy < 15 && col - i * dy >= 0 && board[row - i * dx][col - i * dy] === player) count++;
        else break;
      }
      if (count >= 5) return true;
    }
    return false;
  }

  // Tham gia phòng
  function joinRoom() {
    roomId = document.getElementById('roomId').value;
    socket.emit('joinRoom', roomId);
    drawBoard(board); // Vẽ bàn cờ khi tham gia phòng
  }

  // Xử lý click
  canvas.addEventListener('click', (e) => {
    if (isAIMode) {
      handleAIMove(e);
    } else if (!isAIMode && socket.connected) {
      const rect = canvas.getBoundingClientRect();
      const row = Math.floor((e.clientY - rect.top) / cellSize);
      const col = Math.floor((e.clientX - rect.left) / cellSize);
      socket.emit('move', { roomId, row, col });
    }
  });

  // Xử lý di chuyển trong chế độ AI
  function handleAIMove(e) {
    const rect = canvas.getBoundingClientRect();
    const row = Math.floor((e.clientY - rect.top) / cellSize);
    const col = Math.floor((e.clientX - rect.left) / cellSize);

    if (row >= 0 && row < 15 && col >= 0 && col < 15 && !board[row][col] && !aiTurn) {
      board[row][col] = mySymbol;
      drawBoard(board);
      if (checkWin(row, col, mySymbol, board)) {
        status.textContent = 'Bạn thắng!';
        alert('Bạn thắng!');
        return;
      }
      aiTurn = true;
      setTimeout(aiMove, 500);
    }
  }

  // AI di chuyển
  function aiMove() {
    if (!aiTurn) return;

    let found = false;
    while (!found) {
      const row = Math.floor(Math.random() * 15);
      const col = Math.floor(Math.random() * 15);
      if (!board[row][col]) {
        board[row][col] = 'O';
        drawBoard(board);
        if (checkWin(row, col, 'O', board)) {
          status.textContent = 'Máy thắng!';
          alert('Máy thắng!');
          aiTurn = false;
          return;
        }
        aiTurn = false;
        found = true;
      }
    }
  }

  // Reset game
  function resetGameForAI() {
    board = Array(15).fill().map(() => Array(15).fill(null));
    mySymbol = 'X';
    aiTurn = false;
    drawBoard(board);
    status.textContent = 'Chế độ chơi với máy. Bạn đi trước!';
  }

  // Chuyển đổi chế độ
  function toggleAIMode() {
    isAIMode = !isAIMode;
    document.getElementById('toggleAI').textContent = isAIMode ? 'Chuyển sang Chơi với Người' : 'Chơi với Máy';
    if (isAIMode) {
      socket.disconnect();
      resetGameForAI();
    } else {
      socket.connect();
      joinRoom();
    }
  }

  // Nhận cập nhật từ server
  socket.on('playerUpdate', (players) => {
    if (!isAIMode) {
      mySymbol = players[socket.id]?.symbol || 'X';
      status.textContent = `Bạn là ${mySymbol}. Số người chơi: ${Object.keys(players).length}/2`;
      drawBoard(board);
    }
  });

  socket.on('updateBoard', ({ board: newBoard, currentPlayer }) => {
    if (!isAIMode) {
      board = newBoard;
      drawBoard(board);
      status.textContent = `Lượt của: ${currentPlayer}`;
    }
  });

  socket.on('gameOver', (message) => {
    if (!isAIMode) {
      status.textContent = message;
      alert(message);
    }
  });

  socket.on('roomFull', (message) => {
    if (!isAIMode) {
      alert(message);
    }
  });

  document.getElementById('reset').addEventListener('click', () => {
    if (isAIMode) {
      resetGameForAI();
    } else if (socket.connected) {
      socket.emit('resetGame', roomId);
    }
  });

  socket.on('resetGame', () => {
    if (!isAIMode) {
      board = Array(15).fill().map(() => Array(15).fill(null));
      drawBoard(board);
      status.textContent = `Bạn là ${mySymbol}. Số người chơi: ${Object.keys(players).length}/2`;
    }
  });

  // Vẽ bàn cờ ban đầu khi trang 
  window.onload = () => {
    drawBoard(board); // Vẽ bàn cờ ngay khi trang tải
    if (!isAIMode) {
      joinRoom();
    }
  };
}