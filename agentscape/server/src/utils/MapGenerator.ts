// ============================================================
// AgentScape — Deterministic Map Generator (seed=42)
// 80x80 world with SUITE City, Forest, Ruins, Deep Network
// ============================================================

import {
    MAP_SIZE, WATER_LEVEL, BUILDINGS,
    ZONES, DISTRICTS, TOWN_CENTER,
    MONSTERS, BOSSES,
} from '../config';

export type TileType = 0 | 1 | 2 | 3; // 0=unwalkable, 1=grass, 2=path, 3=bridge

export interface GameMap {
    grid: TileType[][];
    heightMap: number[][];
    buildingDoors: Record<string, { x: number; z: number }>;
    monsterSpawns: Record<string, { x: number; z: number }[]>;
    bossSpawns: Record<string, { x: number; z: number }>;
}

function seededRandom(seed: number): () => number {
    let s = seed;
    return () => {
        s = (s * 16807 + 0) % 2147483647;
        return (s - 1) / 2147483646;
    };
}

function simpleNoise(x: number, z: number): number {
    return Math.sin(x * 0.3) * Math.cos(z * 0.4) * 0.3
         + Math.sin(x * 0.7 + 1) * Math.cos(z * 0.5 + 2) * 0.15;
}

function detailNoise(x: number, z: number): number {
    return Math.sin(x * 0.15) * Math.cos(z * 0.2) * 0.4
         + Math.sin(x * 0.5 + 3) * Math.cos(z * 0.3 + 1) * 0.2
         + Math.sin(x * 1.1 + 5) * Math.cos(z * 0.9 + 4) * 0.08;
}

// --- Water features ---

export function isWater(x: number, z: number): boolean {
    // Forest lake (north-center)
    if (Math.sqrt((x - 25) ** 2 + (z - 10) ** 2) < 4.5) return true;
    // Forest pond (small, northwest)
    if (Math.sqrt((x - 12) ** 2 + (z - 7) ** 2) < 2.5) return true;
    // Forest river (winding east-west through northern area)
    const rz = 14 + Math.sin(x * 0.25) * 2.5;
    if (Math.abs(z - rz) < 1.2 && x > 30 && x < 65) return true;
    // Ruins moat (partial around ruins entrance)
    if (Math.sqrt((x - 62) ** 2 + (z - 38) ** 2) > 6 && Math.sqrt((x - 62) ** 2 + (z - 38) ** 2) < 7.5
        && x > 60 && z > 34 && z < 42) return true;
    // Deep network void pools
    if (Math.sqrt((x - 30) ** 2 + (z - 65) ** 2) < 3) return true;
    if (Math.sqrt((x - 55) ** 2 + (z - 70) ** 2) < 2.5) return true;
    return false;
}

export function isBridge(x: number, z: number): boolean {
    // Forest river bridge (north road crossing)
    const rz = 14 + Math.sin(x * 0.25) * 2.5;
    if (Math.abs(z - rz) < 1.5 && x >= 39 && x <= 41) return true;
    // Ruins moat bridge
    if (x >= 61 && x <= 63 && z >= 37 && z <= 39) return true;
    return false;
}

function isInBuildingZone(x: number, z: number): boolean {
    for (const b of BUILDINGS) {
        const hw = b.w / 2, hd = b.d / 2;
        if (x >= b.x - hw - 0.5 && x <= b.x + hw + 0.5 && z >= b.z - hd - 0.5 && z <= b.z + hd + 0.5) return true;
    }
    return false;
}

function getZone(x: number, z: number): string | null {
    for (const [id, zone] of Object.entries(ZONES)) {
        if (x >= zone.bounds.x1 && x <= zone.bounds.x2 && z >= zone.bounds.z1 && z <= zone.bounds.z2) {
            return id;
        }
    }
    return null;
}

function isOnRoad(x: number, z: number): boolean {
    // === SUITE City grid roads ===
    const city = ZONES.suite_city.bounds;
    if (x >= city.x1 && x <= city.x2 && z >= city.z1 && z <= city.z2) {
        // Main north-south avenue (x=40)
        if (Math.abs(x - 40) < 1) return true;
        // Main east-west avenue (z=38)
        if (Math.abs(z - 38) < 1) return true;
        // District border roads (horizontal)
        if (Math.abs(z - 32) < 0.6 && x >= city.x1 && x <= city.x2) return true;
        if (Math.abs(z - 45) < 0.6 && x >= city.x1 && x <= city.x2) return true;
        // District border roads (vertical)
        if (Math.abs(x - 35) < 0.6 && z >= city.z1 && z <= city.z2) return true;
        if (Math.abs(x - 48) < 0.6 && z >= city.z1 && z <= city.z2) return true;
    }

    // === Roads connecting city to zones ===
    // North road: City → Forest (x=40, z: 20 down to 2)
    if (Math.abs(x - 40) < 1 && z >= 2 && z < 20) return true;
    // East road: City → Ruins (z=38, x: 60 to 78)
    if (Math.abs(z - 38) < 1 && x > 60 && x < 78) return true;
    // South road: City → Deep Network (x=40, z: 55 to 78)
    if (Math.abs(x - 40) < 1 && z > 55 && z < 78) return true;

    return false;
}

function isOnForestPath(x: number, z: number, rng: () => number): boolean {
    // Winding path through the forest
    const forest = ZONES.the_forest.bounds;
    if (x >= forest.x1 && x <= forest.x2 && z >= forest.z1 && z <= forest.z2) {
        // Path from city entrance to boss area
        const pathZ = 10 + Math.sin(x * 0.15) * 3;
        if (Math.abs(z - pathZ) < 0.8 && x > 15 && x < 65) return true;
        // Cross path
        const pathX = 40 + Math.sin(z * 0.3) * 4;
        if (Math.abs(x - pathX) < 0.8 && z >= 3 && z <= 18) return true;
    }
    return false;
}

function isOnRuinsPath(x: number, z: number): boolean {
    const ruins = ZONES.the_ruins.bounds;
    if (x >= ruins.x1 && x <= ruins.x2 && z >= ruins.z1 && z <= ruins.z2) {
        // Broken stone paths
        const pathZ = 38 + Math.sin(x * 0.3) * 2;
        if (Math.abs(z - pathZ) < 0.7 && x > 62 && x < 76) return true;
        const pathX = 70 + Math.sin(z * 0.25) * 3;
        if (Math.abs(x - pathX) < 0.7 && z > 22 && z < 52) return true;
    }
    return false;
}

function isOnDeepPath(x: number, z: number): boolean {
    const deep = ZONES.the_deep_network.bounds;
    if (x >= deep.x1 && x <= deep.x2 && z >= deep.z1 && z <= deep.z2) {
        // Glowing network paths
        const pathZ = 66 + Math.sin(x * 0.2) * 3;
        if (Math.abs(z - pathZ) < 0.7 && x > 15 && x < 65) return true;
        const pathX = 40 + Math.sin(z * 0.2) * 5;
        if (Math.abs(x - pathX) < 0.7 && z > 57 && z < 76) return true;
    }
    return false;
}

// --- Monster spawn point generation ---

function generateMonsterSpawns(rng: () => number): Record<string, { x: number; z: number }[]> {
    const spawns: Record<string, { x: number; z: number }[]> = {};

    for (const [id, monster] of Object.entries(MONSTERS)) {
        const zone = ZONES[monster.zone];
        if (!zone) continue;

        spawns[id] = [];
        const { x1, z1, x2, z2 } = zone.bounds;
        const margin = 2;

        let placed = 0;
        let attempts = 0;
        while (placed < monster.spawnCount && attempts < monster.spawnCount * 20) {
            attempts++;
            const sx = Math.floor(x1 + margin + rng() * (x2 - x1 - margin * 2));
            const sz = Math.floor(z1 + margin + rng() * (z2 - z1 - margin * 2));
            // Don't spawn on buildings or roads
            if (!isInBuildingZone(sx, sz) && !isOnRoad(sx, sz)) {
                spawns[id].push({ x: sx, z: sz });
                placed++;
            }
        }
    }

    return spawns;
}

function generateBossSpawns(): Record<string, { x: number; z: number }> {
    const spawns: Record<string, { x: number; z: number }> = {};
    for (const [id, boss] of Object.entries(BOSSES)) {
        spawns[id] = { x: boss.spawnPos.x, z: boss.spawnPos.z };
    }
    return spawns;
}

// --- Main generation ---

export function generateMap(): GameMap {
    const rng = seededRandom(42);
    const grid: TileType[][] = [];
    const heightMap: number[][] = [];
    const buildingDoors: Record<string, { x: number; z: number }> = {};

    // Pass 1: Base terrain
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
                const zone = getZone(x, z);
                switch (zone) {
                    case 'suite_city':
                        heightMap[x][z] = 0; // flat city
                        break;
                    case 'the_forest':
                        heightMap[x][z] = detailNoise(x, z) * 0.25;
                        break;
                    case 'the_ruins':
                        heightMap[x][z] = detailNoise(x, z) * 0.35; // more rugged
                        break;
                    case 'the_deep_network':
                        heightMap[x][z] = simpleNoise(x, z) * 0.1; // subtle
                        break;
                    default:
                        heightMap[x][z] = simpleNoise(x, z) * 0.2; // wilderness between zones
                }
            }
        }
    }

    // Pass 2: Roads and paths
    for (let x = 0; x < MAP_SIZE; x++) {
        for (let z = 0; z < MAP_SIZE; z++) {
            if (grid[x][z] === 1 || grid[x][z] === 0) {
                if (isOnRoad(x, z) && !isWater(x, z)) {
                    grid[x][z] = 2;
                    heightMap[x][z] = 0; // roads are flat
                } else if (isOnForestPath(x, z, rng) && grid[x][z] === 1) {
                    grid[x][z] = 2;
                } else if (isOnRuinsPath(x, z) && grid[x][z] === 1) {
                    grid[x][z] = 2;
                } else if (isOnDeepPath(x, z) && grid[x][z] === 1) {
                    grid[x][z] = 2;
                }
            }
        }
    }

    // Pass 3: Trees and obstacles (zone-aware density)
    // Forest: dense trees
    const forestZone = ZONES.the_forest.bounds;
    for (let i = 0; i < 250; i++) {
        const x = Math.floor(forestZone.x1 + rng() * (forestZone.x2 - forestZone.x1));
        const z = Math.floor(forestZone.z1 + rng() * (forestZone.z2 - forestZone.z1));
        if (x >= 0 && x < MAP_SIZE && z >= 0 && z < MAP_SIZE
            && grid[x][z] === 1 && !isInBuildingZone(x, z)) {
            grid[x][z] = 0;
        }
    }

    // SUITE City: sparse decorative trees
    const cityZone = ZONES.suite_city.bounds;
    for (let i = 0; i < 30; i++) {
        const x = Math.floor(cityZone.x1 + rng() * (cityZone.x2 - cityZone.x1));
        const z = Math.floor(cityZone.z1 + rng() * (cityZone.z2 - cityZone.z1));
        if (x >= 0 && x < MAP_SIZE && z >= 0 && z < MAP_SIZE
            && grid[x][z] === 1 && !isInBuildingZone(x, z)) {
            grid[x][z] = 0;
        }
    }

    // Ruins: rubble/debris (unwalkable blocks)
    const ruinsZone = ZONES.the_ruins.bounds;
    for (let i = 0; i < 80; i++) {
        const x = Math.floor(ruinsZone.x1 + rng() * (ruinsZone.x2 - ruinsZone.x1));
        const z = Math.floor(ruinsZone.z1 + rng() * (ruinsZone.z2 - ruinsZone.z1));
        if (x >= 0 && x < MAP_SIZE && z >= 0 && z < MAP_SIZE
            && grid[x][z] === 1 && !isInBuildingZone(x, z)) {
            grid[x][z] = 0;
        }
    }

    // Deep Network: void patches
    const deepZone = ZONES.the_deep_network.bounds;
    for (let i = 0; i < 100; i++) {
        const x = Math.floor(deepZone.x1 + rng() * (deepZone.x2 - deepZone.x1));
        const z = Math.floor(deepZone.z1 + rng() * (deepZone.z2 - deepZone.z1));
        if (x >= 0 && x < MAP_SIZE && z >= 0 && z < MAP_SIZE
            && grid[x][z] === 1 && !isInBuildingZone(x, z)) {
            grid[x][z] = 0;
        }
    }

    // Wilderness areas (between zones): some trees
    for (let i = 0; i < 60; i++) {
        const x = Math.floor(rng() * MAP_SIZE);
        const z = Math.floor(rng() * MAP_SIZE);
        if (x >= 0 && x < MAP_SIZE && z >= 0 && z < MAP_SIZE
            && grid[x][z] === 1 && !isInBuildingZone(x, z) && !getZone(x, z)) {
            grid[x][z] = 0;
        }
    }

    // Burn RNG calls to keep deterministic sequence for client sync
    for (let i = 0; i < 80; i++) rng();

    // Pass 4: Building footprints and doors
    for (const b of BUILDINGS) {
        if (b.type === 'pedestal') {
            const cx = Math.floor(b.x), cz = Math.floor(b.z);
            if (cx >= 0 && cx < MAP_SIZE && cz >= 0 && cz < MAP_SIZE) grid[cx][cz] = 0;
            buildingDoors[b.id] = { x: cx, z: cz + 1 };
        } else {
            const hw = Math.ceil(b.w / 2), hd = Math.ceil(b.d / 2);
            for (let bx = Math.floor(b.x) - hw; bx <= Math.floor(b.x) + hw; bx++) {
                for (let bz = Math.floor(b.z) - hd; bz <= Math.floor(b.z) + hd; bz++) {
                    if (bx >= 0 && bx < MAP_SIZE && bz >= 0 && bz < MAP_SIZE) {
                        grid[bx][bz] = 0;
                        heightMap[bx][bz] = 0;
                    }
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

    // Pass 5: Ensure boss spawn areas are walkable
    for (const boss of Object.values(BOSSES)) {
        const bx = Math.floor(boss.spawnPos.x);
        const bz = Math.floor(boss.spawnPos.z);
        // Clear a 3x3 area around boss spawn
        for (let dx = -1; dx <= 1; dx++) {
            for (let dz = -1; dz <= 1; dz++) {
                const nx = bx + dx, nz = bz + dz;
                if (nx >= 0 && nx < MAP_SIZE && nz >= 0 && nz < MAP_SIZE && grid[nx][nz] === 0) {
                    grid[nx][nz] = 1;
                }
            }
        }
    }

    // Generate spawn points
    const monsterSpawns = generateMonsterSpawns(rng);
    const bossSpawns = generateBossSpawns();

    return { grid, heightMap, buildingDoors, monsterSpawns, bossSpawns };
}
