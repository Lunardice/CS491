// Pure collision/reset logic for the paddle ball game.
//
// These functions are the testable source of truth for Task 4. They are written
// as pure functions (no canvas/DOM dependency) so the fast-check property tests
// in gameLogic.test.js can exercise them directly under Node. The identical
// helpers are duplicated inside index.html's inline <script> to keep that file a
// single self-contained HTML file.
//
// Conventions:
//   state:   { x, y, dx, dy }
//   geom:    { width, height, radius }
//   paddles: { paddleWidth, paddleHeight, leftY, rightY }

// Reverse vertical direction if the ball is touching the top or bottom wall.
function applyWallBounce(state, geom) {
  let { x, y, dx, dy } = state;
  const hitTop = y - geom.radius <= 0;
  const hitBottom = y + geom.radius >= geom.height;
  if (hitTop || hitBottom) {
    dy = -dy;
  }
  return { x, y, dx, dy };
}

// Returns true if the ball overlaps either paddle.
function isTouchingPaddle(state, geom, paddles) {
  const { x, y } = state;
  const touchingLeft =
    x - geom.radius <= paddles.paddleWidth &&
    y >= paddles.leftY &&
    y <= paddles.leftY + paddles.paddleHeight;
  const touchingRight =
    x + geom.radius >= geom.width - paddles.paddleWidth &&
    y >= paddles.rightY &&
    y <= paddles.rightY + paddles.paddleHeight;
  return touchingLeft || touchingRight;
}

// Reverse horizontal direction if the ball is touching a paddle.
function applyPaddleBounce(state, geom, paddles) {
  let { x, y, dx, dy } = state;
  if (isTouchingPaddle(state, geom, paddles)) {
    dx = -dx;
  }
  return { x, y, dx, dy };
}

// Determine whether the ball has gone off an edge. Returns 'left', 'right', or null.
function offEdge(state, geom) {
  if (state.x - geom.radius < 0) return 'left';
  if (state.x + geom.radius > geom.width) return 'right';
  return null;
}

// Advance the ball one step by applying velocity.
function stepBall(state) {
  return { x: state.x + state.dx, y: state.y + state.dy, dx: state.dx, dy: state.dy };
}

// Reset the ball to the center of the canvas (keeps current dx/dy by default).
function resetBallState(geom, dx, dy) {
  return { x: geom.width / 2, y: geom.height / 2, dx, dy };
}

// Clamp a paddle's top position so the paddle stays fully within the canvas.
// Valid range is [0, canvasHeight - paddleHeight].
function clampPaddle(y, canvasHeight, paddleHeight) {
  const max = canvasHeight - paddleHeight;
  if (y < 0) return 0;
  if (y > max) return max;
  return y;
}

// Compute the AI (left) paddle's next top position for one frame.
//
// The AI follows the ball's vertical position with proportional smoothing:
// it moves the paddle a `factor` fraction of the distance between the paddle
// center and the ball each frame. A factor of 0.9 (user's "hard" setting)
// tracks the ball quickly but never instantly, and the per-frame step keeps
// the AI beatable. The result is clamped so the paddle stays fully on screen.
//
//   leftY        - current paddle top
//   ballY        - target y to follow (ball center)
//   paddleHeight - paddle height
//   factor       - tracking/smoothing strength in [0, 1] (AI_FACTOR)
//   canvasHeight - canvas height for clamping
function aiPaddleStep(leftY, ballY, paddleHeight, factor, canvasHeight) {
  const paddleCenter = leftY + paddleHeight / 2;
  const delta = ballY - paddleCenter;
  const nextY = leftY + delta * factor;
  return clampPaddle(nextY, canvasHeight, paddleHeight);
}

// Determine the winner of the game once a side reaches the winning score.
//
// Used by the "first to 5 wins" scoreboard logic. Returns:
//   'left'  - the left (COMPUTER) side has reached winScore
//   'right' - the right (PLAYER) side has reached winScore
//   null    - no side has reached winScore yet
//
// If both scores are >= winScore (which should not happen in normal play since
// the game freezes on the first win), the side with the higher score wins; the
// left side wins ties. In practice scores only ever increment by one at a time,
// so at most one side can cross the threshold on any given frame.
function checkWinner(leftScore, rightScore, winScore) {
  const leftWon = leftScore >= winScore;
  const rightWon = rightScore >= winScore;
  if (leftWon && rightWon) {
    return leftScore >= rightScore ? 'left' : 'right';
  }
  if (leftWon) return 'left';
  if (rightWon) return 'right';
  return null;
}

module.exports = {
  applyWallBounce,
  isTouchingPaddle,
  applyPaddleBounce,
  offEdge,
  stepBall,
  resetBallState,
  clampPaddle,
  aiPaddleStep,
  checkWinner,
};
