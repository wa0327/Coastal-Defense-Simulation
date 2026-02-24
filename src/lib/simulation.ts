export type TargetType = 'FRIENDLY' | 'ENEMY' | 'FISHING' | 'UNKNOWN';

export interface Vector2D {
  x: number;
  y: number;
}

export interface Target {
  id: string;
  type: TargetType;
  pos: Vector2D;
  vel: Vector2D;
  speed: number;
  heading: number;
}

export interface Drone {
  id: string;
  pos: Vector2D;
  vel: Vector2D;
  speed: number;
  heading: number;
  state: 'IDLE' | 'PATROL' | 'TRACKING' | 'RETURNING';
  targetId: string | null;
  waypoints: Vector2D[];
  currentWaypointIndex: number;
  flightTime: number;
  maxFlightTime: number;
}

export interface LogEntry {
  id: string;
  time: Date;
  message: string;
  type: 'INFO' | 'ALERT' | 'WARNING';
}

export interface SimulationStats {
  friendly: number;
  enemy: number;
  fishing: number;
  unknown: number;
}

export const distance = (p1: Vector2D, p2: Vector2D) => {
  return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
};

export const normalize = (v: Vector2D) => {
  const len = Math.sqrt(v.x * v.x + v.y * v.y);
  if (len === 0) return { x: 0, y: 0 };
  return { x: v.x / len, y: v.y / len };
};

export const angleDiff = (a: number, b: number) => {
  let diff = b - a;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
};
