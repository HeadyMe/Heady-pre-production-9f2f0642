const BASE = '/api';

async function request(path, options = {}) {
    const res = await fetch(`${BASE}${path}`, {
        headers: { 'Content-Type': 'application/json', ...options.headers },
        ...options,
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || res.statusText);
    }
    return res.json();
}

export const api = {
    // Dashboard
    getSystemConfig: () => request('/config/system'),
    updateSystemConfig: (data) => request('/config/system', { method: 'PUT', body: JSON.stringify(data) }),

    // Services
    getServices: () => request('/services'),
    getService: (id) => request(`/services/${id}`),
    createService: (data) => request('/services', { method: 'POST', body: JSON.stringify(data) }),
    updateService: (id, data) => request(`/services/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteService: (id) => request(`/services/${id}`, { method: 'DELETE' }),

    // Domains
    getDomains: () => request('/domains'),
    getDomain: (id) => request(`/domains/${id}`),
    createDomain: (data) => request('/domains', { method: 'POST', body: JSON.stringify(data) }),
    updateDomain: (id, data) => request(`/domains/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteDomain: (id) => request(`/domains/${id}`, { method: 'DELETE' }),

    // Tunnels
    getTunnels: () => request('/tunnels'),
    updateTunnels: (data) => request('/tunnels', { method: 'PUT', body: JSON.stringify(data) }),

    // Profiles / Users
    getProfiles: () => request('/profiles'),
    createProfile: (data) => request('/profiles', { method: 'POST', body: JSON.stringify(data) }),
    deleteProfile: (id) => request(`/profiles/${id}`, { method: 'DELETE' }),

    // Logs
    getLogs: () => request('/logs'),

    // Dashboard stats
    getDashboard: () => request('/dashboard'),
    getDesignConfig: () => request('/design'),
    updateDesignConfig: (data) => request('/design', { method: 'PUT', body: JSON.stringify(data) }),

    // Tasks (Drupal 11 Headless)
    getTasks: () => request('/tasks'),
    getTask: (id) => request(`/tasks/${id}`),
    createTask: (data) => request('/tasks', { method: 'POST', body: JSON.stringify(data) }),
    updateTask: (id, data) => request(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteTask: (id) => request(`/tasks/${id}`, { method: 'DELETE' }),

    // Drupal 11 Headless Status
    getDrupalStatus: () => request('/drupal/status'),
    getDrupalContent: (type) => request(`/drupal/content/${type}`),
    syncDrupalTasks: () => request('/drupal/sync-tasks', { method: 'POST' }),

    // Routing
    getRoutes: () => request('/routes'),
    getRoute: (id) => request(`/routes/${id}`),
    createRoute: (data) => request('/routes', { method: 'POST', body: JSON.stringify(data) }),
    updateRoute: (id, data) => request(`/routes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteRoute: (id) => request(`/routes/${id}`, { method: 'DELETE' }),
    getRoutingConfig: () => request('/routes/config'),

    // HCFP Auto-Success Engine
    getHCFPStatus: () => request('/hcfp/status'),
    getHCFPHistory: (limit = 100) => request(`/hcfp/history?limit=${limit}`),
    getHCFPSubsystem: (id) => request(`/hcfp/subsystems/${id}`),


    // Autonomy Core
    getAutonomyState: () => request('/autonomy/state'),
    ingestAutonomyConcept: (data) => request('/autonomy/ingest', { method: 'POST', body: JSON.stringify(data) }),
    tickAutonomy: () => request('/autonomy/tick', { method: 'POST', body: JSON.stringify({}) }),
    createMusicSession: (data) => request('/autonomy/music-session', { method: 'POST', body: JSON.stringify(data) }),
    getAutonomyAudit: (limit = 100) => request(`/autonomy/audit?limit=${limit}`),
    getMonorepoProjection: () => request('/autonomy/monorepo-projection'),
    getAutonomyRuntime: () => request('/autonomy/runtime'),
    getAutonomyDiagnostics: () => request('/autonomy/diagnostics'),
    getAutonomyNodes: () => request('/autonomy/nodes'),
    upsertAutonomyVector: (data) => request('/autonomy/vector/upsert', { method: 'POST', body: JSON.stringify(data) }),
    queryAutonomyVector: (data) => request('/autonomy/vector/query', { method: 'POST', body: JSON.stringify(data) }),
    embedAutonomyProjectSnapshot: (data) => request('/autonomy/vector/embed-project', { method: 'POST', body: JSON.stringify(data) }),
    embedAutonomyRepository: (data) => request('/autonomy/vector/embed-repo', { method: 'POST', body: JSON.stringify(data) }),
    getAutonomyTemplateIntelligence: () => request('/autonomy/templates/intelligence'),
    getAutonomyTemplateRegistry: () => request('/autonomy/templates/registry'),
    registerAutonomyTemplate: (data) => request('/autonomy/templates/register', { method: 'POST', body: JSON.stringify(data) }),
    validateAutonomyTemplateRegistry: () => request('/autonomy/templates/validate', { method: 'POST', body: JSON.stringify({}) }),
    recommendAutonomyTemplate: (situation) => request('/autonomy/templates/recommend', { method: 'POST', body: JSON.stringify({ situation }) }),
    optimizeAutonomyTemplates: (predictedSituations = []) => request('/autonomy/templates/optimize', { method: 'POST', body: JSON.stringify({ predictedSituations }) }),
    getAutonomyTemplateCoverageForecast: (limit = 20) => request(`/autonomy/templates/coverage-forecast?limit=${limit}`),
    getAutonomyTemplateReadiness: (limit = 20) => request(`/autonomy/templates/readiness?limit=${limit}`),
    getAutonomyMaintenancePlan: () => request('/autonomy/maintenance/plan'),
    runAutonomyMaintenanceSweep: (removeStaleFiles = false) => request('/autonomy/maintenance/sweep', { method: 'POST', body: JSON.stringify({ removeStaleFiles }) }),
    runAutonomyHardeningCycle: (removeStaleFiles = false) => request('/autonomy/hardening/run', { method: 'POST', body: JSON.stringify({ removeStaleFiles }) }),
    getAutonomyDigitalPresenceReport: () => request('/autonomy/digital-presence/report'),
    getAutonomyDeterminism: (limit = 50) => request(`/autonomy/determinism?limit=${limit}`),
    getAutonomyUnifiedModel: () => request('/autonomy/unified-model'),
    streamAutonomyEvents: () => new EventSource('/api/autonomy/stream'),
    controlAutonomyLoop: (action) => request('/autonomy/control', { method: 'POST', body: JSON.stringify({ action }) }),
    refreshAutonomyProjection: () => request('/autonomy/projection/refresh', { method: 'POST', body: JSON.stringify({}) }),

    // Google AI Studio (Gemini)
    getAIModels: () => request('/ai/models'),
    getAIStatus: () => request('/ai/status'),
    getAISystemPrompt: () => request('/ai/system-prompt'),
    aiChat: (data) => request('/ai/chat', { method: 'POST', body: JSON.stringify(data) }),
    aiEmbed: (data) => request('/ai/embed', { method: 'POST', body: JSON.stringify(data) }),
    // Streaming — returns raw fetch Response for SSE reading
    aiChatStream: (data) => fetch('/api/ai/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    }),
};
