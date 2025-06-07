const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static('public'));

// Khởi tạo dữ liệu điểm số
let scores = {};
try {
  const data = fs.readFileSync('scores.json', 'utf8');
  scores = data ? JSON.parse(data) : {};
} catch (err) {
  if (err.code === 'ENOENT') {
    fs.writeFileSync('scores.json', '{}'); // Tạo file mới nếu không tồn tại
    scores = {};
  } else {
    console.error('Error reading scores.json:', err.message);
    fs.writeFileSync('scores.json', '{}'); // Tạo file mới nếu có lỗi phân tích
    scores = {};
  }
}

// Trạng thái trò chơi
let rooms = {}; // Lưu trạng thái các phòng

// Hàm kiểm tra chiến thắng
function checkWin(row, col, player, board) {
  const directions = [[0, 1], [1, 0], [1, 1], [1, -1]]; // Ngang, dọc, chéo chính, chéo phụ
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

  // Xử lý tham gia phòng
  socket.on('joinRoom', (roomId) => {
    if (!rooms[roomId] || Object.keys(rooms[roomId].players).length < 2) {
      socket.join(roomId);
      rooms[roomId] = rooms[roomId] || { board: Array(15).fill().map(() => Array(15).fill(null)), currentPlayer: 'X', players: {} };
      rooms[roomId].players[socket.id] = { symbol: Object.keys(rooms[roomId].players).length === 0 ? 'X' : 'O' };
      io.to(roomId).emit('playerUpdate', rooms[roomId].players);
    } else {
      socket.emit('roomFull', 'Phòng đã đầy!');
    }
  });

  // Xử lý di chuyển
  socket.on('move', ({ roomId, row, col }) => {
    if (!rooms[roomId] || !rooms[roomId].players[socket.id] || rooms[roomId].players[socket.id].symbol !== rooms[roomId].currentPlayer || rooms[roomId].board[row][col]) return;

    rooms[roomId].board[row][col] = rooms[roomId].currentPlayer;
    io.to(roomId).emit('updateBoard', { board: [...rooms[roomId].board], currentPlayer: rooms[roomId].currentPlayer });

    if (checkWin(row, col, rooms[roomId].currentPlayer, rooms[roomId].board)) {
      const winner = rooms[roomId].currentPlayer;
      scores[winner] = (scores[winner] || 0) + 1;
      fs.writeFileSync('scores.json', JSON.stringify(scores));
      io.to(roomId).emit('updateScores', scores);
      io.to(roomId).emit('gameOver', `${winner} wins!`);
      rooms[roomId].board = Array(15).fill().map(() => Array(15).fill(null));
      rooms[roomId].currentPlayer = 'X';
      rooms[roomId].players = {};
    } else {
      rooms[roomId].currentPlayer = rooms[roomId].currentPlayer === 'X' ? 'O' : 'X';
      io.to(roomId).emit('updateBoard', { board: [...rooms[roomId].board], currentPlayer: rooms[roomId].currentPlayer });
    }
  });

  // Xử lý ngắt kết nối
  socket.on('disconnect', () => {
    console.log('Player disconnected:', socket.id);
    for (let roomId in rooms) {
      if (rooms[roomId].players[socket.id]) {
        delete rooms[roomId].players[socket.id];
        io.to(roomId).emit('playerUpdate', rooms[roomId].players);
        if (Object.keys(rooms[roomId].players).length === 0) {
          delete rooms[roomId];
        }
        break;
      }
    }
  });

  // Reset game
  socket.on('resetGame', (roomId) => {
    if (rooms[roomId]) {
      rooms[roomId].board = Array(15).fill().map(() => Array(15).fill(null));
      rooms[roomId].currentPlayer = 'X';
      io.to(roomId).emit('resetGame');
    }
  });
});

server.listen(3000, () => {
  console.log('Server is running on port 3000');
});