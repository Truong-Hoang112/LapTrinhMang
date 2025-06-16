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
  const urlParams = new URLSearchParams(window.location.search);
  const size = urlParams.get('size') || '15x15';
  const [rows, cols] = size.split('x').map(Number);
  const cellSize = canvas.width / cols; // Sử dụng giá trị từ canvas
  let mySymbol = 'X';
  let board = Array(rows).fill().map(() => Array(cols).fill(null));
  let roomId = '';
  let isAIMode = false;
  let aiTurn = false;
  let currentPlayer = 'X';

  console.log(`Game initialized: rows=${rows}, cols=${cols}, cellSize=${cellSize}, canvas.width=${canvas.width}, canvas.height=${canvas.height}`);

  // Lấy tham số mode và roomId từ URL
  isAIMode = urlParams.get('mode') === 'ai';
  const urlRoomId = urlParams.get('roomId');
  if (!isAIMode && urlRoomId) {
    roomId = urlRoomId;
  }

  // Hàm vẽ bàn cờ
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
          ctx.fillStyle = 'red';
          ctx.beginPath();
          const margin = cellSize * 0.1; // Khoảng cách 10% từ biên
          ctx.moveTo(col * cellSize + margin, row * cellSize + margin);
          ctx.lineTo(col * cellSize + cellSize - margin, row * cellSize + cellSize - margin);
          ctx.moveTo(col * cellSize + cellSize - margin, row * cellSize + margin);
          ctx.lineTo(col * cellSize + margin, row * cellSize + cellSize - margin);
          ctx.stroke();
        } else if (board[row][col] === 'O') {
          ctx.fillStyle = 'blue';
          ctx.beginPath();
          const radius = cellSize * 0.3; // Bán kính 30% của ô
          ctx.arc(col * cellSize + cellSize / 2, row * cellSize + cellSize / 2, radius, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    }
  }

  // Hàm kiểm tra chiến thắng với debug chi tiết
  function checkWin(row, col, player, board) {
    const directions = [[0, 1], [1, 0], [1, 1], [1, -1]]; // Ngang, dọc, chéo chính, chéo phụ
    const winLength = rows === 3 ? 3 : 5; // 3 cho 3x3, 5 cho 15x15
    console.log(`Checking win at row=${row}, col=${col}, player=${player}, winLength=${winLength}, currentPlayer=${currentPlayer}`);

    for (let [dx, dy] of directions) {
      let count = 1;
      console.log(`Direction: dx=${dx}, dy=${dy}, starting at ${row},${col}`);
      // Kiểm tra phía trước
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
      // Kiểm tra phía sau
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

  // Tham gia phòng
  function joinRoom() {
    if (!isAIMode && roomId) {
      socket.emit('joinRoom', roomId);
      drawBoard(board);
    } else if (!isAIMode) {
      alert('Không có mã phòng để tham gia!');
    }
  }

  // Xử lý click
  canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const row = Math.floor((e.clientY - rect.top) / cellSize);
    const col = Math.floor((e.clientX - rect.left) / cellSize);
    console.log(`Click event: clientY=${e.clientY}, rect.top=${rect.top}, row=${row}, clientX=${e.clientX}, rect.left=${rect.left}, col=${col}, rows=${rows}, cols=${cols}`);

    if (row >= 0 && row < rows && col >= 0 && col < cols) {
      if (isAIMode && !aiTurn && !board[row][col]) {
        handleAIMove(row, col);
      } else if (!isAIMode && socket.connected && roomId && !board[row][col]) {
        socket.emit('move', { roomId, row, col });
        console.log(`Sent move to server: row=${row}, col=${col}`);
      }
    }
  });

  // Xử lý di chuyển trong chế độ AI
  function handleAIMove(row, col) {
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

  // AI di chuyển
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

  // Reset game
  function resetGameForAI() {
    board = Array(rows).fill().map(() => Array(cols).fill(null));
    mySymbol = 'X';
    aiTurn = false;
    currentPlayer = 'X';
    drawBoard(board);
    status.textContent = 'Chế độ chơi với máy. Bạn đi trước!';
  }

  // Nhận cập nhật từ server
  socket.on('playerUpdate', (players) => {
    if (!isAIMode) {
      mySymbol = players[socket.id]?.symbol || 'X';
      currentPlayer = mySymbol;
      status.textContent = `Bạn là ${mySymbol}. Số người chơi: ${Object.keys(players).length}/2`;
      drawBoard(board);
    }
  });

  socket.on('updateBoard', ({ board: newBoard, currentPlayer: serverCurrentPlayer }) => {
    if (!isAIMode) {
      board = newBoard.map(row => [...row]);
      drawBoard(board);
      currentPlayer = serverCurrentPlayer;
      status.textContent = `Lượt của: ${currentPlayer === mySymbol ? 'Bạn' : 'Đối thủ'}`;
      // Kiểm tra chiến thắng cho người chơi vừa đi
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          if (board[row][col] === currentPlayer) {
            if (checkWin(row, col, currentPlayer, board)) {
              status.textContent = `${currentPlayer === mySymbol ? 'Bạn' : 'Đối thủ'} thắng!`;
              alert(`${currentPlayer === mySymbol ? 'Bạn' : 'Đối thủ'} thắng!`);
              return;
            }
          }
        }
      }
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

  socket.on('updateScores', (scores) => {
    if (score) {
      score.textContent = `Điểm của bạn: ${scores[mySymbol] || 0}`;
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
      drawBoard(board);
      status.textContent = `Bạn là ${mySymbol}. Số người chơi: ${Object.keys(players).length}/2`;
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