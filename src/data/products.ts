export type Gauge = 0 | 1 | 2 | 3 | 4
export type ProductMeta = {
  id: 1|2|3|4|5
  name: string
  description: string
  sweet: Gauge
  cool: Gauge
  hit: Gauge
  img: string     // ✅ 썸네일 경로
}

export const PRODUCTS: ProductMeta[] = [
  { id: 1, name: '아쌉보이',
    description: '매실 베이스 말레이시아 전통 음료 ‘아쌉보이’를 \n새롭게 재해석한 맛.',
    sweet: 3, cool: 3, hit: 4,
    img: './product/1.png'
  },
  { id: 2, name: '베이비 파인애플',
    description: '열대 바람 품은 베이비 파인애플의 \n달콤함과 상큼함이 살아있는 맛.',
    sweet: 3, cool: 4, hit: 4,
    img: './product/2.png'
  },
  { id: 3, name: '정글망고',
    description: '일반 망고보다 한층 더 진하고 \n부드러운 향과 맛이 매력적인 맛.',
    sweet: 4, cool: 3, hit: 4,
    img: './product/3.png'
  },
  { id: 4, name: '땡큐 베리',
    description: '다양한 베리류의 상큼함과 달콤함이 조화를 이루는 맛.',
    sweet: 4, cool: 3, hit: 4,
    img: './product/4.png'
  },
  { id: 5, name: '제로 콜라',
    description: '레몬콜라에 이어, ASDF만의 \n톡톡 튀는 시그니처 콜라 맛.',
    sweet: 4, cool: 4, hit: 4,
    img: './product/5.png'
  },
]
