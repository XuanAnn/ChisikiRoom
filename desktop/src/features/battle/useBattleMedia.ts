import { type BattlePlayer } from '../../lib/api';
import { usePeerMedia } from '../../hooks/usePeerMedia';
export function useBattleMedia(id: string, userId: string, players: BattlePlayer[]) {
  return usePeerMedia(id, userId, players, 'battle');
}
