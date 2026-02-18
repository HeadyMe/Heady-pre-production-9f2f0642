/**
 * 🤖 OpenAI Integration - Advanced GPT & Codex Capabilities
 * Integrates OpenAI GPT and Codex for advanced AI development
 */

class OpenAIIntegration {
  constructor() {
    this.openaiApiKey = process.env.OPENAI_API_KEY;
    this.orgId = process.env.OPENAI_ORG_ID;
    this.activeSessions = new Map();
    this.codeCache = new Map();
    this.usageMetrics = new Map();
    this.availableModels = [];
  }

  /**
   * Initialize OpenAI integration
   */
  async initialize() {
    console.log('🤖 Initializing OpenAI Integration...');
    
    if (!this.openaiApiKey) {
      throw new Error('OpenAI API key not found in environment variables');
    }

    // Test API connection
    const testResult = await this.testConnection();
    if (!testResult) {
      throw new Error('Failed to connect to OpenAI API');
    }

    // Load available models
    await this.loadAvailableModels();
    
    console.log('✅ OpenAI Integration initialized');
    return {
      status: 'connected',
      orgId: this.orgId,
      models: this.availableModels.length,
      capabilities: [
        'text_generation',
        'code_generation',
        'code_completion',
        'code_analysis',
        'function_calling',
        'embeddings',
        'fine_tuning',
        'image_generation',
        'audio_processing'
      ]
    };
  }

  /**
   * Test API connection
   */
  async testConnection() {
    try {
      const response = await fetch('https://api.openai.com/v1/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.openaiApiKey}`,
          'Content-Type': 'application/json',
          ...(this.orgId && { 'OpenAI-Organization': this.orgId })
        },
        body: JSON.stringify({
          model: 'text-davinci-003',
          prompt: 'Test connection - respond with "connected"',
          max_tokens: 10
        })
      });

      const data = await response.json();
      return data.choices && data.choices[0] && data.choices[0].text.includes('connected');
    } catch (error) {
      console.error('❌ OpenAI connection test failed:', error.message);
      return false;
    }
  }

  /**
   * Load available models
   */
  async loadAvailableModels() {
    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${this.openaiApiKey}`,
          ...(this.orgId && { 'OpenAI-Organization': this.orgId })
        }
      });

      const data = await response.json();
      
      // Filter for relevant models
      this.availableModels = data.data.filter(model => 
        model.id.includes('gpt') || 
        model.id.includes('code') || 
        model.id.includes('text-') ||
        model.id.includes('davinci') ||
        model.id.includes('curie')
      ).map(model => ({
        id: model.id,
        name: model.id,
        owned_by: model.owned_by,
        created: model.created
      }));
      
      console.log(`✅ Loaded ${this.availableModels.length} OpenAI models`);
    } catch (error) {
      console.error('❌ Failed to load models:', error.message);
      this.availableModels = [];
    }
  }

  /**
   * Generate text with GPT
   */
  async generateText(model, prompt, options = {}) {
    try {
      const cacheKey = `${model}_${prompt.substring(0, 50)}`;
      
      if (this.codeCache.has(cacheKey)) {
        return this.codeCache.get(cacheKey);
      }

      const response = await fetch('https://api.openai.com/v1/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.openaiApiKey}`,
          'Content-Type': 'application/json',
          ...(this.orgId && { 'OpenAI-Organization': this.orgId })
        },
        body: JSON.stringify({
          model,
          prompt,
          max_tokens: options.maxTokens || 1000,
          temperature: options.temperature || 0.7,
          top_p: options.topP || 1,
          frequency_penalty: options.frequencyPenalty || 0,
          presence_penalty: options.presencePenalty || 0,
          stop: options.stop || null,
          stream: false
        })
      });

      const data = await response.json();
      
      const result = {
        model,
        prompt,
        response: data.choices[0].text,
        usage: data.usage,
        finishReason: data.choices[0].finish_reason,
        timestamp: Date.now()
      };

      // Cache the result
      this.codeCache.set(cacheKey, result);
      
      // Update usage metrics
      this.updateUsageMetrics(model, data.usage);

      return result;
    } catch (error) {
      console.error('❌ Text generation failed:', error.message);
      return null;
    }
  }

  /**
   * Generate text with ChatGPT
   */
  async generateChatText(model, messages, options = {}) {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.openaiApiKey}`,
          'Content-Type': 'application/json',
          ...(this.orgId && { 'OpenAI-Organization': this.orgId })
        },
        body: JSON.stringify({
          model,
          messages,
          max_tokens: options.maxTokens || 1000,
          temperature: options.temperature || 0.7,
          top_p: options.topP || 1,
          frequency_penalty: options.frequencyPenalty || 0,
          presence_penalty: options.presencePenalty || 0,
          stop: options.stop || null,
          stream: false,
          functions: options.functions || null,
          function_call: options.functionCall || null
        })
      });

      const data = await response.json();
      
      const result = {
        model,
        messages,
        response: data.choices[0].message,
        usage: data.usage,
        finishReason: data.choices[0].finish_reason,
        timestamp: Date.now()
      };

      // Update usage metrics
      this.updateUsageMetrics(model, data.usage);

      return result;
    } catch (error) {
      console.error('❌ Chat text generation failed:', error.message);
      return null;
    }
  }

  /**
   * Generate code with Codex
   */
  async generateCode(model, prompt, language = 'python', options = {}) {
    try {
      const enhancedPrompt = `Generate ${language} code for: ${prompt}\n\nRequirements:\n- Follow best practices\n- Include error handling\n- Add comments\n- Make it production-ready`;
      
      const response = await fetch('https://api.openai.com/v1/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.openaiApiKey}`,
          'Content-Type': 'application/json',
          ...(this.orgId && { 'OpenAI-Organization': this.orgId })
        },
        body: JSON.stringify({
          model: model || 'code-davinci-002',
          prompt: enhancedPrompt,
          max_tokens: options.maxTokens || 2000,
          temperature: options.temperature || 0.1,
          top_p: options.topP || 1,
          frequency_penalty: options.frequencyPenalty || 0,
          presence_penalty: options.presencePenalty || 0,
          stop: ['```', '###'],
          stream: false
        })
      });

      const data = await response.json();
      
      const result = {
        model: model || 'code-davinci-002',
        prompt,
        language,
        code: data.choices[0].text,
        usage: data.usage,
        finishReason: data.choices[0].finish_reason,
        timestamp: Date.now()
      };

      // Update usage metrics
      this.updateUsageMetrics(model, data.usage);

      return result;
    } catch (error) {
      console.error('❌ Code generation failed:', error.message);
      return null;
    }
  }

  /**
   * Complete code
   */
  async completeCode(model, prompt, language = 'python', options = {}) {
    try {
      const response = await fetch('https://api.openai.com/v1/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.openaiApiKey}`,
          'Content-Type': 'application/json',
          ...(this.orgId && { 'OpenAI-Organization': this.orgId })
        },
        body: JSON.stringify({
          model: model || 'code-davinci-002',
          prompt,
          max_tokens: options.maxTokens || 500,
          temperature: options.temperature || 0,
          top_p: options.topP || 1,
          frequency_penalty: options.frequencyPenalty || 0,
          presence_penalty: options.presencePenalty || 0,
          stop: ['\n\n\n\n'],
          stream: false
        })
      });

      const data = await response.json();
      
      const result = {
        model: model || 'code-davinci-002',
        prompt,
        language,
        completion: data.choices[0].text,
        usage: data.usage,
        finishReason: data.choices[0].finish_reason,
        timestamp: Date.now()
      };

      // Update usage metrics
      this.updateUsageMetrics(model, data.usage);

      return result;
    } catch (error) {
      console.error('❌ Code completion failed:', error.message);
      return null;
    }
  }

  /**
   * Analyze code
   */
  async analyzeCode(code, language = 'python', analysisType = 'security') {
    try {
      const prompt = `Analyze this ${language} code for ${analysisType}:\n\n\`\`\`${language}\n${code}\n\`\`\`\n\nProvide detailed analysis with specific recommendations.`;
      
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.openaiApiKey}`,
          'Content-Type': 'application/json',
          ...(this.orgId && { 'OpenAI-Organization': this.orgId })
        },
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [
            {
              role: 'system',
              content: 'You are an expert code analyzer providing detailed security and performance analysis.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 1500,
          temperature: 0.1
        })
      });

      const data = await response.json();
      
      return {
        code,
        language,
        analysisType,
        analysis: data.choices[0].message.content,
        usage: data.usage,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('❌ Code analysis failed:', error.message);
      return null;
    }
  }

  /**
   * Generate embeddings
   */
  async generateEmbeddings(texts, model = 'text-embedding-ada-002') {
    try {
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.openaiApiKey}`,
          'Content-Type': 'application/json',
          ...(this.orgId && { 'OpenAI-Organization': this.orgId })
        },
        body: JSON.stringify({
          input: Array.isArray(texts) ? texts : [texts],
          model
        })
      });

      const data = await response.json();
      
      return {
        model,
        input: texts,
        embeddings: data.data.map(item => item.embedding),
        usage: data.usage,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('❌ Embeddings generation failed:', error.message);
      return null;
    }
  }

  /**
   * Generate image
   */
  async generateImage(prompt, options = {}) {
    try {
      const response = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.openaiApiKey}`,
          'Content-Type': 'application/json',
          ...(this.orgId && { 'OpenAI-Organization': this.orgId })
        },
        body: JSON.stringify({
          prompt,
          n: options.n || 1,
          size: options.size || '1024x1024',
          response_format: options.responseFormat || 'url',
          style: options.style || 'vivid'
        })
      });

      const data = await response.json();
      
      return {
        prompt,
        images: data.data,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('❌ Image generation failed:', error.message);
      return null;
    }
  }

  /**
   * Transcribe audio
   */
  async transcribeAudio(audioFile, language = 'en') {
    try {
      const formData = new FormData();
      formData.append('file', audioFile);
      formData.append('model', 'whisper-1');
      formData.append('language', language);
      formData.append('response_format', 'json');

      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.openaiApiKey}`,
          ...(this.orgId && { 'OpenAI-Organization': this.orgId })
        },
        body: formData
      });

      const data = await response.json();
      
      return {
        audioFile,
        language,
        transcription: data.text,
        duration: data.duration,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('❌ Audio transcription failed:', error.message);
      return null;
    }
  }

  /**
   * Create fine-tuning job
   */
  async createFineTuningJob(trainingFile, model = 'gpt-3.5-turbo', hyperparameters = {}) {
    try {
      const response = await fetch('https://api.openai.com/v1/fine_tuning/jobs', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.openaiApiKey}`,
          'Content-Type': 'application/json',
          ...(this.orgId && { 'OpenAI-Organization': this.orgId })
        },
        body: JSON.stringify({
          training_file: trainingFile,
          model,
          hyperparameters: {
            batch_size: hyperparameters.batchSize || null,
            learning_rate_multiplier: hyperparameters.learningRateMultiplier || null,
            n_epochs: hyperparameters.nEpochs || null
          }
        })
      });

      const data = await response.json();
      
      return {
        jobId: data.id,
        model,
        trainingFile,
        status: data.status,
        hyperparameters,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('❌ Fine-tuning job creation failed:', error.message);
      return null;
    }
  }

  /**
   * Get fine-tuning job status
   */
  async getFineTuningJobStatus(jobId) {
    try {
      const response = await fetch(`https://api.openai.com/v1/fine_tuning/jobs/${jobId}`, {
        headers: {
          'Authorization': `Bearer ${this.openaiApiKey}`,
          ...(this.orgId && { 'OpenAI-Organization': this.orgId })
        }
      });

      const data = await response.json();
      
      return {
        jobId,
        status: data.status,
        model: data.model,
        trainedTokens: data.trained_tokens,
        error: data.error,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('❌ Fine-tuning status check failed:', error.message);
      return null;
    }
  }

  /**
   * Update usage metrics
   */
  updateUsageMetrics(model, usage) {
    if (!this.usageMetrics.has(model)) {
      this.usageMetrics.set(model, {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        requests: 0
      });
    }

    const metrics = this.usageMetrics.get(model);
    metrics.promptTokens += usage.prompt_tokens;
    metrics.completionTokens += usage.completion_tokens;
    metrics.totalTokens += usage.total_tokens;
    metrics.requests += 1;
  }

  /**
   * Get usage metrics
   */
  getUsageMetrics() {
    const metrics = {};
    
    for (const [model, data] of this.usageMetrics) {
      metrics[model] = data;
    }

    return metrics;
  }

  /**
   * Get available models
   */
  getAvailableModels() {
    return this.availableModels;
  }

  /**
   * Get integration status
   */
  getStatus() {
    return {
      connected: !!this.openaiApiKey,
      orgId: this.orgId,
      availableModels: this.availableModels.length,
      activeSessions: this.activeSessions.size,
      cacheSize: this.codeCache.size,
      capabilities: [
        'text_generation',
        'code_generation',
        'code_completion',
        'code_analysis',
        'function_calling',
        'embeddings',
        'fine_tuning',
        'image_generation',
        'audio_processing',
        'chat_completion'
      ],
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = { OpenAIIntegration };
