const {
    listTemplates,
    recommendTemplatesForSituation,
    validateTemplateRegistry,
    getTemplate,
} = require('../src/vector-template-engine');

describe('vector template registry enhancements', () => {
    test('listTemplates includes registry-driven situations and capabilities', () => {
        const siteBuilder = listTemplates().find((template) => template.name === 'site-builder');

        expect(siteBuilder).toBeDefined();
        expect(siteBuilder.situations).toContain('digital_presence_launch');
        expect(siteBuilder.capabilities).toEqual(expect.arrayContaining(['workflows', 'skills', 'nodes']));
    });

    test('recommendTemplatesForSituation prioritizes relevant templates', () => {
        const recommendation = recommendTemplatesForSituation('Need edge reliability and cloudflare gcloud alignment');

        expect(recommendation.recommendations.length).toBeGreaterThan(0);
        expect(recommendation.recommendations[0].name).toBe('infra-deployer');
    });

    test('validateTemplateRegistry reports healthy status and required capabilities', () => {
        const validation = validateTemplateRegistry();

        expect(validation.requiredCapabilities).toEqual(expect.arrayContaining(['workflows', 'skills', 'nodes']));
        expect(validation.healthy).toBe(true);
        expect(validation.templates.every((template) => template.healthy)).toBe(true);
    });

    test('getTemplate returns merged template metadata', () => {
        const template = getTemplate('agent-spawner');

        expect(template.situations).toContain('headyswarm_tasking');
        expect(template.capabilities).toHaveProperty('self_healing');
    });
});
