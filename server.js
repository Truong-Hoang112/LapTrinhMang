const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const fs = require('fs');
const bcrypt = require('bcrypt');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static('public'));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/index.html', (req, res, next) => {
  if (req.headers['sec-websocket-protocol']) {
    return next();
  }
  res.redirect('/home.html');
});

let users = {};
try {
  const data = fs.readFileSync('users.json', 'utf8');
  users = data ? JSON.parse(data) : {};
} catch (err) {
  if (err.code === 'ENOENT') {
    fs.writeFileSync('users.json', '{}');
    users = {};
  } else {
    console.error('Lỗi đọc file users.json:', err.message);
    fs.writeFileSync('users.json', '{}');
    users = {};
  }
}

function saveUsers() {
  const data = JSON.stringify(users, null, 2);
  fs.writeFileSync('users.json', data, { flag: 'w' });
}

let scores = {};
try {
  const data = fs.readFileSync('scores.json', 'utf8');
  scores = data ? JSON.parse(data) : {};
} catch (err) {
  if (err.code === 'ENOENT') {
    fs.writeFileSync('scores.json', '{}');
    scores = {};
  } else {
    console.error('Lỗi đọc file scores.json:', err.message);
    fs.writeFileSync('scores.json', '{}');
    scores = {};
  }
}

let rooms = {};

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

io.on('connection', (socket) => {
  console.log('Người chơi đã kết nối:', socket.id);

  socket.on('register', async ({ username, password }) => {
    if (users[username]) {
      socket.emit('registerResponse', {
        success: false,
        message: 'Tên đăng nhập đã tồn tại!'
      });
      return;
    }

    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      users[username] = {
        password: hashedPassword,
        score: 0
      };
      saveUsers();
      socket.emit('registerResponse', {
        success: true,
        message: 'Đăng ký thành công!'
      });
    } catch (error) {
      socket.emit('registerResponse', {
        success: false,
        message: 'Lỗi đăng ký!'
      });
    }
  });

  socket.on('login', async ({ username, password }) => {
    const user = users[username];
    if (!user) {
      socket.emit('loginResponse', {
        success: false,
        message: 'Tên đăng nhập không tồn tại!'
      });
      return;
    }

    try {
      const match = await bcrypt.compare(password, user.password);
      if (match) {
        socket.emit('loginResponse', {
          success: true,
          user: {
            username,
            score: user.score
          }
        });
      } else {
        socket.emit('loginResponse', {
          success: false,
          message: 'Mật khẩu không đúng!'
        });
      }
    } catch (error) {
      socket.emit('loginResponse', {
        success: false,
        message: 'Lỗi đăng nhập!'
      });
    }
  });

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

  socket.on('move', ({ roomId, row, col }) => {
    if (!rooms[roomId] || !rooms[roomId].players[socket.id] || rooms[roomId].players[socket.id].symbol !== rooms[roomId].currentPlayer || rooms[roomId].board[row][col]) return;

    rooms[roomId].board[row][col] = rooms[roomId].currentPlayer;
    io.to(roomId).emit('updateBoard', { board: [...rooms[roomId].board], currentPlayer: rooms[roomId].currentPlayer });

    if (checkWin(row, col, rooms[roomId].currentPlayer, rooms[roomId].board)) {
      const winner = rooms[roomId].currentPlayer;
      scores[winner] = (scores[winner] || 0) + 1;
      fs.writeFileSync('scores.json', JSON.stringify(scores));
      io.to(roomId).emit('updateScores', scores);
      io.to(roomId).emit('gameOver', `Người chơi ${winner} thắng!`);
      rooms[roomId].board = Array(15).fill().map(() => Array(15).fill(null));
      rooms[roomId].currentPlayer = 'X';
      rooms[roomId].players = {};
    } else {
      rooms[roomId].currentPlayer = rooms[roomId].currentPlayer === 'X' ? 'O' : 'X';
      io.to(roomId).emit('updateBoard', { board: [...rooms[roomId].board], currentPlayer: rooms[roomId].currentPlayer });
    }
  });

  socket.on('leaveRoom', (roomId) => {
    if (rooms[roomId] && rooms[roomId].players[socket.id]) {
      delete rooms[roomId].players[socket.id];
      io.to(roomId).emit('playerUpdate', rooms[roomId].players);
      if (Object.keys(rooms[roomId].players).length === 0) {
        delete rooms[roomId];
      }
    }
  });

  socket.on('disconnect', () => {
    console.log('Người chơi đã ngắt kết nối:', socket.id);
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

  socket.on('resetGame', (roomId) => {
    if (rooms[roomId]) {
      rooms[roomId].board = Array(15).fill().map(() => Array(15).fill(null));
      rooms[roomId].currentPlayer = 'X';
      io.to(roomId).emit('resetGame');
    }
  });
});

app.get('/room.html', (req, res, next) => {
  if (req.headers['sec-websocket-protocol']) {
    return next();
  }
  res.sendFile(path.join(__dirname, 'public', 'room.html'));
});
setInterval(() => {
  for (let roomId in rooms) {
    if (Object.keys(rooms[roomId].players).length === 0) {
      delete rooms[roomId];
      console.log(`Phòng ${roomId} đã bị xóa do không có người chơi.`);
    }
  }
}, 300000); // Kiểm tra mỗi 5 phút

server.listen(3000, () => {
  console.log('Máy chủ đang chạy tại cổng 3000');
});