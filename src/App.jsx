import React, { useMemo, useState, useEffect } from 'react';
import { useGame, REWARD_NAMES, REWARD_MODES, clampPosition, getMaxMovesForMode } from './game.js';
import PuzzlePage from './PuzzlePage.jsx';
import { 
  Button, 
  Select, 
  MenuItem, 
  FormControl, 
  InputLabel, 
  Card, 
  CardContent,
  Typography,
  Box,
  Chip,
  Slider,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

// 보상 등급별 색상 매핑
const REWARD_COLORS = {
  '없음': null,             // 색상 없음
  '커먼': '#cca789',
  '레어': '#5c7cc4',
  '에픽': '#fa75e6',
  '슈퍼 에픽': '#db3534',
  '유니크': '#f5eb36',
  '레전드리': '#11ed99',
};

const CHOICES = [
  { id: '1', label: '1번 선택지', range: [3, 6], limitKey: null },
  { id: '2', label: '2번 선택지', range: [-3, 2], limitKey: 'choice2Remain' },
  { id: '3', label: '3번 선택지', range: [0, 4], limitKey: 'choice3Remain' },
];

// 선택지 버튼 텍스트 생성 함수 (공통)
function getButtonText(choiceId, choice2Used, choice3Used) {
  if (choiceId === '1') return '세게 두드리기\n+3 ~ +6\n무제한';
  if (choiceId === '2') {
    const remain = 3 - choice2Used;
    return `세공하기\n-3 ~ +2\n남은 횟수 : (${remain})`;
  }
  if (choiceId === '3') {
    const remain = 3 - choice3Used;
    return `안정제 사용\n+0 ~ +4\n남은 횟수 : (${remain})`;
  }
  return '';
}

// Material-UI 다크 테마
const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#60a5fa',
    },
    secondary: {
      main: '#34d399',
    },
    warning: {
      main: '#fbbf24',
    },
    background: {
      default: '#0f172a',
      paper: '#111827',
    },
  },
});


function ModeSegment({ mode, onChange, label = '보상 모드', inline = false }) {
  return (
    <FormControl size="small" sx={{ minWidth: inline ? 200 : 160 }}>
      <InputLabel>시즈나이트 등급</InputLabel>
      <Select
        value={mode}
        onChange={(e) => onChange(Number(e.target.value))}
        label="시즈나이트 등급"
      >
        <MenuItem value={1}>슈퍼 에픽</MenuItem>
        <MenuItem value={2}>유니크</MenuItem>
      </Select>
    </FormControl>
  );
}

function Board({ current, rewards, onCellClick, clickable = false }) {
  const maxReward = Math.max(...rewards);
  const rewardSize = rewards.length;
  return (
    <div className="board" aria-label="game-board">
      {rewards.map((level, idx) => {
        const classes = ['cell'];
        if (idx === current) classes.push('current');
        if (level === maxReward) classes.push('finish');
        const rewardName = REWARD_NAMES[level];
        const bg = REWARD_COLORS[rewardName] || undefined; // none이면 기본 배경 유지
        let boom = ''
        if (idx === rewardSize-1) boom = '☠️';
        return (
          <div
            key={idx}
            className={classes.join(' ')}
            style={{
              ...(bg ? { background: bg } : {}),
              ...(clickable ? { cursor: 'pointer' } : {}),
            }}
            onClick={() => clickable && onCellClick && onCellClick(idx)}
          >
            {boom}
          </div>
        );
      })}
    </div>
  );
}

function MovesProgress({ used, total = 8, gameOver = false, onCellClick, clickable = false, blinkIndex = -1 }) {
  const cells = Array.from({ length: total });
  return (
    <div className="progress" aria-label="moves-progress">
      {cells.map((_, i) => {
        const cls = gameOver
          ? `pCell${i < used ? ' end' : ''}`
          : `pCell${i < used ? ' filled' : ''}`;
        const shouldBlink = clickable && blinkIndex === i;
        return (
          <React.Fragment key={i}>
            <div
              className={cls}
              style={{
                ...(clickable ? { cursor: 'pointer' } : {}),
                ...(shouldBlink ? { animation: 'blink 1s infinite' } : {}),
              }}
              onClick={() => clickable && onCellClick && onCellClick(i)}
            />
            {i < total - 1 && <span className="pSep">-</span>}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function History({ items }) {
  if (!items.length) return <div className="label">아직 기록이 없습니다.</div>;
  return (
    <div className="history">
      {items.map((it, i) => {
        if (it.type === 'move') {
          return (
            <div key={i} className="item">
              <span className="chip mono">선택지 {it.label}</span>
              <span className="mono">Δ{it.delta >= 0 ? '+' : ''}{it.delta}</span>
              <span className="label">{it.from} → {it.to}</span>
            </div>
          );
        }
        return (
          <div key={i} className="item">
            <span className="chip">게임 종료</span>
            <span className="label">{it.reason}</span>
            <span className="mono">위치 {it.pos}</span>
            <span className="chip">보상 {REWARD_NAMES[it.rewardLevel]}({it.rewardLevel})</span>
          </div>
        );
      })}
    </div>
  );
}

function GameView({ game }) {
  const moveLimit = getMaxMovesForMode(game.rewardMode);
  const effectiveRemainingMoves = Math.min(game.remainingMoves, moveLimit);
  const movesUsed = Math.max(0, moveLimit - effectiveRemainingMoves);

  const probabilityResults = useMemo(() => {
    if (game.gameOver || effectiveRemainingMoves <= 0) {
      return CHOICES.map((choice) => ({
        choice,
        disabled: true,
        reason: game.gameOver ? '게임이 종료되었습니다.' : '잔여 선택이 없습니다.',
      }));
    }

    const results = calculateBestRewardProbability(
      game.currentPosition,
      effectiveRemainingMoves,
      3 - game.choice2Used,
      3 - game.choice3Used,
      game.rewardArray
    );

    const mapped = CHOICES.map((choice) => {
      if (choice.id === '1') {
        const res = results.choice1;
        if (!res) {
          return { choice, disabled: true, reason: '계산 불가' };
        }
        return {
          choice,
          disabled: false,
          probability: res.probability,
        };
      } else if (choice.id === '2') {
        if (game.choice2Used >= 3) {
          return { choice, disabled: true, reason: '2번 선택지 잔여 횟수가 없습니다.' };
        }
        const res = results.choice2;
        if (!res) {
          return { choice, disabled: true, reason: '계산 불가' };
        }
        return {
          choice,
          disabled: false,
          probability: res.probability,
        };
      } else if (choice.id === '3') {
        if (game.choice3Used >= 3) {
          return { choice, disabled: true, reason: '3번 선택지 잔여 횟수가 없습니다.' };
        }
        const res = results.choice3;
        if (!res) {
          return { choice, disabled: true, reason: '계산 불가' };
        }
        return {
          choice,
          disabled: false,
          probability: res.probability,
        };
      }
      return { choice, disabled: true, reason: '알 수 없는 선택지' };
    });

    const epsilon = 1e-9;

    const candidates = mapped
      .map((res, idx) => ({ res, idx }))
      .filter(({ res }) => !res.disabled && typeof res.probability === 'number');

    const getPriorityTier = (choiceId) => {
      if (choiceId === '2' || choiceId === '3') return 1;
      return 0;
    };

    const getRemaining = (choiceId) => {
      if (choiceId === '2') return 3 - game.choice2Used;
      if (choiceId === '3') return 3 - game.choice3Used;
      return Infinity;
    };

    if (!candidates.length) {
      return mapped.map((res) => {
        if (res.isBest) {
          const { isBest, ...rest } = res;
          return rest;
        }
        return res;
      });
    }

    const maxProbability = Math.max(...candidates.map(({ res }) => res.probability));
    const topCandidates = candidates.filter(
      ({ res }) => Math.abs(res.probability - maxProbability) <= epsilon
    );

    const priorityCandidates = topCandidates.filter(
      ({ res }) => res.choice.id === '2' || res.choice.id === '3'
    );

    const pickHighestRemain = (list) =>
      list.reduce((best, candidate) => {
        if (!best) return candidate;
        const remainDiff =
          getRemaining(candidate.res.choice.id) - getRemaining(best.res.choice.id);
        if (remainDiff > epsilon) return candidate;
        if (remainDiff < -epsilon) return best;
        return candidate.idx < best.idx ? candidate : best;
      }, null);

    const pickLowestIndex = (list) =>
      list.reduce((best, candidate) => {
        if (!best) return candidate;
        return candidate.idx < best.idx ? candidate : best;
      }, null);

    const best =
      priorityCandidates.length > 0
        ? pickHighestRemain(priorityCandidates)
        : pickLowestIndex(topCandidates);

    return mapped.map((res, idx) => {
      if (idx === best.idx) {
        return { ...res, isBest: true };
      }
      if (res.isBest) {
        const { isBest, ...rest } = res;
        return rest;
      }
      return res;
    });
  }, [
    game.currentPosition,
    effectiveRemainingMoves,
    game.choice2Used,
    game.choice3Used,
    game.rewardArray,
    game.gameOver,
  ]);

  const handleModeChange = (mode) => {
    game.setRewardMode(mode);
    game.reset(mode);
  };

  return (
    <main className="container game-container">
      <Card sx={{ p: 2 }}>
        <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mb: 1 }}>시즈나이트 등급</Typography>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 2 }}>
          <ModeSegment mode={game.rewardMode} onChange={handleModeChange} label="시즈나이트 종류" />
          <Button variant="outlined" size="small" onClick={game.reset}>초기화</Button>
        </Box>

        <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mb: 1 }}>보상 보드</Typography>
        <Board current={game.currentPosition} rewards={game.rewardArray} />
        <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mt: 2, mb: 1 }}>잔여 횟수</Typography>
        <MovesProgress used={movesUsed} total={moveLimit} gameOver={game.gameOver} />

        <Box sx={{ mt: 2 }}>
          <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mb: 1 }}>선택지</Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1.5 }}>
            {probabilityResults.map((res) => {
              const getButtonColor = () => {
                if (res.choice.id === '1') return 'primary';
                if (res.choice.id === '2') return 'warning';
                if (res.choice.id === '3') return 'secondary';
                return 'primary';
              };

              return (
                <Box
                  key={res.choice.id}
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    ...(res.isBest
                      ? {
                          boxShadow: '0 0 0 2px #facc15',
                          borderRadius: '10px',
                          overflow: 'hidden',
                        }
                      : {}),
                  }}
                >
                  <Button
                    variant="contained"
                    color={getButtonColor()}
                    disabled={res.disabled}
                    onClick={() => {
                      if (res.disabled) return;
                      if (res.choice.id === '1') game.applyMove('1', [3, 6]);
                      if (res.choice.id === '2') game.applyMove('2', [-3, 2]);
                      if (res.choice.id === '3') game.applyMove('3', [0, 4]);
                    }}
                    title={res.disabled ? res.reason : undefined}
                    sx={{
                      whiteSpace: 'pre-line',
                      minHeight: 80,
                      borderRadius: !res.disabled ? '10px 10px 0 0' : '10px',
                    }}
                  >
                    {getButtonText(res.choice.id, game.choice2Used, game.choice3Used)}
                  </Button>
                  {!res.disabled && typeof res.probability === 'number' && (
                    <Card
                      sx={{
                        p: 1.5,
                        borderRadius: '0 0 10px 10px',
                        textAlign: 'center',
                        bgcolor: 'background.paper',
                      }}
                    >
                      <Typography variant="h6" sx={{ fontFamily: 'monospace', fontWeight: 'bold' }}>
                        {(res.probability * 100).toFixed(2)}%
                      </Typography>
                    </Card>
                  )}
                </Box>
              );
            })}
          </Box>
        </Box>
      </Card>

      <Card sx={{ p: 2 }}>
        <Typography variant="overline" color="text.secondary" display="block">최종 보상</Typography>
        <Typography variant="h5">{game.finalReward == null ? '-' : `${REWARD_NAMES[game.finalReward]}`}</Typography>
      </Card>
    </main>
  );
}

function calculateBestRewardProbability(currentPos, remainingTurns, remaining2, remaining3, rewardArray) {
  const bestReward = Math.max(...rewardArray);
  const maxPos = 16;

  if (remainingTurns <= 0) {
    return {
      choice1: { probability: rewardArray[Math.min(currentPos, maxPos)] === bestReward ? 1 : 0 },
      choice2: remaining2 > 0 ? { probability: rewardArray[Math.min(currentPos, maxPos)] === bestReward ? 1 : 0 } : null,
      choice3: remaining3 > 0 ? { probability: rewardArray[Math.min(currentPos, maxPos)] === bestReward ? 1 : 0 } : null,
      bestReward,
    };
  }

  const dp = Array.from({ length: remainingTurns + 1 }, () =>
    Array.from({ length: maxPos + 1 }, () =>
      Array.from({ length: remaining2 + 1 }, () =>
        Array(remaining3 + 1).fill(0)
      )
    )
  );

  const evaluateTerminal = (pos) => {
    const clamped = Math.max(0, Math.min(pos, maxPos));
    return rewardArray[clamped] === bestReward ? 1 : 0;
  };

  for (let pos = 0; pos <= maxPos; pos++) {
    for (let r2 = 0; r2 <= remaining2; r2++) {
      for (let r3 = 0; r3 <= remaining3; r3++) {
        dp[0][pos][r2][r3] = evaluateTerminal(pos);
      }
    }
  }

  for (let turns = 1; turns <= remainingTurns; turns++) {
    for (let pos = 0; pos <= maxPos; pos++) {
      for (let r2 = 0; r2 <= remaining2; r2++) {
        for (let r3 = 0; r3 <= remaining3; r3++) {
          if (pos >= maxPos) {
            dp[turns][pos][r2][r3] = evaluateTerminal(pos);
            continue;
          }

          let bestProb = 0;

          let prob1 = 0;
          for (let move = 3; move <= 6; move++) {
            const newPos = Math.min(pos + move, maxPos);
            const nextProb =
              newPos >= maxPos
                ? evaluateTerminal(newPos)
                : dp[turns - 1][newPos][r2][r3];
            prob1 += 0.25 * nextProb;
          }
          bestProb = Math.max(bestProb, prob1);

          if (r2 > 0) {
            let prob2 = 0;
            for (let move = -3; move <= 2; move++) {
              const newPos = Math.max(0, Math.min(pos + move, maxPos));
              const nextProb =
                newPos >= maxPos
                  ? evaluateTerminal(newPos)
                  : dp[turns - 1][newPos][r2 - 1][r3];
              prob2 += (1 / 6) * nextProb;
            }
            bestProb = Math.max(bestProb, prob2);
          }

          if (r3 > 0) {
            let prob3 = 0;
            for (let move = 0; move <= 4; move++) {
              const newPos = Math.min(pos + move, maxPos);
              const nextProb =
                newPos >= maxPos
                  ? evaluateTerminal(newPos)
                  : dp[turns - 1][newPos][r2][r3 - 1];
              prob3 += 0.2 * nextProb;
            }
            bestProb = Math.max(bestProb, prob3);
          }

          dp[turns][pos][r2][r3] = bestProb;
        }
      }
    }
  }

  const boundedCurrentPos = Math.max(0, Math.min(currentPos, maxPos));

  const getChoiceProbability = (choiceId) => {
    if (remainingTurns <= 0) return 0;

    if (choiceId === 1) {
      let total = 0;
      for (let move = 3; move <= 6; move++) {
        const newPos = Math.min(boundedCurrentPos + move, maxPos);
        const nextProb =
          newPos >= maxPos
            ? evaluateTerminal(newPos)
            : dp[remainingTurns - 1][newPos][remaining2][remaining3];
        total += 0.25 * nextProb;
      }
      return total;
    }

    if (choiceId === 2 && remaining2 > 0) {
      let total = 0;
      for (let move = -3; move <= 2; move++) {
        const newPos = Math.max(0, Math.min(boundedCurrentPos + move, maxPos));
        const nextProb =
          newPos >= maxPos
            ? evaluateTerminal(newPos)
            : dp[remainingTurns - 1][newPos][remaining2 - 1][remaining3];
        total += (1 / 6) * nextProb;
      }
      return total;
    }

    if (choiceId === 3 && remaining3 > 0) {
      let total = 0;
      for (let move = 0; move <= 4; move++) {
        const newPos = Math.min(boundedCurrentPos + move, maxPos);
        const nextProb =
          newPos >= maxPos
            ? evaluateTerminal(newPos)
            : dp[remainingTurns - 1][newPos][remaining2][remaining3 - 1];
        total += 0.2 * nextProb;
      }
      return total;
    }

    return 0;
  };

  return {
    choice1: { probability: getChoiceProbability(1) },
    choice2: remaining2 > 0 ? { probability: getChoiceProbability(2) } : null,
    choice3: remaining3 > 0 ? { probability: getChoiceProbability(3) } : null,
    bestReward,
  };
}

function ProbabilityTool() {
  const [rewardMode, setRewardMode] = useState(1);
  const [position, setPosition] = useState(0);
  const [remainingMoves, setRemainingMoves] = useState(() => getMaxMovesForMode(1));
  const [choice2Remain, setChoice2Remain] = useState(3);
  const [choice3Remain, setChoice3Remain] = useState(3);
  const [blinkMoveIndex, setBlinkMoveIndex] = useState(0); // 깜빡여야 할 MovesProgress 인덱스

  const rewardArray = REWARD_MODES[rewardMode];
  const manualMoveLimit = getMaxMovesForMode(rewardMode);
  const clampedRemainingMoves = Math.min(remainingMoves, manualMoveLimit);

  useEffect(() => {
    setRemainingMoves(manualMoveLimit);
    setBlinkMoveIndex(0);
  }, [rewardMode, manualMoveLimit]);

  // 현재 잔여 횟수를 기반으로 깜빡일 인덱스 계산
  useEffect(() => {
    const usedMoves = manualMoveLimit - remainingMoves;
    setBlinkMoveIndex(usedMoves);
  }, [remainingMoves, manualMoveLimit]);

  const probabilityResults = useMemo(() => {
    if (clampedRemainingMoves <= 0) {
      return CHOICES.map((choice) => ({
        choice,
        disabled: true,
        reason: '잔여 선택이 없습니다.',
      }));
    }

    const results = calculateBestRewardProbability(
      position,
      clampedRemainingMoves,
      choice2Remain,
      choice3Remain,
      rewardArray
    );

    const mapped = CHOICES.map((choice) => {
      if (choice.id === '1') {
        const res = results.choice1;
        if (!res) {
          return { choice, disabled: true, reason: '계산 불가' };
        }
        return {
          choice,
          disabled: false,
          probability: res.probability,
        };
      } else if (choice.id === '2') {
        if (choice2Remain <= 0) {
          return { choice, disabled: true, reason: '2번 선택지 잔여 횟수가 없습니다.' };
        }
        const res = results.choice2;
        if (!res) {
          return { choice, disabled: true, reason: '계산 불가' };
        }
        return {
          choice,
          disabled: false,
          probability: res.probability,
        };
      } else if (choice.id === '3') {
        if (choice3Remain <= 0) {
          return { choice, disabled: true, reason: '3번 선택지 잔여 횟수가 없습니다.' };
        }
        const res = results.choice3;
        if (!res) {
          return { choice, disabled: true, reason: '계산 불가' };
        }
        return {
          choice,
          disabled: false,
          probability: res.probability,
        };
      }
      return { choice, disabled: true, reason: '알 수 없는 선택지' };
    });

    const epsilon = 1e-9;

    const candidates = mapped
      .map((res, idx) => ({ res, idx }))
      .filter(({ res }) => !res.disabled && typeof res.probability === 'number');

    const getPriorityTier = (choiceId) => {
      if (choiceId === '2' || choiceId === '3') return 1;
      return 0;
    };

    const getRemaining = (choiceId) => {
      if (choiceId === '2') return choice2Remain;
      if (choiceId === '3') return choice3Remain;
      return 0;
    };

    if (!candidates.length) {
      return mapped.map((res) => {
        if (res.isBest) {
          const { isBest, ...rest } = res;
          return rest;
        }
        return res;
      });
    }

    const maxProbability = Math.max(...candidates.map(({ res }) => res.probability));
    const topCandidates = candidates.filter(
      ({ res }) => Math.abs(res.probability - maxProbability) <= epsilon
    );

    const priorityCandidates = topCandidates.filter(
      ({ res }) => res.choice.id === '2' || res.choice.id === '3'
    );

    const pickHighestRemain = (list) =>
      list.reduce((best, candidate) => {
        if (!best) return candidate;
        const remainDiff =
          getRemaining(candidate.res.choice.id) - getRemaining(best.res.choice.id);
        if (remainDiff > epsilon) return candidate;
        if (remainDiff < -epsilon) return best;
        return candidate.idx < best.idx ? candidate : best;
      }, null);

    const pickLowestIndex = (list) =>
      list.reduce((best, candidate) => {
        if (!best) return candidate;
        return candidate.idx < best.idx ? candidate : best;
      }, null);

    const best =
      priorityCandidates.length > 0
        ? pickHighestRemain(priorityCandidates)
        : pickLowestIndex(topCandidates);

    return mapped.map((res, idx) => {
      if (idx === best.idx) {
        return { ...res, isBest: true };
      }
      if (res.isBest) {
        const { isBest, ...rest } = res;
        return rest;
      }
      return res;
    });
  }, [rewardMode, position, clampedRemainingMoves, choice2Remain, choice3Remain, rewardArray]);

  const handleBoardClick = (idx) => {
    setPosition(idx);
  };

  const handleMovesClick = (idx) => {
    // 클릭한 인덱스를 기반으로 잔여 횟수 계산
    // idx가 0이면 모든 횟수가 남음 (used = 0, remaining = manualMoveLimit)
    // idx가 1이면 1회 사용 (used = 1, remaining = manualMoveLimit - 1)
    const usedMoves = idx;
    const newRemainingMoves = Math.max(0, manualMoveLimit - usedMoves);
    setRemainingMoves(newRemainingMoves);
  };

  return (
    <main className="container prob-container-single">
      <Card sx={{ p: 2 }}>
        <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mb: 1 }}>시즈나이트 등급</Typography>
        <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
          <ModeSegment mode={rewardMode} onChange={setRewardMode} />
        </Box>

        <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mb: 1 }}>보상 보드 (클릭하여 현재 위치 선택)</Typography>
        <Board 
          current={position} 
          rewards={rewardArray} 
          onCellClick={handleBoardClick}
          clickable={true}
        />

        <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mt: 2, mb: 1 }}>잔여 횟수 (클릭하여 선택)</Typography>
        <MovesProgress 
          used={manualMoveLimit - remainingMoves} 
          total={manualMoveLimit} 
          gameOver={false}
          onCellClick={handleMovesClick}
          clickable={true}
          blinkIndex={blinkMoveIndex}
        />

        <Box sx={{ mt: 2 }}>
          <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mb: 1 }}>선택지 (최고 확률 강조)</Typography>
          
          {/* 테이블 형식으로 구성 */}
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1.5 }}>
            {/* 첫 번째 행: 잔여 횟수 슬라이더 */}
            <Box>{/* 1번 선택지는 잔여 횟수 없음 */}</Box>
            <Card sx={{ px: 1, py: 0.5, bgcolor: 'background.default' }}>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mb: 0, fontSize: '0.6rem' }}>
                세공 잔여: {choice2Remain}
              </Typography>
              <Slider
                size="small"
                value={3 - choice2Remain}
                onChange={(e, newValue) => setChoice2Remain(3 - newValue)}
                min={0}
                max={3}
                step={1}
                marks={[
                  { value: 0, label: '3' },
                  { value: 1, label: '2' },
                  { value: 2, label: '1' },
                  { value: 3, label: '0' },
                ]}
                sx={{ 
                  mt: 0,
                  mb: -0.5,
                  '& .MuiSlider-markLabel': {
                    fontSize: '0.6rem',
                    top: '20px',
                  },
                  '& .MuiSlider-thumb': {
                    width: 14,
                    height: 14,
                  }
                }}
              />
            </Card>
            <Card sx={{ px: 1, py: 0.5, bgcolor: 'background.default' }}>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mb: 0, fontSize: '0.6rem' }}>
                안정제 잔여: {choice3Remain}
              </Typography>
              <Slider
                size="small"
                value={3 - choice3Remain}
                onChange={(e, newValue) => setChoice3Remain(3 - newValue)}
                min={0}
                max={3}
                step={1}
                marks={[
                  { value: 0, label: '3' },
                  { value: 1, label: '2' },
                  { value: 2, label: '1' },
                  { value: 3, label: '0' },
                ]}
                sx={{ 
                  mt: 0,
                  mb: -0.5,
                  '& .MuiSlider-markLabel': {
                    fontSize: '0.6rem',
                    top: '20px',
                  },
                  '& .MuiSlider-thumb': {
                    width: 14,
                    height: 14,
                  }
                }}
              />
            </Card>

            {/* 두 번째 행: 선택지 버튼 */}
            {probabilityResults.map((res) => {
              const getButtonColor = () => {
                if (res.choice.id === '1') return 'primary';
                if (res.choice.id === '2') return 'warning';
                if (res.choice.id === '3') return 'secondary';
                return 'primary';
              };

              return (
                <Box
                  key={res.choice.id}
                  sx={{
                    ...(res.isBest
                      ? {
                          boxShadow: '0 0 0 2px #facc15',
                          borderRadius: '10px 10px 0 0',
                          overflow: 'hidden',
                        }
                      : {}),
                  }}
                >
                  <Button
                    variant="contained"
                    color={getButtonColor()}
                    disabled={res.disabled}
                    title={res.disabled ? res.reason : undefined}
                    fullWidth
                    sx={{
                      whiteSpace: 'pre-line',
                      minHeight: 80,
                      borderRadius: !res.disabled ? '10px 10px 0 0' : '10px',
                      position: 'relative',
                    }}
                  >
                    {getButtonText(res.choice.id, 3 - choice2Remain, 3 - choice3Remain)}
                    {res.isBest && (
                      <Chip
                        label="최고 확률"
                        size="small"
                        sx={{
                          position: 'absolute',
                          top: 8,
                          right: 8,
                          bgcolor: '#facc15',
                          color: '#000',
                          fontWeight: 600,
                        }}
                      />
                    )}
                  </Button>
                </Box>
              );
            })}

            {/* 세 번째 행: 확률 표시 */}
            {probabilityResults.map((res) => (
              <Box key={`prob-${res.choice.id}`}>
                {!res.disabled && (
                  <Card sx={{ p: 2, borderRadius: '0 0 10px 10px', textAlign: 'center', bgcolor: 'background.paper' }}>
                    <Typography variant="h5" sx={{ fontFamily: 'monospace', fontWeight: 'bold' }}>
                      {(res.probability * 100).toFixed(2)}%
                    </Typography>
                  </Card>
                )}
                {res.disabled && (
                  <Typography variant="caption" color="error" sx={{ textAlign: 'center', p: 1, display: 'block' }}>
                    {res.reason}
                  </Typography>
                )}
              </Box>
            ))}
          </Box>
        </Box>
      </Card>
    </main>
  );
}


function ViewToggle({ view, onChange }) {
  return (
    <ToggleButtonGroup
      value={view}
      exclusive
      onChange={(e, newView) => {
        if (newView !== null) {
          onChange(newView);
        }
      }}
      aria-label="뷰 전환"
      sx={{ mt: 2 }}
    >
      <ToggleButton value="game">게임 플레이</ToggleButton>
      <ToggleButton value="prob">확률 계산</ToggleButton>
    </ToggleButtonGroup>
  );
}

export default function App() {
  const game = useGame();
  const [view, setView] = useState('game');
  const [page, setPage] = useState('main'); // 'main' or 'puzzle'

  if (page === 'puzzle') {
    return (
      <>
        <header>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h4" component="h1">🍪 CookieRun:TOA - 잊혀진 기억의 제단 🍪</Typography>
            <Button variant="contained" onClick={() => setPage('main')}>
              🪨시즈나이트 광산으로 돌아가기
            </Button>
          </Box>
        </header>
        <PuzzlePage />
      </>
    );
  }

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <header>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h4" component="h1">🍪 CookieRun:TOA - 시즈나이트 깍기 시뮬레이터 🍪</Typography>
          <Button variant="contained" color="primary" onClick={() => setPage('puzzle')} sx={{ ml: 'auto' }}>
            🕯️잊혀진 기억의 제단으로 돌아가기
          </Button>
        </Box>
        <ViewToggle view={view} onChange={setView} />
      </header>

      {view === 'game' ? <GameView game={game} /> : <ProbabilityTool />}
    </ThemeProvider>
  );
}

