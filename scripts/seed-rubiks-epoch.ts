import {
  applyMoves,
  createSolvedCube,
  generateScramble,
  hashCubeState,
  serializeCube,
} from "../src/lib/cube";
import { closeSql, getSql } from "../src/lib/db/client";
import {
  hashScrambleState,
  parseStoredScramble,
  reconstructSerializedCubeFromScramble,
} from "../src/lib/rubiks/epoch";

type EpochRow = {
  id: string;
  scramble: unknown;
  state_hash: string;
  cube_version: number;
  move_count: number;
};

async function main() {
  const sql = getSql();
  const [existing] = await sql<EpochRow[]>`
    select id::text, scramble, state_hash, cube_version, move_count
    from epochs
    where game_id = 'rubiks-cube' and status = 'active'
    order by started_at desc
    limit 1
  `;

  if (existing) {
    const scramble = parseStoredScramble(existing.scramble);
    const serialized = reconstructSerializedCubeFromScramble(scramble);
    const recomputedHash = hashScrambleState(scramble);

    if (recomputedHash !== existing.state_hash) {
      throw new Error(
        `Stored hash mismatch for epoch ${existing.id}: stored ${existing.state_hash}, recomputed ${recomputedHash}.`,
      );
    }

    console.log("Active Rubik's Cube epoch already exists.");
    console.log(`Epoch ID: ${existing.id}`);
    console.log(`Scramble: ${scramble.join(" ")}`);
    console.log(`Serialized cube: ${serialized}`);
    console.log(`State hash: ${existing.state_hash}`);
    return;
  }

  const scramble = generateScramble(20).map((move) => move.notation);
  const scrambledCube = applyMoves(createSolvedCube(), scramble);
  const serialized = serializeCube(scrambledCube);
  const stateHash = hashCubeState(serialized);

  const [created] = await sql.begin(async (transaction) => {
    const [epoch] = await transaction<EpochRow[]>`
      insert into epochs (
        game_id,
        status,
        scramble,
        cube_version,
        state_hash,
        move_count
      )
      values (
        'rubiks-cube',
        'active',
        ${transaction.json(scramble)},
        0,
        ${stateHash},
        0
      )
      returning id::text, scramble, state_hash, cube_version, move_count
    `;

    await transaction`
      insert into events (seq, game_id, epoch_id, actor_id, event_type, payload)
      values (
        1,
        'rubiks-cube',
        ${epoch.id}::uuid,
        null,
        'epoch_started',
        ${transaction.json({ scramble })}
      )
    `;

    return [epoch];
  });

  const storedScramble = parseStoredScramble(created.scramble);
  const storedSerialized = reconstructSerializedCubeFromScramble(storedScramble);
  const storedHash = hashCubeState(storedSerialized);

  if (storedHash !== created.state_hash) {
    throw new Error(
      `Stored hash mismatch for epoch ${created.id}: stored ${created.state_hash}, recomputed ${storedHash}.`,
    );
  }

  console.log("Created active Rubik's Cube epoch.");
  console.log(`Epoch ID: ${created.id}`);
  console.log(`Scramble: ${storedScramble.join(" ")}`);
  console.log(`Serialized cube: ${storedSerialized}`);
  console.log(`State hash: ${created.state_hash}`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Seed failed.");
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeSql();
  });
