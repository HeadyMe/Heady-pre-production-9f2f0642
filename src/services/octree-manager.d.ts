export class OctreeNode {
    constructor(minX: any, minY: any, minZ: any, maxX: any, maxY: any, maxZ: any, depth: any, maxDepth: any, maxItems: any);
    minX: any;
    minY: any;
    minZ: any;
    maxX: any;
    maxY: any;
    maxZ: any;
    depth: any;
    maxDepth: any;
    maxItems: any;
    items: any[];
    children: OctreeNode[] | null;
    get midX(): number;
    get midY(): number;
    get midZ(): number;
    contains(x: any, y: any, z: any): boolean;
    intersectsBox(bMinX: any, bMinY: any, bMinZ: any, bMaxX: any, bMaxY: any, bMaxZ: any): boolean;
    subdivide(): void;
    _insertIntoChildren(item: any): void;
    insert(item: any): boolean;
    remove(id: any): boolean;
    queryBox(bMinX: any, bMinY: any, bMinZ: any, bMaxX: any, bMaxY: any, bMaxZ: any, results: any): void;
    countAll(): any;
    allItems(results: any): void;
}
export class OctreeManager {
    constructor(config: any);
    maxDepth: any;
    maxItems: any;
    root: OctreeNode;
    _index: Map<any, any>;
    /**
     * Insert a spatial item.
     * @param {string} id
     * @param {number} x
     * @param {number} y
     * @param {number} z
     * @param {*} payload
     * @returns {boolean}
     */
    insert(id: string, x: number, y: number, z: number, payload: any): boolean;
    /**
     * Remove by id.
     */
    remove(id: any): boolean;
    /**
     * Axis-aligned bounding box query.
     * @returns {Array<{ id, x, y, z, payload }>}
     */
    rangeQuery(minX: any, minY: any, minZ: any, maxX: any, maxY: any, maxZ: any): Array<{
        id: any;
        x: any;
        y: any;
        z: any;
        payload: any;
    }>;
    /**
     * Spherical radius query.
     * @param {number} cx center X
     * @param {number} cy center Y
     * @param {number} cz center Z
     * @param {number} r radius
     * @returns {Array<{ id, x, y, z, payload, distance }>}
     */
    radiusQuery(cx: number, cy: number, cz: number, r: number): Array<{
        id: any;
        x: any;
        y: any;
        z: any;
        payload: any;
        distance: any;
    }>;
    /**
     * K-nearest neighbors.
     */
    nearest(cx: any, cy: any, cz: any, k?: number): any[];
    /** Total items in the tree. */
    size(): number;
    /** Check if id exists. */
    has(id: any): boolean;
    /** Get item by id. */
    get(id: any): any;
    /** Get all items. */
    all(): any[];
    /** Clear the entire tree. */
    clear(): void;
    /** Stats about tree structure. */
    stats(): {
        totalItems: number;
        maxDepth: any;
        maxItemsPerLeaf: any;
        bounds: {
            min: any[];
            max: any[];
        };
    };
}
export function registerRoutes(app: any, octreeInstance: any): any;
export function loadOctreeConfig(): any;
//# sourceMappingURL=octree-manager.d.ts.map