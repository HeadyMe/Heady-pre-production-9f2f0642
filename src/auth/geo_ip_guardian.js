"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.geoIpGuardian = void 0;
const geoip_lite_1 = __importDefault(require("geoip-lite"));
const activeSessions = new Map();
// Calculates physical distance between two lat/lon points in miles
function getDistanceInMiles(lat1, lon1, lat2, lon2) {
    const R = 3958.8; // Radius of earth in miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}
const geoIpGuardian = (req, res, next) => {
    // We assume the token is decoded and user identity is in req.user
    const sessionToken = req.headers.authorization?.split(' ')[1];
    if (!sessionToken) {
        return next();
    }
    const currentIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip || '';
    const currentLoc = geoip_lite_1.default.lookup(currentIp);
    const now = Date.now();
    const existingSession = activeSessions.get(sessionToken);
    if (existingSession) {
        // IP Binding Check
        if (existingSession.ip !== currentIp) {
            console.warn(`[SECURITY] Session IP mismatch. Expected ${existingSession.ip}, got ${currentIp}. Checking geolocation...`);
            // Impossible Travel Check
            if (existingSession.geoLoc && currentLoc) {
                const distance = getDistanceInMiles(existingSession.geoLoc.ll[0], existingSession.geoLoc.ll[1], currentLoc.ll[0], currentLoc.ll[1]);
                const hoursPassed = (now - existingSession.lastSeen) / (1000 * 60 * 60);
                const mph = distance / (hoursPassed || 0.001); // avoid div by 0
                if (mph > 600) { // e.g., > 600 mph implies impossible travel
                    console.error(`[SOUL VETO] Impossible travel detected! Speed: ${mph} mph.`);
                    return res.status(403).json({ error: "Heady SOUL Veto: Suspicious activity leading to instant session termination." });
                }
            }
            // If the IP changed but travel is possible, we update the profile. 
            // Depending on strictness, we could also just kill the token for ANY IP change.
        }
    }
    activeSessions.set(sessionToken, {
        ip: currentIp,
        lastSeen: now,
        geoLoc: currentLoc
    });
    next();
};
exports.geoIpGuardian = geoIpGuardian;
//# sourceMappingURL=geo_ip_guardian.js.map