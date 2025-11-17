import { useState } from 'react';

export const REWARD_MODES = {
  1: [0, 2, 2, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 2, 2, 4, 2],
  2: [0, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 4, 3, 4, 2],
};

export const REWARD_NAMES = {
  0: '없음',
  1: '커먼',
  2: '레어',
  3: '에픽',
  4: '슈퍼 에픽',
  5: '유니크',
  6: '레전드리',
};

export const getMaxMovesForMode = (mode) => {
  const normalized = Number(mode);
  return normalized === 2 ? 7 : 8;
};

export const clampPosition = (pos) => {
  if (pos < 0) return 0;
  if (pos > 16) return 16;
  return pos;
};

const roll = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

export function useGame() {
  const [currentPosition, setCurrentPosition] = useState(0);
  const [remainingMoves, setRemainingMoves] = useState(() => getMaxMovesForMode(1));
  const [choice2Used, setChoice2Used] = useState(0);
  const [choice3Used, setChoice3Used] = useState(0);
  const [rewardMode, setRewardMode] = useState(1);
  const [gameOver, setGameOver] = useState(false);
  const [finalReward, setFinalReward] = useState(null);
  const [history, setHistory] = useState([]);

  const rewardArray = REWARD_MODES[rewardMode];

  const addHistory = (entry) => setHistory((prev) => [entry, ...prev]);

  const endGame = (posArg, reason) => {
    const pos = typeof posArg === 'number' ? posArg : currentPosition;
    const rewardLevel = rewardArray[pos];
    setGameOver(true);
    setFinalReward(rewardLevel);
    addHistory({ type: 'end', reason, pos, rewardLevel, ts: Date.now() });
  };

  const applyMove = (label, [min, max]) => {
    if (gameOver || remainingMoves <= 0) return;
    const delta = roll(min, max);
    const from = currentPosition;
    const to = clampPosition(from + delta);

    if (label === '2') {
      if (choice2Used >= 3) return;
      setChoice2Used((v) => v + 1);
    }
    if (label === '3') {
      if (choice3Used >= 3) return;
      setChoice3Used((v) => v + 1);
    }

    setCurrentPosition(to);
    setRemainingMoves((v) => v - 1);
    addHistory({ type: 'move', label, delta, from, to, ts: Date.now() });

    if (to >= 16) {
      setTimeout(() => endGame(to, '16번 칸 도달로 조기 종료'), 0);
      return;
    }
    setTimeout(() => {
      const nextMoves = remainingMoves - 1;
      if (nextMoves <= 0) endGame(to, '선택 기회 소진으로 정상 종료');
    }, 0);
  };

  const reset = (modeArg = rewardMode) => {
    setCurrentPosition(0);
    setRemainingMoves(getMaxMovesForMode(modeArg));
    setChoice2Used(0);
    setChoice3Used(0);
    setGameOver(false);
    setFinalReward(null);
    setHistory([]);
  };

  return {
    currentPosition,
    remainingMoves,
    choice2Used,
    choice3Used,
    rewardMode,
    rewardArray,
    gameOver,
    finalReward,
    history,
    setRewardMode,
    applyMove,
    reset,
  };
}


