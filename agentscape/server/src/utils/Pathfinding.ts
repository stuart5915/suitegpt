// ============================================================
// AgentScape — A* Pathfinding
// Ported from apps/runescape-game.html line 1443
// ============================================================

import { MAP_SIZE } from '../config';
import { TileType } from './MapGenerator';

export interface PathNode {
    x: number;
    z: number;
}

export function findPath(grid: TileType[][], sx: number, sz: number, ex: number, ez: number): PathNode[] {
    if (ex < 0 || ex >= MAP_SIZE || ez < 0 || ez >= MAP_SIZE || grid[ex][ez] === 0) return [];

    const open: { x: number; z: number; g: number; f: number }[] = [];
    const closed = new Set<string>();
    const cameFrom: Record<string, string> = {};

    function key(x: number, z: number): string { return x + ',' + z; }
    function h(x: number, z: number): number { return Math.abs(x - ex) + Math.abs(z - ez); }

    open.push({ x: sx, z: sz, g: 0, f: h(sx, sz) });

    while (open.length > 0) {
        open.sort((a, b) => a.f - b.f);
        const current = open.shift()!;
        const ck = key(current.x, current.z);

        if (current.x === ex && current.z === ez) {
            const path: PathNode[] = [];
            let kk: string | undefined = ck;
            while (kk) {
                const [px, pz] = kk.split(',').map(Number);
                path.unshift({ x: px, z: pz });
                kk = cameFrom[kk];
            }
            return path;
        }

        closed.add(ck);

        const neighbors = [
            { x: current.x + 1, z: current.z },
            { x: current.x - 1, z: current.z },
            { x: current.x, z: current.z + 1 },
            { x: current.x, z: current.z - 1 },
        ];

        for (const n of neighbors) {
            if (n.x < 0 || n.x >= MAP_SIZE || n.z < 0 || n.z >= MAP_SIZE || grid[n.x][n.z] === 0) continue;
            const nk = key(n.x, n.z);
            if (closed.has(nk)) continue;
            const g = current.g + 1;
            const existing = open.find(o => key(o.x, o.z) === nk);
            if (existing && g >= existing.g) continue;
            cameFrom[nk] = ck;
            if (existing) {
                existing.g = g;
                existing.f = g + h(n.x, n.z);
            } else {
                open.push({ x: n.x, z: n.z, g, f: g + h(n.x, n.z) });
            }
        }
    }

    return [];
}

export function findAdjacentWalkable(grid: TileType[][], tx: number, tz: number): PathNode | null {
    for (const [dx, dz] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
        const nx = tx + dx, nz = tz + dz;
        if (nx >= 0 && nx < MAP_SIZE && nz >= 0 && nz < MAP_SIZE && grid[nx][nz] > 0) {
            return { x: nx, z: nz };
        }
    }
    return null;
}
