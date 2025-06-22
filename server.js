/**
 * server.js
 * Máy chủ cho game Caro sử dụng Node.js, Express và Socket.IO
 * Tính năng: Đăng ký/Đăng nhập, tạo phòng, chơi Người vs Người và Người vs Máy.
 */

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// --- CÀI ĐẶT MÁY CHỦ ---
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});
app.get(['/home.html', '/game.html'], (req, res) => {
    res.sendFile(path.join(__dirname, 'public', req.path));
});

// --- QUẢN LÝ DỮ LIỆU NGƯỜI DÙNG ---
const USERS_FILE = path.join(__dirname, 'users.json');

function readUsers() {
    try {
        if (fs.existsSync(USERS_FILE)) {
            const data = fs.readFileSync(USERS_FILE, 'utf8');
            return data ? JSON.parse(data) : {};
        }
    } catch (err) {
        console.error("Lỗi đọc file users.json:", err);
    }
    return {};
}

function saveUsers(users) {
    try {
        fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
    } catch (err) {
        console.error("Lỗi ghi file users.json:", err);
    }
}

// --- DỮ LIỆU TRONG BỘ NHỚ ---
let users = readUsers();
let rooms = {};

// --- LOGIC GAME ---

/**
 * Kiểm tra điều kiện thắng sau mỗi nước đi.
 */
function checkWin(row, col, player, board, winLength, mode = 'normal') {
    if (!board || !board[row] || typeof board[row][col] === 'undefined') return false;
    const rows = board.length;
    const cols = board[0].length;
    const opponent = player === 'X' ? 'O' : 'X';
    const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];

    for (let [dx, dy] of directions) {
        let count = 1;
        let blocked1 = false, blocked2 = false;
        for (let i = 1; i < winLength; i++) {
            const r = row + i * dx, c = col + i * dy;
            if (r >= 0 && r < rows && c >= 0 && c < cols && board[r][c] === player) count++;
            else { if (r >= 0 && r < rows && c >= 0 && c < cols && board[r][c] === opponent) blocked1 = true; break; }
        }
        for (let i = 1; i < winLength; i++) {
            const r = row - i * dx, c = col - i * dy;
            if (r >= 0 && r < rows && c >= 0 && c < cols && board[r][c] === player) count++;
            else { if (r >= 0 && r < rows && c >= 0 && c < cols && board[r][c] === opponent) blocked2 = true; break; }
        }
        if (count >= winLength) {
            if (mode === 'ganh') { if (!blocked1 || !blocked2) return true; }
            else return true;
        }
    }
    return false;
}

/**
 * AI thực hiện nước đi (cấp độ dễ: chọn ngẫu nhiên).
 */
function makeAiMove(roomId) {
    const room = rooms[roomId];
    if (!room || room.currentPlayer !== 'O') return;
    const emptyCells = [];
    for (let r = 0; r < room.board.length; r++) {
        for (let c = 0; c < room.board[0].length; c++) {
            if (room.board[r][c] === null) emptyCells.push({ row: r, col: c });
        }
    }
    if (emptyCells.length === 0) return;
    const { row, col } = emptyCells[Math.floor(Math.random() * emptyCells.length)];
    room.board[row][col] = 'O';
    io.to(roomId).emit('updateBoard', { board: room.board, currentPlayer: 'O' });
    const isWin = checkWin(row, col, 'O', room.board, room.winLength, room.mode);
    if (isWin) {
        setTimeout(() => io.to(roomId).emit('gameOver', 'Rất tiếc, Máy đã thắng!'), 100);
    } else {
        room.currentPlayer = 'X';
        io.to(roomId).emit('playerTurnUpdate', { currentPlayer: room.currentPlayer });
    }
}

// --- XỬ LÝ KẾT NỐI SOCKET.IO ---
io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);

    // --- XỬ LÝ ĐĂNG NHẬP & ĐĂNG KÝ ---
    socket.on('register', async ({ username, password }) => {
        if (users[username]) return socket.emit('authError', 'Tên đăng nhập đã tồn tại.');
        try {
            const hashedPassword = await bcrypt.hash(password, 10);
            users[username] = { password: hashedPassword };
            saveUsers(users);
            socket.emit('authSuccess', { username });
        } catch (err) { socket.emit('authError', 'Lỗi đăng ký.'); }
    });

    socket.on('login', async ({ username, password }) => {
        const user = users[username];
        if (!user) return socket.emit('authError', 'Tên đăng nhập không tồn tại.');
        try {
            if (await bcrypt.compare(password, user.password)) {
                socket.emit('authSuccess', { username });
            } else {
                socket.emit('authError', 'Mật khẩu không chính xác.');
            }
        } catch (err) { socket.emit('authError', 'Lỗi đăng nhập.'); }
    });

    // --- XỬ LÝ LOGIC PHÒNG CHƠI ---
    socket.on('joinRoom', ({ roomId, size, username, mode }) => {
        if (!roomId || !size || !username) return;
        socket.join(roomId);
        if (!rooms[roomId]) {
            const [rows, cols] = size.split('x').map(Number);
            rooms[roomId] = {
                board: Array(rows).fill(null).map(() => Array(cols).fill(null)),
                currentPlayer: 'X', players: {}, usernames: {},
                size, winLength: size === '3x3' ? 3 : 5,
                mode: mode || 'normal', rematchVotes: [],
            };
        }
        const room = rooms[roomId];
        const isAI = mode === 'ai';
        if (!isAI && Object.keys(room.players).length >= 2 && !room.players[socket.id]) {
            return socket.emit('roomFull', 'Phòng đã đầy!');
        }
        if (!room.players[socket.id]) {
            const symbol = (isAI || Object.keys(room.players).length === 0) ? 'X' : 'O';
            room.players[socket.id] = { symbol };
            room.usernames[socket.id] = username;
        }
        if (isAI && !room.players['ai_player']) {
            room.players['ai_player'] = { symbol: 'O' };
            room.usernames['ai_player'] = 'Máy';
        }
        io.to(roomId).emit('playerUpdate', {
            players: room.players, usernames: room.usernames,
            size: room.size, mode: room.mode,
            board: room.board, currentPlayer: room.currentPlayer
        });
    });

    socket.on('move', ({ roomId, row, col }) => {
        const room = rooms[roomId];
        if (!room || !room.players[socket.id] || room.players[socket.id].symbol !== room.currentPlayer || room.board[row]?.[col] !== null) return;
        const playerSymbol = room.players[socket.id].symbol;
        room.board[row][col] = playerSymbol;
        io.to(roomId).emit('updateBoard', { board: room.board, currentPlayer: playerSymbol });
        const isWin = checkWin(row, col, playerSymbol, room.board, room.winLength, room.mode);
        if (isWin) {
            const winnerUsername = room.usernames[socket.id] || playerSymbol;
            setTimeout(() => io.to(roomId).emit('gameOver', `Người chơi ${winnerUsername} (${playerSymbol}) thắng!`), 100);
        } else {
            room.currentPlayer = playerSymbol === 'X' ? 'O' : 'X';
            io.to(roomId).emit('playerTurnUpdate', { currentPlayer: room.currentPlayer });
            if (room.mode === 'ai' && room.currentPlayer === 'O') {
                setTimeout(() => makeAiMove(roomId), 800);
            }
        }
    });

    socket.on('requestRematch', (roomId) => {
        const room = rooms[roomId];
        if (!room || !room.players[socket.id] || room.rematchVotes.includes(socket.id)) return;
        const resetGame = () => {
            const [rows, cols] = room.size.split('x').map(Number);
            room.board = Array(rows).fill(null).map(() => Array(cols).fill(null));
            room.currentPlayer = 'X';
            room.rematchVotes = [];
            io.to(roomId).emit('playerUpdate', {
                players: room.players, usernames: room.usernames,
                size: room.size, mode: room.mode,
                board: room.board, currentPlayer: room.currentPlayer
            });
        };
        if (room.mode === 'ai') {
            resetGame();
        } else {
            room.rematchVotes.push(socket.id);
            if (room.rematchVotes.length === 2) {
                resetGame();
            } else {
                const opponentId = Object.keys(room.players).find(id => id !== socket.id);
                if (opponentId) io.to(opponentId).emit('opponentWantsRematch');
            }
        }
    });
    socket.on('updateTimer', (data) => {
    const { roomId, time } = data;
    if (rooms[roomId]) {
        io.to(roomId).emit('updateTimer', { time });
    }
});
    socket.on('surrender', (roomId) => {
        const room = rooms[roomId];
        if (!room || !room.players[socket.id]) return;
        const loserUsername = room.usernames[socket.id];
        const opponentId = Object.keys(room.players).find(id => id !== socket.id);
        const winnerUsername = room.usernames[opponentId] || 'Đối thủ';
        io.to(roomId).emit('gameOver', `${loserUsername} đã đầu hàng! ${winnerUsername} thắng!`);
    });

    socket.on('chatMessage', (data) => {
        const { roomId, message, username } = data;
        if (rooms[roomId] && message) {
            io.to(roomId).emit('chatMessage', { username, message });
        }
    });

    socket.on('disconnect', () => {
        console.log(`Client disconnected: ${socket.id}`);
        for (const roomId in rooms) {
            const room = rooms[roomId];
            if (room?.players[socket.id]) {
                delete room.players[socket.id];
                delete room.usernames[socket.id];
                const humanPlayersLeft = Object.keys(room.players).filter(id => id !== 'ai_player').length;
                if (humanPlayersLeft === 0) {
                    delete rooms[roomId];
                    console.log(`Phòng ${roomId} đã được xóa.`);
                } else if (room.mode !== 'ai') {
                    io.to(roomId).emit('opponentLeft', 'Đối thủ đã rời phòng!');
                }
                break;
            }
        }
    });
});

// --- ENDPOINT KIỂM TRA PHÒNG ---
app.get('/getRoomInfo', (req, res) => {
    const roomId = req.query.roomId;
    if (rooms[roomId]) {
        res.json({ exists: true, size: rooms[roomId].size, mode: rooms[roomId].mode });
    } else {
        res.json({ exists: false });
    }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Máy chủ đang chạy tại cổng ${PORT}`);
});