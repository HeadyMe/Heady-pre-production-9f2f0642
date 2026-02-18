/**
 * 🐙 GitHub Enterprise Integration - Advanced Code Management
 * Integrates GitHub Enterprise for advanced code collaboration and automation
 */

class GitHubEnterpriseIntegration {
  constructor() {
    this.githubToken = process.env.GITHUB_TOKEN;
    this.enterpriseUrl = process.env.GITHUB_ENTERPRISE_URL;
    this.orgName = 'HeadySystems';
    this.repositories = new Map();
    this.actions = new Map();
    this.policies = new Map();
    this.teams = new Map();
  }

  /**
   * Initialize GitHub Enterprise integration
   */
  async initialize() {
    console.log('🐙 Initializing GitHub Enterprise Integration...');
    
    if (!this.githubToken) {
      throw new Error('GitHub token not found in environment variables');
    }

    // Test API connection
    const testResult = await this.testConnection();
    if (!testResult) {
      throw new Error('Failed to connect to GitHub Enterprise API');
    }

    // Initialize enterprise features
    await this.initializeEnterpriseFeatures();
    
    console.log('✅ GitHub Enterprise Integration initialized');
    return {
      status: 'connected',
      enterprise: true,
      orgName: this.orgName,
      capabilities: [
        'advanced_security',
        'code_scanning',
        'dependabot',
        'actions_enterprise',
        'packages',
        'copilot_enterprise',
        'team_management',
        'policy_enforcement',
        'audit_logs',
        'enterprise_automation'
      ]
    };
  }

  /**
   * Test API connection
   */
  async testConnection() {
    try {
      const baseUrl = this.enterpriseUrl || 'https://api.github.com';
      const response = await fetch(`${baseUrl}/user`, {
        headers: {
          'Authorization': `token ${this.githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'X-GitHub-Api-Version': '2022-11-28'
        }
      });

      const data = await response.json();
      return data.login && data.id;
    } catch (error) {
      console.error('❌ GitHub connection test failed:', error.message);
      return false;
    }
  }

  /**
   * Initialize enterprise features
   */
  async initializeEnterpriseFeatures() {
    // Advanced Security
    this.policies.set('security', {
      codeScanning: true,
      dependabot: true,
      secretScanning: true,
      securityAdvisories: true,
      vulnerabilityAlerts: true
    });

    // Code Policies
    this.policies.set('code', {
      requireReviews: true,
      requireStatusChecks: true,
      enforceAdmins: false,
      allowForcePushes: false,
      allowDeletions: false
    });

    // Team Management
    this.teams.set('core', {
      name: 'core-team',
      permission: 'admin',
      members: [],
      repositories: ['all']
    });

    this.teams.set('developers', {
      name: 'developers',
      permission: 'write',
      members: [],
      repositories: ['Heady', 'HeadyWeb', 'HeadyManager']
    });

    // Actions
    this.actions.set('ci_cd', {
      name: 'CI/CD Pipeline',
      enabled: true,
      workflows: ['build', 'test', 'deploy', 'security-scan'],
      runners: 'enterprise'
    });
  }

  /**
   * Create repository
   */
  async createRepository(name, description = '', isPrivate = true, teamId = null) {
    try {
      const baseUrl = this.enterpriseUrl || 'https://api.github.com';
      const response = await fetch(`${baseUrl}/orgs/${this.orgName}/repos`, {
        method: 'POST',
        headers: {
          'Authorization': `token ${this.githubToken}`,
          'Content-Type': 'application/json',
          'X-GitHub-Api-Version': '2022-11-28'
        },
        body: JSON.stringify({
          name,
          description,
          private: isPrivate,
          auto_init: true,
          gitignore_template: 'Node',
          license_template: 'mit',
          team_id: teamId
        })
      });

      const data = await response.json();
      
      if (data.id) {
        const repo = {
          id: data.id,
          name: data.name,
          fullName: data.full_name,
          description: data.description,
          private: data.private,
          url: data.html_url,
          cloneUrl: data.clone_url,
          createdAt: data.created_at,
          timestamp: Date.now()
        };

        this.repositories.set(name, repo);
        
        // Initialize repository with enterprise features
        await this.initializeRepository(repo);
        
        return repo;
      }
      
      return null;
    } catch (error) {
      console.error('❌ Repository creation failed:', error.message);
      return null;
    }
  }

  /**
   * Initialize repository with enterprise features
   */
  async initializeRepository(repo) {
    // Enable advanced security
    await this.enableAdvancedSecurity(repo.fullName);
    
    // Enable dependabot
    await this.enableDependabot(repo.fullName);
    
    // Create default workflows
    await this.createDefaultWorkflows(repo.fullName);
    
    // Set up branch protection
    await this.setupBranchProtection(repo.fullName);
  }

  /**
   * Enable advanced security
   */
  async enableAdvancedSecurity(repoFullName) {
    try {
      const baseUrl = this.enterpriseUrl || 'https://api.github.com';
      const response = await fetch(`${baseUrl}/repos/${repoFullName}/security/enable`, {
        method: 'PUT',
        headers: {
          'Authorization': `token ${this.githubToken}`,
          'Content-Type': 'application/json',
          'X-GitHub-Api-Version': '2022-11-28'
        }
      });

      return response.ok;
    } catch (error) {
      console.error('❌ Advanced security enablement failed:', error.message);
      return false;
    }
  }

  /**
   * Enable dependabot
   */
  async enableDependabot(repoFullName) {
    try {
      const dependabotConfig = {
        version: 2,
        updates: [
          {
            packageEcosystem: 'npm',
            directory: '/',
            schedule: {
              interval: 'weekly',
              day: 'monday',
              time: '09:00'
            },
            openPullRequestsLimit: 10,
            reviewers: ['core-team'],
            assignees: ['core-team']
          },
          {
            packageEcosystem: 'docker',
            directory: '/',
            schedule: {
              interval: 'weekly',
              day: 'monday',
              time: '09:00'
            }
          }
        ]
      };

      const baseUrl = this.enterpriseUrl || 'https://api.github.com';
      const response = await fetch(`${baseUrl}/repos/${repoFullName}/contents/.github/dependabot.yml`, {
        method: 'PUT',
        headers: {
          'Authorization': `token ${this.githubToken}`,
          'Content-Type': 'application/json',
          'X-GitHub-Api-Version': '2022-11-28'
        },
        body: JSON.stringify({
          message: 'Add dependabot configuration',
          content: Buffer.from(JSON.stringify(dependabotConfig, null, 2)).toString('base64')
        })
      });

      return response.ok;
    } catch (error) {
      console.error('❌ Dependabot enablement failed:', error.message);
      return false;
    }
  }

  /**
   * Create default workflows
   */
  async createDefaultWorkflows(repoFullName) {
    const workflows = [
      {
        name: 'ci.yml',
        path: '.github/workflows/ci.yml',
        content: {
          name: 'CI Pipeline',
          on: ['push', 'pull_request'],
          jobs: {
            test: {
              'runs-on': 'ubuntu-latest',
              steps: [
                { uses: 'actions/checkout@v4' },
                { uses: 'actions/setup-node@v4', with: { 'node-version': '18' } },
                { run: 'npm ci' },
                { run: 'npm test' },
                { run: 'npm run lint' }
              ]
            },
            security: {
              'runs-on': 'ubuntu-latest',
              steps: [
                { uses: 'actions/checkout@v4' },
                { uses: 'github/codeql-action/init@v2', with: { 'languages': 'javascript' } },
                { uses: 'github/codeql-action/analyze@v2' }
              ]
            }
          }
        }
      },
      {
        name: 'deploy.yml',
        path: '.github/workflows/deploy.yml',
        content: {
          name: 'Deploy to Production',
          on: { push: { branches: ['main'] } },
          jobs: {
            deploy: {
              'runs-on': 'ubuntu-latest',
              steps: [
                { uses: 'actions/checkout@v4' },
                { uses: 'actions/setup-node@v4', with: { 'node-version': '18' } },
                { run: 'npm ci' },
                { run: 'npm run build' },
                { run: 'npm run deploy' }
              ]
            }
          }
        }
      }
    ];

    const baseUrl = this.enterpriseUrl || 'https://api.github.com';
    
    for (const workflow of workflows) {
      try {
        await fetch(`${baseUrl}/repos/${repoFullName}/contents/${workflow.path}`, {
          method: 'PUT',
          headers: {
            'Authorization': `token ${this.githubToken}`,
            'Content-Type': 'application/json',
            'X-GitHub-Api-Version': '2022-11-28'
          },
          body: JSON.stringify({
            message: `Add ${workflow.name}`,
            content: Buffer.from(JSON.stringify(workflow.content, null, 2)).toString('base64')
          })
        });
      } catch (error) {
        console.error(`❌ Workflow creation failed: ${workflow.name}`, error.message);
      }
    }
  }

  /**
   * Setup branch protection
   */
  async setupBranchProtection(repoFullName, branch = 'main') {
    try {
      const baseUrl = this.enterpriseUrl || 'https://api.github.com';
      const response = await fetch(`${baseUrl}/repos/${repoFullName}/branches/${branch}/protection`, {
        method: 'PUT',
        headers: {
          'Authorization': `token ${this.githubToken}`,
          'Content-Type': 'application/json',
          'X-GitHub-Api-Version': '2022-11-28'
        },
        body: JSON.stringify({
          requiredStatusChecks: {
            strict: true,
            contexts: ['ci', 'security']
          },
          enforceAdmins: false,
          requiredPullRequestReviews: {
            dismissalRestrictions: null,
            dismissStaleReviews: true,
            requireCodeOwnerReviews: true,
            requiredApprovingReviewCount: 1
          },
          restrictions: null,
          allowForcePushes: false,
          allowDeletions: false
        })
      });

      return response.ok;
    } catch (error) {
      console.error('❌ Branch protection setup failed:', error.message);
      return false;
    }
  }

  /**
   * Create team
   */
  async createTeam(name, description = '', permission = 'push') {
    try {
      const baseUrl = this.enterpriseUrl || 'https://api.github.com';
      const response = await fetch(`${baseUrl}/orgs/${this.orgName}/teams`, {
        method: 'POST',
        headers: {
          'Authorization': `token ${this.githubToken}`,
          'Content-Type': 'application/json',
          'X-GitHub-Api-Version': '2022-11-28'
        },
        body: JSON.stringify({
          name,
          description,
          permission,
          privacy: 'closed'
        })
      });

      const data = await response.json();
      
      if (data.id) {
        const team = {
          id: data.id,
          name: data.name,
          description: data.description,
          permission: data.permission,
          privacy: data.privacy,
          membersCount: data.members_count,
          reposCount: data.repos_count,
          timestamp: Date.now()
        };

        this.teams.set(name, team);
        
        return team;
      }
      
      return null;
    } catch (error) {
      console.error('❌ Team creation failed:', error.message);
      return null;
    }
  }

  /**
   * Add member to team
   */
  async addTeamMember(teamId, username, role = 'member') {
    try {
      const baseUrl = this.enterpriseUrl || 'https://api.github.com';
      const response = await fetch(`${baseUrl}/teams/${teamId}/memberships/${username}`, {
        method: 'PUT',
        headers: {
          'Authorization': `token ${this.githubToken}`,
          'Content-Type': 'application/json',
          'X-GitHub-Api-Version': '2022-11-28'
        },
        body: JSON.stringify({
          role
        })
      });

      return response.ok;
    } catch (error) {
      console.error('❌ Team member addition failed:', error.message);
      return false;
    }
  }

  /**
   * Create enterprise runner
   */
  async createEnterpriseRunner(name, labels = [], runnerGroup = 'default') {
    try {
      const baseUrl = this.enterpriseUrl || 'https://api.github.com';
      const response = await fetch(`${baseUrl}/enterprises/${this.orgName}/actions/runners`, {
        method: 'POST',
        headers: {
          'Authorization': `token ${this.githubToken}`,
          'Content-Type': 'application/json',
          'X-GitHub-Api-Version': '2022-11-28'
        },
        body: JSON.stringify({
          name,
          runner_group_id: runnerGroup,
          labels,
          busy: false
        })
      });

      const data = await response.json();
      
      return {
        id: data.id,
        name,
        labels,
        runnerGroup,
        registrationToken: data.registration_token,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('❌ Enterprise runner creation failed:', error.message);
      return null;
    }
  }

  /**
   * Get audit logs
   */
  async getAuditLogs(timeRange = '24h', action = null) {
    try {
      const baseUrl = this.enterpriseUrl || 'https://api.github.com';
      let url = `${baseUrl}/orgs/${this.orgName}/audit-log`;
      
      if (action) {
        url += `?action=${action}`;
      }

      const response = await fetch(url, {
        headers: {
          'Authorization': `token ${this.githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'X-GitHub-Api-Version': '2022-11-28'
        }
      });

      const data = await response.json();
      
      return {
        timeRange,
        action,
        logs: data,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('❌ Audit logs fetch failed:', error.message);
      return null;
    }
  }

  /**
   * Enable Copilot for organization
   */
  async enableCopilotForOrg(seatCount = 10) {
    try {
      const baseUrl = this.enterpriseUrl || 'https://api.github.com';
      const response = await fetch(`${baseUrl}/orgs/${this.orgName}/copilot/billing`, {
        method: 'POST',
        headers: {
          'Authorization': `token ${this.githubToken}`,
          'Content-Type': 'application/json',
          'X-GitHub-Api-Version': '2022-11-28'
        },
        body: JSON.stringify({
          seat_count: seatCount,
          auto_renew: true
        })
      });

      const data = await response.json();
      
      return {
        seatCount,
        autoRenew: true,
        billing: data,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('❌ Copilot enablement failed:', error.message);
      return null;
    }
  }

  /**
   * Get organization policies
   */
  async getOrgPolicies() {
    try {
      const baseUrl = this.enterpriseUrl || 'https://api.github.com';
      const response = await fetch(`${baseUrl}/orgs/${this.orgName}/actions/permissions`, {
        headers: {
          'Authorization': `token ${this.githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'X-GitHub-Api-Version': '2022-11-28'
        }
      });

      const data = await response.json();
      
      return {
        enabledActions: data.enabled_actions,
        allowedActions: data.allowed_actions,
        selectedActions: data.selected_actions,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('❌ Organization policies fetch failed:', error.message);
      return null;
    }
  }

  /**
   * Get repositories
   */
  getRepositories() {
    const repos = [];
    
    for (const [name, repo] of this.repositories) {
      repos.push(repo);
    }

    return repos;
  }

  /**
   * Get teams
   */
  getTeams() {
    const teams = [];
    
    for (const [name, team] of this.teams) {
      teams.push(team);
    }

    return teams;
  }

  /**
   * Get policies
   */
  getPolicies() {
    const policies = {};
    
    for (const [category, policy] of this.policies) {
      policies[category] = policy;
    }

    return policies;
  }

  /**
   * Get integration status
   */
  getStatus() {
    return {
      connected: !!this.githubToken,
      enterprise: true,
      enterpriseUrl: this.enterpriseUrl,
      orgName: this.orgName,
      repositories: this.repositories.size,
      teams: this.teams.size,
      policies: this.policies.size,
      actions: this.actions.size,
      capabilities: [
        'advanced_security',
        'code_scanning',
        'dependabot',
        'actions_enterprise',
        'packages',
        'copilot_enterprise',
        'team_management',
        'policy_enforcement',
        'audit_logs',
        'enterprise_automation',
        'branch_protection',
        'enterprise_runners',
        'organization_policies'
      ],
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = { GitHubEnterpriseIntegration };
