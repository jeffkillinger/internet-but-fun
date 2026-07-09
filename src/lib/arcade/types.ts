export type GameId = "rubiks-cube";

export type ActorId = string;
export type EpochId = string;
export type ArcadeEventType = string;

export type ArcadeEvent = Readonly<{
  id: string;
  seq: number;
  gameId: GameId;
  epochId: EpochId;
  actorId: ActorId;
  eventType: ArcadeEventType;
  payload: unknown;
  createdAt: string;
}>;
