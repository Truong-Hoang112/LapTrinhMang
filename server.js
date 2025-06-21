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
app.get('/', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'login.html')); });
app.get(['/home.html', '/game.html'], (req, res, next) => { if (req.headers['sec-websocket-protocol']) return next(); res.sendFile(path.join(__dirname, 'public', req.path)); });
app.get('/getRoomInfo', (req, res) => { const room = rooms[req.query.roomId]; if (room && room.size) { res.json({ success: true, size: room.size, mode: room.mode }); } else { res.status(404).json({ success: false, message: 'Phòng không tồn tại.' }); }});
function readJsonFileSync(filePath) { try { if (fs.existsSync(filePath)) { const c = fs.readFileSync(filePath, 'utf8'); return c ? JSON.parse(c) : {}; } } catch (e) { console.error(`Lỗi đọc file ${filePath}:`, e); } return {}; }
function saveJsonFileSync(filePath, data) { try { fs.writeFileSync(filePath, JSON.stringify(data, null, 2)); } catch (e) { console.error(`Lỗi ghi file ${filePath}:`, e); } }
let users = readJsonFileSync(path.join(__dirname, 'users.json'));
let rooms = {};
function checkWin(row, col, player, board, winLength, mode = 'normal') { /* ... Giữ nguyên hàm checkWin ... */ }

io.on('connection', (socket) => {
    console.log('Một client đã kết nối:', socket.id);
    socket.on('register', async ({ username, password }) => { /* ... */ });
    socket.on('login', async ({ username, password }) => { /* ... */ });

    socket.on('joinRoom', ({ roomId, size, username, mode }) => {
        if (!roomId || !size || !username) return;
        socket.join(roomId);
        if (!rooms[roomId]) {
            const [rows, cols] = size.split('x').map(Number);
            rooms[roomId] = { board: Array(rows).fill(null).map(() => Array(cols).fill(null)), currentPlayer: 'X', players: {}, usernames: {}, size, winLength: size === '3x3' ? 3 : 5, mode: mode || 'normal', rematchVotes: [], drawOfferFrom: null, previousState: null, undoRequestFrom: null };
        }
        const room = rooms[roomId];
        if (Object.keys(room.players).length >= 2 && !room.players[socket.id]) return socket.emit('roomFull', 'Phòng đã đầy!');
        if (!room.players[socket.id]) {
            room.players[socket.id] = { symbol: Object.keys(room.players).length === 0 ? 'X' : 'O' };
            room.usernames[socket.id] = username;
        }
        io.to(roomId).emit('playerUpdate', { players: room.players, usernames: room.usernames, size: room.size, mode: room.mode, board: room.board, currentPlayer: room.currentPlayer });
    });

    socket.on('move', ({ roomId, row, col }) => {
        const room = rooms[roomId];
        if (!room || !room.players[socket.id] || room.players[socket.id].symbol !== room.currentPlayer || !room.board[row] || room.board[row][col]) return;
        console.log(`--- MOVE: Người chơi ${room.usernames[socket.id]} (${room.currentPlayer}) đi nước (${row}, ${col}) ---`);
        room.previousState = { board: JSON.parse(JSON.stringify(room.board)), currentPlayer: room.currentPlayer };
        room.board[row][col] = room.currentPlayer;
        const isWin = checkWin(row, col, room.currentPlayer, room.board, room.winLength, room.mode);
        if (isWin) {
            io.to(roomId).emit('gameOver', `Người chơi ${room.usernames[socket.id]} (${room.currentPlayer}) thắng!`);
        } else {
            room.currentPlayer = room.currentPlayer === 'X' ? 'O' : 'X';
            console.log(`MOVE: Đổi lượt cho người chơi ${room.currentPlayer}`);
            io.to(roomId).emit('updateBoard', { board: room.board, currentPlayer: room.currentPlayer });
        }
    });

    // PHIÊN BẢN GỠ LỖI CỦA requestUndo
    socket.on('requestUndo', (roomId) => {
        const room = rooms[roomId];
        const requesterId = socket.id;
        const requester = room?.players[requesterId];

        console.log(`\n--- SERVER: Nhận 'requestUndo' từ ${requester?.username || requesterId} ---`);

        // In ra tất cả các điều kiện để kiểm tra
        if (!room) {
            console.log("-> KIỂM TRA THẤT BẠI: Phòng không tồn tại.");
            return socket.emit('undoResponse', 'Lỗi: Phòng không tồn tại.');
        }
        if (!room.previousState) {
            console.log("-> KIỂM TRA THẤT BẠI: Không có trạng thái cũ (previousState is null).");
            return socket.emit('undoResponse', 'Không có nước đi nào để quay lại.');
        }
        if (room.undoRequestFrom) {
            console.log("-> KIỂM TRA THẤT BẠI: Đã có người khác xin undo.");
            return socket.emit('undoResponse', 'Đã có người khác yêu cầu đi lại, vui lòng chờ.');
        }
        if (!requester) {
            console.log("-> KIỂM TRA THẤT BẠI: Không tìm thấy người yêu cầu trong phòng.");
            return socket.emit('undoResponse', 'Lỗi: Bạn không có trong phòng này.');
        }

        console.log(`- Symbol của người yêu cầu: '${requester.symbol}'`);
        console.log(`- Lượt đi của nước đi trước đó: '${room.previousState.currentPlayer}'`);
        
        // Logic đúng: Người xin đi lại phải là người vừa đi nước trước đó.
        if (requester.symbol !== room.previousState.currentPlayer) {
            console.log("-> KIỂM TRA THẤT BẠI: Người yêu cầu không phải là người đi nước trước đó.");
            return socket.emit('undoResponse', 'Bạn chỉ có thể xin đi lại nước đi của chính mình.');
        }
        
        console.log("==> TẤT CẢ KIỂM TRA HỢP LỆ. Gửi yêu cầu cho đối thủ.");
        room.undoRequestFrom = requesterId;
        const opponentId = Object.keys(room.players).find(id => id !== requesterId);
        if (opponentId) {
            io.to(opponentId).emit('undoRequested', `Đối thủ (${room.usernames[requesterId]}) muốn đi lại.`);
        }
    });
    
    // ... các hàm khác không đổi ...
});

const PORT = 3000;
server.listen(PORT, () => { console.log(`Máy chủ đang chạy tại cổng ${PORT}`); });