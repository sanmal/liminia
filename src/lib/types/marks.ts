// =============================================================================
// WorldMark System v3 (8 Marks)
// =============================================================================

export const WORLD_MARK = {
  NONE: 0,
  BONE: 1, // 骨 - Structure, Defense
  BLOOD: 2, // 血 - Life Force, Combat
  BREATH: 3, // 息 - Communication, Trade
  TEAR: 4, // 涙 - Emotion, Healing
  EYE: 5, // 眼 - Knowledge, Perception
  SHADOW: 6, // 影 - Stealth, Deception
  EAR: 7, // 耳 - Hearing, Music
  SKIN: 8, // 肌 - Touch, Crafting
} as const;

export type WorldMarkType = (typeof WORLD_MARK)[keyof typeof WORLD_MARK];

// =============================================================================
// WorldMark Metadata
// =============================================================================

export interface WorldMarkInfo {
  id: WorldMarkType;
  nameJa: string;
  nameEn: string;
  domain: string;
  relatedSkills: string[];
}

export const WORLD_MARK_INFO: Record<WorldMarkType, WorldMarkInfo> = {
  [WORLD_MARK.NONE]: {
    id: WORLD_MARK.NONE,
    nameJa: '無',
    nameEn: 'None',
    domain: '',
    relatedSkills: [],
  },
  [WORLD_MARK.BONE]: {
    id: WORLD_MARK.BONE,
    nameJa: '骨',
    nameEn: 'Bone',
    domain: 'Structure, Defense',
    relatedSkills: ['Heavy Armor', 'Construction', 'Endurance'],
  },
  [WORLD_MARK.BLOOD]: {
    id: WORLD_MARK.BLOOD,
    nameJa: '血',
    nameEn: 'Blood',
    domain: 'Life Force, Combat',
    relatedSkills: ['Weapons', 'Hunting', 'Athletics'],
  },
  [WORLD_MARK.BREATH]: {
    id: WORLD_MARK.BREATH,
    nameJa: '息',
    nameEn: 'Breath',
    domain: 'Communication, Trade',
    relatedSkills: ['Negotiation', 'Language', 'Commerce'],
  },
  [WORLD_MARK.TEAR]: {
    id: WORLD_MARK.TEAR,
    nameJa: '涙',
    nameEn: 'Tear',
    domain: 'Emotion, Healing',
    relatedSkills: ['Medicine', 'Empathy', 'Counseling'],
  },
  [WORLD_MARK.EYE]: {
    id: WORLD_MARK.EYE,
    nameJa: '眼',
    nameEn: 'Eye',
    domain: 'Knowledge, Perception',
    relatedSkills: ['Investigation', 'Magic', 'Scholarship'],
  },
  [WORLD_MARK.SHADOW]: {
    id: WORLD_MARK.SHADOW,
    nameJa: '影',
    nameEn: 'Shadow',
    domain: 'Stealth, Deception',
    relatedSkills: ['Theft', 'Assassination', 'Disguise'],
  },
  [WORLD_MARK.EAR]: {
    id: WORLD_MARK.EAR,
    nameJa: '耳',
    nameEn: 'Ear',
    domain: 'Hearing, Music',
    relatedSkills: ['Performance', 'Detection', 'Language'],
  },
  [WORLD_MARK.SKIN]: {
    id: WORLD_MARK.SKIN,
    nameJa: '肌',
    nameEn: 'Skin',
    domain: 'Touch, Crafting',
    relatedSkills: ['Smithing', 'Massage', 'Tailoring'],
  },
};

// =============================================================================
// Perceptual Triad (Eye-Ear-Skin)
// =============================================================================

export const PERCEPTUAL_MARKS: readonly WorldMarkType[] = [
  WORLD_MARK.EYE,
  WORLD_MARK.EAR,
  WORLD_MARK.SKIN,
] as const;

// =============================================================================
// ReasonMark System (18 Types)
// =============================================================================

export const REASON_MARK = {
  NONE: 0,

  // Positive motivations
  CURIOSITY: 1,
  AMBITION: 2,
  COMPASSION: 3,
  DUTY: 4,
  FAITH: 5,
  LOVE: 6,

  // Neutral motivations
  SURVIVAL: 7,
  HABIT: 8,
  PROFIT: 9,

  // Negative motivations
  FEAR: 10,
  REVENGE: 11,
  GREED: 12,
  PRIDE: 13,
  ENVY: 14,
  DESPERATION: 15,

  // Complex motivations
  LOYALTY: 16,
  GUILT: 17,
  HONOR: 18,
} as const;

export type ReasonMarkType = (typeof REASON_MARK)[keyof typeof REASON_MARK];
