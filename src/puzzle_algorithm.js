// 백트래킹 + 휴리스틱 최적화 알고리즘
// 퍼즐 조각 배치 최적화

export function findBestCombinationWithBacktracking(
  board,
  pieces,
  job,
  jobAttributes,
  RARITY_SCORES,
  canPlacePiece,
  placePiece,
  calculateScore
) {
  const openCells = [];
  for (let row = 0; row < 7; row++) {
    for (let col = 0; col < 7; col++) {
      if (board[row][col] === 1) {
        openCells.push({ row, col });
      }
    }
  }
  const totalOpenCells = openCells.length;

  // 조각 우선순위 정렬 (휴리스틱)
  const sortedPieces = [...pieces]
    .filter(p => p.shapeCoords)
    .sort((a, b) => {
      // 1순위: 역할군 일치 여부
      const aMatches = jobAttributes.includes(a.attribute) || a.attribute === job || a.attribute === '전 역할군';
      const bMatches = jobAttributes.includes(b.attribute) || b.attribute === job || b.attribute === '전 역할군';
      if (aMatches !== bMatches) return bMatches ? 1 : -1;
      
      // 2순위: 칸당 점수
      const scoreA = RARITY_SCORES[a.rarity];
      const scoreB = RARITY_SCORES[b.rarity];
      if (scoreA !== scoreB) return scoreB - scoreA;
      
      // 3순위: 크기
      return b.size - a.size;
    });

  // 상한 계산 (가지치기용)
  const calculateUpperBound = (currentScore, remainingPieces, remainingCells, currentAttributeCounts, usedUnique) => {
    if (remainingPieces.length === 0 || remainingCells <= 0) {
      return currentScore;
    }
    
    let estimatedScore = currentScore;
    let estimatedCells = 0;
    let estimatedAttrCounts = { ...currentAttributeCounts };
    let estimatedUnique = usedUnique;
    
    for (const piece of remainingPieces) {
      if (piece.rarity === '유니크' && estimatedUnique >= 1) continue;
      if (estimatedCells + piece.size > remainingCells) continue;
      
      estimatedScore += RARITY_SCORES[piece.rarity] * piece.size;
      estimatedCells += piece.size;
      
      if (piece.size <= 5 && piece.attribute && jobAttributes.includes(piece.attribute)) {
        estimatedAttrCounts[piece.attribute] = (estimatedAttrCounts[piece.attribute] || 0) + piece.size;
      }
      
      if (piece.rarity === '유니크') estimatedUnique++;
    }
    
    // 보너스 점수 추가
    let bonusScore = 0;
    Object.entries(estimatedAttrCounts).forEach(([attr, count]) => {
      if (jobAttributes.includes(attr)) {
        if (count >= 9) bonusScore += 265;
        if (count >= 12) bonusScore += 265;
        if (count >= 15) bonusScore += 265;
        if (count >= 18) bonusScore += 265;
        if (count >= 21) bonusScore += 265;
      }
    });
    
    return estimatedScore + bonusScore;
  };

  let bestScore = 0;
  let bestPlacement = [];
  let searchCount = 0;
  const MAX_SEARCH = 500000;
  const startTime = Date.now();
  const MAX_TIME = 10000; // 10초

  // 백트래킹
  const backtrack = (pieceIndex, currentPlaced, usedCells, currentAttributeCounts, usedUnique) => {
    searchCount++;
    
    if (Date.now() - startTime > MAX_TIME || searchCount > MAX_SEARCH) {
      return;
    }
    
    const currentScore = calculateScore(currentPlaced, board).totalScore;
    
    // 가지치기
    const remainingPieces = sortedPieces.slice(pieceIndex);
    const remainingCells = totalOpenCells - usedCells.size;
    const upperBound = calculateUpperBound(
      currentScore,
      remainingPieces,
      remainingCells,
      currentAttributeCounts,
      usedUnique
    );
    
    if (upperBound <= bestScore) {
      return;
    }
    
    // 최고 점수 갱신
    if (currentScore > bestScore) {
      bestScore = currentScore;
      bestPlacement = [...currentPlaced];
      console.log(`새로운 최고 점수: ${bestScore}점`);
    }
    
    if (pieceIndex >= sortedPieces.length || remainingCells <= 0) {
      return;
    }
    
    const piece = sortedPieces[pieceIndex];
    
    // 유니크 제한
    if (piece.rarity === '유니크' && usedUnique >= 1) {
      backtrack(pieceIndex + 1, currentPlaced, usedCells, currentAttributeCounts, usedUnique);
      return;
    }
    
    // 이 조각을 배치하지 않고 건너뛰기
    backtrack(pieceIndex + 1, currentPlaced, usedCells, currentAttributeCounts, usedUnique);
    
    // 배치 가능한 위치 찾기
    const possiblePositions = [];
    for (const { row, col } of openCells) {
      if (canPlacePiece(piece, row, col, usedCells)) {
        possiblePositions.push({ row, col });
      }
    }
    
    if (possiblePositions.length === 0) {
      return;
    }
    
    // 중앙에 가까운 위치 우선 (휴리스틱)
    possiblePositions.sort((a, b) => {
      const distA = Math.abs(a.row - 3) + Math.abs(a.col - 3);
      const distB = Math.abs(b.row - 3) + Math.abs(b.col - 3);
      return distA - distB;
    });
    
    // 최대 3개 위치만 시도
    const maxPositions = Math.min(3, possiblePositions.length);
    
    for (let i = 0; i < maxPositions; i++) {
      if (Date.now() - startTime > MAX_TIME || searchCount > MAX_SEARCH) {
        return;
      }
      
      const { row, col } = possiblePositions[i];
      const newUsedCells = new Set(usedCells);
      const placedCells = placePiece(piece, row, col, newUsedCells);
      
      const newPlaced = [...currentPlaced, {
        ...piece,
        position: { row, col },
        placedCells,
      }];
      
      const newAttributeCounts = { ...currentAttributeCounts };
      if (piece.size <= 5 && piece.attribute && jobAttributes.includes(piece.attribute)) {
        newAttributeCounts[piece.attribute] = (newAttributeCounts[piece.attribute] || 0) + piece.size;
      }
      
      const newUsedUnique = usedUnique + (piece.rarity === '유니크' ? 1 : 0);
      
      backtrack(pieceIndex + 1, newPlaced, newUsedCells, newAttributeCounts, newUsedUnique);
    }
  };

  // 초기 상태
  const initialAttributeCounts = {
    광휘: 0, 관통: 0, 원소: 0, 파쇄: 0,
    축복: 0, 낙인: 0, 재생: 0,
  };
  
  console.log('=== 백트래킹 + 휴리스틱 최적화 시작 ===');
  console.log(`조각 수: ${sortedPieces.length}개`);
  
  backtrack(0, [], new Set(), initialAttributeCounts, 0);
  
  console.log(`탐색 완료: ${searchCount}회, ${(Date.now() - startTime) / 1000}초`);
  console.log(`최고 점수: ${bestScore}점`);
  
  return {
    placedPieces: bestPlacement,
    score: bestScore,
  };
}

