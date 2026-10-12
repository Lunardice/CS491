// Property-based tests for paddle-ball-game Task 4 (movement & collision).
// Uses fast-check, 100 iterations per property.
//
// Run with: node gameLogic.test.js

const fc = require('fast-check');
const {
  applyWallBounce,
  applyPaddleBounce,
  isTouchingPaddle,
  offEdge,
  resetBallState,
  clampPaddle,
  aiPaddleStep,
  checkWinner,
} = require('./gameLogic');

const GEOM = { width: 600, height: 300, radius: 8 };
const PADDLE_WIDTH = 10;
const PADDLE_HEIGHT = 80;
const RUNS = 100;

let failures = 0;

function runProperty(label, property) {
  try {
    fc.assert(property, { numRuns: RUNS });
    console.log(`PASS (${RUNS} runs) - ${label}`);
  } catch (err) {
    failures++;
    console.error(`FAIL - ${label}`);
    console.error(err.message);
  }
}

// -------------------------------------------------------------------------
// Feature: paddle-ball-game, Property 1: Ball bounces off paddles
// For any ball hitting a paddle, horizontal direction reverses.
// Validates Requirement 2.1.
// -------------------------------------------------------------------------
runProperty(
  'Feature: paddle-ball-game, Property 1: Ball bounces off paddles',
  fc.property(
    // Choose which paddle to hit, a y within that paddle's span, and a dx/dy.
    fc.boolean(), // true => left paddle, false => right paddle
    fc.integer({ min: 0, max: PADDLE_HEIGHT }), // offset into paddle height
    fc.integer({ min: 0, max: GEOM.height - PADDLE_HEIGHT }), // paddle top position
    fc.integer({ min: 1, max: 10 }), // |dx|
    fc.integer({ min: -10, max: 10 }), // dy
    fc.boolean(), // sign of dx
    (hitLeft, yOffset, paddleTop, dxMag, dy, dxPositive) => {
      const paddles = {
        paddleWidth: PADDLE_WIDTH,
        paddleHeight: PADDLE_HEIGHT,
        leftY: paddleTop,
        rightY: paddleTop,
      };
      const y = paddleTop + yOffset;
      // Place the ball so it is touching the chosen paddle.
      const x = hitLeft ? PADDLE_WIDTH + GEOM.radius : GEOM.width - PADDLE_WIDTH - GEOM.radius;
      const dx = dxPositive ? dxMag : -dxMag;
      const state = { x, y, dx, dy };

      // Precondition: this state must actually be touching a paddle.
      if (!isTouchingPaddle(state, GEOM, paddles)) return true; // skip non-contact

      const result = applyPaddleBounce(state, GEOM, paddles);
      // Horizontal direction must have reversed.
      return result.dx === -dx;
    }
  )
);

// -------------------------------------------------------------------------
// Feature: paddle-ball-game, Property 2: Ball bounces off walls
// For any ball hitting the top or bottom wall, vertical direction reverses.
// Validates Requirement 2.2.
// -------------------------------------------------------------------------
runProperty(
  'Feature: paddle-ball-game, Property 2: Ball bounces off walls',
  fc.property(
    fc.boolean(), // true => top wall, false => bottom wall
    fc.integer({ min: 0, max: GEOM.width }), // x position
    fc.integer({ min: 1, max: 10 }), // |dy|
    fc.integer({ min: -10, max: 10 }), // dx
    fc.boolean(), // sign of dy
    (hitTop, x, dyMag, dx, dyPositive) => {
      const dy = dyPositive ? dyMag : -dyMag;
      // Place the ball flush against the chosen wall.
      const y = hitTop ? GEOM.radius : GEOM.height - GEOM.radius;
      const state = { x, y, dx, dy };

      const result = applyWallBounce(state, GEOM);
      // Vertical direction must have reversed.
      return result.dy === -dy;
    }
  )
);

// -------------------------------------------------------------------------
// Feature: paddle-ball-game, Property 3: Ball resets when off screen
// For any ball going off the left or right edge, the ball returns to center.
// Validates Requirement 2.3.
// -------------------------------------------------------------------------
runProperty(
  'Feature: paddle-ball-game, Property 3: Ball resets when off screen',
  fc.property(
    fc.boolean(), // true => off left edge, false => off right edge
    fc.integer({ min: 1, max: 50 }), // how far past the edge
    fc.integer({ min: 0, max: GEOM.height }), // y position
    fc.integer({ min: -10, max: 10 }), // dx
    fc.integer({ min: -10, max: 10 }), // dy
    (offLeft, past, y, dx, dy) => {
      // Place the ball off the chosen edge.
      const x = offLeft ? -past : GEOM.width + past;
      const state = { x, y, dx, dy };

      const edge = offEdge(state, GEOM);
      // Precondition: ball must actually be off an edge.
      if (edge === null) return true;

      // On off-edge, the game resets the ball to center.
      const reset = resetBallState(GEOM, dx, dy);
      return reset.x === GEOM.width / 2 && reset.y === GEOM.height / 2;
    }
  )
);

// -------------------------------------------------------------------------
// Task 5: Player input - paddle stays within canvas bounds.
// clampPaddle must always return a value in [0, canvasHeight - paddleHeight].
// Validates Requirements 1.1, 1.2 (paddle moves but remains on screen).
// -------------------------------------------------------------------------
runProperty(
  'Task 5: clampPaddle keeps the paddle within [0, canvasHeight - paddleHeight]',
  fc.property(
    fc.integer({ min: -500, max: 1000 }), // proposed paddle top (possibly out of bounds)
    (y) => {
      const result = clampPaddle(y, GEOM.height, PADDLE_HEIGHT);
      const max = GEOM.height - PADDLE_HEIGHT;
      return result >= 0 && result <= max;
    }
  )
);

// -------------------------------------------------------------------------
// Task 6: AI left paddle - result always stays within canvas bounds.
// aiPaddleStep must always return a value in [0, canvasHeight - paddleHeight],
// for any current paddle position, ball position, and tracking factor.
// Validates Requirement 1.3 (AI follows the ball while staying on screen).
// -------------------------------------------------------------------------
runProperty(
  'Task 6: aiPaddleStep keeps the AI paddle within [0, canvasHeight - paddleHeight]',
  fc.property(
    fc.integer({ min: -500, max: 1000 }),  // current paddle top (possibly out of bounds)
    fc.integer({ min: -500, max: 1000 }),  // ball y (possibly off screen)
    fc.double({ min: 0, max: 1, noNaN: true }), // tracking factor (AI_FACTOR)
    (leftY, ballY, factor) => {
      const result = aiPaddleStep(leftY, ballY, PADDLE_HEIGHT, factor, GEOM.height);
      const max = GEOM.height - PADDLE_HEIGHT;
      return result >= 0 && result <= max;
    }
  )
);

// -------------------------------------------------------------------------
// Task 8: "First to N wins" - checkWinner declares a winner iff some score
// has reached winScore, and never reports both sides as winning at once.
// Validates the fancy scoreboard "First to 5 wins" customization.
// -------------------------------------------------------------------------
runProperty(
  'Task 8: checkWinner declares a winner iff a score reaches winScore (never both)',
  fc.property(
    fc.integer({ min: 0, max: 10 }), // leftScore
    fc.integer({ min: 0, max: 10 }), // rightScore
    fc.integer({ min: 1, max: 10 }), // winScore
    (leftScore, rightScore, winScore) => {
      const winner = checkWinner(leftScore, rightScore, winScore);
      const someoneReached = leftScore >= winScore || rightScore >= winScore;

      // A winner is declared iff at least one side reached winScore.
      if (someoneReached && winner === null) return false;
      if (!someoneReached && winner !== null) return false;

      // The result is always one of the three valid values.
      if (winner !== 'left' && winner !== 'right' && winner !== null) return false;

      // The declared winner must itself have reached winScore.
      if (winner === 'left' && leftScore < winScore) return false;
      if (winner === 'right' && rightScore < winScore) return false;

      return true;
    }
  )
);

// Unit checks for checkWinner edge cases.
(function checkWinnerUnitTests() {
  const cases = [
    [0, 0, 5, null],   // fresh game, no winner
    [4, 3, 5, null],   // close but no winner
    [5, 3, 5, 'left'], // left reaches 5 first
    [2, 5, 5, 'right'],// right reaches 5 first
    [6, 2, 5, 'left'], // left past threshold
    [5, 5, 5, 'left'], // tie at threshold -> left wins (shouldn't occur in play)
  ];
  for (const [l, r, w, expected] of cases) {
    const actual = checkWinner(l, r, w);
    if (actual !== expected) {
      failures++;
      console.error(`FAIL - checkWinner(${l}, ${r}, ${w}) expected ${expected}, got ${actual}`);
    }
  }
  console.log('PASS - checkWinner unit edge cases');
})();

// Unit checks for clampPaddle edge cases.
(function clampPaddleUnitTests() {
  const max = GEOM.height - PADDLE_HEIGHT; // 220
  const cases = [
    [-10, 0],      // below lower bound -> clamped to 0
    [0, 0],        // lower boundary
    [100, 100],    // in range -> unchanged
    [max, max],    // upper boundary
    [max + 50, max], // above upper bound -> clamped to max
  ];
  for (const [input, expected] of cases) {
    const actual = clampPaddle(input, GEOM.height, PADDLE_HEIGHT);
    if (actual !== expected) {
      failures++;
      console.error(`FAIL - clampPaddle(${input}) expected ${expected}, got ${actual}`);
    }
  }
  console.log('PASS - clampPaddle unit edge cases');
})();

if (failures > 0) {
  console.error(`\n${failures} property/properties FAILED`);
  process.exit(1);
} else {
  console.log('\nAll properties passed.');
  process.exit(0);
}
