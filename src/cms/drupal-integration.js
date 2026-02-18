/**
 * 🏛️ Drupal 11 Integration - Enterprise Content Management
 * Integrates Drupal 11 for advanced content management and enterprise features
 */

class DrupalIntegration {
  constructor() {
    this.drupalUrl = process.env.DRUPAL_URL;
    this.apiKey = process.env.DRUPAL_API_KEY;
    this.username = process.env.DRUPAL_USERNAME;
    this.password = process.env.DRUPAL_PASSWORD;
    this.contentTypes = new Map();
    this.taxonomies = new Map();
    this.modules = new Map();
    this.themes = new Map();
  }

  /**
   * Initialize Drupal 11 integration
   */
  async initialize() {
    console.log('🏛️ Initializing Drupal 11 Integration...');
    
    if (!this.drupalUrl) {
      throw new Error('Drupal URL not found in environment variables');
    }

    // Test API connection
    const testResult = await this.testConnection();
    if (!testResult) {
      throw new Error('Failed to connect to Drupal API');
    }

    // Initialize Drupal 11 features
    await this.initializeDrupalFeatures();
    
    console.log('✅ Drupal 11 Integration initialized');
    return {
      status: 'connected',
      version: '11.x',
      capabilities: [
        'content_management',
        'taxonomy_system',
        'user_management',
        'api_integration',
        'media_library',
        'workflows',
        'layout_builder',
        'multilingual',
        'enterprise_features'
      ]
    };
  }

  /**
   * Test API connection
   */
  async testConnection() {
    try {
      const response = await fetch(`${this.drupalUrl}/api/v1/status`, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        }
      });

      const data = await response.json();
      return data.status === 'healthy' && data.version.includes('11.');
    } catch (error) {
      console.error('❌ Drupal connection test failed:', error.message);
      return false;
    }
  }

  /**
   * Initialize Drupal 11 features
   */
  async initializeDrupalFeatures() {
    // Content types
    this.contentTypes.set('article', {
      name: 'Article',
      description: 'Use articles for time-sensitive content like news, press releases or blog posts.',
      fields: ['title', 'body', 'image', 'tags', 'category'],
      workflow: 'editorial'
    });

    this.contentTypes.set('page', {
      name: 'Page',
      description: 'Use pages for your static content, such as an "About us" page.',
      fields: ['title', 'body', 'image'],
      workflow: 'basic'
    });

    this.contentTypes.set('heady_service', {
      name: 'Heady Service',
      description: 'Heady ecosystem service descriptions and documentation.',
      fields: ['title', 'body', 'service_type', 'api_endpoint', 'documentation', 'status'],
      workflow: 'technical'
    });

    this.contentTypes.set('heady_component', {
      name: 'Heady Component',
      description: 'Individual Heady components and their specifications.',
      fields: ['title', 'body', 'component_type', 'code_snippet', 'dependencies', 'version'],
      workflow: 'development'
    });

    // Taxonomies
    this.taxonomies.set('tags', {
      name: 'Tags',
      description: 'Use tags to group articles on similar topics.',
      vocabulary: 'tags',
      hierarchy: false
    });

    this.taxonomies.set('categories', {
      name: 'Categories',
      description: 'Use categories to group content in different sections.',
      vocabulary: 'categories',
      hierarchy: true
    });

    this.taxonomies.set('service_types', {
      name: 'Service Types',
      description: 'Classification of Heady services.',
      vocabulary: 'service_types',
      hierarchy: true
    });

    // Modules
    this.modules.set('heady_integration', {
      name: 'Heady Integration',
      description: 'Custom module for Heady ecosystem integration.',
      enabled: true,
      version: '1.0.0',
      dependencies: ['jsonapi', 'media_library', 'layout_builder']
    });

    this.modules.set('api_integration', {
      name: 'API Integration',
      description: 'Enhanced API capabilities for external integrations.',
      enabled: true,
      version: '1.0.0',
      dependencies: ['jsonapi', 'serialization']
    });

    this.modules.set('enterprise_features', {
      name: 'Enterprise Features',
      description: 'Enterprise-level features and enhancements.',
      enabled: true,
      version: '1.0.0',
      dependencies: ['workflows', 'content_moderation', 'media_library']
    });
  }

  /**
   * Create content
   */
  async createContent(contentType, data) {
    try {
      const response = await fetch(`${this.drupalUrl}/api/v1/content/${contentType}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          type: contentType,
          ...data
        })
      });

      const result = await response.json();
      
      if (result.id) {
        const content = {
          id: result.id,
          type: contentType,
          title: result.title,
          status: result.status,
          created: result.created,
          changed: result.changed,
          url: result.url,
          timestamp: Date.now()
        };

        return content;
      }
      
      return null;
    } catch (error) {
      console.error('❌ Content creation failed:', error.message);
      return null;
    }
  }

  /**
   * Update content
   */
  async updateContent(contentId, data) {
    try {
      const response = await fetch(`${this.drupalUrl}/api/v1/content/${contentId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(data)
      });

      const result = await response.json();
      
      return {
        id: contentId,
        updated: result.changed,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('❌ Content update failed:', error.message);
      return null;
    }
  }

  /**
   * Get content
   */
  async getContent(contentId) {
    try {
      const response = await fetch(`${this.drupalUrl}/api/v1/content/${contentId}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });

      const result = await response.json();
      
      return {
        id: result.id,
        type: result.type,
        title: result.title,
        body: result.body,
        status: result.status,
        created: result.created,
        changed: result.changed,
        url: result.url,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('❌ Content fetch failed:', error.message);
      return null;
    }
  }

  /**
   * Query content
   */
  async queryContent(contentType = null, filters = {}, limit = 20, offset = 0) {
    try {
      let url = `${this.drupalUrl}/api/v1/content`;
      
      if (contentType) {
        url += `/${contentType}`;
      }

      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString(),
        ...filters
      });

      const response = await fetch(`${url}?${params}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });

      const result = await response.json();
      
      return {
        contentType,
        filters,
        limit,
        offset,
        total: result.total,
        items: result.items,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('❌ Content query failed:', error.message);
      return null;
    }
  }

  /**
   * Create taxonomy term
   */
  async createTaxonomyTerm(vocabulary, name, parent = null) {
    try {
      const response = await fetch(`${this.drupalUrl}/api/v1/taxonomy/${vocabulary}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          name,
          parent,
          vocabulary
        })
      });

      const result = await response.json();
      
      return {
        id: result.id,
        name,
        vocabulary,
        parent,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('❌ Taxonomy term creation failed:', error.message);
      return null;
    }
  }

  /**
   * Upload media
   */
  async uploadMedia(file, filename, alt = '') {
    try {
      const formData = new FormData();
      formData.append('file', file, filename);
      formData.append('alt', alt);

      const response = await fetch(`${this.drupalUrl}/api/v1/media`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: formData
      });

      const result = await response.json();
      
      return {
        id: result.id,
        filename,
        url: result.url,
        mimeType: result.mime_type,
        size: result.size,
        alt: result.alt,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('❌ Media upload failed:', error.message);
      return null;
    }
  }

  /**
   * Create user
   */
  async createUser(username, email, password, roles = []) {
    try {
      const response = await fetch(`${this.drupalUrl}/api/v1/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          name: username,
          mail: email,
          pass: password,
          status: 1,
          roles
        })
      });

      const result = await response.json();
      
      return {
        id: result.id,
        username,
        email,
        roles,
        status: result.status,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('❌ User creation failed:', error.message);
      return null;
    }
  }

  /**
   * Enable module
   */
  async enableModule(moduleName) {
    try {
      const response = await fetch(`${this.drupalUrl}/api/v1/modules/${moduleName}/enable`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      const result = await response.json();
      
      if (result.success) {
        const module = this.modules.get(moduleName);
        if (module) {
          module.enabled = true;
          this.modules.set(moduleName, module);
        }
      }
      
      return {
        moduleName,
        enabled: result.success,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('❌ Module enablement failed:', error.message);
      return null;
    }
  }

  /**
   * Create workflow
   */
  async createWorkflow(name, entityType, states = [], transitions = []) {
    try {
      const response = await fetch(`${this.drupalUrl}/api/v1/workflows`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          name,
          entityType,
          states,
          transitions
        })
      });

      const result = await response.json();
      
      return {
        id: result.id,
        name,
        entityType,
        states,
        transitions,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('❌ Workflow creation failed:', error.message);
      return null;
    }
  }

  /**
   * Configure layout builder
   */
  async configureLayoutBuilder(contentType, layout) {
    try {
      const response = await fetch(`${this.drupalUrl}/api/v1/layout/${contentType}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          layout,
          entityType: 'node',
          bundle: contentType
        })
      });

      const result = await response.json();
      
      return {
        contentType,
        layout,
        configured: result.success,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('❌ Layout builder configuration failed:', error.message);
      return null;
    }
  }

  /**
   * Enable multilingual support
   */
  async enableMultilingual(languages = ['en', 'es', 'fr', 'de']) {
    try {
      const response = await fetch(`${this.drupalUrl}/api/v1/multilingual`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          enabled: true,
          languages
        })
      });

      const result = await response.json();
      
      return {
        enabled: result.success,
        languages,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('❌ Multilingual enablement failed:', error.message);
      return null;
    }
  }

  /**
   * Get content types
   */
  getContentTypes() {
    const types = [];
    
    for (const [id, type] of this.contentTypes) {
      types.push({
        id,
        ...type
      });
    }

    return types;
  }

  /**
   * Get taxonomies
   */
  getTaxonomies() {
    const taxonomies = [];
    
    for (const [id, taxonomy] of this.taxonomies) {
      taxonomies.push({
        id,
        ...taxonomy
      });
    }

    return taxonomies;
  }

  /**
   * Get modules
   */
  getModules() {
    const modules = [];
    
    for (const [id, module] of this.modules) {
      modules.push({
        id,
        ...module
      });
    }

    return modules;
  }

  /**
   * Get themes
   */
  getThemes() {
    const themes = [];
    
    for (const [id, theme] of this.themes) {
      themes.push({
        id,
        ...theme
      });
    }

    return themes;
  }

  /**
   * Get integration status
   */
  getStatus() {
    return {
      connected: !!this.drupalUrl,
      version: '11.x',
      contentTypes: this.contentTypes.size,
      taxonomies: this.taxonomies.size,
      modules: this.modules.size,
      themes: this.themes.size,
      capabilities: [
        'content_management',
        'taxonomy_system',
        'user_management',
        'api_integration',
        'media_library',
        'workflows',
        'layout_builder',
        'multilingual',
        'enterprise_features',
        'jsonapi',
        'headless_cms',
        'content_versioning',
        'access_control'
      ],
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = { DrupalIntegration };
