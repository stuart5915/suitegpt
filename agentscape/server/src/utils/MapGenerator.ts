// ============================================================
// AgentScape — Deterministic Map Generator (seed=42)
// Ported from apps/runescape-game.html lines 1347-1364
// ============================================================

import { MAP_SIZE, WATER_LEVEL, BUILDINGS } from '../config';

export type TileType = 0 | 1 | 2 | 3; // 0=unwalkable, 1=grass, 2=path, 3=bridge

export interface GameMap {
    grid: TileType[][];
    heightMap: number[][];
    buildingDoors: Record<string, { x: number; z: number }>;
}

function seededRandom(seed: number): () => number {
    let s = seed;
    return () => {
        s = (s * 16807 + 0) % 2147483647;
        return (s - 1) / 2147483646;
    };
}

function simpleNoise(x: number, z: number): number {
    return Math.sin(x * 0.3) * Math.cos(z * 0.4) * 0.3 + Math.sin(x * 0.7 + 1) * Math.cos(z * 0.5 + 2) * 0.15;
}

export function isWater(x: number, z: number): boolean {
    // Lake at (6,6) radius 3.5
    if (Math.sqrt((x - 6) ** 2 + (z - 6) ** 2) < 3.5) return true;
    // River at z ≈ 20
    const rz = 20 + Math.sin(x * 0.4) * 2;
    if (Math.abs(z - rz) < 1.5 && x > 5 && x < 28) return true;
    return false;
}

export function isBridge(x: number, z: number): boolean {
    const rz = 20 + Math.sin(x * 0.4) * 2;
    return Math.abs(z - rz) < 1.5 && x >= 14 && x <= 16;
}

function isInBuildingZone(x: number, z: number): boolean {
    for (const b of BUILDINGS) {
        const hw = b.w / 2, hd = b.d / 2;
        if (x >= b.x - hw - 0.5 && x <= b.x + hw + 0.5 && z >= b.z - hd - 0.5 && z <= b.z + hd + 0.5) return true;
    }
    return false;
}

export function generateMap(): GameMap {
    const rng = seededRandom(42);
    const grid: TileType[][] = [];
    const heightMap: number[][] = [];
    const buildingDoors: Record<string, { x: number; z: number }> = {};

    // Generate base terrain
    for (let x = 0; x < MAP_SIZE; x++) {
        grid[x] = [];
        heightMap[x] = [];
        for (let z = 0; z < MAP_SIZE; z++) {
            const w = isWater(x, z);
            const br = isBridge(x, z);
            if (br) {
                grid[x][z] = 3;
                heightMap[x][z] = 0.05;
            } else if (w) {
                grid[x][z] = 0;
                heightMap[x][z] = WATER_LEVEL;
            } else {
                grid[x][z] = 1;
                heightMap[x][z] = simpleNoise(x, z) * 0.2;
            }
        }
    }

    // Mark paths
    for (let x = 0; x < MAP_SIZE; x++) {
        for (let z = 0; z < MAP_SIZE; z++) {
            if (grid[x][z] === 1) {
                const pz = 15 + Math.sin(x * 0.3) * 1.5;
                if (Math.abs(z - pz) < 0.8 && x > 3 && x < 27) {
                    grid[x][z] = 2;
                }
            }
        }
    }

    // Place trees (mark unwalkable) — same RNG sequence as client
    for (let i = 0; i < 40; i++) {
        const x = Math.floor(rng() * MAP_SIZE);
        const z = Math.floor(rng() * MAP_SIZE);
        if (grid[x][z] > 0 && !isWater(x, z) && !isInBuildingZone(x, z) && grid[x][z] !== 2 && grid[x][z] !== 3 && !(Math.abs(x - 15) < 3 && Math.abs(z - 15) < 3)) {
            grid[x][z] = 0;
        }
    }

    // Use up the RNG calls for tree variants (to keep in sync with client)
    // Each tree uses 1 rng() for height, possibly more for variants
    // We just need the grid to match
    for (let i = 0; i < 40; i++) rng(); // tree height
    for (let i = 0; i < 40; i++) rng(); // tree variant

    // Mark building zones + doors
    for (const b of BUILDINGS) {
        if (b.type === 'pedestal') {
            const cx = Math.floor(b.x), cz = Math.floor(b.z);
            if (cx >= 0 && cx < MAP_SIZE && cz >= 0 && cz < MAP_SIZE) grid[cx][cz] = 0;
            buildingDoors[b.id] = { x: cx, z: cz + 1 };
        } else {
            const hw = Math.ceil(b.w / 2), hd = Math.ceil(b.d / 2);
            for (let bx = Math.floor(b.x) - hw; bx <= Math.floor(b.x) + hw; bx++) {
                for (let bz = Math.floor(b.z) - hd; bz <= Math.floor(b.z) + hd; bz++) {
                    if (bx >= 0 && bx < MAP_SIZE && bz >= 0 && bz < MAP_SIZE) grid[bx][bz] = 0;
                }
            }

            let dt: { x: number; z: number };
            switch (b.doorSide) {
                case 'south': dt = { x: Math.floor(b.x), z: Math.floor(b.z) + hd + 1 }; break;
                case 'north': dt = { x: Math.floor(b.x), z: Math.floor(b.z) - hd - 1 }; break;
                case 'west':  dt = { x: Math.floor(b.x) - hw - 1, z: Math.floor(b.z) }; break;
                case 'east':  dt = { x: Math.floor(b.x) + hw + 1, z: Math.floor(b.z) }; break;
            }
            if (dt.x >= 0 && dt.x < MAP_SIZE && dt.z >= 0 && dt.z < MAP_SIZE) {
                grid[dt.x][dt.z] = 1;
                buildingDoors[b.id] = dt;
            }
        }
    }

    return { grid, heightMap, buildingDoors };
}
