const socket = io();
const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');
const cellSize = 40;
let mySymbol = null;
let board = Array(15).fill().map(() => Array(15).fill(null));
let roomId = 'phong1';

// Hàm vẽ bàn cờ
function drawBoard(board) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (let i = 0; i <= 15; i++) {
    ctx.beginPath();
    ctx.moveTo(i * cellSize, 0);
    ctx.lineTo(i * cellSize, canvas.height);
    ctx.moveTo(0, i * cellSize);
    ctx.lineTo(canvas.width, i * cellSize);
    ctx.stroke();
  }
  // Vẽ X và O
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

// Tham gia phòng
function joinRoom() {
  roomId = document.getElementById('roomId').value;
  socket.emit('joinRoom', roomId);
}

// Xử lý click
canvas.addEventListener('click', (e) => {
  const rect = canvas.getBoundingClientRect();
  const row = Math.floor((e.clientY - rect.top) / cellSize);
  const col = Math.floor((e.clientX - rect.left) / cellSize);
  socket.emit('move', { roomId, row, col });
});

// Nhận cập nhật từ server
socket.on('playerUpdate', (players) => {
  mySymbol = players[socket.id]?.symbol;
  status.textContent = `Bạn là ${mySymbol}. Số người chơi: ${Object.keys(players).length}/2`;
  drawBoard(board); // Vẽ bàn cờ khi tham gia
});

socket.on('updateBoard', ({ board: newBoard, currentPlayer }) => {
  board = newBoard;
  drawBoard(board);
  status.textContent = `Lượt của: ${currentPlayer}`;
});

socket.on('gameOver', (message) => {
  status.textContent = message;
  alert(message);
});

socket.on('roomFull', (message) => {
  alert(message);
});

// Reset game
document.getElementById('reset').addEventListener('click', () => {
  socket.emit('resetGame', roomId);
});

socket.on('resetGame', () => {
  board = Array(15).fill().map(() => Array(15).fill(null));
  drawBoard(board);
  status.textContent = `Bạn là ${mySymbol}. Số người chơi: ${Object.keys(players).length}/2`;
});