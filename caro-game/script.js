const boardSize = 16;
let board = [];
let currentPlayer = 'X';
let gameActive = true;
let gameMode = '2-player'; // Chế độ game: '2-player' hoặc 'vs-ai'

const gameBoard = document.getElementById('game-board');
const statusDisplay = document.getElementById('status');
const restartButton = document.getElementById('restart-button');
const modeSwitchButton = document.getElementById('mode-switch-button');

// Hàm khởi tạo bàn cờ
function initializeBoard() {
    board = Array(boardSize).fill(null).map(() => Array(boardSize).fill(null));
    gameBoard.innerHTML = ''; // Xóa bàn cờ cũ
    gameBoard.className = 'caro-board-' + boardSize; // Đảm bảo class đúng

    for (let i = 0; i < boardSize; i++) {
        for (let j = 0; j < boardSize; j++) {
            const cell = document.createElement('div');
            cell.classList.add('caro-cell');
            cell.dataset.row = i;
            cell.dataset.col = j;
            cell.addEventListener('click', handleCellClick);
            gameBoard.appendChild(cell);
        }
    }
    // Bắt đầu với X hoặc O ngẫu nhiên
    currentPlayer = Math.random() < 0.5 ? 'X' : 'O';
    statusDisplay.textContent = `Lượt của người chơi ${currentPlayer}`;
    gameActive = true;

    // Cập nhật trạng thái nút chuyển chế độ
    if (gameMode === '2-player') {
        modeSwitchButton.textContent = 'Chơi với Máy';
    } else {
        modeSwitchButton.textContent = 'Chơi 2 Người';
    }

    // Nếu ở chế độ vs-ai và máy đi trước (ví dụ O), kích hoạt nước đi của máy
    // Hiện tại, X luôn đi trước, nên máy (O) sẽ đi sau người (X).
}

// Hàm kiểm tra thắng thua
function checkWin(row, col, player) {
    const directions = [
        [0, 1],  // Ngang
        [1, 0],  // Dọc
        [1, 1],  // Chéo /
        [1, -1]  // Chéo \
    ];

    for (const [dr, dc] of directions) {
        let count = 1;
        // Kiểm tra một hướng
        for (let i = 1; i < 5; i++) {
            const r = row + dr * i;
            const c = col + dc * i;
            if (r >= 0 && r < boardSize && c >= 0 && c < boardSize && board[r][c] === player) {
                count++;
            } else {
                break;
            }
        }
        // Kiểm tra hướng ngược lại
        for (let i = 1; i < 5; i++) {
            const r = row - dr * i;
            const c = col - dc * i;
            if (r >= 0 && r < boardSize && c >= 0 && c < boardSize && board[r][c] === player) {
                count++;
            } else {
                break;
            }
        }

        if (count >= 5) {
             // TODO: Có thể thêm luật chặn 2 đầu nếu cần (5 quân liên tiếp không bị chặn cả 2 đầu)
             // Với kiểm tra cơ bản này, 5 quân liên tiếp là thắng.
            return true;
        }
    }
    return false;
}

// Hàm xử lý khi click vào một ô
function handleCellClick(event) {
    const clickedCell = event.target;
    const row = parseInt(clickedCell.dataset.row);
    const col = parseInt(clickedCell.dataset.col);

    // Nếu ô đã có quân, game không hoạt động, hoặc đang ở chế độ vs-ai và là lượt của máy, thì không làm gì
    if (board[row][col] !== null || !gameActive || (gameMode === 'vs-ai' && currentPlayer === 'O')) {
        return;
    }

    // Đặt quân cờ của người chơi hiện tại (Người 'X')
    makeMove(row, col, currentPlayer);

    // Sau nước đi của người, kiểm tra thắng
    if (checkWin(row, col, currentPlayer)) {
        statusDisplay.textContent = `Người chơi ${currentPlayer} thắng!`;
        gameActive = false;
        return;
    }

    // Kiểm tra hòa (nếu tất cả ô đều đầy)
    if (board.flat().every(cell => cell !== null)) {
        statusDisplay.textContent = "Hòa!";
        gameActive = false;
        return;
    }

    // Chuyển lượt
    currentPlayer = currentPlayer === 'X' ? 'O' : 'X';
    statusDisplay.textContent = `Lượt của người chơi ${currentPlayer}`;

    // Nếu đang chơi với máy và là lượt của máy, kích hoạt nước đi của máy
    if (gameMode === 'vs-ai' && currentPlayer === 'O' && gameActive) {
        // Thêm một độ trễ nhỏ để trải nghiệm người dùng tốt hơn
        setTimeout(makeAIMove, 500);
    }
}

// Hàm hỗ trợ đặt quân cờ (cho cả người và máy)
function makeMove(row, col, player) {
    board[row][col] = player;
    const cellElement = gameBoard.querySelector(`[data-row='${row}'][data-col='${col}']`);
    cellElement.textContent = player;
    cellElement.classList.add(player.toLowerCase());
}


// --- Logic AI (Cải thiện) ---

// Hàm đánh giá điểm cho một nước đi tại (row, col) cho người chơi player
function getScoreForMove(board, row, col, player) {
    if (board[row][col] !== null) return 0; // Không thể đi vào ô đã có quân

    let score = 0;
    const opponent = player === 'X' ? 'O' : 'X';

    const directions = [
        [0, 1],  // Ngang
        [1, 0],  // Dọc
        [1, 1],  // Chéo /
        [1, -1]  // Chéo \
    ];

    for (const [dr, dc] of directions) {
        let playerScore = 0;
        let opponentScore = 0;
        let playerCount = 0;
        let opponentCount = 0;
        let openEnds = 0;

        // Kiểm tra theo 2 hướng của đường thẳng
        for (let i = -4; i <= 4; i++) { // Kiểm tra 4 ô mỗi bên
            const r = row + dr * i;
            const c = col + dc * i;

            if (r >= 0 && r < boardSize && c >= 0 && c < boardSize) {
                if (board[r][c] === player) {
                    playerCount++;
                    opponentCount = 0; // Reset đối thủ nếu gặp quân mình
                } else if (board[r][c] === opponent) {
                    opponentCount++;
                    playerCount = 0; // Reset mình nếu gặp quân đối thủ
                } else { // Ô trống
                    // Đánh giá chuỗi kết thúc bằng ô trống
                    if (playerCount > 0) {
                         // Đánh giá chuỗi của mình kết thúc bằng ô trống
                         playerScore += evaluateSequence(playerCount, openEnds + 1); // +1 vì ô hiện tại là trống
                         playerCount = 0; // Reset
                         openEnds = 1; // Có 1 đầu hở
                    } else if (opponentCount > 0) {
                         // Đánh giá chuỗi của đối thủ kết thúc bằng ô trống
                         opponentScore += evaluateSequence(opponentCount, openEnds + 1); // +1 vì ô hiện tại là trống
                         opponentCount = 0; // Reset
                         openEnds = 1; // Có 1 đầu hở
                    } else {
                         openEnds = 1; // Gặp 2 ô trống liên tiếp
                    }
                }
            } else { // Gặp biên bàn cờ
                 if (playerCount > 0) {
                     playerScore += evaluateSequence(playerCount, openEnds); // Chuỗi kết thúc bằng biên
                     playerCount = 0;
                     openEnds = 0;
                 } else if (opponentCount > 0) {
                     opponentScore += evaluateSequence(opponentCount, openEnds); // Chuỗi kết thúc bằng biên
                     opponentCount = 0;
                     openEnds = 0;
                 } else {
                     openEnds = 0; // Gặp 2 biên liên tiếp
                 }
            }
        }
         // Đánh giá chuỗi cuối cùng nếu nó kết thúc ở biên
         if (playerCount > 0) {
             playerScore += evaluateSequence(playerCount, openEnds);
         } else if (opponentCount > 0) {
             opponentScore += evaluateSequence(opponentCount, openEnds);
         }


        // Cộng điểm cho hướng này. AI ưu tiên tấn công và phòng thủ.
        // Điểm tấn công của AI (playerScore khi player là 'O')
        // Điểm phòng thủ của AI (opponentScore khi opponent là 'X')
        // AI muốn tối đa điểm của mình và tối thiểu điểm của đối thủ.
        // Một cách đơn giản là cộng điểm tấn công và điểm phòng thủ (điểm của đối thủ với dấu âm hoặc trọng số cao)
        // Ở đây, ta sẽ tính điểm cho nước đi này cho cả AI và người, rồi kết hợp.
        // Điểm cho nước đi này = Điểm tấn công của AI + Điểm phòng thủ của AI (chặn đối thủ)
        score += playerScore; // Điểm tấn công
        score += opponentScore * 1.2; // Điểm phòng thủ (chặn đối thủ), nhân trọng số cao hơn để ưu tiên chặn
    }

    return score;
}

// Hàm đánh giá điểm cho một chuỗi quân cờ liên tiếp
function evaluateSequence(count, openEnds) {
    if (openEnds === 2) { // Chuỗi hở 2 đầu
        switch (count) {
            case 5: return 100000; // Thắng ngay
            case 4: return 50000;  // Tứ hở
            case 3: return 5000;   // Tam hở
            case 2: return 500;    // Song hở
            case 1: return 50;     // Nhất hở
        }
    } else if (openEnds === 1) { // Chuỗi hở 1 đầu
         switch (count) {
            case 5: return 100000; // Thắng ngay
            case 4: return 10000;  // Tứ hở 1 đầu
            case 3: return 1000;   // Tam hở 1 đầu
            case 2: return 100;    // Song hở 1 đầu
            case 1: return 10;     // Nhất hở 1 đầu
        }
    } else { // Chuỗi bị chặn 2 đầu hoặc 1 đầu và biên
         switch (count) {
            case 5: return 100000; // Thắng ngay (vẫn tính nếu đủ 5)
            // Các chuỗi bị chặn ít giá trị hơn
            case 4: return 100;
            case 3: return 10;
            case 2: return 1;
            default: return 0;
         }
    }
    return 0;
}


// Hàm thực hiện nước đi của máy (AI)
function makeAIMove() {
    let bestScore = -Infinity;
    let bestMove = null;
    const aiPlayer = 'O';
    const humanPlayer = 'X';

    // Tìm tất cả các ô trống
    const emptyCells = [];
    for (let i = 0; i < boardSize; i++) {
        for (let j = 0; j < boardSize; j++) {
            if (board[i][j] === null) {
                emptyCells.push({ row: i, col: j });
            }
        }
    }

    // Nếu không còn ô trống, game hòa (đã kiểm tra trước đó nhưng thêm check an toàn)
    if (emptyCells.length === 0) {
         statusDisplay.textContent = "Hòa!";
         gameActive = false;
         return;
    }

    // Đánh giá từng ô trống
    for (const { row, col } of emptyCells) {
        // Tính điểm cho nước đi của AI tại ô này
        const scoreAI = getScoreForMove(board, row, col, aiPlayer);

        // Tính điểm cho nước đi của người tại ô này (để AI chặn)
        const scoreHuman = getScoreForMove(board, row, col, humanPlayer);

        // Kết hợp điểm tấn công và phòng thủ
        // AI ưu tiên thắng (điểm AI rất cao) hoặc chặn người thắng (điểm người rất cao)
        let currentMoveScore;

        if (scoreAI >= 100000) { // AI có thể thắng ngay
            currentMoveScore = 100000;
        } else if (scoreHuman >= 100000) { // Người có thể thắng ngay, AI phải chặn
             currentMoveScore = 90000; // Điểm cao để ưu tiên chặn
        }
        else {
             // Kết hợp điểm tấn công và phòng thủ
             // AI muốn tối đa điểm của mình và tối thiểu điểm của đối thủ
             // Một cách đơn giản là lấy điểm của mình trừ đi điểm của đối thủ (hoặc cộng với trọng số âm)
             // Hoặc kết hợp điểm tấn công và phòng thủ với trọng số khác nhau
             currentMoveScore = scoreAI + scoreHuman * 1.1; // Ưu tiên chặn hơn tấn công một chút
        }


        // Cập nhật nước đi tốt nhất
        if (currentMoveScore > bestScore) {
            bestScore = currentMoveScore;
            bestMove = { row: row, col: col };
        }
    }

    // Thực hiện nước đi tốt nhất tìm được
    if (bestMove) {
        makeMove(bestMove.row, bestMove.col, aiPlayer);

        // Sau nước đi của máy, kiểm tra thắng
        if (checkWin(bestMove.row, bestMove.col, aiPlayer)) {
            statusDisplay.textContent = `Người chơi O (Máy) thắng!`;
            gameActive = false;
            return;
        }

         // Kiểm tra hòa
        if (board.flat().every(cell => cell !== null)) {
            statusDisplay.textContent = "Hòa!";
            gameActive = false;
            return;
        }

        // Chuyển lại lượt cho người chơi
        currentPlayer = humanPlayer;
        statusDisplay.textContent = `Lượt của người chơi ${currentPlayer}`;
    }
}


// Hàm xử lý chơi lại game
function handleRestartGame() {
    initializeBoard();
    // Nếu ở chế độ vs-ai và máy đi trước (ví dụ O), kích hoạt nước đi của máy
    // Hiện tại, X luôn đi trước.
}

// Hàm xử lý chuyển đổi chế độ chơi
function handleModeSwitch() {
    if (gameMode === '2-player') {
        gameMode = 'vs-ai';
        modeSwitchButton.textContent = 'Chơi 2 Người';
        statusDisplay.textContent = 'Đã chuyển sang chế độ đấu với Máy. Lượt của người chơi X.';
    } else {
        gameMode = '2-player';
        modeSwitchButton.textContent = 'Chơi với Máy';
        statusDisplay.textContent = 'Đã chuyển sang chế độ 2 Người chơi. Lượt của người chơi X.';
    }
    initializeBoard(); // Khởi động lại game khi chuyển chế độ
}


// Thêm các sự kiện lắng nghe
restartButton.addEventListener('click', handleRestartGame);
modeSwitchButton.addEventListener('click', handleModeSwitch); // Thêm sự kiện cho nút chuyển chế độ

// Khởi tạo game khi script tải xong
initializeBoard();
