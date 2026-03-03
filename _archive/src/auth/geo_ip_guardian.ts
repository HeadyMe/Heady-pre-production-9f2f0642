import { Request, Response, NextFunction } from 'express';
import geoip from 'geoip-lite';

/**
 * IP-Bound Continuous Authentication (Heady Geo-IP Guardian)
 * Prevents Session Token Hijacking by tracking "impossible travel" and
 * validating JWTs against originating Network IP.
 */

interface SessionData {
    ip: string;
    lastSeen: number;
    geoLoc: { ll: [number, number] } | null;
}

const activeSessions = new Map<string, SessionData>();

// Calculates physical distance between two lat/lon points in miles
function getDistanceInMiles(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 3958.8; // Radius of earth in miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

export const geoIpGuardian = (req: Request, res: Response, next: NextFunction) => {
    // We assume the token is decoded and user identity is in req.user
    const sessionToken = req.headers.authorization?.split(' ')[1];

    if (!sessionToken) {
        return next();
    }

    const currentIp = req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || req.ip || '';
    const currentLoc = geoip.lookup(currentIp);
    const now = Date.now();

    const existingSession = activeSessions.get(sessionToken);

    if (existingSession) {
        // IP Binding Check
        if (existingSession.ip !== currentIp) {
            console.warn(`[SECURITY] Session IP mismatch. Expected ${existingSession.ip}, got ${currentIp}. Checking geolocation...`);

            // Impossible Travel Check
            if (existingSession.geoLoc && currentLoc) {
                const distance = getDistanceInMiles(
                    existingSession.geoLoc.ll[0], existingSession.geoLoc.ll[1],
                    currentLoc.ll[0], currentLoc.ll[1]
                );

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
