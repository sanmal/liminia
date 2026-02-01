A と B の両方を先に実施してから Step 7 に進む。以下の方針で。
A. ArchetypeStorage direction weights
ArchetypeDefinition に weightActive, weightPassive, weightSocial（各 0-100、合計不問）を追加。ArchetypeStorage に weightActive: Uint8Array, weightPassive: Uint8Array, weightSocial: Uint8Array を追加し、registerArchetype で書き込み、getWeightActive(storage, id) 等のアクセサを export する。
32アーキタイプの weights 参考値:
ArchetypeActivePassiveSocialGUARDIAN706040SENTINEL607530DEFENDER755535WARDEN657035COMMANDER704075DIPLOMAT304585MERCHANT403580PREACHER355080SCHOLAR258045INVESTIGATOR556540SAGE208550ARCHIVIST159035ARTISAN506545BUILDER655540HEALER307065CULTIVATOR457050EXPLORER853040PIONEER802550NOMAD753535WANDERER704030BERSERKER951020DUELIST852530HUNTER804025VETERAN705045ASSASSIN803520THIEF704035SPY554565TRICKSTER603070SURVIVOR656025HERMIT308515REBEL802050OUTCAST555020
設計根拠: Active はそのアーキタイプが行動的な選択（戦闘・探索・移動）をどれだけ好むか、Passive は受動的な選択（休息・観察・瞑想）への傾向、Social は対人行動（会話・取引・説得）への傾向。BERSERKER が Active 95 / Passive 10 なのは極端だが、これがアーキタイプごとの行動多様性を生む。
B. CharacterStateStorage archetypeId
CharacterStateStorage に archetypeIds: Uint8Array を追加。getArchetypeId(storage, id): number / setArchetypeId(storage, id, archetypeId) をアクセサとして export。初期値は 0。
完了条件:

bun run typecheck 通過
既存394テスト全パス
A の新規テスト: weights が registerArchetype で正しく設定されること、アクセサが正しい値を返すこと（~5-8テスト）
B の新規テスト: archetypeId の get/set、初期値0の検証（~3-5テスト）
完了後、Step 7 指示書に基づいて evaluator.ts の実装に進む