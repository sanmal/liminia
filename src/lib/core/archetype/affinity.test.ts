import { describe, it, expect, beforeEach } from 'vitest';
import {
  computeArchetypeCompatibility,
  computeEntityArchetypeAffinity,
  areOppositeAxes,
  sameMotivationCategory,
} from './affinity';
import { createArchetypeStorage } from './storage';
import { initializeDefaultArchetypes } from './definitions';
import { createTagStorage } from '../tags/storage';
import {
  setDirection,
  setAxis,
  setAxis2,
  setMotivation,
  setWorldMark,
} from '../tags/accessors';
import { createEntityStorage } from '../entity/storage';
import { createEntity } from '../entity/lifecycle';
import { ARCHETYPE } from '$lib/types/archetype';
import type { ArchetypeStorage } from '$lib/types/archetype';
import type { TagStorage } from '$lib/types/tags';
import type { EntityStorage } from '$lib/types/entity';
import { archetypeId } from '$lib/types/brand';
import { DIRECTION_TAG, AXIS_TAG, MOTIVATION_TAG } from '$lib/types/tags';
import { WORLD_MARK } from '$lib/types/marks';
import { CATEGORY } from '$lib/types/constants';

describe('areOppositeAxes', () => {
  it('should detect ORDER-CHAOS as opposite', () => {
    expect(areOppositeAxes(AXIS_TAG.ORDER, AXIS_TAG.CHAOS)).toBe(true);
  });

  it('should detect INTRO-EXTRA as opposite', () => {
    expect(areOppositeAxes(AXIS_TAG.INTRO, AXIS_TAG.EXTRA)).toBe(true);
  });

  it('should detect STABLE-REACTIVE as opposite', () => {
    expect(areOppositeAxes(AXIS_TAG.STABLE, AXIS_TAG.REACTIVE)).toBe(true);
  });

  it('should detect CAUTIOUS-BOLD as opposite', () => {
    expect(areOppositeAxes(AXIS_TAG.CAUTIOUS, AXIS_TAG.BOLD)).toBe(true);
  });

  it('should detect SELF-OTHERS as opposite', () => {
    expect(areOppositeAxes(AXIS_TAG.SELF, AXIS_TAG.OTHERS)).toBe(true);
  });

  it('should not treat same value as opposite', () => {
    expect(areOppositeAxes(AXIS_TAG.ORDER, AXIS_TAG.ORDER)).toBe(false);
  });

  it('should not treat cross-axis as opposite', () => {
    expect(areOppositeAxes(AXIS_TAG.ORDER, AXIS_TAG.BOLD)).toBe(false);
  });

  it('should return false for NONE', () => {
    expect(areOppositeAxes(AXIS_TAG.NONE, AXIS_TAG.ORDER)).toBe(false);
  });
});

describe('sameMotivationCategory', () => {
  it('should detect Achievement category (MASTERY, POWER, WEALTH)', () => {
    expect(
      sameMotivationCategory(MOTIVATION_TAG.MASTERY, MOTIVATION_TAG.POWER)
    ).toBe(true);
    expect(
      sameMotivationCategory(MOTIVATION_TAG.POWER, MOTIVATION_TAG.WEALTH)
    ).toBe(true);
  });

  it('should detect Connection category (BELONGING, RECOGNITION, LOVE)', () => {
    expect(
      sameMotivationCategory(MOTIVATION_TAG.BELONGING, MOTIVATION_TAG.LOVE)
    ).toBe(true);
  });

  it('should detect Growth category (KNOWLEDGE, CREATION, FREEDOM)', () => {
    expect(
      sameMotivationCategory(MOTIVATION_TAG.KNOWLEDGE, MOTIVATION_TAG.FREEDOM)
    ).toBe(true);
  });

  it('should detect Preservation category (PROTECTION, JUSTICE, SURVIVAL)', () => {
    expect(
      sameMotivationCategory(MOTIVATION_TAG.PROTECTION, MOTIVATION_TAG.SURVIVAL)
    ).toBe(true);
  });

  it('should not match across categories', () => {
    expect(
      sameMotivationCategory(MOTIVATION_TAG.MASTERY, MOTIVATION_TAG.BELONGING)
    ).toBe(false);
  });

  it('should return false for NONE', () => {
    expect(sameMotivationCategory(0, MOTIVATION_TAG.MASTERY)).toBe(false);
  });
});

describe('computeArchetypeCompatibility', () => {
  let s: ArchetypeStorage;

  beforeEach(() => {
    s = createArchetypeStorage();
    initializeDefaultArchetypes(s);
  });

  it('should return high score for same-category archetypes', () => {
    // GUARDIAN(0) and SENTINEL(1) - both Protectors (ORDER-based)
    const score = computeArchetypeCompatibility(
      s,
      archetypeId(ARCHETYPE.GUARDIAN),
      archetypeId(ARCHETYPE.SENTINEL)
    );
    // Same primary axis (ORDER): +30, Same motivation (PROTECTION): +30
    expect(score).toBeGreaterThanOrEqual(30);
  });

  it('should penalize opposing archetypes', () => {
    // GUARDIAN(ORDER, ACTIVE) vs REBEL(CHAOS, ACTIVE) - opposite primary axes
    // Direction match: +20, Opposite axis: -20 = 0
    const score = computeArchetypeCompatibility(
      s,
      archetypeId(ARCHETYPE.GUARDIAN),
      archetypeId(ARCHETYPE.REBEL)
    );
    // Net score is low due to axis opposition penalty
    expect(score).toBeLessThanOrEqual(0);
  });

  it('should return low score for unrelated archetypes', () => {
    // SCHOLAR vs BERSERKER - no particular overlap
    const score = computeArchetypeCompatibility(
      s,
      archetypeId(ARCHETYPE.SCHOLAR),
      archetypeId(ARCHETYPE.BERSERKER)
    );
    // CAUTIOUS vs REACTIVE (opposite): -20
    expect(score).toBeLessThanOrEqual(10);
  });

  it('should be roughly symmetric', () => {
    const ab = computeArchetypeCompatibility(
      s,
      archetypeId(ARCHETYPE.MERCHANT),
      archetypeId(ARCHETYPE.THIEF)
    );
    const ba = computeArchetypeCompatibility(
      s,
      archetypeId(ARCHETYPE.THIEF),
      archetypeId(ARCHETYPE.MERCHANT)
    );
    // May not be perfectly symmetric due to cross-match direction
    expect(Math.abs(ab - ba)).toBeLessThanOrEqual(15);
  });
});

describe('computeEntityArchetypeAffinity', () => {
  let archetypes: ArchetypeStorage;
  let tags: TagStorage;
  let entities: EntityStorage;

  beforeEach(() => {
    archetypes = createArchetypeStorage();
    initializeDefaultArchetypes(archetypes);
    tags = createTagStorage(20);
    entities = createEntityStorage(20);
  });

  it('should return high score when entity tags match archetype', () => {
    const h = createEntity(entities, { category: CATEGORY.NPC });
    // Set tags matching Guardian: ACTIVE, ORDER, OTHERS, PROTECTION, BONE
    setDirection(tags, h.id, DIRECTION_TAG.ACTIVE);
    setAxis(tags, h.id, AXIS_TAG.ORDER);
    setAxis2(tags, h.id, AXIS_TAG.OTHERS);
    setMotivation(tags, h.id, MOTIVATION_TAG.PROTECTION);
    setWorldMark(tags, h.id, WORLD_MARK.BONE);

    const score = computeEntityArchetypeAffinity(
      archetypes,
      archetypeId(ARCHETYPE.GUARDIAN),
      tags,
      h.id
    );
    // Direction(+20) + Primary Axis(+30) + Motivation(+30) + WorldMark(+20) = 100+
    expect(score).toBeGreaterThanOrEqual(80);
  });

  it('should return low score when entity tags mismatch', () => {
    const h = createEntity(entities, { category: CATEGORY.NPC });
    setDirection(tags, h.id, DIRECTION_TAG.SOCIAL);
    setAxis(tags, h.id, AXIS_TAG.CHAOS);
    setMotivation(tags, h.id, MOTIVATION_TAG.FREEDOM);
    setWorldMark(tags, h.id, WORLD_MARK.SHADOW);

    const score = computeEntityArchetypeAffinity(
      archetypes,
      archetypeId(ARCHETYPE.GUARDIAN),
      tags,
      h.id
    );
    // ORDER↔CHAOS opposite penalty: -20, no matches
    expect(score).toBeLessThanOrEqual(0);
  });

  it('should return 0 for untagged entity', () => {
    const h = createEntity(entities, { category: CATEGORY.NPC });
    const score = computeEntityArchetypeAffinity(
      archetypes,
      archetypeId(ARCHETYPE.GUARDIAN),
      tags,
      h.id
    );
    expect(score).toBe(0);
  });

  it('should score secondary tag matches', () => {
    const h = createEntity(entities, { category: CATEGORY.NPC });
    // Only secondary axis matches archetype primary
    setAxis(tags, h.id, AXIS_TAG.BOLD); // No match with Guardian
    setAxis2(tags, h.id, AXIS_TAG.ORDER); // Matches Guardian primary
    setMotivation(tags, h.id, MOTIVATION_TAG.PROTECTION);

    const score = computeEntityArchetypeAffinity(
      archetypes,
      archetypeId(ARCHETYPE.GUARDIAN),
      tags,
      h.id
    );
    // Axis2 match with archetype primary: +15, Motivation: +30
    expect(score).toBeGreaterThanOrEqual(30);
  });
});
