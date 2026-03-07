export class OctreeManager {
    constructor(options?: {});
    root: OctreeNode;
    totalInserted: number;
    insert(point: any): boolean;
    queryRange(bounds: any): any;
    queryRadius(center: any, radius: any): any;
    nearest(point: any, k?: number): any;
    count(): number;
    getStats(): {
        totalInserted: number;
        currentCount: number;
        bounds: any;
        maxItemsPerNode: number;
        maxDepth: number;
        memoryPerVector: string;
        memoryReduction: string;
    };
}
export class OctreeNode {
    constructor(bounds: any, depth?: number, maxItems?: number, maxDepth?: number);
    bounds: any;
    depth: number;
    maxItems: number;
    maxDepth: number;
    items: any[];
    children: OctreeNode[] | null;
    contains(point: any): boolean;
    subdivide(): void;
    insert(item: any): boolean;
    queryRange(bounds: any): any;
    queryRadius(center: any, radius: any): any;
    nearest(point: any, k?: number): any;
    count(): number;
    _intersects(bounds: any): boolean;
}
//# sourceMappingURL=octree-manager.d.ts.map