// Game configuration - 6 pairs for 3x4 grid
const EMOJIS = ['👹', '🤡', '👽', '🎃', '🤖', '🐸'];

// Win phrases - shown randomly on victory
const WIN_PHRASES = [
    'Да у тебя талант!',
    'Все пары найдены!',
    'Вау!',
    'Так держать!',
    'Вот это скорость!',
    'Спишь?'
];

// ==================== //
// SOUND SYSTEM          //
// ==================== //

const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioContext = null;
const audioBuffers = {};
let soundEnabled = true;

// Preload and decode all sound files into memory
async function initAudioSystem() {
    try {
        audioContext = new AudioCtx();
        const soundFiles = {
            flip: 'sounds/flip.mp3',
            match: 'sounds/matched.mp3',
            win: 'sounds/win.mp3'
        };
        await Promise.all(
            Object.entries(soundFiles).map(async ([name, url]) => {
                try {
                    const resp = await fetch(url);
                    const buf = await resp.arrayBuffer();
                    audioBuffers[name] = await audioContext.decodeAudioData(buf);
                } catch (_) { /* sound load failed, continue silently */ }
            })
        );
    } catch (_) { /* Web Audio API not supported */ }
}

// Unlock AudioContext on first user gesture (required by mobile browsers)
function unlockAudio() {
    if (audioContext && audioContext.state === 'suspended') {
        audioContext.resume();
    }
}
document.addEventListener('touchstart', unlockAudio, { once: true });
document.addEventListener('touchend', unlockAudio, { once: true });
document.addEventListener('click', unlockAudio, { once: true });

// Play sound — creates a fresh source node each time (instant, no conflicts)
function playSound(soundName) {
    if (!soundEnabled || !audioContext || !audioBuffers[soundName]) return;
    if (audioContext.state === 'suspended') audioContext.resume();
    const source = audioContext.createBufferSource();
    source.buffer = audioBuffers[soundName];
    source.connect(audioContext.destination);
    source.start(0);
}

// Start loading audio immediately
initAudioSystem();

// ==================== //
// GAME STATE            //
// ==================== //

let cards = [];
let flippedCards = [];
let matchedPairs = 0;
let isLocked = false;
let timerInterval = null;
let startTime = null;
let elapsedTime = 0;
let gameStarted = false;
let bestTime = localStorage.getItem('duoQuestBestTime') ? parseInt(localStorage.getItem('duoQuestBestTime')) : null;

// DOM elements
const gameBoard = document.getElementById('gameBoard');
const timerDisplay = document.getElementById('timer');
const winCard = document.getElementById('winCard');
const playAgainBtn = document.getElementById('playAgainBtn');
const bestTimeDisplay = document.getElementById('bestTimeDisplay');
const bestTimeElement = document.getElementById('bestTime');

// ==================== //
// GAME LOGIC            //
// ==================== //

// Initialize game
function initGame() {
    cards = [];
    flippedCards = [];
    matchedPairs = 0;
    isLocked = false;
    gameStarted = false;
    elapsedTime = 0;

    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    timerDisplay.innerHTML = '00:00<span class="ms">.00</span>';

    // Show best time (or 00:00.00 if none)
    if (bestTime) {
        bestTimeElement.innerHTML = formatTime(bestTime);
    } else {
        bestTimeElement.innerHTML = '00:00<span class="ms">.00</span>';
    }

    // Create card pairs (6 pairs = 12 cards for 3x4 grid)
    const cardPairs = [...EMOJIS, ...EMOJIS];

    // Shuffle cards
    for (let i = cardPairs.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [cardPairs[i], cardPairs[j]] = [cardPairs[j], cardPairs[i]];
    }

    gameBoard.innerHTML = '';

    cardPairs.forEach((emoji, index) => {
        const card = document.createElement('div');
        card.className = 'card';
        card.dataset.index = index;
        card.dataset.emoji = emoji;

        card.innerHTML = `
            <div class="card-face card-back"></div>
            <div class="card-face card-front">${emoji}</div>
        `;

        card.addEventListener('click', () => flipCard(card));
        gameBoard.appendChild(card);
        cards.push(card);
    });

    // Hide win card, show game board
    winCard.classList.remove('show');
    winCard.classList.remove('visible');
    gameBoard.style.display = 'grid';
}

// Flip card
function flipCard(card) {
    if (isLocked ||
        card.classList.contains('flipped') ||
        card.classList.contains('matched') ||
        flippedCards.length >= 2) {
        return;
    }

    if (!gameStarted) {
        gameStarted = true;
        startTime = Date.now();
        timerInterval = setInterval(updateTimer, 10);
    }

    card.classList.add('flipped');
    flippedCards.push(card);
    playSound('flip');

    if (flippedCards.length === 2) {
        checkMatch();
    }
}

// Check match
function checkMatch() {
    isLocked = true;
    const [card1, card2] = flippedCards;

    if (card1.dataset.emoji === card2.dataset.emoji) {
        setTimeout(() => {
            card1.classList.add('matched');
            card2.classList.add('matched');
            playSound('match');
            matchedPairs++;
            flippedCards = [];
            isLocked = false;

            if (matchedPairs === EMOJIS.length) {
                endGame();
            }
        }, 150);
    } else {
        setTimeout(() => {
            card1.classList.remove('flipped');
            card2.classList.remove('flipped');
            flippedCards = [];
            isLocked = false;
        }, 600);
    }
}

// Update timer
function updateTimer() {
    elapsedTime = Date.now() - startTime;
    timerDisplay.innerHTML = formatTime(elapsedTime);
}

// Format time
function formatTime(ms) {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    const milliseconds = Math.floor((ms % 1000) / 10);

    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}<span class="ms">.${milliseconds.toString().padStart(2, '0')}</span>`;
}

// End game
function endGame() {
    clearInterval(timerInterval);
    playSound('win');

    // Show random win phrase
    const randomPhrase = WIN_PHRASES[Math.floor(Math.random() * WIN_PHRASES.length)];
    document.querySelector('.win-title').textContent = randomPhrase;

    // Update best time if needed
    if (!bestTime || elapsedTime < bestTime) {
        bestTime = elapsedTime;
        localStorage.setItem('duoQuestBestTime', bestTime);
        bestTimeElement.innerHTML = formatTime(bestTime);
    }

    // Hide game board, show win card with animation
    setTimeout(() => {
        gameBoard.style.display = 'none';
        winCard.classList.add('visible');
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                winCard.classList.add('show');
            });
        });
    }, 300);
}

// Event listeners
playAgainBtn.addEventListener('click', initGame);

// Sound toggle
const soundBtn = document.getElementById('soundBtn');
const soundBtnDesktop = document.getElementById('soundBtnDesktop');

function toggleSound() {
    soundEnabled = !soundEnabled;
    document.querySelectorAll('.sound-icon-on').forEach(el => {
        el.style.display = soundEnabled ? 'block' : 'none';
    });
    document.querySelectorAll('.sound-icon-off').forEach(el => {
        el.style.display = soundEnabled ? 'none' : 'block';
    });
}

soundBtn.addEventListener('click', toggleSound);
soundBtnDesktop.addEventListener('click', toggleSound);

// ==================== //
// MAIN SCREEN           //
// ==================== //

// Letters mapped to SVG paths: П(0), А(1), Р(2), А(3), К(4), А(5), Р(6), Т(7)
const TITLE_CHARS = ['П', 'А', 'Р', 'А', 'К', 'А', 'Р', 'Т'];
// All letters participate in animation
// Matching pairs for forced matches: А-А and Р-Р
const TITLE_PAIRS = [[1,3],[1,5],[3,5],[2,6]];
let titleSpans = [];
let titleAnimTimer = null;
let titleAnimRunning = false;
let titleMissCount = 0;

// SVG natural dimensions from viewBox
const SVG_W = 324;
const SVG_H = 601;

// Layout: scale SVG title to fill available space
function layoutMainTitle() {
    const isDesktop = window.innerWidth >= 601;
    const area = document.getElementById('mainTitleArea');
    const title = document.getElementById('mainTitle');

    if (isDesktop) {
        // Desktop: rotate 90° to horizontal, stretch to fill viewport width (minus padding)
        const viewW = window.innerWidth - 100; // 50px padding on each side
        const scale = viewW / SVG_H; // After 90° rotation, SVG_H becomes visual width
        const w = Math.floor(SVG_W * scale);
        const h = Math.floor(SVG_H * scale);
        title.style.width = w + 'px';
        title.style.height = h + 'px';
        title.style.left = '50%';
        title.style.top = '50%';
        title.style.transform = 'translate(-50%, -50%) rotate(90deg)';
    } else {
        // Mobile: scale SVG to fit available area (no rotation — SVG is already vertical)
        const availW = area.clientWidth;
        const availH = area.clientHeight - 40; // 40px min gap to button
        const scale = Math.min(availW / SVG_W, availH / SVG_H);
        const w = Math.floor(SVG_W * scale);
        const h = Math.floor(SVG_H * scale);
        title.style.width = w + 'px';
        title.style.height = h + 'px';
        title.style.left = Math.floor((availW - w) / 2) + 'px';
        title.style.top = Math.floor((availH - h) / 2) + 'px';
    }
}

// Title animation: demonstrates the matching mechanic
function startTitleAnimation() {
    titleSpans = document.querySelectorAll('#mainTitle path');
    titleAnimRunning = true;
    titleAnimTimer = setTimeout(titleAnimStep, 800);
}

function stopTitleAnimation() {
    titleAnimRunning = false;
    if (titleAnimTimer) { clearTimeout(titleAnimTimer); titleAnimTimer = null; }
    titleSpans.forEach(s => s.style.fill = '');
}

function titleAnimStep() {
    if (!titleAnimRunning) return;
    let i1, i2;

    if (titleMissCount >= 3) {
        // Force a match on the 4th attempt
        const pair = TITLE_PAIRS[Math.floor(Math.random() * TITLE_PAIRS.length)];
        i1 = pair[0];
        i2 = pair[1];
    } else {
        // All letters except К (index 4)
        const pool = [0, 1, 2, 3, 5, 6, 7];
        const pi1 = Math.floor(Math.random() * pool.length);
        i1 = pool[pi1];
        let pi2;
        do { pi2 = Math.floor(Math.random() * pool.length); } while (pi2 === pi1);
        i2 = pool[pi2];
    }

    const s1 = titleSpans[i1];
    const s2 = titleSpans[i2];

    // First card
    s1.style.fill = '#206CF3';

    setTimeout(() => {
        if (!titleAnimRunning) return;
        // Second card
        s2.style.fill = '#206CF3';

        setTimeout(() => {
            if (!titleAnimRunning) return;
            if (TITLE_CHARS[i1] === TITLE_CHARS[i2]) {
                // Match → green flash → return
                titleMissCount = 0;
                s1.style.fill = '#CCED00';
                s2.style.fill = '#CCED00';
                setTimeout(() => {
                    if (!titleAnimRunning) return;
                    s1.style.fill = '';
                    s2.style.fill = '';
                    titleAnimTimer = setTimeout(titleAnimStep, 600);
                }, 500);
            } else {
                // No match → return
                titleMissCount++;
                s1.style.fill = '';
                s2.style.fill = '';
                titleAnimTimer = setTimeout(titleAnimStep, 600);
            }
        }, 500);
    }, 500);
}

// ==================== //
// SCREEN NAVIGATION     //
// ==================== //

function showMainScreen() {
    document.getElementById('gameScreen').style.display = 'none';
    document.getElementById('mainScreen').style.display = 'flex';
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
    layoutMainTitle();
    startTitleAnimation();
}

function showGameScreen() {
    stopTitleAnimation();
    document.getElementById('mainScreen').style.display = 'none';
    document.getElementById('gameScreen').style.display = '';
    initGame();
}

// Resize handler — re-layout title if main screen is visible
window.addEventListener('resize', () => {
    if (document.getElementById('mainScreen').style.display !== 'none') {
        layoutMainTitle();
    }
});

// Navigation event listeners
document.getElementById('startBtn').addEventListener('click', showGameScreen);
document.getElementById('logoBtn').addEventListener('click', showMainScreen);

// Start on main screen
showMainScreen();
