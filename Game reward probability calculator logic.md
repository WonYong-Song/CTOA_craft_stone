import React, { useState, useEffect } from 'react';

function calculateBestRewardProbability(currentPos, remainingTurns, remaining2, remaining3, rewardMode) {
  const rewards = rewardMode === 1 
    ? [0,2,2,2,2,2,2,2,2,2,3,3,3,2,2,4,2]
    : [0,3,3,3,3,3,3,3,3,3,3,3,3,3,3,4,2];
  
  const bestReward = Math.max(...rewards);
  const bestRewardPositions = rewards
    .map((r, i) => r === bestReward ? i : -1)
    .filter(i => i >= 0);
  
  const memo = new Map();
  
  function getKey(pos, turns, r2, r3) {
    return `${pos},${turns},${r2},${r3}`;
  }
  
  function getProbability(pos, turns, r2, r3) {
    if (turns === 0 || pos >= 16) {
      const finalPos = Math.min(pos, 16);
      return rewards[finalPos] === bestReward ? 1.0 : 0.0;
    }
    
    const key = getKey(pos, turns, r2, r3);
    if (memo.has(key)) {
      return memo.get(key);
    }
    
    let maxProb = 0;
    
    let prob1 = 0;
    for (let move = 3; move <= 6; move++) {
      const newPos = Math.min(pos + move, 16);
      prob1 += 0.25 * getProbability(newPos, turns - 1, r2, r3);
    }
    maxProb = Math.max(maxProb, prob1);
    
    if (r2 > 0) {
      let prob2 = 0;
      for (let move = -3; move <= 2; move++) {
        const newPos = Math.max(0, Math.min(pos + move, 16));
        prob2 += (1/6) * getProbability(newPos, turns - 1, r2 - 1, r3);
      }
      maxProb = Math.max(maxProb, prob2);
    }
    
    if (r3 > 0) {
      let prob3 = 0;
      for (let move = 0; move <= 4; move++) {
        const newPos = Math.min(pos + move, 16);
        prob3 += 0.2 * getProbability(newPos, turns - 1, r2, r3 - 1);
      }
      maxProb = Math.max(maxProb, prob3);
    }
    
    memo.set(key, maxProb);
    return maxProb;
  }
  
  function getChoiceProbability(choice) {
    let totalProb = 0;
    
    if (choice === 1) {
      for (let move = 3; move <= 6; move++) {
        const newPos = Math.min(currentPos + move, 16);
        totalProb += 0.25 * getProbability(newPos, remainingTurns - 1, remaining2, remaining3);
      }
    } else if (choice === 2 && remaining2 > 0) {
      for (let move = -3; move <= 2; move++) {
        const newPos = Math.max(0, Math.min(currentPos + move, 16));
        totalProb += (1/6) * getProbability(newPos, remainingTurns - 1, remaining2 - 1, remaining3);
      }
    } else if (choice === 3 && remaining3 > 0) {
      for (let move = 0; move <= 4; move++) {
        const newPos = Math.min(currentPos + move, 16);
        totalProb += 0.2 * getProbability(newPos, remainingTurns - 1, remaining2, remaining3 - 1);
      }
    }
    
    return totalProb;
  }
  
  return {
    choice1: getChoiceProbability(1),
    choice2: remaining2 > 0 ? getChoiceProbability(2) : null,
    choice3: remaining3 > 0 ? getChoiceProbability(3) : null,
    bestReward: bestReward,
    bestRewardPositions: bestRewardPositions,
    rewards: rewards
  };
}

export default function RewardCalculator() {
  const [result, setResult] = useState(null);
  
  useEffect(() => {
    const calculated = calculateBestRewardProbability(0, 8, 3, 3, 1);
    setResult(calculated);
  }, []);
  
  if (!result) return <div className="p-8">계산 중...</div>;
  
  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">보상 확률 계산 결과</h1>
      
      <div className="bg-blue-50 p-4 rounded-lg mb-6">
        <h2 className="text-xl font-semibold mb-2">입력 정보</h2>
        <p>현재 위치: 0칸</p>
        <p>잔여 선택 횟수: 8회</p>
        <p>2번 선택지 잔여: 3회</p>
        <p>3번 선택지 잔여: 3회</p>
        <p>보상 모드: 1</p>
      </div>
      
      <div className="bg-green-50 p-4 rounded-lg mb-6">
        <h2 className="text-xl font-semibold mb-2">보상 정보</h2>
        <p className="mb-2">보상 배열: {JSON.stringify(result.rewards)}</p>
        <p className="text-lg font-bold text-green-700">최고 보상: {result.bestReward}</p>
        <p className="text-green-700">최고 보상 위치: {result.bestRewardPositions.join(', ')}칸</p>
      </div>
      
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold mb-4">각 선택지별 최고 보상 도달 확률</h2>
        
        <div className="bg-purple-50 p-6 rounded-lg border-2 border-purple-300">
          <h3 className="text-xl font-bold mb-2">선택지 1 (3~6칸 이동)</h3>
          <p className="text-3xl font-bold text-purple-700">
            {(result.choice1 * 100).toFixed(2)}%
          </p>
        </div>
        
        {result.choice2 !== null && (
          <div className="bg-orange-50 p-6 rounded-lg border-2 border-orange-300">
            <h3 className="text-xl font-bold mb-2">선택지 2 (-3~2칸 이동)</h3>
            <p className="text-3xl font-bold text-orange-700">
              {(result.choice2 * 100).toFixed(2)}%
            </p>
          </div>
        )}
        
        {result.choice3 !== null && (
          <div className="bg-cyan-50 p-6 rounded-lg border-2 border-cyan-300">
            <h3 className="text-xl font-bold mb-2">선택지 3 (0~4칸 이동)</h3>
            <p className="text-3xl font-bold text-cyan-700">
              {(result.choice3 * 100).toFixed(2)}%
            </p>
          </div>
        )}
      </div>
      
      <div className="mt-6 text-sm text-gray-600">
        <p>* 각 선택지를 선택한 후 이후 항상 최적의 선택을 한다고 가정한 확률입니다.</p>
      </div>
    </div>
  );
}