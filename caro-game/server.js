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
    res.redirect('/login.html');
});

app.get('/index.html', (req, res, next) => {
    if (req.headers['sec-websocket-protocol']) {
        return next();
    }
    res.redirect('/login.html');
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
    fs.writeFileSync('users.json', JSON.stringify(users, null, 2));
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

function createRoom() {
    return {
        board: Array(15).fill().map(() => Array(15).fill(null)),
        currentPlayer: 'X',
        players: {},
        isPaused: false,
        timer: null,
        timeLeft: 30, // 30 giây cho mỗi lượt
        messages: [], // Lưu lịch sử chat
        lastMoveTime: Date.now()
    };
}

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
            if (!rooms[roomId]) {
                rooms[roomId] = createRoom();
            }
            rooms[roomId].players[socket.id] = { 
                symbol: Object.keys(rooms[roomId].players).length === 0 ? 'X' : 'O',
                username: socket.username || 'Player' + socket.id.slice(0, 4)
            };
            
            socket.emit('roomInfo', {
                players: rooms[roomId].players,
                board: rooms[roomId].board,
                currentPlayer: rooms[roomId].currentPlayer,
                isPaused: rooms[roomId].isPaused,
                timeLeft: rooms[roomId].timeLeft,
                messages: rooms[roomId].messages
            });
            
            io.to(roomId).emit('playerUpdate', rooms[roomId].players);
            
            if (Object.keys(rooms[roomId].players).length === 2 && !rooms[roomId].timer) {
                startTimer(roomId);
            }
        } else {
            socket.emit('roomFull', 'Phòng đã đầy!');
        }
    });

    socket.on('sendMessage', ({ roomId, message }) => {
        if (rooms[roomId] && rooms[roomId].players[socket.id]) {
            const username = rooms[roomId].players[socket.id].username;
            const chatMessage = {
                username,
                message,
                timestamp: new Date().toISOString()
            };
            rooms[roomId].messages.push(chatMessage);
            io.to(roomId).emit('newMessage', chatMessage);
        }
    });

    socket.on('togglePause', (roomId) => {
        if (rooms[roomId] && rooms[roomId].players[socket.id]) {
            rooms[roomId].isPaused = !rooms[roomId].isPaused;
            if (rooms[roomId].isPaused) {
                clearInterval(rooms[roomId].timer);
                rooms[roomId].timer = null;
            } else {
                startTimer(roomId);
            }
            io.to(roomId).emit('gamePaused', {
                isPaused: rooms[roomId].isPaused,
                pausedBy: rooms[roomId].players[socket.id].username
            });
        }
    });

    function startTimer(roomId) {
        if (rooms[roomId].timer) {
            clearInterval(rooms[roomId].timer);
        }
        rooms[roomId].timeLeft = 30;
        rooms[roomId].lastMoveTime = Date.now();
        
        rooms[roomId].timer = setInterval(() => {
            if (!rooms[roomId].isPaused) {
                rooms[roomId].timeLeft--;
                io.to(roomId).emit('timerUpdate', rooms[roomId].timeLeft);
                
                if (rooms[roomId].timeLeft <= 0) {
                    clearInterval(rooms[roomId].timer);
                    rooms[roomId].timer = null;
                    rooms[roomId].currentPlayer = rooms[roomId].currentPlayer === 'X' ? 'O' : 'X';
                    rooms[roomId].timeLeft = 30;
                    io.to(roomId).emit('timeUp', {
                        message: `Hết thời gian! Lượt của ${rooms[roomId].currentPlayer}`,
                        currentPlayer: rooms[roomId].currentPlayer
                    });
                    startTimer(roomId);
                }
            }
        }, 1000);
    }

    socket.on('move', ({ roomId, row, col }) => {
        if (!rooms[roomId] || 
            !rooms[roomId].players[socket.id] || 
            rooms[roomId].players[socket.id].symbol !== rooms[roomId].currentPlayer || 
            rooms[roomId].board[row][col] ||
            rooms[roomId].isPaused) return;

        rooms[roomId].board[row][col] = rooms[roomId].currentPlayer;
        rooms[roomId].lastMoveTime = Date.now();
        rooms[roomId].timeLeft = 30;
        io.to(roomId).emit('updateBoard', { 
            board: [...rooms[roomId].board], 
            currentPlayer: rooms[roomId].currentPlayer,
            timeLeft: rooms[roomId].timeLeft
        });

        if (checkWin(row, col, rooms[roomId].currentPlayer, rooms[roomId].board)) {
            const winner = rooms[roomId].currentPlayer;
            scores[winner] = (scores[winner] || 0) + 1;
            fs.writeFileSync('scores.json', JSON.stringify(scores));
            io.to(roomId).emit('updateScores', scores);
            io.to(roomId).emit('gameOver', `Người chơi ${winner} thắng!`);
            clearInterval(rooms[roomId].timer);
            rooms[roomId].timer = null;
            rooms[roomId] = createRoom();
        } else {
            rooms[roomId].currentPlayer = rooms[roomId].currentPlayer === 'X' ? 'O' : 'X';
            io.to(roomId).emit('updateBoard', { 
                board: [...rooms[roomId].board], 
                currentPlayer: rooms[roomId].currentPlayer,
                timeLeft: rooms[roomId].timeLeft
            });
        }
    });

    socket.on('disconnect', () => {
        console.log('Người chơi đã ngắt kết nối:', socket.id);
        for (let roomId in rooms) {
            if (rooms[roomId].players[socket.id]) {
                delete rooms[roomId].players[socket.id];
                io.to(roomId).emit('playerUpdate', rooms[roomId].players);
                
                if (Object.keys(rooms[roomId].players).length === 0) {
                    if (rooms[roomId].timer) {
                        clearInterval(rooms[roomId].timer);
                    }
                    delete rooms[roomId];
                } else {
                    rooms[roomId].isPaused = true;
                    if (rooms[roomId].timer) {
                        clearInterval(rooms[roomId].timer);
                        rooms[roomId].timer = null;
                    }
                    io.to(roomId).emit('gamePaused', {
                        isPaused: true,
                        pausedBy: 'system',
                        message: 'Game tạm dừng do một người chơi rời đi'
                    });
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

server.listen(3000, () => {
    console.log('Máy chủ đang chạy tại cổng 3000');
});