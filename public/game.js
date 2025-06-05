const socket = io();
const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');
const cellSize = 40;
let mySymbol = null;

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
  for (let row = 0; row < 15; row++) {
    for (let col = 0; col < 15; col++) {
      if (board[row][col] === 'X') {
        ctx.beginPath();
        ctx.moveTo(col * cellSize + 5, row * cellSize + 5);
        ctx.lineTo((col + 1) * cellSize - 5, (row + 1) * cellSize - 5);
        ctx.moveTo((col + 1) * cellSize - 5, row * cellSize + 5);
        ctx.lineTo(col * cellSize + 5, (row + 1) * cellSize - 5);
        ctx.strokeStyle = 'red';
        ctx.stroke();
      } else if (board[row][col] === 'O') {
        ctx.beginPath();
        ctx.arc(col * cellSize + cellSize / 2, row * cellSize + cellSize / 2, cellSize / 2 - 5, 0, 2 * Math.PI);
        ctx.strokeStyle = 'blue';
        ctx.stroke();
      }
    }
  }
}

canvas.addEventListener('click', (e) => {
  const rect = canvas.getBoundingClientRect();
  const row = Math.floor((e.clientY - rect.top) / cellSize);
  const col = Math.floor((e.clientX - rect.left) / cellSize);
  socket.emit('move', { row, col });
});

socket.on('playerUpdate', (players) => {
  mySymbol = players[socket.id].symbol;
  status.textContent = `You are ${mySymbol}. Players: ${Object.keys(players).length}/2`;
});

socket.on('updateBoard', ({ board, currentPlayer }) => {
  drawBoard(board);
  status.textContent = `Current turn: ${currentPlayer}`;
});

socket.on('gameOver', (message) => {
  status.textContent = message;
  alert(message);
});

socket.on('roomFull', (message) => {
  alert(message);
});