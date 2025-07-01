/**
 * game.js
 * Xử lý logic phía client: vẽ bàn cờ, gửi sự kiện, cập nhật giao diện.
 */
document.addEventListener("DOMContentLoaded", () => {
  const socket = io();
  const canvas = document.getElementById("board");
  const statusEl = document.getElementById("status");
  const rematchBtn = document.getElementById("rematchBtn");
  const surrenderBtn = document.getElementById("surrenderBtn");
  const chatBox = document.getElementById("chat-box");
  const chatInput = document.getElementById("chat-input");
  const timerEl = document.getElementById("timer"); // Thêm tham chiếu đến timer

  if (!canvas) {
    console.error("Lỗi nghiêm trọng: Không tìm thấy element #board!");
    return;
  }

  const ctx = canvas.getContext("2d");
  let board,
    rows,
    cols,
    cellSize,
    mySymbol = "",
    currentPlayer = "",
    isGameReady = false,
    gameMode = "normal";
  let timeLeft = 30; // Thời gian mặc định là 30 giây mỗi lượt
  let timerInterval; // Biến để lưu interval của timer

  const urlParams = new URLSearchParams(window.location.search);
  const roomId = urlParams.get("roomId");
  const requestedSize = urlParams.get("size");
  const requestedMode = urlParams.get("mode");

  function initializeBoard(sizeStr, boardData) {
    [rows, cols] = sizeStr.split("x").map(Number);
    cellSize = 600 / cols;
    canvas.width = 600;
    canvas.height = rows * cellSize;
    board = boardData;
    drawGrid();
    drawPieces();
  }

  function drawGrid() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#555";
    ctx.lineWidth = 1;
    for (let i = 0; i <= cols; i++) {
      ctx.beginPath();
      ctx.moveTo(i * cellSize, 0);
      ctx.lineTo(i * cellSize, canvas.height);
      ctx.stroke();
    }
    for (let i = 0; i <= rows; i++) {
      ctx.beginPath();
      ctx.moveTo(0, i * cellSize);
      ctx.lineTo(canvas.width, i * cellSize);
      ctx.stroke();
    }
  }

  function drawPieces() {
    if (!board) return;
    ctx.lineWidth = 4;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const piece = board[r][c];
        if (!piece) continue;
        const centerX = c * cellSize + cellSize / 2,
          centerY = r * cellSize + cellSize / 2;
        ctx.beginPath();
        if (piece === "X") {
          ctx.strokeStyle = "#d9534f";
          const margin = cellSize * 0.15;
          ctx.moveTo(centerX - margin, centerY - margin);
          ctx.lineTo(centerX + margin, centerY + margin);
          ctx.moveTo(centerX + margin, centerY - margin);
          ctx.lineTo(centerX - margin, centerY + margin);
        } else {
          ctx.strokeStyle = "#428bca";
          ctx.arc(centerX, centerY, cellSize * 0.35, 0, Math.PI * 2);
        }
        ctx.stroke();
      }
    }
  }

  function updateStatus() {
    if (!isGameReady) {
      statusEl.textContent = `Phòng: ${roomId}. Đang chờ...`;
      return;
    }
    const opponentName = gameMode === "ai" ? "Máy" : "Đối thủ";
    const turnText =
      currentPlayer === mySymbol
        ? ">>> Lượt của BẠN <<<"
        : `Lượt của ${opponentName}`;
    statusEl.textContent = `Bạn là quân ${mySymbol}. ${turnText}.`;
  }

  function startTimer() {
    clearInterval(timerInterval); // Xóa timer cũ nếu có
    timeLeft = 30; // Đặt lại thời gian
    timerEl.textContent = `${timeLeft}s`;
    timerInterval = setInterval(() => {
      timeLeft--;
      timerEl.textContent = `${timeLeft}s`;
      if (timeLeft <= 0) {
        clearInterval(timerInterval);
        if (currentPlayer === mySymbol) {
          socket.emit("surrender", roomId); // Tự động đầu hàng nếu hết thời gian
          alert("Hết thời gian! Bạn đã thua.");
        }
      }
    }, 1000);
  }

  function sendMessage() {
    const message = chatInput.value.trim();
    if (message) {
      const user = JSON.parse(localStorage.getItem("user")) || {
        username: "Khách",
      };
      socket.emit("chatMessage", { roomId, message, username: user.username });
      chatInput.value = "";
    }
  }

  socket.on("playerUpdate", (data) => {
    gameMode = data.mode;
    const humanPlayers = Object.keys(data.players).filter(
      (id) => id !== "ai_player"
    ).length;
    isGameReady =
      (gameMode === "ai" && humanPlayers >= 1) ||
      (gameMode !== "ai" && humanPlayers === 2);
    if (surrenderBtn) surrenderBtn.disabled = !isGameReady;
    if (rematchBtn) rematchBtn.style.display = "none";
    initializeBoard(data.size, data.board);
    currentPlayer = data.currentPlayer;
    mySymbol = data.players[socket.id]?.symbol || "";
    updateStatus();
    if (isGameReady && currentPlayer === mySymbol) startTimer(); // Bắt đầu timer khi đến lượt
  });

  socket.on("updateBoard", (data) => {
    board = data.board;
    drawGrid();
    drawPieces();
  });

  socket.on("playerTurnUpdate", (data) => {
    currentPlayer = data.currentPlayer;
    updateStatus();
    if (isGameReady && currentPlayer === mySymbol) startTimer(); // Bắt đầu timer khi đến lượt
  });

  socket.on("gameOver", (message) => {
    isGameReady = false;
    clearInterval(timerInterval); // Dừng timer khi game kết thúc
    if (surrenderBtn) surrenderBtn.disabled = true;
    if (rematchBtn) rematchBtn.style.display = "block";
    setTimeout(() => {
      alert(message);
      statusEl.textContent = message;
    }, 150);
  });

  socket.on("opponentWantsRematch", () => {
    statusEl.textContent = 'Đối thủ muốn chơi lại! Nhấn "Chơi Lại" để đồng ý.';
  });

  socket.on("opponentLeft", (message) => {
    isGameReady = false;
    clearInterval(timerInterval); // Dừng timer khi đối thủ rời
    alert(message);
    statusEl.textContent = message;
    if (surrenderBtn) surrenderBtn.disabled = true;
    if (rematchBtn) rematchBtn.style.display = "none";
  });

  socket.on("chatMessage", (data) => {
    const messageElement = document.createElement("div");
    messageElement.textContent = `${data.username}: ${data.message}`;
    chatBox.appendChild(messageElement);
    chatBox.scrollTop = chatBox.scrollHeight; // Tự động cuộn xuống
  });

  socket.on("roomFull", (message) => {
    alert(message);
    window.location.href = "/home.html";
  });
  socket.on("roomError", (message) => {
    alert(message);
    window.location.href = "/home.html";
  });

  canvas.addEventListener("click", (e) => {
    if (!isGameReady || currentPlayer !== mySymbol) return;

    const rect = canvas.getBoundingClientRect();

    // Tính tỷ lệ scale (trong trường hợp canvas bị co dãn)
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    // Tính tọa độ chính xác trên canvas
    const canvasX = (e.clientX - rect.left) * scaleX;
    const canvasY = (e.clientY - rect.top) * scaleY;

    // Chuyển tọa độ về dòng/cột
    const col = Math.floor(canvasX / cellSize);
    const row = Math.floor(canvasY / cellSize);

    // Kiểm tra hợp lệ và gửi lên server
    if (board[row]?.[col] === null) {
      socket.emit("move", { roomId, row, col });
    }
  });

  if (rematchBtn) {
    rematchBtn.addEventListener("click", () => {
      socket.emit("requestRematch", roomId);
      if (gameMode !== "ai") {
        rematchBtn.disabled = true;
        rematchBtn.textContent = "Đang chờ đối thủ...";
      }
    });
  }

  if (surrenderBtn) {
    surrenderBtn.addEventListener("click", () => {
      if (confirm("Bạn có chắc muốn đầu hàng?"))
        socket.emit("surrender", roomId);
    });
  }

  if (roomId && requestedSize) {
    const user = JSON.parse(localStorage.getItem("user")) || {
      username: "Khách",
    };
    socket.emit("joinRoom", {
      roomId,
      size: requestedSize,
      username: user.username,
      mode: requestedMode || "normal",
    });
    statusEl.textContent = `Đang vào phòng ${roomId}...`;
  } else {
    alert("Lỗi: Thiếu thông tin phòng hoặc kích thước.");
    window.location.href = "/home.html";
  }

  // Xử lý gửi tin nhắn khi nhấn Enter
  chatInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") sendMessage();
  });

  // Log kết nối Socket.IO
  socket.on("connect", () =>
    console.log("Kết nối Socket.IO thành công:", socket.id)
  );
  socket.on("connect_error", (error) => console.error("Lỗi Socket.IO:", error));
});
