const logger = require('../utils/logger').child({ component: 'incident-timeline' });

class IncidentTimeline {
    constructor() {
        this.events = [];
        this.incidents = new Map();
    }

    recordEvent(eventType, serviceId, details = {}) {
        const event = {
            id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            timestamp: Date.now(),
            eventType,
            serviceId,
            details
        };
        this.events.push(event);
        logger.info('Incident event recorded', event);
        return event;
    }

    getEvents(timeWindow = 86400000) { // 24h default
        const cutoff = Date.now() - timeWindow;
        return this.events.filter(e => e.timestamp > cutoff);
    }

    generatePostmortem(incidentId) {
        const incident = this.incidents.get(incidentId);
        if (!incident) return null;

        const relatedEvents = this.events.filter(e => 
            e.timestamp >= incident.startTime && 
            e.timestamp <= incident.endTime
        );

        return {
            incidentId,
            summary: `Incident ${incidentId}`,
            timeline: relatedEvents,
            rootCause: 'TBD',
            affectedServices: [...new Set(relatedEvents.map(e => e.serviceId))],
            totalDowntime: incident.endTime - incident.startTime,
            recommendations: []
        };
    }
}

module.exports = IncidentTimeline;
