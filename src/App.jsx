import React, { useMemo, useState, useEffect } from 'react';
import { useGame, REWARD_NAMES, REWARD_MODES, clampPosition, getMaxMovesForMode } from './game.js';

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


function ModeSegment({ mode, onChange, label = '보상 모드', inline = false }) {
  const containerStyle = {
    minWidth: inline ? 200 : 160,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'space-between',
  };

  const labelStyle = { marginBottom: 0, whiteSpace: 'nowrap' };
  const selectStyle = inline
    ? { flex: '1 1 auto' }
    : { flex: '0 0 auto', minWidth: 140 };

  return (
    <label className="input-group" style={containerStyle}>
      <select
        className="input"
        value={mode}
        onChange={(e) => onChange(Number(e.target.value))}
        style={selectStyle}
      >
        <option value={1}>슈퍼 에픽</option>
        <option value={2}>유니크</option>
      </select>
    </label>
  );
}

function Board({ current, rewards }) {
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
            style={bg ? { background: bg } : undefined}
          >
            {boom}
          </div>
        );
      })}
    </div>
  );
}

function MovesProgress({ used, total = 8, gameOver = false }) {
  const cells = Array.from({ length: total });
  return (
    <div className="progress" aria-label="moves-progress">
      {cells.map((_, i) => {
        const cls = gameOver
          ? `pCell${i < used ? ' end' : ''}`
          : `pCell${i < used ? ' filled' : ''}`;
        return (
          <React.Fragment key={i}>
            <div className={cls} />
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
      <section className="panel">
        <div className="label" style={{ margin: 8 }}>시즈나이트 등급</div>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
          <div className="row" style={{ gap: 8, alignItems: 'center' }}>
            <ModeSegment mode={game.rewardMode} onChange={handleModeChange} label="시즈나이트 종류" />
            <button className="btn" onClick={game.reset}>초기화</button>
          </div>
        </div>

        <div className="label" style={{ margin: 8 }}>보상 보드</div>
        <Board current={game.currentPosition} rewards={game.rewardArray} />
        <div className="label" style={{ margin: 8 }}>잔여 횟수</div>
        <MovesProgress used={movesUsed} total={moveLimit} gameOver={game.gameOver} />

        <div className="controls" style={{ marginTop: 14 }}>
          <div className="label" style={{ marginBottom: 6 }}>선택지</div>
          <div className="choices" aria-label="선택지">
            {probabilityResults.map((res) => {
              const getButtonClass = () => {
                if (res.choice.id === '1') return 'btn primary';
                if (res.choice.id === '2') return 'btn warn';
                if (res.choice.id === '3') return 'btn success';
                return 'btn';
              };

              const getButtonText = () => {
                if (res.choice.id === '1') return '세게 두드리기\n+3 ~ +6\n무제한';
                if (res.choice.id === '2') {
                  const remain = 3 - game.choice2Used;
                  return `세공하기\n-3 ~ +2\n남은 횟수 : (${remain})`;
                }
                if (res.choice.id === '3') {
                  const remain = 3 - game.choice3Used;
                  return `안정제 사용\n+0 ~ +4\n남은 횟수 : (${remain})`;
                }
                return res.choice.label;
              };

              const wrapperStyle = {
                display: 'flex',
                flexDirection: 'column',
                gap: 0,
                ...(res.isBest
                  ? {
                      boxShadow: '0 0 0 2px #facc15',
                      borderRadius: '10px',
                      overflow: 'hidden',
                      position: 'relative',
                    }
                  : {}),
              };

              return (
                <div key={res.choice.id} style={wrapperStyle}>
                  <button
                    className={getButtonClass()}
                    disabled={res.disabled}
                    onClick={() => {
                      if (res.disabled) return;
                      if (res.choice.id === '1') game.applyMove('1', [3, 6]);
                      if (res.choice.id === '2') game.applyMove('2', [-3, 2]);
                      if (res.choice.id === '3') game.applyMove('3', [0, 4]);
                    }}
                    title={res.disabled ? res.reason : undefined}
                    style={{
                      cursor: res.disabled ? 'not-allowed' : 'pointer',
                      whiteSpace: 'pre-line',
                    }}
                  >
                    {getButtonText()}
                  </button>
                  {!res.disabled && typeof res.probability === 'number' && (
                    <div
                      className="card"
                      style={{
                        padding: '12px',
                        borderRadius: '0 0 10px 10px',
                        marginTop: 0,
                        borderTop: 'none',
                        background: 'var(--panel-2)',
                        textAlign: 'center',
                      }}
                    >
                      <div className="value mono" style={{ fontSize: 18, fontWeight: 'bold' }}>
                        {(res.probability * 100).toFixed(2)}%
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="panel info-panel">
        <div className="card">
          <div className="label">최종 보상</div>
          <div className="value">{game.finalReward == null ? '-' : `${REWARD_NAMES[game.finalReward]}`}</div>
        </div>
      </section>
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

  const rewardArray = REWARD_MODES[rewardMode];
  const manualMoveLimit = getMaxMovesForMode(rewardMode);
  const clampedRemainingMoves = Math.min(remainingMoves, manualMoveLimit);

  useEffect(() => {
    setRemainingMoves(manualMoveLimit);
  }, [rewardMode, manualMoveLimit]);

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

  return (
    <main className="container prob-container-single">
      <section className="panel prob-panel">
        <h2 style={{ margin: '0' }}>상태 입력</h2>

        <div className="label" style={{ margin: 8 }}>시즈나이트 등급</div>
        <div className="row" style={{ gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          <ModeSegment mode={rewardMode} onChange={setRewardMode} />
        </div>

        <div className="label" style={{ marginBottom: 6 }}>보상 보드</div>
        <Board current={position} rewards={rewardArray} />

        <div className="input-grid">
          <NumberInput
            label="현재 위치"
            value={position}
            onChange={(v) => setPosition(v)}
            min={0}
            max={16}
          />
          <NumberInput
            label="잔여 선택 횟수"
            value={remainingMoves}
            onChange={(v) => setRemainingMoves(v)}
            min={0}
            max={manualMoveLimit}
          />
          <NumberInput
            label="2번 잔여 횟수"
            value={choice2Remain}
            onChange={(v) => setChoice2Remain(v)}
            min={0}
            max={3}
          />
          <NumberInput
            label="3번 잔여 횟수"
            value={choice3Remain}
            onChange={(v) => setChoice3Remain(v)}
            min={0}
            max={3}
          />
        </div>

        <div style={{ marginTop: 24 }}>
          <div className="label" style={{ marginBottom: 6 }}>선택지 (최고 확률 강조)</div>
          <div className="choices" aria-label="선택지">
            {probabilityResults.map((res) => {
              const wrapperStyle = {
                display: 'flex',
                flexDirection: 'column',
                gap: 0,
                ...(res.isBest
                  ? {
                      boxShadow: '0 0 0 2px #facc15',
                      borderRadius: '10px',
                      overflow: 'hidden',
                      position: 'relative',
                    }
                  : {}),
              };

              const getButtonClass = () => {
                if (res.choice.id === '1') return 'btn primary';
                if (res.choice.id === '2') return 'btn warn';
                if (res.choice.id === '3') return 'btn success';
                return 'btn';
              };

              const getButtonText = () => {
                if (res.choice.id === '1') return '1번: +3~+6';
                if (res.choice.id === '2') {
                  const remain = choice2Remain;
                  return `2번: -3~+2 (${remain}회 남음)`;
                }
                if (res.choice.id === '3') {
                  const remain = choice3Remain;
                  return `3번: +0~+4 (${remain}회 남음)`;
                }
                return res.choice.label;
              };

              return (
                <div key={res.choice.id} style={wrapperStyle}>
                  <button
                    className={getButtonClass()}
                    disabled={res.disabled}
                    style={{ 
                      cursor: 'default', 
                      width: '100%',
                      borderRadius: !res.disabled ? '10px 10px 0 0' : '10px',
                      borderBottom: !res.disabled ? 'none' : undefined,
                      marginBottom: 0,
                      ...(res.isBest ? { position: 'relative' } : {})
                    }}
                    title={res.disabled ? res.reason : undefined}
                  >
                    {getButtonText()}
                    {res.isBest && (
                      <span
                        className="chip"
                        style={{
                          position: 'absolute',
                          top: 8,
                          right: 8,
                          background: '#facc15',
                          color: '#000',
                          fontWeight: 600,
                        }}
                      >
                        최고 확률
                      </span>
                    )}
                  </button>
                  {!res.disabled && (
                    <div className="card" style={{ 
                      padding: '16px', 
                      borderRadius: '0 0 10px 10px', 
                      marginTop: 0, 
                      borderTop: 'none',
                      background: 'var(--panel-2)',
                      textAlign: 'center',
                    }}>
                      <div className="value mono" style={{ fontSize: 24, fontWeight: 'bold' }}>
                        {(res.probability * 100).toFixed(2)}%
                      </div>
                    </div>
                  )}
                  {res.disabled && (
                    <div className="label" style={{ color: '#f87171', fontSize: 12, textAlign: 'center', padding: '8px' }}>
                      {res.reason}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </main>
  );
}

function NumberInput({ label, value, onChange, min, max }) {
  return (
    <label className="input-group">
      <span className="label">{label}</span>
      <input
        className="input"
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => {
          const num = Number(e.target.value);
          const clamped = Number.isNaN(num) ? min : Math.min(Math.max(num, min), max);
          onChange(clamped);
        }}
      />
    </label>
  );
}

function ViewToggle({ view, onChange }) {
  const tabs = [
    { id: 'game', label: '게임 플레이' },
    { id: 'prob', label: '확률 계산' },
  ];

  return (
    <div className="seg view-toggle" role="tablist" aria-label="뷰 전환">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={view === tab.id}
          className={view === tab.id ? 'active' : ''}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export default function App() {
  const game = useGame();
  const [view, setView] = useState('game');

  return (
    <>
      <header>
        <h1>🍪 CookieRun:TOA - 시즈나이트 깍기 시뮬레이터 🍪</h1>
        <ViewToggle view={view} onChange={setView} />
      </header>

      {view === 'game' ? <GameView game={game} /> : <ProbabilityTool />}
    </>
  );
}

