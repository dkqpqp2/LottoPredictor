export type CardDirection = "up" | "down" | "left" | "right";

export const DIRECTION_LABELS: Record<CardDirection, string> = {
  up: "위",
  down: "아래",
  left: "왼쪽",
  right: "오른쪽",
};

export interface TarotCard {
  number: number;
  nameEn: string;
  nameKo: string;
  keyword: string;
  fortunes: Record<CardDirection, string>;
}

export const TAROT_CARDS: TarotCard[] = [
  {
    number: 0,
    nameEn: "The Fool",
    nameKo: "바보",
    keyword: "새로운 시작",
    fortunes: {
      up: "새로운 문이 열립니다 — 두려움 없이 첫걸음을 내디뎌 보세요.",
      down: "지금 이 순간에 집중하면 안정감을 찾을 수 있어요.",
      left: "과거의 경험이 지금의 선택에 힌트를 줍니다.",
      right: "작은 행동 하나가 예상치 못한 변화를 만듭니다.",
    },
  },
  {
    number: 1,
    nameEn: "The Magician",
    nameKo: "마법사",
    keyword: "창조, 의지",
    fortunes: {
      up: "원하는 것을 이룰 힘이 이미 당신 안에 있습니다.",
      down: "지금 가진 것들을 잘 활용하면 충분합니다.",
      left: "예전에 배운 기술이 다시 쓸모를 찾을 시기예요.",
      right: "생각만 하지 말고 지금 바로 시도해 보세요.",
    },
  },
  {
    number: 2,
    nameEn: "The High Priestess",
    nameKo: "여사제",
    keyword: "직관, 신비",
    fortunes: {
      up: "직감이 이끄는 방향으로 한 걸음 나아가 보세요.",
      down: "말보다 침묵 속에서 답을 찾게 될 거예요.",
      left: "무의식 깊은 곳의 기억이 실마리가 됩니다.",
      right: "숨겨진 정보가 곧 드러날 준비를 하고 있어요.",
    },
  },
  {
    number: 3,
    nameEn: "The Empress",
    nameKo: "여황제",
    keyword: "풍요, 성장",
    fortunes: {
      up: "풍요로움이 자라나는 시기, 여유를 가지세요.",
      down: "지금 가꾸고 있는 것들이 튼튼하게 뿌리내리는 중이에요.",
      left: "예전에 심어둔 노력이 결실을 맺을 준비를 합니다.",
      right: "새로운 관계나 기회가 자연스럽게 다가옵니다.",
    },
  },
  {
    number: 4,
    nameEn: "The Emperor",
    nameKo: "황제",
    keyword: "안정, 권위",
    fortunes: {
      up: "체계를 세우면 목표에 더 가까워집니다.",
      down: "흔들리지 않는 기반이 지금의 가장 큰 힘이에요.",
      left: "예전의 원칙이 지금도 여전히 유효합니다.",
      right: "결단력 있게 이끌어야 할 순간이 왔어요.",
    },
  },
  {
    number: 5,
    nameEn: "The Hierophant",
    nameKo: "교황",
    keyword: "전통, 가르침",
    fortunes: {
      up: "배움의 기회를 놓치지 마세요.",
      down: "익숙한 방식이 지금은 가장 안전한 길입니다.",
      left: "오래된 조언 속에 답이 숨어 있을 수 있어요.",
      right: "새로운 규칙이나 방식을 받아들여 보세요.",
    },
  },
  {
    number: 6,
    nameEn: "The Lovers",
    nameKo: "연인",
    keyword: "선택, 관계",
    fortunes: {
      up: "마음이 이끄는 선택이 곧 옳은 선택일 수 있어요.",
      down: "지금의 관계에 집중하면 안정을 찾습니다.",
      left: "예전의 인연이 다시 의미를 갖게 될 수도 있어요.",
      right: "중요한 결정을 내려야 할 시기가 다가옵니다.",
    },
  },
  {
    number: 7,
    nameEn: "The Chariot",
    nameKo: "전차",
    keyword: "의지, 전진",
    fortunes: {
      up: "목표를 향해 거침없이 나아갈 때입니다.",
      down: "속도보다 방향을 먼저 점검해 보세요.",
      left: "지금까지의 노력이 곧 추진력이 됩니다.",
      right: "과감하게 밀어붙이면 원하는 걸 얻을 수 있어요.",
    },
  },
  {
    number: 8,
    nameEn: "Strength",
    nameKo: "힘",
    keyword: "용기, 인내",
    fortunes: {
      up: "부드러움이 강함을 이기는 순간이 옵니다.",
      down: "묵묵히 버티는 힘이 지금 가장 중요해요.",
      left: "예전에 극복했던 어려움이 자신감의 근거가 됩니다.",
      right: "두려움을 마주하면 예상보다 쉽게 풀립니다.",
    },
  },
  {
    number: 9,
    nameEn: "The Hermit",
    nameKo: "은둔자",
    keyword: "성찰, 탐구",
    fortunes: {
      up: "혼자만의 시간이 답을 찾는 데 도움이 됩니다.",
      down: "잠시 멈춰서 지금을 돌아보는 것도 좋아요.",
      left: "지난 경험을 곱씹을 때 통찰이 떠오릅니다.",
      right: "혼자 내린 결정이 의외로 좋은 결과를 가져와요.",
    },
  },
  {
    number: 10,
    nameEn: "Wheel of Fortune",
    nameKo: "운명의 수레바퀴",
    keyword: "전환, 순환",
    fortunes: {
      up: "흐름이 좋은 쪽으로 바뀌고 있습니다.",
      down: "지금의 안정도 결국 순환의 일부예요.",
      left: "예전의 상황이 다시 반복될 조짐이 보입니다.",
      right: "예상치 못한 전환점이 곧 찾아올 수 있어요.",
    },
  },
  {
    number: 11,
    nameEn: "Justice",
    nameKo: "정의",
    keyword: "균형, 인과",
    fortunes: {
      up: "공정한 결과가 곧 따라올 거예요.",
      down: "균형 잡힌 선택이 지금 가장 필요합니다.",
      left: "과거의 행동에 대한 결과가 돌아오는 시기입니다.",
      right: "결단을 내리면 명확한 답을 얻게 됩니다.",
    },
  },
  {
    number: 12,
    nameEn: "The Hanged Man",
    nameKo: "매달린 사람",
    keyword: "관점 전환, 기다림",
    fortunes: {
      up: "관점을 바꿔보면 새로운 게 보일 거예요.",
      down: "지금은 기다림이 최선의 전략입니다.",
      left: "예전엔 몰랐던 걸 다시 보게 될 수 있어요.",
      right: "조급해하지 않는 것이 오히려 도움이 됩니다.",
    },
  },
  {
    number: 13,
    nameEn: "Death",
    nameKo: "죽음",
    keyword: "끝과 시작",
    fortunes: {
      up: "끝난 자리에서 새로운 시작이 열립니다.",
      down: "변화를 받아들이면 마음이 오히려 편해져요.",
      left: "지나간 일에 미련을 두지 않아도 괜찮아요.",
      right: "지금 필요한 건 과감한 정리예요.",
    },
  },
  {
    number: 14,
    nameEn: "Temperance",
    nameKo: "절제",
    keyword: "조화, 균형",
    fortunes: {
      up: "균형을 맞추면 흐름이 자연스러워집니다.",
      down: "서두르지 않아도 결국 조화를 이룰 거예요.",
      left: "예전 방식과 새로운 방식을 함께 써보세요.",
      right: "적당한 타협이 예상보다 좋은 결과를 만듭니다.",
    },
  },
  {
    number: 15,
    nameEn: "The Devil",
    nameKo: "악마",
    keyword: "유혹, 속박",
    fortunes: {
      up: "얽매인 것에서 벗어날 용기가 필요합니다.",
      down: "익숙한 유혹에 흔들리지 않는 게 중요해요.",
      left: "반복되던 습관을 돌아볼 시점이에요.",
      right: "지금이야말로 매듭을 끊어낼 때입니다.",
    },
  },
  {
    number: 16,
    nameEn: "The Tower",
    nameKo: "탑",
    keyword: "급변, 깨달음",
    fortunes: {
      up: "예상 밖의 변화가 결국 더 나은 길을 엽니다.",
      down: "흔들려도 무너지지 않는 게 핵심이에요.",
      left: "이미 예견됐던 균열이 드러나는 시기입니다.",
      right: "갑작스러운 사건이 오히려 전화위복이 될 수 있어요.",
    },
  },
  {
    number: 17,
    nameEn: "The Star",
    nameKo: "별",
    keyword: "희망, 영감",
    fortunes: {
      up: "희망을 잃지 않으면 좋은 신호가 이어집니다.",
      down: "지금의 소망이 조용히 이루어지고 있어요.",
      left: "예전에 품었던 꿈이 다시 떠오를 시점입니다.",
      right: "영감이 떠오르면 바로 행동으로 옮겨보세요.",
    },
  },
  {
    number: 18,
    nameEn: "The Moon",
    nameKo: "달",
    keyword: "불안, 잠재의식",
    fortunes: {
      up: "불안함 속에서도 답은 서서히 드러납니다.",
      down: "확실하지 않아도 지금은 그대로 괜찮아요.",
      left: "무의식 속 감정을 들여다볼 필요가 있어요.",
      right: "혼란스러운 상황이 곧 정리되기 시작합니다.",
    },
  },
  {
    number: 19,
    nameEn: "The Sun",
    nameKo: "태양",
    keyword: "성공, 활력",
    fortunes: {
      up: "밝은 기운이 앞으로의 흐름을 채웁니다.",
      down: "지금 이대로도 충분히 만족스러운 상태예요.",
      left: "예전의 노력이 이제야 빛을 보게 됩니다.",
      right: "자신 있게 나서면 좋은 결과가 따라와요.",
    },
  },
  {
    number: 20,
    nameEn: "Judgement",
    nameKo: "심판",
    keyword: "각성, 부활",
    fortunes: {
      up: "새로운 국면으로 넘어갈 준비가 됐습니다.",
      down: "지금의 선택을 스스로 인정해줘도 괜찮아요.",
      left: "지난 일들을 되돌아보면 답이 명확해집니다.",
      right: "결단의 순간, 자신을 믿고 나아가세요.",
    },
  },
  {
    number: 21,
    nameEn: "The World",
    nameKo: "세계",
    keyword: "완성, 성취",
    fortunes: {
      up: "하나의 여정이 완성되는 순간이 다가옵니다.",
      down: "지금까지 쌓아온 것들이 안정적으로 자리잡습니다.",
      left: "지나온 과정 전체가 지금의 결실을 만들었어요.",
      right: "새로운 챕터로 넘어갈 자신감을 가지세요.",
    },
  },
];

export function shuffleCards(cards: TarotCard[]): TarotCard[] {
  const result = [...cards];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
