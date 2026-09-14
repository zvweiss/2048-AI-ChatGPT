const SIZE = 4;
const STARTING_TILES = 2;
const STORAGE_KEY = "2048-best-score";

const gridElement = document.querySelector("#grid");
const boardElement = document.querySelector("#board");
const scoreElement = document.querySelector("#score");
const bestElement = document.querySelector("#best");
const statusElement = document.querySelector("#status");
const overlayElement = document.querySelector("#overlay");
const overlayTitle = document.querySelector("#overlay-title");
const overlayMessage = document.querySelector("#overlay-message");
const keepPlayingButton = document.querySelector("#keep-playing");

let board = [];
let score = 0;
let best = Number(localStorage.getItem(STORAGE_KEY)) || 0;
let previousState = null;
let gameWon = false;
let gameOver = false;
let touchStart = null;

function createEmptyBoard() {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
}

function getEmptyCells() {
  const cells = [];
  board.forEach((row, rowIndex) => row.forEach((value, columnIndex) => {
    if (value === 0) cells.push({ row: rowIndex, column: columnIndex });
  }));
  return cells;
}

function addRandomTile() {
  const emptyCells = getEmptyCells();
  if (!emptyCells.length) return null;
  const cell = emptyCells[Math.floor(Math.random() * emptyCells.length)];
  board[cell.row][cell.column] = Math.random() < 0.9 ? 2 : 4;
  return cell;
}

function startGame() {
  board = createEmptyBoard();
  score = 0;
  previousState = null;
  gameWon = false;
  gameOver = false;
  hideOverlay();
  for (let index = 0; index < STARTING_TILES; index += 1) addRandomTile();
  updateStatus("Your move.");
  render();
}

function render(effects = {}) {
  const mergedCells = new Set((effects.mergedPositions || []).map(({ row, column }) => `${row}-${column}`));
  const spawnedCell = effects.spawnedPosition ? `${effects.spawnedPosition.row}-${effects.spawnedPosition.column}` : null;
  gridElement.replaceChildren();
  board.flat().forEach((value, index) => {
    const positionKey = `${Math.floor(index / SIZE)}-${index % SIZE}`;
    const cell = document.createElement("div");
    cell.className = "cell";
    if (mergedCells.has(positionKey)) cell.classList.add("tile-merged");
    if (spawnedCell === positionKey) cell.classList.add("tile-new");
    cell.dataset.value = value;
    cell.textContent = value || "";
    cell.setAttribute("aria-label", value ? `Tile ${value}` : "Empty cell");
    gridElement.appendChild(cell);
  });
  scoreElement.textContent = score;
  bestElement.textContent = best;
}

function updateStatus(message) {
  statusElement.textContent = message;
}

function snapshot() {
  return { board: board.map((row) => [...row]), score };
}

function restore(state) {
  board = state.board.map((row) => [...row]);
  score = state.score;
  gameOver = false;
  hideOverlay();
  updateStatus("Move undone.");
  render();
}

function slideRow(row) {
  const compacted = row.filter(Boolean);
  const merged = [];
  const mergedIndices = [];
  let gained = 0;
  for (let index = 0; index < compacted.length; index += 1) {
    if (compacted[index] === compacted[index + 1]) {
      const value = compacted[index] * 2;
      merged.push(value);
      mergedIndices.push(merged.length - 1);
      gained += value;
      index += 1;
    } else {
      merged.push(compacted[index]);
    }
  }
  while (merged.length < SIZE) merged.push(0);
  return { row: merged, gained, mergedIndices };
}

function move(direction) {
  if (gameOver || (gameWon && direction === "blocked")) return;
  const before = JSON.stringify(board);
  let gained = 0;
  const mergedPositions = [];
  const nextBoard = createEmptyBoard();

  for (let index = 0; index < SIZE; index += 1) {
    let line;
    if (direction === "left" || direction === "right") line = [...board[index]];
    else line = board.map((row) => row[index]);
    if (direction === "right" || direction === "down") line.reverse();
    const result = slideRow(line);
    result.row.forEach((value, lineIndex) => {
      const position = direction === "left" || direction === "right" ? { row: index, column: lineIndex } : { row: lineIndex, column: index };
      if (direction === "right" || direction === "down") position[direction === "right" ? "column" : "row"] = SIZE - 1 - lineIndex;
      nextBoard[position.row][position.column] = value;
      if (result.mergedIndices.includes(lineIndex)) mergedPositions.push(position);
    });
    gained += result.gained;
  }

  board = nextBoard;
  if (JSON.stringify(board) === before) return;
  previousState = { board: JSON.parse(before), score };
  score += gained;
  if (score > best) {
    best = score;
    localStorage.setItem(STORAGE_KEY, best);
  }
  const spawnedPosition = addRandomTile();
  render({ mergedPositions, spawnedPosition });
  if (!gameWon && board.flat().includes(2048)) showWin();
  if (!canMove() && !gameWon) showGameOver();
  else updateStatus(gained ? `Great merge! +${gained}` : "Keep going!");
}

function canMove() {
  if (getEmptyCells().length) return true;
  for (let row = 0; row < SIZE; row += 1) {
    for (let column = 0; column < SIZE; column += 1) {
      if (board[row][column] === board[row + 1]?.[column] || board[row][column] === board[row]?.[column + 1]) return true;
    }
  }
  return false;
}

function showWin() {
  gameWon = true;
  overlayTitle.textContent = "You win!";
  overlayMessage.textContent = "You reached 2048. Keep playing or start a new game?";
  keepPlayingButton.hidden = false;
  overlayElement.hidden = false;
  updateStatus("2048 reached!");
}

function showGameOver() {
  gameOver = true;
  overlayTitle.textContent = "Game over!";
  overlayMessage.textContent = "No more moves. Give it another try?";
  keepPlayingButton.hidden = true;
  overlayElement.hidden = false;
  updateStatus("No more moves.");
}

function hideOverlay() {
  overlayElement.hidden = true;
}

document.querySelector("#new-game").addEventListener("click", startGame);
document.querySelector("#try-again").addEventListener("click", startGame);
document.querySelector("#undo").addEventListener("click", () => {
  if (previousState) restore(previousState);
});
keepPlayingButton.addEventListener("click", () => {
  hideOverlay();
  updateStatus("Keep going!");
});

document.addEventListener("keydown", (event) => {
  const directions = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down" };
  if (!directions[event.key]) return;
  event.preventDefault();
  move(directions[event.key]);
});

boardElement.addEventListener("touchstart", (event) => {
  const touch = event.changedTouches[0];
  touchStart = { x: touch.clientX, y: touch.clientY };
}, { passive: true });

boardElement.addEventListener("touchend", (event) => {
  if (!touchStart) return;
  const touch = event.changedTouches[0];
  const deltaX = touch.clientX - touchStart.x;
  const deltaY = touch.clientY - touchStart.y;
  touchStart = null;
  if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < 24) return;
  if (Math.abs(deltaX) > Math.abs(deltaY)) move(deltaX > 0 ? "right" : "left");
  else move(deltaY > 0 ? "down" : "up");
}, { passive: true });

startGame();