// tslint:disable
/* eslint-disable */
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  Play,
  RotateCw,
  Volume2,
  VolumeX,
  Star,
  Sparkles,
  Settings,
  HelpCircle,
  Menu,
  X,
  Lightbulb,
  Check,
  Flame,
  Layers,
  Calculator,
  ArrowRight,
  Shuffle,
  BookOpen,
  Sliders,
} from 'lucide-react';
import {getConfig} from './constants';
import BackgroundMusic from './utils/BackgroundMusic';
import {
  gameAudio,
  GameState,
  MenuOverlay,
  useAssets,
  useAutoFocus,
  useIsMobile,
} from './utils/helper';
import {
  usePlayground,
  usePlaygroundGameLifecycle,
} from './utils/usePlayground';

const BACKGROUND_MUSIC_URL = 'assets/audio/bgm_study_math.mp3';

// Method Modes & Digit Configurations
export type MathMethod = 'AREA_MODEL' | 'STANDARD_ALGORITHM';
export type FirstFactorDigits = 2 | 3 | 4;
export type SecondFactorDigits = 1 | 2;

// Step definition for Area Model (3 phases)
export type AreaStep = 1 | 2 | 3;

export interface DecomposedPart {
  id: string;
  targetVal: number;
  userVal: string;
  isSolved: boolean;
  placeLabel: string; // e.g. "Thousands", "Hundreds", "Tens", "Ones"
}

export interface AreaBox {
  id: string;
  rowIdx: number;
  colIdx: number;
  colVal: number; // e.g. 4000, 300, 40, or 5
  rowVal: number; // e.g. 20 or 4
  product: number; // colVal * rowVal
  label: string; // "300 × 20"
  hint: string;
  userVal: string;
  isSolved: boolean;
}

export interface AreaProblemData {
  id: string;
  topNum: number;
  sideNum: number;
  topParts: DecomposedPart[];
  sideParts: DecomposedPart[];
  boxes: AreaBox[];
  finalProduct: number;
}

// Standard Algorithm Atomic Step definition
export interface StandardStep {
  id: string;
  type: 'r1_digit' | 'r1_carry' | 'r2_zero' | 'r2_digit' | 'r2_carry' | 'sum_digit';
  rowName: 'Row 1' | 'Row 2' | 'Sum' | 'Carry 1' | 'Carry 2';
  colIndex: number; // 0 = ones, 1 = tens, 2 = hundreds, 3 = thousands, etc.
  targetVal: number; // Single expected digit 0-9
  userVal: string;
  isSolved: boolean;
  prompt: string;
  hint: string;
}

export interface StandardAlgorithmData {
  id: string;
  topNum: number;
  bottomNum: number;
  topDigits: number[]; // From right to left (0 = ones, 1 = tens, 2 = hundreds, etc.)
  bottomOnes: number;
  hasBottomTens: boolean;
  bottomTens: number;
  totalCols: number;
  steps: StandardStep[];
  r1Product: number;
  r2Product: number;
  finalProduct: number;
  allSolved: boolean;
}

// Helper: Generate clean non-zero factor numbers for pedagogical clarity
function generateFactor(digits: number, isSecondFactor = false): number {
  if (isSecondFactor && digits === 1) {
    // 1-digit multiplier: 2 to 9
    return Math.floor(Math.random() * 8) + 2;
  }
  // For multi-digit: generate non-zero digits (1-9) so every place value
  // has a positive decomposed component (no 0 boxes).
  let num = 0;
  for (let i = 0; i < digits; i++) {
    const d = i === 0 ? Math.floor(Math.random() * 8) + 2 : Math.floor(Math.random() * 9) + 1;
    num = num * 10 + d;
  }
  return num;
}

// Build Area Model Problem Structure for dynamic digits
function buildAreaProblemData(topNum: number, sideNum: number): AreaProblemData {
  const topParts: DecomposedPart[] = [];
  if (topNum >= 1000) {
    const thousands = Math.floor(topNum / 1000) * 1000;
    const hundreds = Math.floor((topNum % 1000) / 100) * 100;
    const tens = Math.floor((topNum % 100) / 10) * 10;
    const ones = topNum % 10;
    topParts.push({id: 'top_0', targetVal: thousands, userVal: '', isSolved: false, placeLabel: 'Thousands'});
    topParts.push({id: 'top_1', targetVal: hundreds, userVal: '', isSolved: false, placeLabel: 'Hundreds'});
    topParts.push({id: 'top_2', targetVal: tens, userVal: '', isSolved: false, placeLabel: 'Tens'});
    topParts.push({id: 'top_3', targetVal: ones, userVal: '', isSolved: false, placeLabel: 'Ones'});
  } else if (topNum >= 100) {
    const hundreds = Math.floor(topNum / 100) * 100;
    const tens = Math.floor((topNum % 100) / 10) * 10;
    const ones = topNum % 10;
    topParts.push({id: 'top_0', targetVal: hundreds, userVal: '', isSolved: false, placeLabel: 'Hundreds'});
    topParts.push({id: 'top_1', targetVal: tens, userVal: '', isSolved: false, placeLabel: 'Tens'});
    topParts.push({id: 'top_2', targetVal: ones, userVal: '', isSolved: false, placeLabel: 'Ones'});
  } else {
    const tens = Math.floor(topNum / 10) * 10;
    const ones = topNum % 10;
    topParts.push({id: 'top_0', targetVal: tens, userVal: '', isSolved: false, placeLabel: 'Tens'});
    topParts.push({id: 'top_1', targetVal: ones, userVal: '', isSolved: false, placeLabel: 'Ones'});
  }

  const sideParts: DecomposedPart[] = [];
  if (sideNum < 10) {
    sideParts.push({id: 'side_0', targetVal: sideNum, userVal: '', isSolved: false, placeLabel: 'Ones'});
  } else {
    const tens = Math.floor(sideNum / 10) * 10;
    const ones = sideNum % 10;
    sideParts.push({id: 'side_0', targetVal: tens, userVal: '', isSolved: false, placeLabel: 'Tens'});
    sideParts.push({id: 'side_1', targetVal: ones, userVal: '', isSolved: false, placeLabel: 'Ones'});
  }

  // Create grid boxes
  const boxes: AreaBox[] = [];
  for (let r = 0; r < sideParts.length; r++) {
    const rowVal = sideParts[r].targetVal;
    for (let c = 0; c < topParts.length; c++) {
      const colVal = topParts[c].targetVal;
      const prod = colVal * rowVal;

      // Extract trailing zeros for pedagogical hints
      const colZeros = colVal.toString().length - colVal.toString().replace(/0+$/, '').length;
      const rowZeros = rowVal.toString().length - rowVal.toString().replace(/0+$/, '').length;
      const baseCol = colVal / Math.pow(10, colZeros);
      const baseRow = rowVal / Math.pow(10, rowZeros);
      const baseProduct = baseCol * baseRow;
      const totalZeros = colZeros + rowZeros;

      let hint = '';
      if (totalZeros > 0) {
        hint = `Think: ${baseCol} × ${baseRow} = ${baseProduct}, then append ${totalZeros} zero${totalZeros > 1 ? 's' : ''} ➔ ${prod}`;
      } else {
        hint = `Think: ${baseCol} × ${baseRow} = ${prod}`;
      }

      boxes.push({
        id: `box_${r}_${c}`,
        rowIdx: r,
        colIdx: c,
        colVal,
        rowVal,
        product: prod,
        label: `${colVal} × ${rowVal}`,
        hint,
        userVal: '',
        isSolved: false,
      });
    }
  }

  return {
    id: `area_${Date.now()}_${Math.random()}`,
    topNum,
    sideNum,
    topParts,
    sideParts,
    boxes,
    finalProduct: topNum * sideNum,
  };
}

const PLACE_NAMES = ['Ones', 'Tens', 'Hundreds', 'Thousands', 'Ten-Thousands', 'Hundred-Thousands'];

// Build Standard Algorithm Problem Structure dynamically
function buildStandardAlgorithmData(topNum: number, bottomNum: number): StandardAlgorithmData {
  // Extract top digits from right to left
  const topDigits = topNum
    .toString()
    .split('')
    .reverse()
    .map((d) => parseInt(d, 10));

  const bottomOnes = bottomNum % 10;
  const hasBottomTens = bottomNum >= 10;
  const bottomTens = hasBottomTens ? Math.floor(bottomNum / 10) : 0;
  const r1Product = topNum * bottomOnes;
  const r2Product = hasBottomTens ? topNum * (bottomTens * 10) : 0;
  const finalProduct = topNum * bottomNum;

  // Maximum columns needed in grid
  const totalCols = Math.max(topDigits.length + 1, finalProduct.toString().length);

  const steps: StandardStep[] = [];

  // 1. Row 1: Multiply bottomOnes by each top digit from right to left
  let carry = 0;
  for (let i = 0; i < topDigits.length; i++) {
    const d = topDigits[i];
    const prod = bottomOnes * d + carry;
    const digitVal = prod % 10;
    const nextCarry = Math.floor(prod / 10);
    const place = PLACE_NAMES[i] || `Col ${i}`;

    steps.push({
      id: `r1_digit_${i}`,
      type: 'r1_digit',
      rowName: 'Row 1',
      colIndex: i,
      targetVal: digitVal,
      userVal: '',
      isSolved: false,
      prompt: `Multiply bottom ones (${bottomOnes}) × top ${place} (${d})${carry > 0 ? ` + carried ${carry}` : ''}`,
      hint: `Think: ${bottomOnes} × ${d} = ${bottomOnes * d}${carry > 0 ? ` + ${carry} = ${prod}` : ''}. Write ${digitVal} in the ${place} column.`,
    });

    if (i < topDigits.length - 1) {
      if (nextCarry > 0) {
        const nextPlace = PLACE_NAMES[i + 1] || `Col ${i + 1}`;
        steps.push({
          id: `r1_carry_${i + 1}`,
          type: 'r1_carry',
          rowName: 'Carry 1',
          colIndex: i + 1,
          targetVal: nextCarry,
          userVal: '',
          isSolved: false,
          prompt: `Carry above ${nextPlace} column`,
          hint: `Since ${prod} >= 10, carry ${nextCarry} above the ${nextPlace} column.`,
        });
      }
      carry = nextCarry;
    } else {
      // Leftmost overflow digit if any
      if (nextCarry > 0) {
        const overflowPlace = PLACE_NAMES[i + 1] || `Col ${i + 1}`;
        steps.push({
          id: `r1_digit_${i + 1}`,
          type: 'r1_digit',
          rowName: 'Row 1',
          colIndex: i + 1,
          targetVal: nextCarry,
          userVal: '',
          isSolved: false,
          prompt: `Write remaining carry in ${overflowPlace} column`,
          hint: `Write the remaining carry ${nextCarry} in the ${overflowPlace} column.`,
        });
      }
      carry = 0;
    }
  }

  // 2. Row 2: (Only if 2-digit bottom multiplier)
  if (hasBottomTens) {
    // Step: Placeholder 0
    steps.push({
      id: 'r2_zero_0',
      type: 'r2_zero',
      rowName: 'Row 2',
      colIndex: 0,
      targetVal: 0,
      userVal: '',
      isSolved: false,
      prompt: `Row 2: Place 0 placeholder in Ones column`,
      hint: `Because you are multiplying by tens (${bottomTens}0), write a placeholder 0 in the ones place of Row 2.`,
    });

    let carry2 = 0;
    for (let i = 0; i < topDigits.length; i++) {
      const d = topDigits[i];
      const prod = bottomTens * d + carry2;
      const digitVal = prod % 10;
      const nextCarry = Math.floor(prod / 10);
      const place = PLACE_NAMES[i + 1] || `Col ${i + 1}`;

      steps.push({
        id: `r2_digit_${i + 1}`,
        type: 'r2_digit',
        rowName: 'Row 2',
        colIndex: i + 1,
        targetVal: digitVal,
        userVal: '',
        isSolved: false,
        prompt: `Multiply bottom tens (${bottomTens}) × top ${PLACE_NAMES[i]} (${d})${carry2 > 0 ? ` + carried ${carry2}` : ''}`,
        hint: `Think: ${bottomTens} × ${d} = ${bottomTens * d}${carry2 > 0 ? ` + ${carry2} = ${prod}` : ''}. Write ${digitVal} in the ${place} column.`,
      });

      if (i < topDigits.length - 1) {
        if (nextCarry > 0) {
          const nextPlace = PLACE_NAMES[i + 1] || `Col ${i + 1}`;
          steps.push({
            id: `r2_carry_${i + 1}`,
            type: 'r2_carry',
            rowName: 'Carry 2',
            colIndex: i + 1,
            targetVal: nextCarry,
            userVal: '',
            isSolved: false,
            prompt: `Row 2: Carry ${nextCarry} above ${nextPlace} column`,
            hint: `Since ${bottomTens} × ${d}${carry2 > 0 ? ` + ${carry2}` : ''} = ${prod} >= 10, carry ${nextCarry} above the ${nextPlace} column for Row 2.`,
          });
        }
        carry2 = nextCarry;
      } else {
        if (nextCarry > 0) {
          const overflowPlace = PLACE_NAMES[i + 2] || `Col ${i + 2}`;
          steps.push({
            id: `r2_digit_${i + 2}`,
            type: 'r2_digit',
            rowName: 'Row 2',
            colIndex: i + 2,
            targetVal: nextCarry,
            userVal: '',
            isSolved: false,
            prompt: `Write remaining carry in ${overflowPlace} column`,
            hint: `Write the remaining carry ${nextCarry} in the ${overflowPlace} column.`,
          });
        }
        carry2 = 0;
      }
    }

    // 3. Final Sum Steps: Column-by-column addition from right to left
    const sumDigits = finalProduct
      .toString()
      .split('')
      .reverse()
      .map((d) => parseInt(d, 10));

    for (let c = 0; c < sumDigits.length; c++) {
      const place = PLACE_NAMES[c] || `Col ${c}`;
      steps.push({
        id: `sum_digit_${c}`,
        type: 'sum_digit',
        rowName: 'Sum',
        colIndex: c,
        targetVal: sumDigits[c],
        userVal: '',
        isSolved: false,
        prompt: `Add ${place} column for the final sum`,
        hint: `Add the digits in the ${place} column (including carries if any) to get ${sumDigits[c]}.`,
      });
    }
  }

  return {
    id: `std_${Date.now()}_${Math.random()}`,
    topNum,
    bottomNum,
    topDigits,
    bottomOnes,
    hasBottomTens,
    bottomTens,
    totalCols,
    steps,
    r1Product,
    r2Product,
    finalProduct,
    allSolved: false,
  };
}

// React Error Boundary
interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class GameErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {hasError: false, error: null};
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {hasError: true, error};
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('GameErrorBoundary caught error:', error, errorInfo);
  }

  handleRestart = () => {
    this.setState({hasError: false, error: null});
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 flex flex-col items-center justify-center bg-slate-950 text-white p-6 text-center select-none font-sans">
          <div className="w-16 h-16 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center mb-4 text-3xl font-black border border-amber-400/40">
            !
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-amber-400 mb-2">
            Step Multiply
          </h2>
          <p className="text-slate-300 text-sm max-w-md mb-6 leading-relaxed">
            The game encountered a minor startup issue. Click below to refresh and start multiplying!
          </p>
          <button
            onClick={this.handleRestart}
            data-testid="start-button"
            className="px-6 py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl shadow-lg transition-all active:scale-95">
            Restart Game
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function GameInner() {
  const isMobile = useIsMobile();
  const {sdk} = usePlayground();

  const ASSETS_MANIFEST: Record<string, string> = {
    classroomBg: 'assets/images/math_classroom_bg.png',
    mascotOwl: 'assets/images/mascot_owl_guide.png',
    starIcon: 'assets/images/star_reward_icon.png',
    trophyIcon: 'assets/images/trophy_mastery_icon.png',
  };
  const {isReady: assetsReady} = useAssets(ASSETS_MANIFEST);

  // Core Configuration State: Method & Dynamic Factor Digits
  const [method, setMethod] = useState<MathMethod>('AREA_MODEL');
  const [firstFactorDigits, setFirstFactorDigits] = useState<FirstFactorDigits>(2);
  const [secondFactorDigits, setSecondFactorDigits] = useState<SecondFactorDigits>(2);

  // Audio State
  const [isMusicMuted, setIsMusicMuted] = useState(false);
  const [isSfxMuted, setIsSfxMuted] = useState(false);

  // Overlay Screens State
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSetupModalOpen, setIsSetupModalOpen] = useState(false);
  const [isHowToPlayOpen, setIsHowToPlayOpen] = useState(false);
  const [isTimesTableOpen, setIsTimesTableOpen] = useState(false);

  // Problem Index & Round Stats
  const [problemIndex, setProblemIndex] = useState(0);

  // AREA MODEL Specific State
  const [areaStep, setAreaStep] = useState<AreaStep>(1);
  const [currentAreaProblem, setCurrentAreaProblem] = useState<AreaProblemData>(() =>
    buildAreaProblemData(43, 27),
  );
  const [activeHeaderId, setActiveHeaderId] = useState<string>('top_0');
  const [activeBoxId, setActiveBoxId] = useState<string>('box_0_0');
  const [sumInput, setSumInput] = useState<string>('');
  const [sumIsSolved, setSumIsSolved] = useState<boolean>(false);

  // STANDARD ALGORITHM Specific State
  const [standardData, setStandardData] = useState<StandardAlgorithmData>(() =>
    buildStandardAlgorithmData(43, 27),
  );
  const [standardActiveStepId, setStandardActiveStepId] = useState<string>('r1_digit_0');

  // Virtual Keypad Buffer
  const [currentInput, setCurrentInput] = useState<string>('');

  // Performance & Streak Stats
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [mistakesThisProblem, setMistakesThisProblem] = useState(0);
  const [totalProblemsCompleted, setTotalProblemsCompleted] = useState(0);
  const [perfectProblemsCount, setPerfectProblemsCount] = useState(0);

  // Visual Feedback & Gated Hints State
  const [shakeError, setShakeError] = useState(false);
  const [showHintBubble, setShowHintBubble] = useState(false);
  const [activeCellHint, setActiveCellHint] = useState<string | null>(null);
  const [stepTransitionMessage, setStepTransitionMessage] = useState<string | null>(null);
  const [owlReaction, setOwlReaction] = useState<'idle' | 'happy' | 'thinking'>('idle');
  const [showCelebration, setShowCelebration] = useState(false);

  // Timeouts tracking
  const timeoutsRef = useRef<number[]>([]);
  const safeSetTimeout = useCallback((cb: () => void, delay: number) => {
    const id = window.setTimeout(() => {
      timeoutsRef.current = timeoutsRef.current.filter((t) => t !== id);
      cb();
    }, delay);
    timeoutsRef.current.push(id);
    return id;
  }, []);

  const clearAllTimeouts = useCallback(() => {
    timeoutsRef.current.forEach((id) => window.clearTimeout(id));
    timeoutsRef.current = [];
  }, []);

  useEffect(() => {
    return () => {
      clearAllTimeouts();
    };
  }, [clearAllTimeouts]);

  // Game Lifecycle State
  const [gameState, setGameState] = useState<GameState>({
    status: 'START',
    score: 0,
    level: 1,
  });

  const gameStateRef = useRef(gameState);
  gameStateRef.current = gameState;

  usePlaygroundGameLifecycle(gameState, sdk);

  const startButtonRef = useAutoFocus<HTMLButtonElement>(
    gameState.status === 'START',
  );

  const totalProblemsPerRound = (getConfig('totalProblemsPerRound') as number) || 10;
  const maxMistakesAllowed = (getConfig('maxMistakesAllowed') as number) || 3;
  const pointsPerStep = (getConfig('pointsPerCorrectStep') as number) || 100;
  const cleanProblemBonus = (getConfig('bonusForNoMistakes') as number) || 500;

  // Active items lookup for Area Model
  const allHeadersList = useMemo(() => {
    if (!currentAreaProblem) return [];
    return [...(currentAreaProblem.topParts || []), ...(currentAreaProblem.sideParts || [])];
  }, [currentAreaProblem]);

  const activeHeader = useMemo(() => {
    if (!allHeadersList.length) return null;
    return (
      allHeadersList.find((h) => h.id === activeHeaderId) ||
      allHeadersList.find((h) => !h.isSolved) ||
      allHeadersList[0] ||
      null
    );
  }, [allHeadersList, activeHeaderId]);

  const activeBox = useMemo(() => {
    const boxes = currentAreaProblem?.boxes || [];
    if (!boxes.length) return null;
    return (
      boxes.find((b) => b.id === activeBoxId) ||
      boxes.find((b) => !b.isSolved) ||
      boxes[0] ||
      null
    );
  }, [currentAreaProblem?.boxes, activeBoxId]);

  // Active step lookup for Standard Algorithm
  const currentStandardStep = useMemo(() => {
    const steps = standardData?.steps || [];
    if (!steps.length) return null;
    return (
      steps.find((s) => s.id === standardActiveStepId) ||
      steps.find((s) => !s.isSolved) ||
      steps[0] ||
      null
    );
  }, [standardData?.steps, standardActiveStepId]);

  // Setup problem with chosen factor digits and method
  const setupProblem = useCallback(
    (
      targetMethod: MathMethod = method,
      f1Digits: FirstFactorDigits = firstFactorDigits,
      f2Digits: SecondFactorDigits = secondFactorDigits,
    ) => {
      clearAllTimeouts();

      // Generate dynamic numbers adhering strictly to chosen factor digit lengths
      const topNum = generateFactor(f1Digits, false);
      const sideNum = generateFactor(f2Digits, true);

      // Area Model Setup
      const areaProb = buildAreaProblemData(topNum, sideNum);
      setCurrentAreaProblem(areaProb);
      setAreaStep(1);
      setActiveHeaderId(areaProb.topParts[0]?.id || 'top_0');
      setActiveBoxId(areaProb.boxes[0]?.id || 'box_0_0');
      setCurrentInput('');
      setSumInput('');
      setSumIsSolved(false);

      // Standard Algorithm Setup
      const stdProb = buildStandardAlgorithmData(topNum, sideNum);
      setStandardData(stdProb);
      setStandardActiveStepId(stdProb.steps[0]?.id || 'r1_digit_0');

      // Reset problem-level trackers & strictly gated hints
      setMistakesThisProblem(0);
      setShowHintBubble(false);
      setActiveCellHint(null);
      setOwlReaction('idle');
      setStepTransitionMessage(null);
    },
    [clearAllTimeouts, firstFactorDigits, method, secondFactorDigits],
  );

  // Launch practice session
  const initGame = useCallback(
    (
      m: MathMethod = method,
      f1: FirstFactorDigits = firstFactorDigits,
      f2: SecondFactorDigits = secondFactorDigits,
    ) => {
      clearAllTimeouts();
      setMethod(m);
      setFirstFactorDigits(f1);
      setSecondFactorDigits(f2);

      setupProblem(m, f1, f2);

      setProblemIndex(0);
      setStreak(0);
      setBestStreak(0);
      setTotalProblemsCompleted(0);
      setPerfectProblemsCount(0);
      setShowCelebration(false);
      setIsMenuOpen(false);
      setIsSetupModalOpen(false);
      setIsHowToPlayOpen(false);

      setGameState({
        status: 'PLAYING',
        score: 0,
        level: f1,
      });

      if (sdk) {
        sdk.startGame();
      }
      gameAudio.playConfirmSelect();
    },
    [clearAllTimeouts, firstFactorDigits, method, sdk, secondFactorDigits, setupProblem],
  );

  // Auto-start support (?autoplay)
  const hasAutoplayed = useRef(false);
  useEffect(() => {
    if (
      !hasAutoplayed.current &&
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).has('autoplay')
    ) {
      hasAutoplayed.current = true;
      initGame();
    }
  }, [initGame]);

  // Audio stinger on Victory or Game Over
  useEffect(() => {
    if (gameState.status === 'VICTORY') {
      gameAudio.playVictoryFanfare();
    } else if (gameState.status === 'GAME_OVER') {
      gameAudio.playDefeatMotif();
    }
  }, [gameState.status]);

  // Advance to next problem in round
  const advanceToNextProblem = useCallback(() => {
    setShowCelebration(false);
    const nextProblemNum = problemIndex + 1;

    if (nextProblemNum >= totalProblemsPerRound) {
      setGameState((prev) => ({
        ...prev,
        status: 'VICTORY',
      }));
      return;
    }

    setupProblem(method, firstFactorDigits, secondFactorDigits);
    setProblemIndex(nextProblemNum);
  }, [
    firstFactorDigits,
    method,
    problemIndex,
    secondFactorDigits,
    setupProblem,
    totalProblemsPerRound,
  ]);

  // Strict pedagogical mistake trigger (Hints are gated strictly until incorrect entry)
  const triggerMistake = useCallback(
    (specificHint: string) => {
      gameAudio.playErrorBuzz();
      setShakeError(true);
      safeSetTimeout(() => setShakeError(false), 500);
      setOwlReaction('thinking');
      setStreak(0);

      const newMistakes = mistakesThisProblem + 1;
      setMistakesThisProblem(newMistakes);

      setActiveCellHint(specificHint);
      setShowHintBubble(true);

      if (newMistakes >= maxMistakesAllowed) {
        setGameState((prev) => ({
          ...prev,
          status: 'GAME_OVER',
        }));
      }
    },
    [maxMistakesAllowed, mistakesThisProblem, safeSetTimeout],
  );

  // ============================================================================
  // AREA MODEL VERIFICATION LOGIC (3 Pedagogical Steps)
  // ============================================================================
  const verifyAreaHeaderInput = useCallback(
    (inputValue: string) => {
      if (!activeHeader || !currentAreaProblem) return;
      const numVal = parseInt(inputValue, 10);

      if (numVal === activeHeader.targetVal) {
        gameAudio.playCoinPickup();
        setOwlReaction('happy');
        setStreak((prev) => {
          const next = prev + 1;
          setBestStreak((b) => Math.max(b, next));
          return next;
        });

        const isTop = activeHeader.id.startsWith('top');
        let updatedTop = [...currentAreaProblem.topParts];
        let updatedSide = [...currentAreaProblem.sideParts];

        if (isTop) {
          updatedTop = updatedTop.map((p) =>
            p.id === activeHeader.id ? {...p, userVal: inputValue, isSolved: true} : p,
          );
        } else {
          updatedSide = updatedSide.map((p) =>
            p.id === activeHeader.id ? {...p, userVal: inputValue, isSolved: true} : p,
          );
        }

        setCurrentAreaProblem((prev) => ({
          ...prev,
          topParts: updatedTop,
          sideParts: updatedSide,
        }));

        setGameState((prev) => ({
          ...prev,
          score: prev.score + pointsPerStep,
        }));

        setCurrentInput('');
        setShowHintBubble(false);
        setActiveCellHint(null);

        const combined = [...updatedTop, ...updatedSide];
        const nextUnsolvedHeader = combined.find((h) => !h.isSolved);

        if (nextUnsolvedHeader) {
          setActiveHeaderId(nextUnsolvedHeader.id);
        } else {
          gameAudio.playLevelUpStinger();
          setStepTransitionMessage('Step 1 Complete! Now find each Box Area!');
          safeSetTimeout(() => {
            setStepTransitionMessage(null);
            setAreaStep(2);
            setActiveBoxId(currentAreaProblem.boxes[0]?.id || 'box_0_0');
            setActiveCellHint(null);
            setShowHintBubble(false);
          }, 900);
        }
      } else {
        const isTop = activeHeader.id.startsWith('top');
        const num = isTop ? currentAreaProblem.topNum : currentAreaProblem.sideNum;
        const parts = isTop ? currentAreaProblem.topParts : currentAreaProblem.sideParts;
        const decompStr = parts.map((p) => p.targetVal).join(' + ');
        const hintText = `Decompose ${num} into place values (${decompStr}). Enter ${activeHeader.targetVal} for ${activeHeader.placeLabel}.`;
        triggerMistake(hintText);
      }
    },
    [activeHeader, currentAreaProblem, pointsPerStep, safeSetTimeout, triggerMistake],
  );

  const verifyAreaBoxInput = useCallback(
    (inputValue: string) => {
      if (!activeBox || !currentAreaProblem) return;
      const numVal = parseInt(inputValue, 10);

      if (numVal === activeBox.product) {
        gameAudio.playCoinPickup();
        setOwlReaction('happy');
        setStreak((prev) => {
          const next = prev + 1;
          setBestStreak((b) => Math.max(b, next));
          return next;
        });

        const updatedBoxes = currentAreaProblem.boxes.map((b) =>
          b.id === activeBox.id ? {...b, userVal: inputValue, isSolved: true} : b,
        );

        setCurrentAreaProblem((prev) => ({
          ...prev,
          boxes: updatedBoxes,
        }));

        setGameState((prev) => ({
          ...prev,
          score: prev.score + pointsPerStep,
        }));

        setCurrentInput('');
        setShowHintBubble(false);
        setActiveCellHint(null);

        const nextUnsolvedBox = updatedBoxes.find((b) => !b.isSolved);
        if (nextUnsolvedBox) {
          setActiveBoxId(nextUnsolvedBox.id);
        } else {
          gameAudio.playLevelUpStinger();
          setStepTransitionMessage('All Boxes Solved! Now sum the partial products!');
          safeSetTimeout(() => {
            setStepTransitionMessage(null);
            setAreaStep(3);
            setActiveCellHint(null);
            setShowHintBubble(false);
          }, 900);
        }
      } else {
        const hintText = `Multiply column header (${activeBox.colVal}) by row header (${activeBox.rowVal}): ${activeBox.hint}`;
        triggerMistake(hintText);
      }
    },
    [activeBox, currentAreaProblem, pointsPerStep, safeSetTimeout, triggerMistake],
  );

  const verifyAreaSumInput = useCallback(
    (inputValue: string) => {
      if (!currentAreaProblem) return;
      const numVal = parseInt(inputValue, 10);

      if (numVal === currentAreaProblem.finalProduct) {
        gameAudio.playPowerupChime();
        setSumIsSolved(true);
        setShowCelebration(true);
        setOwlReaction('happy');
        setTotalProblemsCompleted((prev) => prev + 1);

        const isClean = mistakesThisProblem === 0;
        const bonus = isClean ? cleanProblemBonus : 0;
        if (isClean) {
          setPerfectProblemsCount((prev) => prev + 1);
        }

        setGameState((prev) => ({
          ...prev,
          score: prev.score + pointsPerStep * 2 + bonus,
        }));
      } else {
        const sumExp = currentAreaProblem.boxes.map((b) => b.product).join(' + ');
        const hintText = `Add all partial products together: ${sumExp} = ${currentAreaProblem.finalProduct}`;
        triggerMistake(hintText);
      }
    },
    [cleanProblemBonus, currentAreaProblem, mistakesThisProblem, pointsPerStep, triggerMistake],
  );

  // ============================================================================
  // STANDARD ALGORITHM VERIFICATION LOGIC (Dynamic Column Flow)
  // ============================================================================
  const verifyStandardInput = useCallback(
    (inputValue: string) => {
      if (!currentStandardStep || !standardData) return;
      const numVal = parseInt(inputValue, 10);

      if (numVal === currentStandardStep.targetVal) {
        gameAudio.playCoinPickup();
        setOwlReaction('happy');
        setStreak((prev) => {
          const next = prev + 1;
          setBestStreak((b) => Math.max(b, next));
          return next;
        });

        const updatedSteps = standardData.steps.map((s) =>
          s.id === currentStandardStep.id ? {...s, userVal: inputValue, isSolved: true} : s,
        );

        const nextStep = updatedSteps.find((s) => !s.isSolved);
        const isFinished = !nextStep;

        setStandardData((prev) => ({
          ...prev,
          steps: updatedSteps,
          allSolved: isFinished,
        }));

        setGameState((prev) => ({
          ...prev,
          score: prev.score + pointsPerStep,
        }));

        setCurrentInput('');
        setShowHintBubble(false);
        setActiveCellHint(null);

        if (isFinished) {
          gameAudio.playPowerupChime();
          setShowCelebration(true);
          setOwlReaction('happy');
          setTotalProblemsCompleted((prev) => prev + 1);
          const isClean = mistakesThisProblem === 0;
          if (isClean) {
            setPerfectProblemsCount((prev) => prev + 1);
          }
          setGameState((prev) => ({
            ...prev,
            score: prev.score + pointsPerStep * 2 + (isClean ? cleanProblemBonus : 0),
          }));
        } else {
          setStandardActiveStepId(nextStep.id);
        }
      } else {
        triggerMistake(currentStandardStep.hint);
      }
    },
    [
      cleanProblemBonus,
      currentStandardStep,
      mistakesThisProblem,
      pointsPerStep,
      standardData,
      triggerMistake,
    ],
  );

  // Unified Answer Submission
  const submitCurrentAnswer = useCallback(
    (val: string) => {
      if (
        gameState.status !== 'PLAYING' ||
        isMenuOpen ||
        isSetupModalOpen ||
        isHowToPlayOpen ||
        showCelebration ||
        stepTransitionMessage
      ) {
        return;
      }

      const trimmed = val.trim();
      if (!trimmed) return;

      if (method === 'AREA_MODEL') {
        if (areaStep === 1) {
          verifyAreaHeaderInput(trimmed);
        } else if (areaStep === 2) {
          verifyAreaBoxInput(trimmed);
        } else if (areaStep === 3) {
          verifyAreaSumInput(trimmed);
        }
      } else {
        verifyStandardInput(trimmed);
      }
    },
    [
      areaStep,
      gameState.status,
      isHowToPlayOpen,
      isMenuOpen,
      isSetupModalOpen,
      method,
      showCelebration,
      stepTransitionMessage,
      verifyAreaBoxInput,
      verifyAreaHeaderInput,
      verifyAreaSumInput,
      verifyStandardInput,
    ],
  );

  // Virtual Keypad Button Press Handler
  const handleKeypadPress = useCallback(
    (key: string) => {
      if (
        gameState.status !== 'PLAYING' ||
        isMenuOpen ||
        isSetupModalOpen ||
        isHowToPlayOpen ||
        showCelebration ||
        stepTransitionMessage
      ) {
        return;
      }

      if (key === 'BACKSPACE') {
        setCurrentInput((prev) => prev.slice(0, -1));
        if (method === 'AREA_MODEL' && areaStep === 3) {
          setSumInput((prev) => prev.slice(0, -1));
        }
        gameAudio.playCrispClick();
        return;
      }

      if (key === 'CLEAR') {
        setCurrentInput('');
        if (method === 'AREA_MODEL' && areaStep === 3) {
          setSumInput('');
        }
        gameAudio.playCrispClick();
        return;
      }

      if (key === 'ENTER') {
        const val =
          method === 'AREA_MODEL' && areaStep === 3
            ? sumInput || currentInput
            : currentInput;
        submitCurrentAnswer(val);
        return;
      }

      // Digit pressed (0-9)
      gameAudio.playCrispClick();
      const nextVal = currentInput + key;
      if (nextVal.length <= 7) {
        setCurrentInput(nextVal);
        if (method === 'AREA_MODEL' && areaStep === 3) {
          setSumInput(nextVal);
        }

        // Instant auto-submit if exact match
        if (method === 'AREA_MODEL') {
          if (areaStep === 1 && activeHeader && parseInt(nextVal, 10) === activeHeader.targetVal) {
            submitCurrentAnswer(nextVal);
          } else if (areaStep === 2 && activeBox && parseInt(nextVal, 10) === activeBox.product) {
            submitCurrentAnswer(nextVal);
          } else if (areaStep === 3 && parseInt(nextVal, 10) === currentAreaProblem.finalProduct) {
            submitCurrentAnswer(nextVal);
          }
        } else {
          if (currentStandardStep && parseInt(nextVal, 10) === currentStandardStep.targetVal) {
            submitCurrentAnswer(nextVal);
          }
        }
      }
    },
    [
      activeBox,
      activeHeader,
      areaStep,
      currentAreaProblem?.finalProduct,
      currentInput,
      currentStandardStep,
      gameState.status,
      isHowToPlayOpen,
      isMenuOpen,
      isSetupModalOpen,
      method,
      showCelebration,
      stepTransitionMessage,
      submitCurrentAnswer,
      sumInput,
    ],
  );

  // Physical Keyboard Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isHowToPlayOpen) {
          setIsHowToPlayOpen(false);
          return;
        }
        if (isSetupModalOpen) {
          setIsSetupModalOpen(false);
          return;
        }
        if (isTimesTableOpen) {
          setIsTimesTableOpen(false);
          return;
        }
        if (gameState.status === 'PLAYING') {
          setIsMenuOpen((prev) => !prev);
          gameAudio.playCrispClick();
        }
        return;
      }

      if (
        gameState.status !== 'PLAYING' ||
        isMenuOpen ||
        isSetupModalOpen ||
        isHowToPlayOpen ||
        showCelebration ||
        stepTransitionMessage
      ) {
        return;
      }

      if (e.key >= '0' && e.key <= '9') {
        handleKeypadPress(e.key);
      } else if (e.key === 'Backspace') {
        handleKeypadPress('BACKSPACE');
      } else if (e.key === 'Enter') {
        handleKeypadPress('ENTER');
      } else if (e.key === 'h' || e.key === 'H' || e.key === '?') {
        if (activeCellHint) {
          setShowHintBubble((prev) => !prev);
          gameAudio.playCrispClick();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    activeCellHint,
    gameState.status,
    handleKeypadPress,
    isHowToPlayOpen,
    isMenuOpen,
    isSetupModalOpen,
    isTimesTableOpen,
    showCelebration,
    stepTransitionMessage,
  ]);

  // Times Table Reference Table (1-9)
  const timesTable = useMemo(() => {
    const table: {x: number; y: number; res: number}[][] = [];
    for (let r = 1; r <= 9; r++) {
      const row: {x: number; y: number; res: number}[] = [];
      for (let c = 1; c <= 9; c++) {
        row.push({x: r, y: c, res: r * c});
      }
      table.push(row);
    }
    return table;
  }, []);

  const isMusicPlaying = gameState.status === 'PLAYING' && !isMenuOpen;

  // Colors for Area Model quadrants/cells
  const boxColorThemes = [
    {
      bg: 'bg-cyan-950/70',
      border: 'border-cyan-500/60',
      activeBorder: 'border-cyan-400 ring-4 ring-cyan-400/60 bg-cyan-900/90 shadow-lg shadow-cyan-500/20',
      text: 'text-cyan-300',
      badge: 'bg-cyan-600/30 text-cyan-300 border-cyan-500/40',
    },
    {
      bg: 'bg-amber-950/70',
      border: 'border-amber-500/60',
      activeBorder: 'border-amber-400 ring-4 ring-amber-400/60 bg-amber-900/90 shadow-lg shadow-amber-500/20',
      text: 'text-amber-300',
      badge: 'bg-amber-600/30 text-amber-300 border-amber-500/40',
    },
    {
      bg: 'bg-emerald-950/70',
      border: 'border-emerald-500/60',
      activeBorder: 'border-emerald-400 ring-4 ring-emerald-400/60 bg-emerald-900/90 shadow-lg shadow-emerald-500/20',
      text: 'text-emerald-300',
      badge: 'bg-emerald-600/30 text-emerald-300 border-emerald-500/40',
    },
    {
      bg: 'bg-purple-950/70',
      border: 'border-purple-500/60',
      activeBorder: 'border-purple-400 ring-4 ring-purple-400/60 bg-purple-900/90 shadow-lg shadow-purple-500/20',
      text: 'text-purple-300',
      badge: 'bg-purple-600/30 text-purple-300 border-purple-500/40',
    },
  ];

  // Current problem numbers for HUD display
  const currentTopNum = method === 'AREA_MODEL' ? currentAreaProblem.topNum : standardData.topNum;
  const currentSideNum = method === 'AREA_MODEL' ? currentAreaProblem.sideNum : standardData.bottomNum;
  const isCurrentProblemSolved =
    method === 'AREA_MODEL' ? sumIsSolved : standardData.allSolved;

  return (
    <div
      className="fixed inset-0 overflow-hidden touch-none flex flex-col items-center justify-between text-white font-sans select-none"
      style={{
        backgroundColor: '#0f172a',
        backgroundImage: `url(${ASSETS_MANIFEST.classroomBg})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}>
      <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-[2px] pointer-events-none" />

      {!assetsReady && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-950 text-white font-sans">
          <div className="text-xl font-bold tracking-wide animate-pulse">
            Loading Step Multiply...
          </div>
        </div>
      )}

      <BackgroundMusic
        url={BACKGROUND_MUSIC_URL}
        isPlaying={isMusicPlaying}
        isMuted={isMusicMuted}
      />

      {/* Top Header / HUD Bar */}
      <header className="relative w-full z-20 flex flex-wrap items-center justify-between px-3 py-2 sm:px-6 sm:py-2.5 bg-slate-900/95 border-b border-slate-700/80 shadow-lg">
        {/* Left Side: Game Title, Factor Digit Badge & Setup Button */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-1.5 sm:gap-2 bg-slate-800/90 px-2.5 sm:px-3 py-1.5 rounded-xl border border-slate-700 shadow-inner">
            <span className="font-black text-cyan-400 text-xs sm:text-base tracking-wider uppercase">
              Step Multiply
            </span>
            <span className="text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-700/60 font-mono">
              {firstFactorDigits}D × {secondFactorDigits}D
            </span>
          </div>

          {/* Settings / Change Problem Type Button */}
          <button
            onClick={() => {
              setIsSetupModalOpen(true);
              gameAudio.playCrispClick();
            }}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 transition-all active:scale-95 shadow-sm"
            title="Change Factor Digits or Method">
            <Sliders size={13} className="text-amber-400" />
            <span className="hidden sm:inline">Problem Setup</span>
            <span className="sm:hidden font-mono">Setup</span>
          </button>

          {gameState.status === 'PLAYING' && (
            <div className="hidden md:flex items-center gap-1.5 bg-slate-800/90 px-2.5 py-1 rounded-lg border border-slate-700 text-xs">
              <span className="text-slate-400">Problem:</span>
              <span className="font-bold text-amber-400 font-mono">
                {problemIndex + 1}/{totalProblemsPerRound}
              </span>
            </div>
          )}
        </div>

        {/* Center: Score & Streak Counters */}
        {gameState.status === 'PLAYING' && (
          <div className="flex items-center gap-2 sm:gap-4 my-0.5 sm:my-0">
            <div className="flex items-center gap-1.5 text-xs sm:text-sm font-bold bg-amber-500/20 text-amber-300 px-3 py-1 rounded-full border border-amber-500/40 shadow-sm font-mono">
              <Star size={15} className="text-amber-400 fill-amber-400" />
              <span>Score: {gameState.score}</span>
            </div>

            {streak > 1 && (
              <div className="flex items-center gap-1 text-xs font-black bg-orange-600/30 text-orange-300 px-2.5 py-1 rounded-full border border-orange-500/50 animate-pulse">
                <Flame size={13} className="text-orange-400 fill-orange-400" />
                <span>{streak} Streak!</span>
              </div>
            )}

            {/* Strikes Counter */}
            <div className="flex items-center gap-1 bg-slate-800/90 px-2 py-1 rounded-lg border border-slate-700 text-xs">
              <span className="text-slate-400 mr-1 hidden sm:inline">Strikes:</span>
              {[...Array(maxMistakesAllowed)].map((_, i) => (
                <span
                  key={i}
                  className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-black transition-colors ${
                    i < mistakesThisProblem
                      ? 'bg-red-500 text-white animate-bounce'
                      : 'bg-slate-700 text-slate-500'
                  }`}>
                  ✕
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Right Side: Scratchpad & Menu */}
        <div className="flex items-center gap-2">
          {gameState.status === 'PLAYING' && (
            <>
              {/* STRICTLY GATED HINT BUTTON - ONLY REVEALED ON ERROR */}
              {showHintBubble && activeCellHint && (
                <button
                  onClick={() => {
                    setShowHintBubble((prev) => !prev);
                    gameAudio.playCrispClick();
                  }}
                  className="flex items-center gap-1 px-2.5 py-1 bg-amber-600/40 hover:bg-amber-600/60 text-amber-300 rounded-xl text-xs font-bold border border-amber-500/50 animate-pulse min-h-[34px]"
                  title="Toggle Hint">
                  <Lightbulb size={15} />
                  <span>Hint</span>
                </button>
              )}

              <button
                onClick={() => {
                  setIsTimesTableOpen(true);
                  gameAudio.playCrispClick();
                }}
                className="flex items-center gap-1 px-2.5 py-1 bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 rounded-xl text-xs font-bold border border-indigo-500/40 transition-colors min-h-[34px]"
                title="Times Table Scratchpad">
                <Calculator size={14} />
                <span className="hidden sm:inline">×Table</span>
              </button>
            </>
          )}

          <button
            onClick={() => {
              setIsMenuOpen(true);
              gameAudio.playCrispClick();
            }}
            className="flex items-center gap-1.5 px-3 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs sm:text-sm font-black border border-cyan-400 shadow-md transition-all active:scale-95 min-h-[34px]">
            <Menu size={16} />
            <span>Menu</span>
          </button>
        </div>
      </header>

      {/* Progress Flow Banner */}
      {gameState.status === 'PLAYING' && (
        <div className="relative w-full max-w-5xl z-10 px-3 pt-1.5">
          {method === 'AREA_MODEL' ? (
            /* 3-Step Area Model Flow Banner */
            <div className="w-full bg-slate-900/90 rounded-2xl border border-slate-700/80 p-2 shadow-md flex items-center justify-between gap-1 sm:gap-3">
              <div
                className={`flex-1 flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 rounded-xl border transition-all ${
                  areaStep === 1
                    ? 'bg-cyan-950/90 border-cyan-400 text-cyan-300 ring-2 ring-cyan-400/40 shadow'
                    : areaStep > 1
                    ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300'
                    : 'bg-slate-800/40 border-slate-700/60 text-slate-500'
                }`}>
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center font-black text-xs shrink-0 ${
                    areaStep > 1
                      ? 'bg-emerald-500 text-slate-950'
                      : areaStep === 1
                      ? 'bg-cyan-400 text-slate-950 animate-pulse'
                      : 'bg-slate-700 text-slate-400'
                  }`}>
                  {areaStep > 1 ? <Check size={13} className="stroke-[3]" /> : '1'}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-[10px] uppercase font-bold text-slate-400 leading-tight truncate">
                    Step 1
                  </span>
                  <span className="text-xs sm:text-sm font-black truncate">
                    Decompose Digits
                  </span>
                </div>
              </div>

              <div className="text-slate-600 font-bold px-1">➔</div>

              <div
                className={`flex-1 flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 rounded-xl border transition-all ${
                  areaStep === 2
                    ? 'bg-amber-950/90 border-amber-400 text-amber-300 ring-2 ring-amber-400/40 shadow'
                    : areaStep > 2
                    ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300'
                    : 'bg-slate-800/40 border-slate-700/60 text-slate-500'
                }`}>
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center font-black text-xs shrink-0 ${
                    areaStep > 2
                      ? 'bg-emerald-500 text-slate-950'
                      : areaStep === 2
                      ? 'bg-amber-400 text-slate-950 animate-pulse'
                      : 'bg-slate-700 text-slate-400'
                  }`}>
                  {areaStep > 2 ? <Check size={13} className="stroke-[3]" /> : '2'}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-[10px] uppercase font-bold text-slate-400 leading-tight truncate">
                    Step 2
                  </span>
                  <span className="text-xs sm:text-sm font-black truncate">
                    Multiply Box Areas ({currentAreaProblem.boxes.length} Boxes)
                  </span>
                </div>
              </div>

              <div className="text-slate-600 font-bold px-1">➔</div>

              <div
                className={`flex-1 flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 rounded-xl border transition-all ${
                  areaStep === 3
                    ? 'bg-emerald-950/90 border-emerald-400 text-emerald-300 ring-2 ring-emerald-400/40 shadow'
                    : 'bg-slate-800/40 border-slate-700/60 text-slate-500'
                }`}>
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center font-black text-xs shrink-0 ${
                    sumIsSolved
                      ? 'bg-emerald-400 text-slate-950'
                      : areaStep === 3
                      ? 'bg-emerald-400 text-slate-950 animate-pulse'
                      : 'bg-slate-700 text-slate-400'
                  }`}>
                  {sumIsSolved ? <Check size={13} className="stroke-[3]" /> : '3'}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-[10px] uppercase font-bold text-slate-400 leading-tight truncate">
                    Step 3
                  </span>
                  <span className="text-xs sm:text-sm font-black truncate">
                    Add Partial Products
                  </span>
                </div>
              </div>
            </div>
          ) : (
            /* Standard Algorithm Step Counter Banner */
            <div className="w-full bg-slate-900/90 rounded-2xl border border-slate-700/80 p-2 shadow-md flex items-center justify-between text-xs sm:text-sm">
              <div className="flex items-center gap-2">
                <span className="font-bold text-amber-400 flex items-center gap-1">
                  <Calculator size={15} /> Standard Algorithm:
                </span>
                <span className="text-slate-300 font-medium">
                  {currentStandardStep ? currentStandardStep.prompt : 'Vertical Multiplication'}
                </span>
              </div>
              <div className="font-mono text-xs text-slate-400 font-bold">
                Steps Solved:{' '}
                <span className="text-emerald-400">
                  {standardData.steps.filter((s) => s.isSolved).length}
                </span>{' '}
                / {standardData.steps.length}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main Interactive Worksheet Area */}
      {gameState.status === 'PLAYING' && (
        <main className="relative flex-1 w-full max-w-6xl flex flex-col lg:flex-row items-center justify-center p-2 sm:p-3 gap-2.5 sm:gap-4 z-10 overflow-y-auto">
          {/* Left Column: Mascot & Step Guidance Speech Bubble */}
          <div className="w-full lg:w-72 xl:w-80 flex flex-col items-center justify-center bg-slate-900/95 p-3 rounded-2xl border-2 border-slate-700/80 shadow-2xl backdrop-blur-md shrink-0">
            {/* Mascot Avatar */}
            <div className="relative mb-1">
              <img
                src={ASSETS_MANIFEST.mascotOwl}
                alt="Professor Hoot"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
                className={`w-16 h-16 sm:w-20 sm:h-20 object-contain drop-shadow-xl transition-transform duration-300 ${
                  owlReaction === 'happy'
                    ? 'scale-110 -rotate-3'
                    : owlReaction === 'thinking'
                    ? 'scale-105 rotate-3'
                    : 'scale-100'
                }`}
              />
              {owlReaction === 'happy' && (
                <div className="absolute -top-1 -right-1 bg-amber-400 text-black font-black text-xs px-2 py-0.5 rounded-full animate-bounce shadow">
                  ⭐ Great Job!
                </div>
              )}
            </div>

            {/* Prominent Target Problem Card */}
            <div className="w-full text-center bg-gradient-to-b from-slate-950 to-slate-900 border-2 border-amber-400/80 py-2 px-3 rounded-2xl mb-2.5 shadow-lg shadow-amber-500/10">
              <div className="text-[10px] text-amber-300 font-extrabold tracking-widest uppercase mb-0.5 flex items-center justify-center gap-1">
                <Sparkles size={12} className="text-amber-400" />
                Target Problem
              </div>
              <div className="text-xl sm:text-2xl font-black text-white font-mono tracking-wider">
                Solve: <span className="text-amber-400">{currentTopNum} × {currentSideNum}</span>
              </div>
            </div>

            {/* Instructional Speech Bubble */}
            <div className="w-full bg-slate-800/95 rounded-xl p-3 border border-slate-600/70 text-left shadow-inner">
              <div className="flex items-center gap-1.5 mb-1 text-cyan-400 font-bold text-xs uppercase tracking-wide">
                <Sparkles size={13} />
                <span>Professor Hoot:</span>
              </div>
              <p className="text-xs sm:text-sm text-slate-100 font-medium leading-snug min-h-[40px]">
                {method === 'AREA_MODEL' ? (
                  areaStep === 1 && activeHeader ? (
                    <>
                      <strong>Step 1:</strong> Decompose{' '}
                      <span className="text-amber-300 font-bold font-mono">
                        {activeHeader.id.startsWith('top')
                          ? currentAreaProblem.topNum
                          : currentAreaProblem.sideNum}
                      </span>{' '}
                      into its{' '}
                      <span className="text-cyan-300 font-bold">
                        {activeHeader.placeLabel}
                      </span>{' '}
                      expanded place value.
                    </>
                  ) : areaStep === 2 && activeBox ? (
                    <>
                      <strong>Step 2:</strong> Calculate the partial product area for the active box: {activeBox.colVal} × {activeBox.rowVal}.
                    </>
                  ) : areaStep === 3 ? (
                    <>
                      <strong>Step 3:</strong> Sum all {currentAreaProblem.boxes.length}{' '}
                      partial products to find the final total!
                    </>
                  ) : (
                    'Follow each pedagogical step to multiply!'
                  )
                ) : (
                  /* Standard Algorithm Guidance */
                  currentStandardStep ? (
                    <>
                      <strong>Step:</strong> {currentStandardStep.prompt}.
                    </>
                  ) : (
                    'Standard vertical multiplication complete!'
                  )
                )}
              </p>

              {/* Gated Error Hint Callout - STRICTLY SHOWN ONLY ON WRONG ANSWER */}
              {showHintBubble && activeCellHint && (
                <div className="mt-2 pt-2 border-t border-amber-500/30 text-amber-200 text-xs font-semibold bg-amber-950/80 p-2.5 rounded-xl border border-amber-500/50 shadow-md animate-bounce">
                  <div className="flex items-center gap-1 text-amber-400 font-bold mb-1">
                    <Lightbulb size={13} />
                    <span>Helpful Hint:</span>
                  </div>
                  <p className="leading-snug text-amber-100">{activeCellHint}</p>
                </div>
              )}
            </div>
          </div>

          {/* Center Column: Interactive Worksheet Card */}
          <div className="flex-1 w-full max-w-2xl flex flex-col items-center">
            {/* Focal Target Problem Ribbon */}
            <div className="w-full mb-2 bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border-2 border-amber-400/90 rounded-2xl px-4 py-2 shadow-xl flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="bg-amber-500/20 text-amber-300 text-[10px] sm:text-xs font-black uppercase tracking-wider px-2 py-0.5 rounded-lg border border-amber-400/40">
                  Problem
                </span>
                <span className="text-lg sm:text-2xl font-black font-mono tracking-wider text-white">
                  {currentTopNum} × {currentSideNum} ={' '}
                  <span className="text-amber-400">
                    {isCurrentProblemSolved
                      ? method === 'AREA_MODEL'
                        ? currentAreaProblem.finalProduct
                        : standardData.finalProduct
                      : '?'}
                  </span>
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => {
                    setIsSetupModalOpen(true);
                    gameAudio.playCrispClick();
                  }}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-cyan-300 rounded-lg text-xs font-bold border border-slate-600 transition-colors flex items-center gap-1">
                  <Sliders size={12} />
                  <span>Change Setup</span>
                </button>
              </div>
            </div>

            {/* Interactive Worksheet Container */}
            <div
              className={`w-full bg-slate-900/95 border-2 rounded-2xl p-3 sm:p-4 shadow-2xl backdrop-blur-md transition-all ${
                shakeError
                  ? 'border-red-500 shadow-red-500/40 ring-4 ring-red-500/50 animate-shake'
                  : showCelebration
                  ? 'border-emerald-400 ring-4 ring-emerald-400/50 shadow-emerald-500/20'
                  : 'border-cyan-500/60'
              }`}>
              {/* Step Transition Announcement Banner */}
              {stepTransitionMessage && (
                <div className="mb-2 py-1.5 px-3 bg-gradient-to-r from-cyan-600 to-emerald-600 text-white font-black text-center text-xs sm:text-sm rounded-xl animate-bounce shadow-lg">
                  ✨ {stepTransitionMessage}
                </div>
              )}

              {/* ========================================================================= */}
              {/* METHOD 1: AREA MODEL (DYNAMIC 2, 3, OR 4 COLUMNS × 1 OR 2 ROWS) */}
              {/* ========================================================================= */}
              {method === 'AREA_MODEL' && (
                <div className="w-full flex flex-col items-center select-none">
                  {/* Step 1 Expanded Context Formula */}
                  <div className="w-full flex items-center justify-between pb-1.5 mb-2 border-b border-slate-700/80 text-xs">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-slate-400 font-medium">Expanded:</span>
                      <span className="font-mono font-bold text-cyan-300 bg-cyan-950/70 px-2 py-0.5 rounded border border-cyan-700/50 text-[11px] sm:text-xs">
                        (
                        {currentAreaProblem.topParts
                          .map((p) => (p.isSolved ? p.userVal : '?'))
                          .join(' + ')}
                        )
                      </span>
                      <span className="text-slate-400 font-bold">×</span>
                      <span className="font-mono font-bold text-amber-300 bg-amber-950/70 px-2 py-0.5 rounded border border-amber-700/50 text-[11px] sm:text-xs">
                        (
                        {currentAreaProblem.sideParts
                          .map((p) => (p.isSolved ? p.userVal : '?'))
                          .join(' + ')}
                        )
                      </span>
                    </div>

                    <div className="text-[11px] font-bold text-slate-400 hidden sm:block">
                      {areaStep === 1
                        ? 'Step 1: Fill Expanded Headers'
                        : areaStep === 2
                        ? 'Step 2: Solve Box Areas'
                        : 'Step 3: Total Sum'}
                    </div>
                  </div>

                  {/* Top Decomposition Headers (Columns: 2, 3, or 4) */}
                  <div className="flex items-center justify-end w-full pl-16 sm:pl-20 mb-2">
                    <div
                      className="grid gap-1.5 sm:gap-2.5 w-full"
                      style={{
                        gridTemplateColumns: `repeat(${currentAreaProblem.topParts.length}, minmax(0, 1fr))`,
                      }}>
                      {currentAreaProblem.topParts.map((part) => {
                        const isActive = areaStep === 1 && activeHeaderId === part.id;
                        return (
                          <button
                            key={part.id}
                            onClick={() => {
                              if (areaStep === 1) {
                                setActiveHeaderId(part.id);
                                setCurrentInput('');
                                gameAudio.playCrispClick();
                              }
                            }}
                            className={`relative py-1.5 sm:py-2 px-1 rounded-xl font-mono font-black text-xs sm:text-base text-center border-2 transition-all ${
                              part.isSolved
                                ? 'bg-cyan-950/80 border-cyan-400 text-cyan-200 shadow'
                                : isActive
                                ? 'bg-cyan-900/90 border-cyan-400 ring-4 ring-cyan-400/60 text-cyan-100 animate-pulse shadow-lg'
                                : areaStep === 1
                                ? 'bg-slate-800/80 border-cyan-600/40 text-slate-400 hover:border-cyan-400 cursor-pointer'
                                : 'bg-slate-800/40 border-slate-700 text-slate-500'
                            }`}>
                            <div className="text-[8px] sm:text-[9px] uppercase tracking-wider text-cyan-400 font-sans font-bold">
                              {part.placeLabel}
                            </div>
                            <div className="text-xs sm:text-sm font-black">
                              {part.isSolved ? (
                                `+${part.userVal}`
                              ) : isActive ? (
                                <span className="text-cyan-300 font-bold">
                                  {currentInput ? `+${currentInput}` : '+?'}
                                </span>
                              ) : (
                                '+?'
                              )}
                            </div>
                            {part.isSolved && (
                              <span className="absolute top-1 right-1 text-cyan-400">
                                <Check size={11} className="stroke-[3]" />
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Grid Rows with Side Decomposition Headers (1 or 2 rows) */}
                  <div className="w-full flex flex-col gap-2">
                    {currentAreaProblem.sideParts.map((sidePart, rIdx) => {
                      const isRowHeaderActive = areaStep === 1 && activeHeaderId === sidePart.id;

                      return (
                        <div key={sidePart.id} className="flex items-center gap-1.5 sm:gap-2.5 w-full">
                          {/* Side Row Header */}
                          <button
                            onClick={() => {
                              if (areaStep === 1) {
                                setActiveHeaderId(sidePart.id);
                                setCurrentInput('');
                                gameAudio.playCrispClick();
                              }
                            }}
                            className={`w-16 sm:w-20 py-2 rounded-xl font-mono font-black text-xs sm:text-sm text-center border-2 shrink-0 transition-all ${
                              sidePart.isSolved
                                ? 'bg-amber-950/80 border-amber-400 text-amber-200 shadow'
                                : isRowHeaderActive
                                ? 'bg-amber-900/90 border-amber-400 ring-4 ring-amber-400/60 text-amber-100 animate-pulse shadow-lg'
                                : areaStep === 1
                                ? 'bg-slate-800/80 border-amber-600/40 text-slate-400 hover:border-amber-400 cursor-pointer'
                                : 'bg-slate-800/40 border-slate-700 text-slate-500'
                            }`}>
                            <div className="text-[8px] sm:text-[9px] uppercase tracking-wider text-amber-400 font-sans font-bold">
                              {sidePart.placeLabel}
                            </div>
                            <div className="text-xs sm:text-sm font-black">
                              {sidePart.isSolved ? (
                                `+${sidePart.userVal}`
                              ) : isRowHeaderActive ? (
                                <span className="text-amber-300 font-bold">
                                  {currentInput ? `+${currentInput}` : '+?'}
                                </span>
                              ) : (
                                '+?'
                              )}
                            </div>
                            {sidePart.isSolved && (
                              <span className="flex justify-center text-amber-400 mt-0.5">
                                <Check size={11} className="stroke-[3]" />
                              </span>
                            )}
                          </button>

                          {/* Grid Inner Box Cells */}
                          <div
                            className="grid gap-1.5 sm:gap-2.5 flex-1"
                            style={{
                              gridTemplateColumns: `repeat(${currentAreaProblem.topParts.length}, minmax(0, 1fr))`,
                            }}>
                            {currentAreaProblem.topParts.map((colPart, cIdx) => {
                              const box = currentAreaProblem.boxes.find(
                                (b) => b.rowIdx === rIdx && b.colIdx === cIdx,
                              );
                              if (!box) return null;

                              const boxLinearIdx = rIdx * currentAreaProblem.topParts.length + cIdx;
                              const colorTheme = boxColorThemes[boxLinearIdx % boxColorThemes.length];
                              const isBoxActive = areaStep === 2 && activeBoxId === box.id;
                              const isLocked = areaStep === 1;

                              return (
                                <button
                                  key={box.id}
                                  disabled={isLocked}
                                  onClick={() => {
                                    if (areaStep === 2 && !box.isSolved) {
                                      setActiveBoxId(box.id);
                                      setCurrentInput('');
                                      gameAudio.playCrispClick();
                                    }
                                  }}
                                  className={`relative min-h-[68px] sm:min-h-[82px] rounded-xl p-1.5 sm:p-2 border-2 flex flex-col items-center justify-between text-center transition-all ${
                                    isLocked
                                      ? 'bg-slate-950/40 border-slate-800/80 opacity-50 cursor-not-allowed'
                                      : isBoxActive
                                      ? colorTheme.activeBorder
                                      : box.isSolved
                                      ? 'bg-slate-900/90 border-emerald-500/80 shadow-inner'
                                      : `${colorTheme.bg} ${colorTheme.border} hover:border-slate-300 cursor-pointer`
                                  }`}>
                                  <div className="w-full flex items-center justify-between">
                                    <span
                                      className={`text-[9px] sm:text-[10px] font-mono font-bold px-1 py-0.2 rounded truncate ${
                                        isLocked
                                          ? 'bg-slate-800 text-slate-500'
                                          : colorTheme.badge
                                      }`}>
                                      {box.label}
                                    </span>
                                    {box.isSolved && (
                                      <span className="flex items-center text-emerald-400">
                                        <Check size={12} className="stroke-[3]" />
                                      </span>
                                    )}
                                  </div>

                                  <div className="w-full flex items-center justify-center my-auto">
                                    {box.isSolved ? (
                                      <span className="text-base sm:text-xl font-black font-mono text-emerald-300 tracking-wider">
                                        {box.product}
                                      </span>
                                    ) : isBoxActive ? (
                                      <div className="flex items-center justify-center min-w-[50px] px-1.5 py-0.5 rounded-lg bg-slate-950/90 border-2 border-amber-400 ring-2 ring-amber-400/40">
                                        <span className="text-base sm:text-xl font-black font-mono text-amber-200 tracking-widest min-h-[24px]">
                                          {currentInput || <span className="text-slate-600 animate-pulse">?</span>}
                                        </span>
                                      </div>
                                    ) : (
                                      <span className="text-xs font-bold text-slate-600 font-mono">
                                        {isLocked ? '🔒' : '?'}
                                      </span>
                                    )}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Step 3: Grand Sum of Partial Products */}
                  <div
                    className={`w-full mt-3 pt-2.5 border-t-2 transition-all ${
                      areaStep === 3
                        ? 'border-emerald-400/80 bg-slate-950/80 p-2.5 sm:p-3 rounded-2xl ring-2 ring-emerald-500/30'
                        : 'border-slate-800 bg-slate-950/30 p-2 rounded-xl opacity-60'
                    }`}>
                    <div className="w-full flex flex-wrap items-center justify-between gap-1 mb-1.5">
                      <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                        <Sparkles size={13} /> Step 3: Add Partial Products
                      </span>
                      {areaStep === 3 && !sumIsSolved && (
                        <span className="text-[11px] text-emerald-300 font-semibold animate-pulse">
                          Type total sum below!
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center justify-center gap-1 sm:gap-1.5 font-mono text-xs sm:text-sm">
                      {currentAreaProblem.boxes.map((b, idx) => (
                        <React.Fragment key={b.id}>
                          <span
                            className={`px-1.5 py-0.5 rounded font-black border ${
                              b.isSolved
                                ? 'bg-slate-800 text-emerald-300 border-emerald-600/50'
                                : 'bg-slate-900 text-slate-600 border-slate-800'
                            }`}>
                            {b.isSolved ? b.product : '?'}
                          </span>
                          {idx < currentAreaProblem.boxes.length - 1 && (
                            <span className="text-slate-400 font-bold">+</span>
                          )}
                        </React.Fragment>
                      ))}

                      <span className="text-emerald-400 font-black text-base mx-1">=</span>

                      {sumIsSolved ? (
                        <span className="px-2.5 py-1 rounded-xl font-black text-base sm:text-xl bg-emerald-950 border-2 border-emerald-400 text-emerald-300 shadow-lg animate-pulse">
                          {currentAreaProblem.finalProduct}
                        </span>
                      ) : areaStep === 3 ? (
                        <div className="flex items-center justify-center min-w-[75px] px-2 py-0.5 rounded-xl bg-slate-950 border-2 border-emerald-400 ring-4 ring-emerald-400/40">
                          <span className="text-base sm:text-xl font-black text-emerald-200 tracking-wider">
                            {sumInput || currentInput || <span className="text-slate-600 animate-pulse">?</span>}
                          </span>
                        </div>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-xl font-bold bg-slate-900 border border-slate-800 text-slate-600">
                          ?
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ========================================================================= */}
              {/* METHOD 2: STANDARD ALGORITHM (DYNAMIC VERTICAL COLUMNS) */}
              {/* ========================================================================= */}
              {method === 'STANDARD_ALGORITHM' && (
                <div className="w-full flex flex-col items-center select-none py-1">
                  <div className="w-full max-w-lg bg-slate-950/85 p-3 sm:p-4 rounded-2xl border border-slate-700/80 shadow-inner flex flex-col items-center font-mono">
                    {/* Grid Columns for Vertical Stack */}
                    <div
                      className="grid gap-1 sm:gap-2 w-full items-center text-center pb-1 border-b border-slate-800"
                      style={{
                        gridTemplateColumns: `auto repeat(${standardData.totalCols}, minmax(0, 1fr))`,
                      }}>
                      <div className="w-12 text-[10px] text-slate-500 font-bold text-right pr-1">
                        Col:
                      </div>
                      {[...Array(standardData.totalCols)]
                        .map((_, i) => standardData.totalCols - 1 - i)
                        .map((colIdx) => (
                          <div
                            key={colIdx}
                            className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            {PLACE_NAMES[colIdx]?.slice(0, 2) || colIdx}
                          </div>
                        ))}
                    </div>

                    {/* Row 2 Carries (Tens Multiplier Carries - only if 2-digit multiplier) */}
                    {standardData.hasBottomTens && (
                      <div
                        className="grid gap-1 sm:gap-2 w-full items-center py-0.5"
                        style={{
                          gridTemplateColumns: `auto repeat(${standardData.totalCols}, minmax(0, 1fr))`,
                        }}>
                        <div
                          className="w-12 text-[9px] text-amber-400 font-bold text-right pr-1 uppercase truncate"
                          title="Row 2 Carry">
                          Carry 2:
                        </div>
                        {[...Array(standardData.totalCols)]
                          .map((_, i) => standardData.totalCols - 1 - i)
                          .map((colIdx) => {
                            const carryStep = standardData.steps.find(
                              (s) => s.type === 'r2_carry' && s.colIndex === colIdx,
                            );
                            if (!carryStep) {
                              return <div key={colIdx} className="h-7 sm:h-8" />;
                            }

                            const isActive = currentStandardStep?.id === carryStep.id;
                            const isRow2Finished = standardData.steps
                              .filter(
                                (s) =>
                                  s.type === 'r2_digit' ||
                                  s.type === 'r2_zero' ||
                                  s.type === 'r2_carry',
                              )
                              .every((s) => s.isSolved);

                            return (
                              <button
                                key={colIdx}
                                onClick={() => {
                                  if (!carryStep.isSolved) {
                                    setStandardActiveStepId(carryStep.id);
                                    setCurrentInput('');
                                    gameAudio.playCrispClick();
                                  }
                                }}
                                className={`h-7 sm:h-8 rounded-lg border-2 flex items-center justify-center font-black text-xs transition-all ${
                                  carryStep.isSolved
                                    ? isRow2Finished
                                      ? 'bg-slate-900/90 border-slate-700 text-slate-400 shadow-inner'
                                      : 'bg-amber-950/90 border-amber-400 text-amber-300 shadow'
                                    : isActive
                                    ? 'bg-amber-900 border-amber-400 ring-4 ring-amber-400/60 text-amber-100 animate-pulse shadow-lg'
                                    : 'bg-slate-900 border-slate-700 text-slate-500 hover:border-slate-500'
                                }`}>
                                {carryStep.isSolved ? (
                                  isRow2Finished ? (
                                    <span className="line-through decoration-amber-500 decoration-2 text-slate-400 font-bold">
                                      +{carryStep.targetVal}
                                    </span>
                                  ) : (
                                    `+${carryStep.targetVal}`
                                  )
                                ) : isActive ? (
                                  currentInput || '?'
                                ) : (
                                  ''
                                )}
                              </button>
                            );
                          })}
                      </div>
                    )}

                    {/* Row 1 Carries (Ones Multiplier Carries) */}
                    <div
                      className="grid gap-1 sm:gap-2 w-full items-center py-0.5"
                      style={{
                        gridTemplateColumns: `auto repeat(${standardData.totalCols}, minmax(0, 1fr))`,
                      }}>
                      <div
                        className="w-12 text-[9px] text-cyan-400 font-bold text-right pr-1 uppercase truncate"
                        title="Row 1 Carry">
                        {standardData.hasBottomTens ? 'Carry 1:' : 'Carry:'}
                      </div>
                      {[...Array(standardData.totalCols)]
                        .map((_, i) => standardData.totalCols - 1 - i)
                        .map((colIdx) => {
                          const carryStep = standardData.steps.find(
                            (s) => s.type === 'r1_carry' && s.colIndex === colIdx,
                          );
                          if (!carryStep) {
                            return <div key={colIdx} className="h-7 sm:h-8" />;
                          }

                          const isActive = currentStandardStep?.id === carryStep.id;
                          const isRow1Finished = standardData.steps
                            .filter((s) => s.type === 'r1_digit' || s.type === 'r1_carry')
                            .every((s) => s.isSolved);

                          return (
                            <button
                              key={colIdx}
                              onClick={() => {
                                if (!carryStep.isSolved) {
                                  setStandardActiveStepId(carryStep.id);
                                  setCurrentInput('');
                                  gameAudio.playCrispClick();
                                }
                              }}
                              className={`h-7 sm:h-8 rounded-lg border-2 flex items-center justify-center font-black text-xs transition-all ${
                                carryStep.isSolved
                                  ? isRow1Finished
                                    ? 'bg-slate-900/90 border-slate-700 text-slate-400 shadow-inner'
                                    : 'bg-cyan-950/90 border-cyan-400 text-cyan-300 shadow'
                                  : isActive
                                  ? 'bg-cyan-900 border-cyan-400 ring-4 ring-cyan-400/60 text-cyan-100 animate-pulse shadow-lg'
                                  : 'bg-slate-900 border-slate-700 text-slate-500 hover:border-slate-500'
                              }`}>
                              {carryStep.isSolved ? (
                                isRow1Finished ? (
                                  <span className="line-through decoration-cyan-400 decoration-2 text-slate-400 font-bold">
                                    +{carryStep.targetVal}
                                  </span>
                                ) : (
                                  `+${carryStep.targetVal}`
                                )
                              ) : isActive ? (
                                currentInput || '?'
                              ) : (
                                ''
                              )}
                            </button>
                          );
                        })}
                    </div>

                    {/* Top Number Row (e.g. 43, 345, or 4256) */}
                    <div
                      className="grid gap-1 sm:gap-2 w-full items-center text-lg sm:text-2xl font-black text-cyan-200 py-1"
                      style={{
                        gridTemplateColumns: `auto repeat(${standardData.totalCols}, minmax(0, 1fr))`,
                      }}>
                      <div className="w-12 text-[10px] text-cyan-400 font-bold text-right pr-1">
                        Top:
                      </div>
                      {[...Array(standardData.totalCols)]
                        .map((_, i) => standardData.totalCols - 1 - i)
                        .map((colIdx) => {
                          const digit = standardData.topDigits[colIdx];
                          return (
                            <div key={colIdx} className="text-center font-mono">
                              {digit !== undefined ? digit : ''}
                            </div>
                          );
                        })}
                    </div>

                    {/* Bottom Number Row with Multiplication Symbol (e.g. × 24) */}
                    <div
                      className="grid gap-1 sm:gap-2 w-full items-center text-lg sm:text-2xl font-black text-amber-200 py-1"
                      style={{
                        gridTemplateColumns: `auto repeat(${standardData.totalCols}, minmax(0, 1fr))`,
                      }}>
                      <div className="w-12 text-center text-amber-400 text-xl font-black">×</div>
                      {[...Array(standardData.totalCols)]
                        .map((_, i) => standardData.totalCols - 1 - i)
                        .map((colIdx) => {
                          let digit: string | number = '';
                          if (colIdx === 0) digit = standardData.bottomOnes;
                          else if (colIdx === 1 && standardData.hasBottomTens) digit = standardData.bottomTens;
                          return (
                            <div key={colIdx} className="text-center font-mono">
                              {digit}
                            </div>
                          );
                        })}
                    </div>

                    {/* Horizontal Divider Line */}
                    <div className="w-full h-0.5 bg-slate-600 my-1 rounded-full" />

                    {/* Row 1: Partial Product 1 (Top × Bottom Ones) */}
                    <div
                      className="grid gap-1 sm:gap-2 w-full items-center py-1"
                      style={{
                        gridTemplateColumns: `auto repeat(${standardData.totalCols}, minmax(0, 1fr))`,
                      }}>
                      <div className="w-12 text-[9px] text-cyan-400 font-bold text-right pr-1 uppercase truncate">
                        Row 1:
                      </div>
                      {[...Array(standardData.totalCols)]
                        .map((_, i) => standardData.totalCols - 1 - i)
                        .map((colIdx) => {
                          const step = standardData.steps.find(
                            (s) => s.type === 'r1_digit' && s.colIndex === colIdx,
                          );
                          if (!step) {
                            return <div key={colIdx} className="h-8 sm:h-10" />;
                          }

                          const isActive = currentStandardStep?.id === step.id;
                          return (
                            <button
                              key={colIdx}
                              onClick={() => {
                                setStandardActiveStepId(step.id);
                                setCurrentInput('');
                                gameAudio.playCrispClick();
                              }}
                              className={`h-8 sm:h-10 rounded-xl border-2 flex items-center justify-center font-black text-sm sm:text-lg transition-all ${
                                step.isSolved
                                  ? 'bg-cyan-950/80 border-cyan-400 text-cyan-200'
                                  : isActive
                                  ? 'bg-cyan-900 border-cyan-400 ring-4 ring-cyan-400/60 text-cyan-100 animate-pulse'
                                  : 'bg-slate-900 border-slate-700 text-slate-600 hover:border-slate-500'
                              }`}>
                              {step.isSolved
                                ? step.targetVal
                                : isActive
                                ? currentInput || '?'
                                : '?'}
                            </button>
                          );
                        })}
                    </div>

                    {/* Row 2: Partial Product 2 (If bottomNum has tens) */}
                    {standardData.hasBottomTens && (
                      <div
                        className="grid gap-1 sm:gap-2 w-full items-center py-1"
                        style={{
                          gridTemplateColumns: `auto repeat(${standardData.totalCols}, minmax(0, 1fr))`,
                        }}>
                        <div className="w-12 text-[9px] text-amber-400 font-bold text-right pr-1 uppercase truncate">
                          Row 2:
                        </div>
                        {[...Array(standardData.totalCols)]
                          .map((_, i) => standardData.totalCols - 1 - i)
                          .map((colIdx) => {
                            const step = standardData.steps.find(
                              (s) => (s.type === 'r2_digit' || s.type === 'r2_zero') && s.colIndex === colIdx,
                            );
                            if (!step) {
                              return <div key={colIdx} className="h-8 sm:h-10" />;
                            }

                            const isActive = currentStandardStep?.id === step.id;
                            return (
                              <button
                                key={colIdx}
                                onClick={() => {
                                  setStandardActiveStepId(step.id);
                                  setCurrentInput('');
                                  gameAudio.playCrispClick();
                                }}
                                className={`h-8 sm:h-10 rounded-xl border-2 flex items-center justify-center font-black text-sm sm:text-lg transition-all ${
                                  step.isSolved
                                    ? step.type === 'r2_zero'
                                      ? 'bg-purple-950/80 border-purple-400 text-purple-200'
                                      : 'bg-amber-950/80 border-amber-400 text-amber-200'
                                    : isActive
                                    ? step.type === 'r2_zero'
                                      ? 'bg-purple-900 border-purple-400 ring-4 ring-purple-400/60 text-purple-100 animate-pulse'
                                      : 'bg-amber-900 border-amber-400 ring-4 ring-amber-400/60 text-amber-100 animate-pulse'
                                    : 'bg-slate-900 border-slate-700 text-slate-600 hover:border-slate-500'
                                }`}>
                                {step.isSolved
                                  ? step.targetVal
                                  : isActive
                                  ? currentInput || '?'
                                  : '?'}
                              </button>
                            );
                          })}
                      </div>
                    )}

                    {/* Final Sum Row (If bottomNum has tens) */}
                    {standardData.hasBottomTens && (
                      <>
                        <div className="w-full h-0.5 bg-emerald-500/80 my-1 rounded-full" />

                        <div
                          className="grid gap-1 sm:gap-2 w-full items-center py-1"
                          style={{
                            gridTemplateColumns: `auto repeat(${standardData.totalCols}, minmax(0, 1fr))`,
                          }}>
                          <div className="w-12 text-[9px] text-emerald-400 font-bold text-right pr-1 uppercase truncate">
                            Total:
                          </div>
                          {[...Array(standardData.totalCols)]
                            .map((_, i) => standardData.totalCols - 1 - i)
                            .map((colIdx) => {
                              const step = standardData.steps.find(
                                (s) => s.type === 'sum_digit' && s.colIndex === colIdx,
                              );
                              if (!step) {
                                return <div key={colIdx} className="h-8 sm:h-10" />;
                              }

                              const isActive = currentStandardStep?.id === step.id;
                              return (
                                <button
                                  key={colIdx}
                                  onClick={() => {
                                    setStandardActiveStepId(step.id);
                                    setCurrentInput('');
                                    gameAudio.playCrispClick();
                                  }}
                                  className={`h-8 sm:h-10 rounded-xl border-2 flex items-center justify-center font-black text-sm sm:text-lg transition-all ${
                                    step.isSolved
                                      ? 'bg-emerald-950/80 border-emerald-400 text-emerald-200'
                                      : isActive
                                      ? 'bg-emerald-900 border-emerald-400 ring-4 ring-emerald-400/60 text-emerald-100 animate-pulse'
                                      : 'bg-slate-900 border-slate-700 text-slate-600 hover:border-slate-500'
                                  }`}>
                                  {step.isSolved
                                    ? step.targetVal
                                    : isActive
                                    ? currentInput || '?'
                                    : '?'}
                                </button>
                              );
                            })}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Tactile Virtual Keypad */}
            <div className="w-full max-w-lg mt-2.5 bg-slate-900/95 p-2 rounded-2xl border border-slate-700 shadow-2xl backdrop-blur-sm">
              <div className="grid grid-cols-6 gap-1.5 sm:gap-2">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((num) => (
                  <button
                    key={num}
                    onClick={() => handleKeypadPress(num.toString())}
                    className="min-w-[38px] min-h-[40px] sm:min-h-[44px] py-1 bg-slate-800 hover:bg-cyan-600 active:bg-cyan-700 text-white font-black text-base sm:text-lg rounded-xl border border-slate-600 hover:border-cyan-400 active:scale-95 transition-all flex items-center justify-center shadow">
                    {num}
                  </button>
                ))}

                {/* Backspace Button */}
                <button
                  onClick={() => handleKeypadPress('BACKSPACE')}
                  className="min-w-[38px] min-h-[40px] sm:min-h-[44px] py-1 bg-slate-800 hover:bg-red-600/80 text-red-300 hover:text-white font-bold text-xs sm:text-sm rounded-xl border border-slate-600 active:scale-95 transition-all flex items-center justify-center shadow"
                  title="Backspace">
                  <span className="font-bold text-sm">⌫</span>
                </button>

                {/* Submit / Check Answer Button */}
                <button
                  onClick={() => handleKeypadPress('ENTER')}
                  className="min-w-[38px] min-h-[40px] sm:min-h-[44px] py-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs sm:text-sm rounded-xl border border-emerald-400 active:scale-95 transition-all flex items-center justify-center shadow-lg">
                  <Check size={18} className="stroke-[3]" />
                </button>
              </div>
            </div>
          </div>
        </main>
      )}

      {/* Problem Celebration Modal */}
      {showCelebration && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/75 backdrop-blur-sm">
          <div className="bg-slate-900 border-2 border-emerald-400 p-6 rounded-2xl text-center shadow-2xl flex flex-col items-center max-w-sm w-full mx-4 animate-scale-in">
            <img
              src={ASSETS_MANIFEST.starIcon}
              alt="Star Reward"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
              className="w-16 h-16 object-contain drop-shadow-xl animate-bounce mb-2"
            />
            <h3 className="text-2xl font-black text-emerald-400 mb-1">
              PROBLEM SOLVED!
            </h3>
            <p className="text-slate-200 text-sm mb-3 font-mono font-bold">
              {currentTopNum} × {currentSideNum} ={' '}
              <span className="text-amber-400 text-lg">
                {currentTopNum * currentSideNum}
              </span>
            </p>
            <div className="text-xs text-amber-300 font-bold bg-amber-950/80 px-3 py-1 rounded-full border border-amber-500/40 mb-5">
              +{pointsPerStep * 4} Points Earned!
            </div>

            <button
              onClick={() => advanceToNextProblem()}
              className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black py-3 px-6 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 active:scale-95 transition-all">
              <span>Next Problem</span>
              <ArrowRight size={18} />
            </button>
          </div>
        </div>
      )}

      {/* PROBLEM SETUP / CHANGE TYPE MODAL (Accessible mid-game and from header) */}
      {isSetupModalOpen && (
        <MenuOverlay tone="neutral" zIndex={85}>
          <div className="w-full max-w-lg bg-slate-900 border-2 border-cyan-400 rounded-2xl p-5 sm:p-6 shadow-2xl flex flex-col items-center">
            <div className="w-full flex items-center justify-between pb-2.5 mb-3 border-b border-slate-700">
              <h3 className="text-xl font-black text-cyan-400 flex items-center gap-2">
                <Sliders size={20} /> Problem Configuration
              </h3>
              <button
                onClick={() => setIsSetupModalOpen(false)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>

            {/* 1. Method Selector */}
            <div className="w-full mb-4">
              <div className="text-xs font-bold text-cyan-300 mb-2 uppercase tracking-wide">
                1. Choose Multiplication Strategy:
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setMethod('AREA_MODEL')}
                  className={`p-3 rounded-xl border-2 flex flex-col items-center text-center transition-all ${
                    method === 'AREA_MODEL'
                      ? 'bg-cyan-950/90 border-cyan-400 ring-2 ring-cyan-400/60 shadow-lg'
                      : 'bg-slate-800/80 border-slate-700 hover:border-slate-500 text-slate-300'
                  }`}>
                  <Layers size={20} className="text-cyan-400 mb-1" />
                  <span className="font-black text-sm text-white">Area Model</span>
                  <span className="text-[10px] text-cyan-300 font-bold">Box Method</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMethod('STANDARD_ALGORITHM')}
                  className={`p-3 rounded-xl border-2 flex flex-col items-center text-center transition-all ${
                    method === 'STANDARD_ALGORITHM'
                      ? 'bg-amber-950/90 border-amber-400 ring-2 ring-amber-400/60 shadow-lg'
                      : 'bg-slate-800/80 border-slate-700 hover:border-slate-500 text-slate-300'
                  }`}>
                  <Calculator size={20} className="text-amber-400 mb-1" />
                  <span className="font-black text-sm text-white">Standard Algorithm</span>
                  <span className="text-[10px] text-amber-300 font-bold">Vertical Method</span>
                </button>
              </div>
            </div>

            {/* 2. Factor Digit Selectors */}
            <div className="w-full mb-5 space-y-3">
              <div className="text-xs font-bold text-cyan-300 uppercase tracking-wide">
                2. Select Factor Sizes:
              </div>

              {/* First Factor */}
              <div className="bg-slate-800/70 p-3 rounded-xl border border-slate-700">
                <div className="text-xs font-bold text-slate-300 mb-2 flex justify-between">
                  <span>First Factor (Top Number):</span>
                  <span className="text-cyan-400 font-mono">{firstFactorDigits}-Digit</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {([2, 3, 4] as FirstFactorDigits[]).map((digits) => (
                    <button
                      key={digits}
                      type="button"
                      onClick={() => setFirstFactorDigits(digits)}
                      className={`py-2 px-1 rounded-xl border font-bold text-xs sm:text-sm transition-all ${
                        firstFactorDigits === digits
                          ? 'bg-cyan-600/40 border-cyan-400 ring-2 ring-cyan-400 text-white'
                          : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                      }`}>
                      {digits}-Digit
                    </button>
                  ))}
                </div>
              </div>

              {/* Second Factor */}
              <div className="bg-slate-800/70 p-3 rounded-xl border border-slate-700">
                <div className="text-xs font-bold text-slate-300 mb-2 flex justify-between">
                  <span>Second Factor (Multiplier):</span>
                  <span className="text-amber-400 font-mono">{secondFactorDigits}-Digit</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {([1, 2] as SecondFactorDigits[]).map((digits) => (
                    <button
                      key={digits}
                      type="button"
                      onClick={() => setSecondFactorDigits(digits)}
                      className={`py-2 px-1 rounded-xl border font-bold text-xs sm:text-sm transition-all ${
                        secondFactorDigits === digits
                          ? 'bg-amber-600/40 border-amber-400 ring-2 ring-amber-400 text-white'
                          : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                      }`}>
                      {digits}-Digit
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Launch Setup Button */}
            <button
              onClick={() => {
                initGame(method, firstFactorDigits, secondFactorDigits);
                setIsSetupModalOpen(false);
              }}
              className="w-full bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 font-black py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95">
              <Play size={18} className="fill-slate-950" />
              <span>Apply & Start New Problem</span>
            </button>
          </div>
        </MenuOverlay>
      )}

      {/* Times Table Reference Modal Scratchpad */}
      {isTimesTableOpen && (
        <MenuOverlay tone="neutral" zIndex={60}>
          <div className="w-full max-w-lg bg-slate-900 border-2 border-indigo-500 rounded-2xl p-4 sm:p-5 shadow-2xl flex flex-col items-center">
            <div className="w-full flex items-center justify-between pb-2 mb-3 border-b border-slate-700">
              <h3 className="text-lg font-black text-indigo-400 flex items-center gap-2">
                <Calculator size={18} /> Times Table Reference (1–9)
              </h3>
              <button
                onClick={() => setIsTimesTableOpen(false)}
                className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="w-full overflow-x-auto text-xs">
              <table className="w-full text-center border-collapse font-mono">
                <thead>
                  <tr className="bg-indigo-950 text-indigo-300 font-bold">
                    <th className="p-1.5 border border-slate-700">×</th>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                      <th
                        key={n}
                        className="p-1.5 border border-slate-700 text-indigo-200">
                        {n}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {timesTable.map((row, rIdx) => (
                    <tr
                      key={rIdx}
                      className={rIdx % 2 === 0 ? 'bg-slate-800/60' : 'bg-slate-850'}>
                      <td className="p-1.5 font-bold bg-indigo-950/60 text-indigo-300 border border-slate-700">
                        {rIdx + 1}
                      </td>
                      {row.map((cell) => (
                        <td
                          key={cell.y}
                          className="p-1.5 border border-slate-700/60 text-slate-200 hover:bg-indigo-600/40">
                          {cell.res}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button
              onClick={() => setIsTimesTableOpen(false)}
              className="mt-3 px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-colors text-xs">
              Close Reference
            </button>
          </div>
        </MenuOverlay>
      )}

      {/* Game Menu Overlay */}
      {isMenuOpen && (
        <MenuOverlay tone="neutral" zIndex={70}>
          <div className="w-full max-w-md flex flex-col items-center bg-slate-900 border-2 border-cyan-500 rounded-2xl p-5 shadow-2xl">
            <h2 className="text-2xl font-black text-cyan-400 mb-5 flex items-center gap-2">
              <Settings size={24} /> Game Menu
            </h2>

            {/* Resume Button */}
            <button
              onClick={() => {
                setIsMenuOpen(false);
                gameAudio.playCrispClick();
              }}
              className="w-full bg-cyan-600 hover:bg-cyan-500 text-white px-6 py-2.5 rounded-xl font-bold text-base mb-2.5 flex items-center justify-center gap-2 transition-all active:scale-95 shadow-md">
              <Play size={18} /> Resume Practice
            </button>

            {/* Change Setup Button */}
            <button
              onClick={() => {
                setIsMenuOpen(false);
                setIsSetupModalOpen(true);
                gameAudio.playCrispClick();
              }}
              className="w-full bg-amber-600/30 hover:bg-amber-600/50 text-amber-300 px-6 py-2 rounded-xl font-bold text-sm mb-2.5 flex items-center justify-center gap-2 border border-amber-500/50 transition-colors">
              <Sliders size={16} /> Change Setup ({firstFactorDigits}D × {secondFactorDigits}D)
            </button>

            {/* Audio Controls */}
            <div className="w-full grid grid-cols-2 gap-2.5 mb-2.5">
              <button
                onClick={() => {
                  const muted = gameAudio.toggleMute();
                  setIsSfxMuted(muted);
                }}
                className={`w-full px-3 py-2 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 border transition-all ${
                  isSfxMuted
                    ? 'bg-slate-800 text-slate-400 border-slate-700'
                    : 'bg-emerald-900/60 text-emerald-300 border-emerald-600'
                }`}>
                {isSfxMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                SFX: {isSfxMuted ? 'Off' : 'On'}
              </button>

              <button
                onClick={() => {
                  setIsMusicMuted((prev) => !prev);
                  gameAudio.playCrispClick();
                }}
                className={`w-full px-3 py-2 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 border transition-all ${
                  isMusicMuted
                    ? 'bg-slate-800 text-slate-400 border-slate-700'
                    : 'bg-emerald-900/60 text-emerald-300 border-emerald-600'
                }`}>
                {isMusicMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                Music: {isMusicMuted ? 'Off' : 'On'}
              </button>
            </div>

            {/* Multiplication Guide */}
            <button
              onClick={() => {
                setIsHowToPlayOpen(true);
                gameAudio.playCrispClick();
              }}
              className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 px-6 py-2 rounded-xl font-bold text-sm mb-2.5 flex items-center justify-center gap-2 border border-slate-700 transition-colors">
              <HelpCircle size={16} /> Multiplication Guide
            </button>

            {/* Restart Problem Set */}
            <button
              onClick={() => initGame(method, firstFactorDigits, secondFactorDigits)}
              className="w-full bg-slate-800 hover:bg-slate-700 text-amber-300 px-6 py-2 rounded-xl font-bold text-sm mb-2.5 flex items-center justify-center gap-2 border border-slate-700 transition-colors">
              <RotateCw size={16} /> Restart Problem Set
            </button>

            {/* Quit to Start Screen */}
            <button
              onClick={() => {
                setGameState((prev) => ({...prev, status: 'START'}));
                setIsMenuOpen(false);
                gameAudio.playCrispClick();
              }}
              className="w-full bg-red-950/60 hover:bg-red-900/80 text-red-300 px-6 py-2 rounded-xl font-bold text-xs border border-red-800/50 transition-colors">
              Quit to Title Screen
            </button>
          </div>
        </MenuOverlay>
      )}

      {/* How to Play Guide Overlay */}
      {isHowToPlayOpen && (
        <MenuOverlay tone="neutral" zIndex={80}>
          <div className="w-full max-w-lg bg-slate-900 border-2 border-cyan-400 rounded-2xl p-5 shadow-2xl flex flex-col items-center">
            <h2 className="text-2xl font-black text-cyan-400 mb-3 flex items-center gap-2">
              <BookOpen size={24} /> Multiplication Strategies
            </h2>

            <div className="w-full text-left text-xs sm:text-sm text-slate-200 space-y-3 bg-slate-800/70 p-4 rounded-xl border border-slate-700 max-h-[60vh] overflow-y-auto">
              <div className="border-b border-slate-700 pb-3">
                <div className="text-cyan-400 font-black text-sm mb-1 flex items-center gap-1.5">
                  <Layers size={16} /> 1. Area Model (Box Method)
                </div>
                <p className="text-slate-300 mb-1 leading-relaxed">
                  • <strong>Step 1:</strong> Decompose both factors along columns and rows into expanded place values (Thousands, Hundreds, Tens, Ones).
                </p>
                <p className="text-slate-300 mb-1 leading-relaxed">
                  • <strong>Step 2:</strong> Compute partial product for each box in the grid by multiplying column header × row header.
                </p>
                <p className="text-slate-300 leading-relaxed">
                  • <strong>Step 3:</strong> Sum all partial products together for the grand total!
                </p>
              </div>

              <div>
                <div className="text-amber-400 font-black text-sm mb-1 flex items-center gap-1.5">
                  <Calculator size={16} /> 2. Standard Algorithm (Vertical Method)
                </div>
                <p className="text-slate-300 mb-1 leading-relaxed">
                  • <strong>Row 1:</strong> Multiply bottom ones by all top digits from right to left with carries in Carry 1.
                </p>
                <p className="text-slate-300 mb-1 leading-relaxed">
                  • <strong>Row 2:</strong> Place placeholder 0, then multiply bottom tens by all top digits with dedicated carries in Carry 2 (Row 1 carries are crossed out!).
                </p>
                <p className="text-slate-300 leading-relaxed">
                  • <strong>Final Sum:</strong> Add the partial product rows column-by-column with carries.
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsHowToPlayOpen(false)}
              className="mt-4 w-full bg-cyan-600 hover:bg-cyan-500 text-white font-black py-2.5 rounded-xl transition-all shadow-md">
              Got It, Let&apos;s Multiply!
            </button>
          </div>
        </MenuOverlay>
      )}

      {/* ========================================================================= */}
      {/* START SCREEN: PROMINENT METHOD SELECTION & FACTOR DIGIT SELECTION */}
      {/* ========================================================================= */}
      {gameState.status === 'START' && (
        <MenuOverlay tone="neutral" zIndex={50}>
          <div className="w-full max-w-lg bg-slate-900/95 border-2 border-cyan-500 p-5 sm:p-6 rounded-2xl shadow-2xl flex flex-col items-center backdrop-blur-md">
            {/* Mascot Avatar */}
            <div className="relative mb-2">
              <img
                src={ASSETS_MANIFEST.mascotOwl}
                alt="Professor Hoot"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
                className="w-16 h-16 sm:w-20 sm:h-20 object-contain drop-shadow-xl"
              />
              <div className="absolute -bottom-1 -right-1 bg-amber-400 text-black text-[9px] font-black px-2 py-0.5 rounded-full shadow">
                Math Academy
              </div>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-amber-300 to-emerald-400 text-center tracking-tight mb-0.5">
              STEP MULTIPLY
            </h1>
            <p className="text-slate-300 text-xs text-center mb-4 leading-relaxed">
              Master multi-digit multiplication step-by-step with Professor Hoot!
            </p>

            {/* SECTION 1: METHOD SELECTION CARDS */}
            <div className="w-full mb-4">
              <div className="text-xs font-bold text-cyan-300 mb-2 uppercase tracking-wide flex items-center justify-between">
                <span>1. Choose Your Strategy:</span>
                <span className="text-[10px] text-slate-400 font-normal">Interactive Modes</span>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                {/* Area Model Card */}
                <button
                  type="button"
                  onClick={() => {
                    setMethod('AREA_MODEL');
                    gameAudio.playCrispClick();
                  }}
                  className={`p-3 rounded-xl border-2 flex flex-col items-center text-center transition-all ${
                    method === 'AREA_MODEL'
                      ? 'bg-cyan-950/90 border-cyan-400 ring-2 ring-cyan-400/60 shadow-lg scale-102'
                      : 'bg-slate-800/80 border-slate-700 hover:border-slate-500 text-slate-300'
                  }`}>
                  <Layers size={22} className="text-cyan-400 mb-1" />
                  <span className="font-black text-xs sm:text-sm text-white">
                    Area Model
                  </span>
                  <span className="text-[10px] text-cyan-300 font-bold mb-1">
                    Box Method
                  </span>
                  <span className="text-[10px] text-slate-400 leading-tight">
                    Decompose & sum visual boxes
                  </span>
                </button>

                {/* Standard Algorithm Card */}
                <button
                  type="button"
                  onClick={() => {
                    setMethod('STANDARD_ALGORITHM');
                    gameAudio.playCrispClick();
                  }}
                  className={`p-3 rounded-xl border-2 flex flex-col items-center text-center transition-all ${
                    method === 'STANDARD_ALGORITHM'
                      ? 'bg-amber-950/90 border-amber-400 ring-2 ring-amber-400/60 shadow-lg scale-102'
                      : 'bg-slate-800/80 border-slate-700 hover:border-slate-500 text-slate-300'
                  }`}>
                  <Calculator size={22} className="text-amber-400 mb-1" />
                  <span className="font-black text-xs sm:text-sm text-white">
                    Standard Algorithm
                  </span>
                  <span className="text-[10px] text-amber-300 font-bold mb-1">
                    Vertical Method
                  </span>
                  <span className="text-[10px] text-slate-400 leading-tight">
                    Columns, carries & rows
                  </span>
                </button>
              </div>
            </div>

            {/* SECTION 2: FACTOR DIGIT SELECTION (No Grade/Difficulty selectors) */}
            <div className="w-full mb-5 space-y-2.5">
              <div className="text-xs font-bold text-cyan-300 uppercase tracking-wide flex items-center justify-between">
                <span>2. Select Factor Sizes:</span>
                <span className="text-[10px] font-mono text-amber-300 font-bold">
                  {firstFactorDigits}D × {secondFactorDigits}D
                </span>
              </div>

              {/* First Factor Selection */}
              <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700">
                <div className="text-[11px] font-bold text-slate-300 mb-1.5 flex justify-between">
                  <span>First Factor:</span>
                  <span className="text-cyan-400 font-mono text-xs">
                    {firstFactorDigits === 2 ? '10–99' : firstFactorDigits === 3 ? '100–999' : '1000–9999'}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {([2, 3, 4] as FirstFactorDigits[]).map((digits) => (
                    <button
                      key={digits}
                      type="button"
                      onClick={() => {
                        setFirstFactorDigits(digits);
                        gameAudio.playCrispClick();
                      }}
                      className={`py-2 px-1 rounded-xl border font-bold text-xs sm:text-sm transition-all ${
                        firstFactorDigits === digits
                          ? 'bg-cyan-600/40 border-cyan-400 ring-2 ring-cyan-400 text-white shadow-md'
                          : 'bg-slate-850 border-slate-700 text-slate-400 hover:text-white'
                      }`}>
                      {digits}-Digit
                    </button>
                  ))}
                </div>
              </div>

              {/* Second Factor Selection */}
              <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700">
                <div className="text-[11px] font-bold text-slate-300 mb-1.5 flex justify-between">
                  <span>Second Factor:</span>
                  <span className="text-amber-400 font-mono text-xs">
                    {secondFactorDigits === 1 ? '1-Digit (2–9)' : '2-Digit (10–99)'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {([1, 2] as SecondFactorDigits[]).map((digits) => (
                    <button
                      key={digits}
                      type="button"
                      onClick={() => {
                        setSecondFactorDigits(digits);
                        gameAudio.playCrispClick();
                      }}
                      className={`py-2 px-1 rounded-xl border font-bold text-xs sm:text-sm transition-all ${
                        secondFactorDigits === digits
                          ? 'bg-amber-600/40 border-amber-400 ring-2 ring-amber-400 text-white shadow-md'
                          : 'bg-slate-850 border-slate-700 text-slate-400 hover:text-white'
                      }`}>
                      {digits}-Digit
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Launch Practice Button */}
            <button
              ref={startButtonRef}
              autoFocus
              onClick={() => initGame(method, firstFactorDigits, secondFactorDigits)}
              data-testid="start-button"
              className="w-full bg-gradient-to-r from-cyan-500 via-amber-400 to-emerald-400 hover:from-cyan-400 hover:via-amber-300 hover:to-emerald-300 text-slate-950 px-6 py-3 rounded-xl font-black text-base sm:text-lg transition-all flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/25 active:scale-95">
              <Play size={20} className="fill-slate-950" />
              <span>START PRACTICE</span>
            </button>
          </div>
        </MenuOverlay>
      )}

      {/* GAME OVER SCREEN */}
      {gameState.status === 'GAME_OVER' && (
        <MenuOverlay tone="danger" zIndex={50}>
          <div className="w-full max-w-md bg-slate-900 border-2 border-red-500 p-6 rounded-2xl shadow-2xl flex flex-col items-center">
            <div className="w-14 h-14 rounded-full bg-red-950/80 border-2 border-red-500 flex items-center justify-center text-red-400 mb-3">
              <X size={32} />
            </div>

            <h2 className="text-2xl sm:text-3xl font-black text-red-400 mb-1">
              PRACTICE COMPLETE
            </h2>
            <p className="text-slate-300 text-xs sm:text-sm text-center mb-5">
              Multiplication takes practice! Let&apos;s try again with a fresh set of numbers.
            </p>

            <div className="w-full bg-slate-800/80 rounded-xl p-3 mb-5 border border-slate-700 text-center font-mono">
              <div className="text-xs text-slate-400">Problems Solved</div>
              <div className="text-2xl font-black text-white">
                {totalProblemsCompleted} / {totalProblemsPerRound}
              </div>
              <div className="text-xs text-amber-400 mt-1">
                Score: {gameState.score}
              </div>
            </div>

            <button
              onClick={() => initGame(method, firstFactorDigits, secondFactorDigits)}
              data-testid="start-button"
              className="w-full bg-red-600 hover:bg-red-500 text-white px-6 py-3 rounded-xl font-black text-base transition-all flex items-center justify-center gap-2 shadow-lg active:scale-95">
              <RotateCw size={18} /> TRY AGAIN
            </button>
          </div>
        </MenuOverlay>
      )}

      {/* VICTORY SCREEN */}
      {gameState.status === 'VICTORY' && (
        <MenuOverlay tone="victory" zIndex={50}>
          <div className="w-full max-w-md bg-slate-900 border-2 border-amber-400 p-6 rounded-2xl shadow-2xl flex flex-col items-center text-center">
            <div className="relative mb-2">
              <img
                src={ASSETS_MANIFEST.trophyIcon}
                alt="Mastery Trophy"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
                className="w-24 h-24 sm:w-28 sm:h-28 object-contain drop-shadow-2xl animate-bounce"
              />
              <div className="absolute -bottom-1 bg-gradient-to-r from-amber-400 to-yellow-300 text-slate-950 text-xs font-black px-3 py-0.5 rounded-full shadow-lg">
                MULTIPLICATION MASTER
              </div>
            </div>

            <h2 className="text-2xl sm:text-3xl font-black text-amber-400 mb-1 mt-1">
              ROUND COMPLETE!
            </h2>
            <p className="text-slate-300 text-xs sm:text-sm mb-5">
              Sensational job! You solved all 10 problems using {method === 'AREA_MODEL' ? 'the Area Model' : 'the Standard Algorithm'}!
            </p>

            <div className="w-full bg-slate-800/90 rounded-xl p-3.5 mb-5 border border-slate-700 space-y-1.5 text-left text-xs sm:text-sm font-mono">
              <div className="flex justify-between">
                <span className="text-slate-400 font-sans">Total Score:</span>
                <span className="font-bold text-amber-400 text-base">
                  {gameState.score}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-sans">Perfect Problems:</span>
                <span className="font-bold text-emerald-400">
                  {perfectProblemsCount} / {totalProblemsPerRound}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-sans">Best Streak:</span>
                <span className="font-bold text-orange-400">
                  {bestStreak} in a row
                </span>
              </div>
            </div>

            <div className="w-full flex flex-col gap-2">
              <button
                onClick={() => initGame(method, firstFactorDigits, secondFactorDigits)}
                data-testid="start-button"
                className="w-full bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 px-6 py-3 rounded-xl font-black text-base transition-all flex items-center justify-center gap-2 shadow-lg active:scale-95">
                <Star size={18} className="fill-slate-950" />
                PLAY AGAIN
              </button>

              <button
                onClick={() => setIsSetupModalOpen(true)}
                className="w-full bg-slate-800 hover:bg-slate-700 text-white px-6 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 border border-slate-700">
                <Sliders size={16} /> CHANGE PROBLEM TYPE
              </button>
            </div>
          </div>
        </MenuOverlay>
      )}
    </div>
  );
}

export default function App() {
  return (
    <GameErrorBoundary>
      <GameInner />
    </GameErrorBoundary>
  );
}
