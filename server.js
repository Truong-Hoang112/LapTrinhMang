const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static('public'));

// Trạng thái trò chơi
let board = Array(15).fill().map(() => Array(15).fill(null));
let currentPlayer = 'X';
let players = {}; // Lưu danh sách người chơi trong phòng
let room = null;

// Kiểm tra điều kiện thắng
function checkWin(row, col, player) {
  const directions = [
    [0, 1], [1, 0], [1, 1], [1, -1] // Ngang, dọc, chéo chính, chéo phụ
  ];
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

io.on('connection', (socket) => {
  console.log('A player connected:', socket.id);

  // Gán người chơi vào phòng
  if (!room || Object.keys(players).length < 2) {
    if (!room) room = 'room1';
    players[socket.id] = { symbol: Object.keys(players).length === 0 ? 'X' : 'O', ready: false };
    socket.join(room);
    io.to(room).emit('playerUpdate', players);
  } else {
    socket.emit('roomFull', 'Phòng đã đủ người chơi.');
    socket.disconnect();
    return;
  }

  // Khi người chơi đánh
  socket.on('move', ({ row, col }) => {
    if (players[socket.id].symbol !== currentPlayer || board[row][col]) return;
    
    board[row][col] = currentPlayer;
    io.to(room).emit('updateBoard', { board, currentPlayer });
    
    if (checkWin(row, col, currentPlayer)) {
      io.to(room).emit('gameOver', `${currentPlayer} wins!`);
      board = Array(15).fill().map(() => Array(15).fill(null));
      currentPlayer = 'X';
    } else {
      currentPlayer = currentPlayer === 'X' ? 'O' : 'X';
      io.to(room).emit('updateBoard', { board, currentPlayer });
    }
  });

  // Xử lý ngắt kết nối
  socket.on('disconnect', () => {
    console.log('Player disconnected:', socket.id);
    delete players[socket.id];
    if (Object.keys(players).length === 0) {
      room = null;
      board = Array(15).fill().map(() => Array(15).fill(null));
      currentPlayer = 'X';
    }
    io.to(room).emit('playerUpdate', players);
  });
});

server.listen(3000, () => {
  console.log('Server is running on port 3000');
});