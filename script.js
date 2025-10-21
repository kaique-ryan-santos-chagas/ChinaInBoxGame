// Parâmetros do jogo

const TILE_W = 64, TILE_H = 64;
const COLS = 10, ROWS = 6;
const CANVAS_W = COLS * TILE_W, CANVAS_H = ROWS * TILE_H;
const MAX_LEVEL = 5;

// Q-Learning parâmetros

const ALPHA = 0.6;
const GAMMA = 0.8;
const DEFAULT_EPSILON = 0.2;

let player = { x: 1, y: 1 };
let enemy = { x: 8, y: 4 };
let enemy2 = { x: 6, y: 2 };
let dishes = [];
let obstacles = [];

let canvas = document.getElementById('board');
let ctx = canvas.getContext('2d');
canvas.width = CANVAS_W; canvas.height = CANVAS_H;

let level = 1; let lives = 3; let score = 0; let goalPerLevel = 3;
let epsilon = DEFAULT_EPSILON;

const ACTIONS = [0, 1, 2, 3, 4]; // 0: up, 1: right, 2: down, 3: left, 4: stay
let Q = {};

const logEl = document.getElementById('log');

function log(s) {
  logEl.innerText = (new Date()).toLocaleTimeString() + ' — ' + s + '\n' + logEl.innerText;
}

function stateFor(enemy, player) {
  const dx = player.x - enemy.x;
  const dy = player.y - enemy.y;
  const sdx = Math.sign(dx);
  const sdy = Math.sign(dy);
  const dist = Math.abs(dx) + Math.abs(dy);
  const db = dist <= 2 ? 'N' : (dist <= 5 ? 'M' : 'F');
  return `${sdx},${sdy},${db}`;
}

function ensureQ(state) {
  if (!(state in Q)) Q[state] = Array(ACTIONS.length).fill(0);
}

function chooseAction(state) {
  ensureQ(state);
  if (Math.random() < epsilon) {
    return ACTIONS[Math.floor(Math.random() * ACTIONS.length)];
  }
  const arr = Q[state];
  let best = 0, bestVal = -1e9;
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] > bestVal) {
      bestVal = arr[i];
      best = ACTIONS[i];
    }
  }
  return best;
}

function qUpdate(state, action, reward, nextState) {
  ensureQ(state);
  ensureQ(nextState);
  const aidx = ACTIONS.indexOf(action);
  const nextVals = Q[nextState];
  const bestNext = Math.max(...nextVals);
  Q[state][aidx] = Q[state][aidx] + ALPHA * (reward + GAMMA * bestNext - Q[state][aidx]);
}

function saveQ() {
  localStorage.setItem('cib_qtable_v2', JSON.stringify(Q));
  console.log('Q-table salva.');
}

function loadQ() {
  const s = localStorage.getItem('cib_qtable_v2');
  if (s) {
    Q = JSON.parse(s);
  }
  console.log('Q-table carregada.');
}

function resetQ() {
  Q = {};
  localStorage.removeItem('cib_qtable_v2');
  log('Q-table resetada.');
  console.log('Q-table resetada.');
}

function seedLevel(n) {

  player = { x: 1, y: 1 };
  enemy = { x: COLS - 2, y: ROWS - 2 };
  enemy2 = { x: COLS - 3, y: ROWS - 3 };
  dishes = [];
  obstacles = [];
  goalPerLevel = 2 + Math.min(4, n);

  const menu = [
    { name: 'Arroz', icon: '🍚' },
    { name: 'Frango Xadrez', icon: '🍗' },
    { name: 'Yakissoba', icon: '🍜' },
    { name: 'Rolinho', icon: '🍣' },
    { name: 'Frango Agridoce', icon: '🥢' },
    { name: 'Katsu', icon: '🍖' }
  ];

  for (let i = 0; i < goalPerLevel; i++) {
    let p = randomEmpty(); 
    let menuItem = menu[(i + n) % menu.length];
    dishes.push({ x: p.x, y: p.y, name: menuItem.name, icon: menuItem.icon });
  }

  for (let k = 0; k < Math.min(8, n * 2); k++) { 
    let p = randomEmpty(); obstacles.push(p); 
  }

  document.getElementById('level').innerText = level;
  document.getElementById('score').innerText = score;
  document.getElementById('lives').innerText = lives;
  document.getElementById('lives2').innerText = lives;
  document.getElementById('epsilon').innerText = epsilon.toFixed(2);

}

function randomEmpty() {
  while (true) {
    const x = Math.floor(Math.random() * COLS);
    const y = Math.floor(Math.random() * ROWS);
   
    if ((x === player.x && y === player.y) || (x === enemy.x && y === enemy.y) || (x === enemy2.x && y === enemy2.y)) continue;
    if (dishes.some(d => d.x === x && d.y === y)) continue;
    if (obstacles.some(o => o.x === x && o.y === y)) continue;

    return { x, y };
  }
}

function canMove(x, y) { 
  if (x < 0 || x >= COLS || y < 0 || y >= ROWS) 
    return false; 
  if (obstacles.some(o => o.x === x && o.y === y)) 
    return false; 
  
  console.log('Movimento permitido.');
  return true; 
}

function moveEntity(ent, dir) { 
  let nx = ent.x, ny = ent.y; 
  if (dir === 0) ny--; 
  if (dir === 1) nx++; 
  if (dir === 2) ny++; 
  if (dir === 3) nx--; 
  if (canMove(nx, ny)) { 
    ent.x = nx; ent.y = ny; 
  } 
  console.log('Movimento realizado.');
}

function enemyStep() {

  // Primeiro inimigo
  const s = stateFor(enemy, player);
  const action = chooseAction(s);
  const prevPos = { x: enemy.x, y: enemy.y };
  moveEntity(enemy, action);
  const caught1 = (enemy.x === player.x && enemy.y === player.y);

  // Segundo inimigo
  const s2 = stateFor(enemy2, player);
  const action2 = chooseAction(s2);
  const prevPos2 = { x: enemy2.x, y: enemy2.y };
  moveEntity(enemy2, action2);
  const caught2 = (enemy2.x === player.x && enemy2.y === player.y);

  const caught = caught1 || caught2;

  // Checa se os inimigos coletaram algum prato

  let collectedDish = false;
  for (let i = dishes.length - 1; i >= 0; i--) {
    const d = dishes[i];
    if ((d.x === enemy.x && d.y === enemy.y) || (d.x === enemy2.x && d.y === enemy2.y)) {
      dishes.splice(i, 1);
      collectedDish = true;
      log(`🧊 Frio coletou: ${d.name}`);
    }
  }

  // Q-learning para primeiro inimigo

  const nextS = stateFor(enemy, player);
  const prevDist = Math.abs(prevPos.x - player.x) + Math.abs(prevPos.y - player.y);
  const curDist = Math.abs(enemy.x - player.x) + Math.abs(enemy.y - player.y);
  let reward = -0.05;
  if (caught1) reward += 10;
  else if (collectedDish) reward += 5;
  else if (curDist < prevDist) reward += 0.3;
  else if (curDist > prevDist) reward -= 0.1;

  qUpdate(s, action, reward, nextS);

  // Q-learning para segundo inimigo

  const nextS2 = stateFor(enemy2, player);
  const prevDist2 = Math.abs(prevPos2.x - player.x) + Math.abs(prevPos2.y - player.y);
  const curDist2 = Math.abs(enemy2.x - player.x) + Math.abs(enemy2.y - player.y);
  let reward2 = -0.05;
  if (caught2) reward2 += 10;
  else if (collectedDish) reward2 += 5;
  else if (curDist2 < prevDist2) reward2 += 0.3;
  else if (curDist2 > prevDist2) reward2 -= 0.1;

  qUpdate(s2, action2, reward2, nextS2);
  
  saveQ();
  return { caught, collectedDish };

}

let tickInterval = null;

function startTicks() {
  if (tickInterval) clearInterval(tickInterval); tickInterval = setInterval(() => {
    const result = enemyStep();
    const { caught, collectedDish } = result;
    
    if (caught) {
      lives--; 
      document.getElementById('lives2').innerText = lives; 
      document.getElementById('lives').innerText = lives;
      log('Jogador capturado pelo frio! Vida perdida.');
      if (lives <= 0) { 
        showGameOverModal('O frio te pegou!');
        stopTicks(); 
      } else { 
        player = { x: 1, y: 1 }; 
        enemy = { x: COLS - 2, y: ROWS - 2 }; 
        enemy2 = { x: COLS - 3, y: ROWS - 3 };
      }
    }
    
    // Check if enemy collected all dishes
    if (dishes.length === 0 && !caught) {
      lives--;
      document.getElementById('lives2').innerText = lives;
      document.getElementById('lives').innerText = lives;
      log('🧊 Frio congelou todos os pratos! Vida perdida.');
      if (lives <= 0) {
        showGameOverModal('O frio congelou todos os pratos!');
        stopTicks();
      } else {
        level++;
        epsilon = Math.max(0.02, epsilon * 0.9);
        document.getElementById('epsilon').innerText = epsilon.toFixed(2);
        seedLevel(level);
      }
    }
    
    render();
  }, 500);
}

function stopTicks() { 
  if (tickInterval) clearInterval(tickInterval); tickInterval = null; 
  log('Ticks parados.'); 
}

function render() {
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      ctx.fillStyle = (x + y) % 2 === 0 ? '#0e0e0e' : '#0b0b0b';
      ctx.fillRect(x * TILE_W, y * TILE_H, TILE_W - 2, TILE_H - 2);
    }
  }
  for (const o of obstacles) { drawTile(o.x, o.y, '#2b2b2b', '▣'); }
  for (const d of dishes) { drawTile(d.x, d.y, '#f6c84c', d.icon); }
  drawTile(player.x, player.y, '#66c2a5', '🙂');
  drawTile(enemy.x, enemy.y, '#87CEEB', '🧊');
  drawTile(enemy2.x, enemy2.y, '#87CEEB', '❄️');
}

function drawTile(x, y, fill, icon) { 
  const px = x * TILE_W, py = y * TILE_H; 
  ctx.fillStyle = fill; 
  ctx.fillRect(px + 6, py + 6, TILE_W - 12, TILE_H - 12); 
  ctx.fillStyle = '#000'; 
  ctx.font = '28px serif'; 
  ctx.fillText(icon, px + 16, py + 40); 
  console.log('Tile desenhado.');
}

window.addEventListener('keydown', (e) => {
  
  if (!tickInterval) return;
  const k = e.key; let moved = false;

  if (k === 'ArrowUp' || k === 'w' || k === 'W') 
    if (canMove(player.x, player.y - 1)) 
      player.y--; moved = true;  
  if (k === 'ArrowDown' || k === 's' || k === 'S') 
    if (canMove(player.x, player.y + 1)) 
      player.y++; moved = true; 
  if (k === 'ArrowLeft' || k === 'a' || k === 'A') 
    if (canMove(player.x - 1, player.y)) 
      player.x--; moved = true; 
  if (k === 'ArrowRight' || k === 'd' || k === 'D') 
    if (canMove(player.x + 1, player.y)) 
      player.x++; moved = true; 
 
  if (moved) {
   
    for (let i = dishes.length - 1; i >= 0; i--) {
      const d = dishes[i]; if (d.x === player.x && d.y === player.y) {
        dishes.splice(i, 1); score++; document.getElementById('score').innerText = score; log(`Prato coletado: ${d.name}`);
        if (dishes.length === 0) { 
          log(`Nível ${level} completo!`); 
          
          if (level >= MAX_LEVEL) { 
            showVictoryModal();
            stopTicks(); 
          } else { 
            level++; 
            epsilon = Math.max(0.02, epsilon * 0.9); 
            document.getElementById('epsilon').innerText = epsilon.toFixed(2); 
            seedLevel(level); 
          } 

        }
      }
    }
    render();
  }

});

document.getElementById('restart').addEventListener('click', () => {
  lives = 3; score = 0; level = 1; epsilon = DEFAULT_EPSILON; seedLevel(1); render(); startTicks(); log('Jogo reiniciado.');
});
document.getElementById('resetQ').addEventListener('click', () => { if (confirm('Resetar Q-table?')) resetQ(); });

// Pré-treinamento do inimigo (simulação automática)

function preTrain(episodes = 1000) {
 
  log(`🧠 Treinando inimigo intensivamente por ${episodes} episódios...`);
  epsilon = 0.8; // muito mais exploração

  for (let e = 0; e < episodes; e++) {
    let simPlayer = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) };
    let simEnemy = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) };
    let simEnemy2 = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) };
    let simDishes = [];
    
    // Cria pratos para treinamento

    for (let i = 0; i < 3; i++) {
      let pos;
      do {
        pos = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) };
      } while ((pos.x === simPlayer.x && pos.y === simPlayer.y) || 
               (pos.x === simEnemy.x && pos.y === simEnemy.y) ||
               (pos.x === simEnemy2.x && pos.y === simEnemy2.y));
      simDishes.push(pos);
    }
    
    for (let step = 0; step < 60; step++) {
      
      // Primeiro inimigo

      const s = stateFor(simEnemy, simPlayer);
      const a = chooseAction(s);
      const prev = { x: simEnemy.x, y: simEnemy.y };
      moveEntity(simEnemy, a);
      const caught1 = (simEnemy.x === simPlayer.x && simEnemy.y === simPlayer.y);
      
      // Segundo inimigo

      const s2 = stateFor(simEnemy2, simPlayer);
      const a2 = chooseAction(s2);
      const prev2 = { x: simEnemy2.x, y: simEnemy2.y };
      moveEntity(simEnemy2, a2);
      const caught2 = (simEnemy2.x === simPlayer.x && simEnemy2.y === simPlayer.y);
      
      const caught = caught1 || caught2;
      
      // Checa se os inimigos coletaram algum prato

      let collectedDish = false;
      for (let i = simDishes.length - 1; i >= 0; i--) {
        if ((simDishes[i].x === simEnemy.x && simDishes[i].y === simEnemy.y) ||
            (simDishes[i].x === simEnemy2.x && simDishes[i].y === simEnemy2.y)) {
          simDishes.splice(i, 1);
          collectedDish = true;
        }
      }
      
      // Q-learning para primeiro inimigo

      const nextS = stateFor(simEnemy, simPlayer);
      const prevDist = Math.abs(prev.x - simPlayer.x) + Math.abs(prev.y - simPlayer.y);
      const curDist = Math.abs(simEnemy.x - simPlayer.x) + Math.abs(simEnemy.y - simPlayer.y);
      
      let r = -0.02;
      if (caught1) r += 15;
      else if (collectedDish) r += 8;
      else if (curDist < prevDist) r += 0.5;
      else if (curDist > prevDist) r -= 0.2;
      
      qUpdate(s, a, r, nextS);
      
      // Q-learning para segundo inimigo

      const nextS2 = stateFor(simEnemy2, simPlayer);
      const prevDist2 = Math.abs(prev2.x - simPlayer.x) + Math.abs(prev2.y - simPlayer.y);
      const curDist2 = Math.abs(simEnemy2.x - simPlayer.x) + Math.abs(simEnemy2.y - simPlayer.y);
      
      let r2 = -0.02;
      if (caught2) r2 += 15;
      else if (collectedDish) r2 += 8;
      else if (curDist2 < prevDist2) r2 += 0.5;
      else if (curDist2 > prevDist2) r2 -= 0.2;
      
      qUpdate(s2, a2, r2, nextS2);
      
      if (caught || simDishes.length === 0) break;
    }
    
    // Decay epsilon during training
    epsilon = Math.max(0.1, epsilon * 0.999);
  }

  epsilon = DEFAULT_EPSILON; saveQ(); log('🎯 Inimigo super treinado! Prepare-se para o desafio!');
}

// Funções dos modais

function showVictoryModal() {
  document.getElementById('finalScore').innerText = score;
  document.getElementById('victoryModal').style.display = 'block';
}

function showGameOverModal(message) {
  document.getElementById('gameOverMessage').innerText = message;
  document.getElementById('finalScoreGameOver').innerText = score;
  document.getElementById('gameOverModal').style.display = 'block';
}

function hideModals() {
  document.getElementById('victoryModal').style.display = 'none';
  document.getElementById('gameOverModal').style.display = 'none';
}

// Event listeners dos modais

document.addEventListener('DOMContentLoaded', function() {
  // Botões de fechar
  document.querySelectorAll('.close').forEach(closeBtn => {
    closeBtn.addEventListener('click', hideModals);
  });

  // Botão Jogar Novamente

  document.getElementById('playAgain').addEventListener('click', () => {
    hideModals();
    lives = 3; score = 0; level = 1; epsilon = DEFAULT_EPSILON;
    seedLevel(1); render(); startTicks();
    log('Jogo reiniciado.');
  });

  // Botão Tentar Novamente

  document.getElementById('tryAgain').addEventListener('click', () => {
    hideModals();
    lives = 3; score = 0; level = 1; epsilon = DEFAULT_EPSILON;
    seedLevel(1); render(); startTicks();
    log('Jogo reiniciado.');
  });

  // Fechar modal clicando fora

  window.addEventListener('click', (event) => {
    if (event.target.classList.contains('modal')) {
      hideModals();
    }
  });
});

loadQ(); preTrain(1000); seedLevel(1); render(); startTicks();
window.addEventListener('beforeunload', () => { saveQ(); });

