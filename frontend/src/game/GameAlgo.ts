import * as BABYLON from 'babylonjs';

export function startGame(
  onMatchEnd: (winner: string) => void,
  settings: {
    winScore: number;
    ballSpeed: number;
    paddleSpeed: number;
  },
  p1: string,
  p2: string
) {
  const canvas = document.getElementById('pong') as HTMLCanvasElement;
  if (!canvas) return;

  // Load mode and AI settings
  const opponentSettings = JSON.parse(localStorage.getItem('opponent_settings') || '{}');
  const mode = localStorage.getItem('mode') || 'multi';
  const aiLevel = opponentSettings.aiLevel || 'medium';

  // Check if this is an AI match (either singleplayer or profile-singleplayer)
  const isAIMatch = mode === 'singleplayer' || mode === 'profile-singleplayer';

  // --- Configure AI difficulty (used for error & aggressiveness) ---
  // These values influence prediction noise, chance to miss and hold time scaling.
  let aiErrorFactor = 0.15;   // higher = more error (in world units)
  let aiMissChance = 0.12;    // probability to intentionally "miss" (0..1)
  let aiViewInterval = 1000;  // ms: how often AI re-computes (must be 1000 ms per spec)
  let aiHoldScale = 1.0;      // scales how long keys are held (lower -> shorter presses)
  switch (aiLevel) {
    case 'easy':
      aiErrorFactor = 0.6;
      aiMissChance = 0.35;
      aiHoldScale = 0.8;
      break;
    case 'medium':
      aiErrorFactor = 0.25;
      aiMissChance = 0.18;
      aiHoldScale = 1.0;
      break;
    case 'hard':
      aiErrorFactor = 0.08;
      aiMissChance = 0.05;
      aiHoldScale = 1.15;
      break;
  }

  const engine = new BABYLON.Engine(canvas, true);
  const scene = new BABYLON.Scene(engine);
  const camera = new BABYLON.FreeCamera('camera', new BABYLON.Vector3(0, 0, -100), scene);
  camera.setTarget(BABYLON.Vector3.Zero());
  new BABYLON.HemisphericLight('light', new BABYLON.Vector3(0, 1, 0), scene);
  // Add a subtle glow bloom to make emissive materials pop
  const glow = new BABYLON.GlowLayer('glow', scene, { blurKernelSize: 48 });
  glow.intensity = 0.55;

  const WIN_SCORE = settings.winScore;
  const BALL_SPEED = settings.ballSpeed;
  const PADDLE_SPEED = settings.paddleSpeed;

  const fieldWidth = 100;
  const fieldHeight = 60;
  const paddleSize = { width: 3, height: 14, depth: 2 };
  const ballSize = 4;

  const scoreboardHost = document.getElementById('app') || document.body;
  let scoreDiv = document.getElementById('scoreDisplay') as HTMLDivElement | null;
  let leftScoreValueEl: HTMLSpanElement | null = null;
  let rightScoreValueEl: HTMLSpanElement | null = null;

  function mountScoreboard() {
    if (!scoreDiv) {
      scoreDiv = document.createElement('div');
      scoreDiv.id = 'scoreDisplay';
    }

    scoreDiv.className = 'game-scoreboard';
    scoreDiv.innerHTML = '';
    scoreDiv.setAttribute('role', 'status');
    scoreDiv.setAttribute('aria-live', 'polite');

    const panel = document.createElement('div');
    panel.className = 'game-scoreboard-panel';

    const leftPlayer = document.createElement('div');
    leftPlayer.className = 'game-scoreboard-player';
    const leftLabel = document.createElement('span');
    leftLabel.className = 'game-scoreboard-label';
    leftLabel.textContent = 'Player One';
    const leftName = document.createElement('span');
    leftName.className = 'game-scoreboard-name';
    leftName.textContent = p1;
    leftPlayer.append(leftLabel, leftName);

    const scoresGroup = document.createElement('div');
    scoresGroup.className = 'game-scoreboard-scores';
    const leftScoreSpan = document.createElement('span');
    leftScoreSpan.className = 'game-scoreboard-score';
    leftScoreSpan.textContent = '00';
    const divider = document.createElement('span');
    divider.className = 'game-scoreboard-divider';
    divider.textContent = ':';
    const rightScoreSpan = document.createElement('span');
    rightScoreSpan.className = 'game-scoreboard-score';
    rightScoreSpan.textContent = '00';
    scoresGroup.append(leftScoreSpan, divider, rightScoreSpan);

    const rightPlayer = document.createElement('div');
    rightPlayer.className = 'game-scoreboard-player game-scoreboard-player--right';
    const rightLabel = document.createElement('span');
    rightLabel.className = 'game-scoreboard-label';
    rightLabel.textContent = isAIMatch ? 'AI Opponent' : 'Player Two';
    const rightName = document.createElement('span');
    rightName.className = 'game-scoreboard-name';
    rightName.textContent = p2;
    rightPlayer.append(rightLabel, rightName);

    panel.append(leftPlayer, scoresGroup, rightPlayer);

    const subtext = document.createElement('p');
    subtext.className = 'game-scoreboard-subtext';
    const descriptor = isAIMatch ? 'AI showdown' : 'Head-to-head battle';
    subtext.textContent = `First to ${WIN_SCORE} | ${descriptor}`;

    scoreDiv.append(panel, subtext);
    scoreboardHost.appendChild(scoreDiv);

    leftScoreValueEl = leftScoreSpan;
    rightScoreValueEl = rightScoreSpan;
  }

  mountScoreboard();

  // --- Background ---
  const ground = BABYLON.MeshBuilder.CreateGround(
    'ground',
    { width: fieldWidth, height: fieldHeight },
    scene
  );
  const groundMat = new BABYLON.StandardMaterial('groundMat', scene);
  groundMat.diffuseColor = new BABYLON.Color3(0.05, 0.05, 0.1);
  ground.material = groundMat;

  // --- Paddles (glowing block look) ---
  function buildGlowingBlockPaddle(base: BABYLON.AbstractMesh, color: BABYLON.Color3) {
    // Base is just a transform holder for physics and positioning
    base.isVisible = false;

    const holder = new BABYLON.TransformNode(base.name + '-block-holder', scene);
    holder.parent = base;

    // Outer translucent shell to create a soft volumetric glow
    const shell = BABYLON.MeshBuilder.CreateBox(base.name + '-shell', {
      width: paddleSize.width,
      height: paddleSize.height,
      depth: paddleSize.depth,
    }, scene);
    shell.parent = holder;
    shell.isPickable = false;
    const shellMat = new BABYLON.StandardMaterial(base.name + '-shell-mat', scene);
    shellMat.diffuseColor = color.scale(0.15);
    shellMat.emissiveColor = color.scale(0.22);
    shellMat.specularColor = new BABYLON.Color3(0.9, 0.9, 1);
    shellMat.alpha = 0.42;
    shell.material = shellMat;

    // Inner bright core block that actually glows
    const core = BABYLON.MeshBuilder.CreateBox(base.name + '-core', {
      width: paddleSize.width * 0.72,
      height: paddleSize.height * 0.92,
      depth: paddleSize.depth * 0.72,
    }, scene);
    core.parent = holder;
    core.isPickable = false;
    const coreMat = new BABYLON.StandardMaterial(base.name + '-core-mat', scene);
    coreMat.diffuseColor = color.scale(0.08);
    coreMat.emissiveColor = color.clone();
    coreMat.specularColor = new BABYLON.Color3(1, 1, 1);
    // Rim emphasis to enhance 3D
    coreMat.emissiveFresnelParameters = new BABYLON.FresnelParameters();
    coreMat.emissiveFresnelParameters.bias = 0.18;
    coreMat.emissiveFresnelParameters.power = 2.0;
    core.material = coreMat;

    // Gentle pulsating emissive to make it feel alive
    const phase = Math.random() * Math.PI * 2;
    scene.onBeforeRenderObservable.add(() => {
      const t = performance.now() * 0.001;
      const pulse = 0.85 + 0.15 * Math.sin(t * 1.2 + phase);
      coreMat.emissiveColor = color.scale(pulse);
      shellMat.emissiveColor = color.scale(0.18 * pulse);
    });
  }

  // Base meshes (drivers for position) keep original dimensions for gameplay
  const paddleLeft = BABYLON.MeshBuilder.CreateBox('paddleLeft', paddleSize, scene);
  paddleLeft.position.x = -fieldWidth / 2 + 5;
  const paddleRight = BABYLON.MeshBuilder.CreateBox('paddleRight', paddleSize, scene);
  paddleRight.position.x = fieldWidth / 2 - 5;

  // Build glowing block visuals on both paddles
  buildGlowingBlockPaddle(paddleLeft, new BABYLON.Color3(0.2, 0.95, 1.0));
  buildGlowingBlockPaddle(paddleRight, new BABYLON.Color3(0.7, 0.3, 1.0));

  // --- Ball ---
  const ballMat = new BABYLON.StandardMaterial('ballMat', scene);
  ballMat.emissiveColor = new BABYLON.Color3(1.0, 0.3, 0.3);
  const ball = BABYLON.MeshBuilder.CreateSphere('ball', { diameter: ballSize }, scene);
  ball.material = ballMat;

  /** GAME STATE **/
  let leftScore = 0;
  let rightScore = 0;
  let gameOver = false;

  const left = { x: paddleLeft.position.x, y: 0, dy: 0, mesh: paddleLeft };
  const right = { x: paddleRight.position.x, y: 0, dy: 0, mesh: paddleRight };

  const ballObj = {
    x: 0,
    y: 0,
    dx: BALL_SPEED * (Math.random() > 0.5 ? 1 : -1),
    dy: BALL_SPEED * (Math.random() > 0.5 ? 1 : -1),
  };

  const keys: Record<string, boolean> = {};

  function updateScoreText() {
    if (leftScoreValueEl) {
      leftScoreValueEl.textContent = leftScore.toString().padStart(2, '0');
    }
    if (rightScoreValueEl) {
      rightScoreValueEl.textContent = rightScore.toString().padStart(2, '0');
    }
  }

  function resetBall() {
    ballObj.x = 0;
    ballObj.y = 0;
    ballObj.dx = BALL_SPEED * (Math.random() > 0.5 ? 1 : -1);
    ballObj.dy = BALL_SPEED * (Math.random() > 0.5 ? 1 : -1);
  }

  function checkPaddleCollision(paddle: typeof left | typeof right, isLeft: boolean) {
    const ballHalf = ballSize / 2;
    const paddleHalfH = paddleSize.height / 2;
    const paddleHalfW = paddleSize.width / 2;

    const withinX = isLeft
      ? ballObj.x - ballHalf <= paddle.x + paddleHalfW && ballObj.x > paddle.x
      : ballObj.x + ballHalf >= paddle.x - paddleHalfW && ballObj.x < paddle.x;

    const withinY =
      ballObj.y + ballHalf >= paddle.y - paddleHalfH && ballObj.y - ballHalf <= paddle.y + paddleHalfH;

    if (withinX && withinY) {
      const relY = ballObj.y - paddle.y;
      const normY = relY / paddleHalfH;
      const bounceAngle = (normY * Math.PI) / 4;
      const speed = Math.sqrt(ballObj.dx ** 2 + ballObj.dy ** 2);
      const dir = isLeft ? 1 : -1;

      ballObj.dx = speed * Math.cos(bounceAngle) * dir;
      ballObj.dy = speed * Math.sin(bounceAngle);
      ballObj.x = isLeft ? paddle.x + paddleHalfW + ballHalf : paddle.x - paddleHalfW - ballHalf;
    }
  }

  /** Predict where ball will intersect at x = targetX accounting for vertical bounces.
   *  Uses continuous linear motion + reflection math (no A*).
   */
  function predictBallYAtX(targetX: number) {
    // If dx is zero -> can't predict, return center
    if (ballObj.dx === 0) return 0;

    const dirToTarget = Math.sign(targetX - ballObj.x);
    const ballMovingTowardsTarget = Math.sign(ballObj.dx) === dirToTarget;

    // If ball is moving away from AI, predict center (or anticipate next approach by waiting)
    if (!ballMovingTowardsTarget) {
      return 0; // center fallback; AI will not be perfect here
    }

    // time to reach targetX (in "frames" units same as dx/dy per frame)
    const t = (targetX - ballObj.x) / ballObj.dx; // can be fractional

    // projected Y without considering walls:
    let projY = ballObj.y + ballObj.dy * t;

    // reflect projY into allowed range [-H/2, H/2] using mirror reflection
    const H = fieldHeight;
    const top = H / 2;
    // shift to [0, H] range by adding top
    let shifted = projY + top;
    const period = 2 * H;
    // proper positive modulo
    shifted = ((shifted % period) + period) % period;
    if (shifted > H) shifted = 2 * H - shifted;
    const finalY = shifted - top;
    return finalY;
  }

  /** ---- AI (simulated keyboard input, refreshed once per second) ----
   * Strategy:
   *  - Every aiViewInterval (1000ms) the AI samples ball & predicts intersection Y.
   *  - Adds an error offset (stochastic) based on difficulty.
   *  - Decides whether to press ArrowUp or ArrowDown (or do nothing).
   *  - Simulates `keydown` for arrow key, then schedules `keyup` after a computed duration
   *    based on distance and paddle speed (so movement looks natural).
   */
  let aiTimer: number | null = null;
  function startAIController() {
    // Start AI controller for both singleplayer and profile-singleplayer modes
    if (!isAIMatch) return;

    aiTimer = window.setInterval(() => {
      if (gameOver) return;
      // Predict intersection at the AI's x
      const aiX = right.x;
      let targetY = predictBallYAtX(aiX);

      // Add error/noise (difficulty-based)
      const error = (Math.random() * 2 - 1) * (aiErrorFactor * fieldHeight / 10);
      targetY += error;

      // With some probability, intentionally miss (simulate human mistakes)
      if (Math.random() < aiMissChance) {
        // push target off by a bigger offset
        targetY += (Math.random() > 0.5 ? 1 : -1) * (0.2 * fieldHeight);
      }

      // Decide direction: ArrowUp increases y, ArrowDown decreases y
      const delta = targetY - right.y;
      const tolerance = 1.2; // small deadzone so AI won't jitter

      // If the ball is not moving toward AI or delta is tiny, hold center
      if (Math.abs(delta) <= tolerance) {
        // do nothing (no key)
        return;
      }

      const keyToPress = delta > 0 ? 'ArrowUp' : 'ArrowDown';

      // compute duration to press key so paddle moves roughly the required distance
      const distance = Math.abs(delta);
      const framesNeeded = distance / Math.max(0.0001, PADDLE_SPEED);
      let durationMs = framesNeeded * (1000 / 60) * aiHoldScale;

      // Bound duration so it doesn't press absurdly long
      durationMs = Math.max(80, Math.min(durationMs, aiViewInterval - 50));

      // Simulate keydown
      const kd = new KeyboardEvent('keydown', { key: keyToPress });
      document.dispatchEvent(kd);

      // Schedule keyup after durationMs
      setTimeout(() => {
        const ku = new KeyboardEvent('keyup', { key: keyToPress });
        document.dispatchEvent(ku);
      }, durationMs);
    }, aiViewInterval);
  }

  // Stop AI controller (cleanup)
  function stopAIController() {
    if (aiTimer != null) {
      clearInterval(aiTimer);
      aiTimer = null;
    }
  }

  /** 🔁 Game Loop */
  function update() {
    if (gameOver) return;

    // Player control (always left)
    left.y += left.dy;
    left.y = Math.max(-fieldHeight / 2 + 7, Math.min(fieldHeight / 2 - 7, left.y));

    // right paddle movement: respond to right.dy set by keyboard handlers (or AI key simulation)
    right.y += right.dy;
    right.y = Math.max(-fieldHeight / 2 + 7, Math.min(fieldHeight / 2 - 7, right.y));

    left.mesh.position.y = left.y;
    right.mesh.position.y = right.y;

    // Ball physics
    ballObj.x += ballObj.dx;
    ballObj.y += ballObj.dy;
    ball.position.x = ballObj.x;
    ball.position.y = ballObj.y;

    if (ballObj.y <= -fieldHeight / 2 || ballObj.y >= fieldHeight / 2) ballObj.dy *= -1;

    checkPaddleCollision(left, true);
    checkPaddleCollision(right, false);

    // Scoring
    if (ballObj.x < -fieldWidth / 2) {
      rightScore++;
      updateScoreText();
      checkWinner();
      resetBall();
    }
    if (ballObj.x > fieldWidth / 2) {
      leftScore++;
      updateScoreText();
      checkWinner();
      resetBall();
    }
  }

  function checkWinner() {
    if (leftScore >= WIN_SCORE) {
      gameOver = true;
      stopAIController();
      onMatchEnd(p1);
    } else if (rightScore >= WIN_SCORE) {
      gameOver = true;
      stopAIController();
      onMatchEnd(p2);
    }
  }

  function loop() {
    update();
    scene.render();
    requestAnimationFrame(loop);
  }

  // Controls — accept arrow keys regardless of mode so AI keyboard simulation works.
  document.addEventListener('keydown', (e) => {
    keys[e.key] = true;
    if (keys['w']) left.dy = PADDLE_SPEED;
    if (keys['s']) left.dy = -PADDLE_SPEED;

    // Accept Arrow keys for second player or AI
    if (keys['ArrowUp']) right.dy = PADDLE_SPEED;
    if (keys['ArrowDown']) right.dy = -PADDLE_SPEED;
  });

  document.addEventListener('keyup', (e) => {
    keys[e.key] = false;
    if (!keys['w'] && !keys['s']) left.dy = 0;

    // stop right paddle when arrow keys are released
    if (!keys['ArrowUp'] && !keys['ArrowDown']) right.dy = 0;
    // if both pressed, keep whichever is still true (handled above)
  });

  // kick off AI controller if this is an AI match
  if (isAIMatch) {
    startAIController();
  }

  // Start
  updateScoreText();
  resetBall();
  loop();
  window.addEventListener('resize', () => engine.resize());

  // Clean-up when page/app is unloaded (prevent intervals leaking)
  window.addEventListener(
    'beforeunload',
    () => {
      stopAIController();
      try {
        engine.dispose();
      } catch (e) {}
    },
    { once: true }
  );
}
