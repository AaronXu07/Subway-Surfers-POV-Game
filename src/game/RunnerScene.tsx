import { TRACK } from './constants';
import { ChunkView } from './ChunkView';
import { Environment } from './Environment';
import { GameDirector } from './GameDirector';
import { InstancedCoins } from './InstancedCoins';
import { PlayerRig } from './PlayerRig';

export function RunnerScene() {
  return (
    <>
      <GameDirector />
      <PlayerRig />
      <Environment />
      {Array.from({ length: TRACK.slots }, (_, index) => (
        <ChunkView key={index} index={index} />
      ))}
      <InstancedCoins />
    </>
  );
}
