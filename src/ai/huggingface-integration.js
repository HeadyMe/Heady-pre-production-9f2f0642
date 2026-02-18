/**
 * 🤗 Hugging Face Integration - Advanced ML Model Access
 * Integrates Hugging Face for model inference and deployment
 */

class HuggingFaceIntegration {
  constructor() {
    this.hfApiKey = process.env.HUGGINGFACE_API_KEY;
    this.activeModels = new Map();
    this.modelCache = new Map();
    this.inferenceHistory = [];
    this.availableModels = [];
  }

  /**
   * Initialize Hugging Face integration
   */
  async initialize() {
    console.log('🤗 Initializing Hugging Face Integration...');
    
    if (!this.hfApiKey) {
      throw new Error('Hugging Face API key not found in environment variables');
    }

    // Test API connection
    const testResult = await this.testConnection();
    if (!testResult) {
      throw new Error('Failed to connect to Hugging Face API');
    }

    // Load available models
    await this.loadAvailableModels();
    
    console.log('✅ Hugging Face Integration initialized');
    return {
      status: 'connected',
      models: this.availableModels.length,
      capabilities: [
        'text_generation',
        'text_classification',
        'sentiment_analysis',
        'question_answering',
        'summarization',
        'translation',
        'code_generation',
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
      const response = await fetch('https://api-inference.huggingface.co/models/bigscience/bloom-560M', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.hfApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          inputs: 'Test connection - respond with "connected"',
          parameters: {
            max_new_tokens: 10,
            temperature: 0.1
          }
        })
      });

      const data = await response.json();
      return data && data[0] && data[0].generated_text.includes('connected');
    } catch (error) {
      console.error('❌ Hugging Face connection test failed:', error.message);
      return false;
    }
  }

  /**
   * Load available models
   */
  async loadAvailableModels() {
    try {
      const models = [
        // Text Generation
        'bigscience/bloom-560m',
        'EleutherAI/gpt-neo-125m',
        'microsoft/DialoGPT-medium',
        'google/flan-t5-small',
        
        // Code Generation
        'codeparrot/codeparrot-small',
        'bigcode/gpt-bigcode-small-15m',
        'Salesforce/codegen-350m-mono',
        
        // Classification
        'cardiffnlp/twitter-roberta-base-sentiment',
        'distilbert-base-uncased-finetuned-sst-2-english',
        'facebook/bart-large-mnli',
        
        // Question Answering
        'distilbert-base-cased-distilled-squad',
        'deepset/roberta-base-squad2',
        
        // Summarization
        'facebook/bart-large-cnn',
        't5-small',
        
        // Translation
        'Helsinki-NLP/opus-mt-en-es',
        'Helsinki-NLP/opus-mt-en-fr',
        
        // Image Generation
        'runwayml/stable-diffusion-v1-5',
        'CompVis/stable-diffusion-v1-4',
        
        // Audio Processing
        'openai/whisper-base',
        'facebook/wav2vec2-base'
      ];

      this.availableModels = models;
      console.log(`✅ Loaded ${models.length} models`);
    } catch (error) {
      console.error('❌ Failed to load models:', error.message);
      this.availableModels = [];
    }
  }

  /**
   * Generate text with model
   */
  async generateText(modelId, inputs, parameters = {}) {
    try {
      const cacheKey = `${modelId}_${inputs.substring(0, 50)}`;
      
      if (this.modelCache.has(cacheKey)) {
        return this.modelCache.get(cacheKey);
      }

      const response = await fetch(`https://api-inference.huggingface.co/models/${modelId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.hfApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          inputs,
          parameters: {
            max_new_tokens: parameters.max_tokens || 100,
            temperature: parameters.temperature || 0.7,
            top_p: parameters.top_p || 0.9,
            do_sample: parameters.do_sample !== false,
            ...parameters
          }
        })
      });

      const data = await response.json();
      
      const result = {
        modelId,
        inputs,
        outputs: data,
        parameters,
        timestamp: Date.now(),
        inferenceTime: Date.now()
      };

      // Cache the result
      this.modelCache.set(cacheKey, result);
      this.inferenceHistory.push(result);

      // Keep only last 100 results
      if (this.inferenceHistory.length > 100) {
        this.inferenceHistory = this.inferenceHistory.slice(-100);
      }

      return result;
    } catch (error) {
      console.error('❌ Text generation failed:', error.message);
      return null;
    }
  }

  /**
   * Classify text
   */
  async classifyText(modelId, inputs, candidateLabels = null) {
    try {
      const response = await fetch(`https://api-inference.huggingface.co/models/${modelId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.hfApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          inputs,
          parameters: {
            candidate_labels: candidateLabels
          }
        })
      });

      const data = await response.json();
      
      return {
        modelId,
        inputs,
        classification: data,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('❌ Text classification failed:', error.message);
      return null;
    }
  }

  /**
   * Analyze sentiment
   */
  async analyzeSentiment(inputs) {
    try {
      const modelId = 'cardiffnlp/twitter-roberta-base-sentiment';
      
      const response = await fetch(`https://api-inference.huggingface.co/models/${modelId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.hfApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          inputs: Array.isArray(inputs) ? inputs : [inputs]
        })
      });

      const data = await response.json();
      
      const results = Array.isArray(data) ? data : [data];
      
      return {
        modelId,
        inputs,
        results: results.map((result, index) => ({
          input: Array.isArray(inputs) ? inputs[index] : inputs,
          label: result[0].label,
          score: result[0].score
        })),
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('❌ Sentiment analysis failed:', error.message);
      return null;
    }
  }

  /**
   * Answer questions
   */
  async answerQuestion(modelId, question, context = '') {
    try {
      const inputs = context ? `${context}\n\nQuestion: ${question}` : question;
      
      const response = await fetch(`https://api-inference.huggingface.co/models/${modelId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.hfApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          inputs,
          parameters: {
            max_new_tokens: 150,
            temperature: 0.1,
            do_sample: false
          }
        })
      });

      const data = await response.json();
      
      return {
        modelId,
        question,
        context,
        answer: data[0].generated_text,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('❌ Question answering failed:', error.message);
      return null;
    }
  }

  /**
   * Summarize text
   */
  async summarizeText(modelId, text, maxLength = 150) {
    try {
      const inputs = `Summarize the following text in ${maxLength} words or less:\n\n${text}`;
      
      const response = await fetch(`https://api-inference.huggingface.co/models/${modelId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.hfApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          inputs,
          parameters: {
            max_new_tokens: maxLength,
            temperature: 0.3,
            do_sample: false
          }
        })
      });

      const data = await response.json();
      
      return {
        modelId,
        originalText: text,
        summary: data[0].generated_text,
        maxLength,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('❌ Text summarization failed:', error.message);
      return null;
    }
  }

  /**
   * Translate text
   */
  async translateText(modelId, text, sourceLang, targetLang) {
    try {
      const inputs = `Translate the following text from ${sourceLang} to ${targetLang}:\n\n${text}`;
      
      const response = await fetch(`https://api-inference.huggingface.co/models/${modelId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.hfApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          inputs,
          parameters: {
            max_new_tokens: 200,
            temperature: 0.1
          }
        })
      });

      const data = await response.json();
      
      return {
        modelId,
        originalText: text,
        sourceLang,
        targetLang,
        translation: data[0].translation_text,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('❌ Translation failed:', error.message);
      return null;
    }
  }

  /**
   * Generate code
   */
  async generateCode(modelId, prompt, language = 'python', context = '') {
    try {
      const inputs = context 
        ? `Generate ${language} code for: ${prompt}\n\nContext: ${context}`
        : `Generate ${language} code for: ${prompt}`;
      
      const response = await fetch(`https://api-inference.huggingface.co/models/${modelId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.hfApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          inputs,
          parameters: {
            max_new_tokens: 500,
            temperature: 0.2,
            do_sample: true
          }
        })
      });

      const data = await response.json();
      
      return {
        modelId,
        prompt,
        language,
        context,
        code: data[0].generated_text,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('❌ Code generation failed:', error.message);
      return null;
    }
  }

  /**
   * Generate image
   */
  async generateImage(modelId, prompt, negativePrompt = '', steps = 20) {
    try {
      const response = await fetch(`https://api-inference.huggingface.co/models/${modelId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.hfApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          inputs: prompt,
          parameters: {
            negative_prompt: negativePrompt,
            num_inference_steps: steps,
            guidance_scale: 7.5,
            width: 512,
            height: 512
          }
        })
      });

      const data = await response.json();
      
      return {
        modelId,
        prompt,
        negativePrompt,
        image: data.images[0],
        parameters: {
          steps,
          guidance_scale: 7.5,
          width: 512,
          height: 512
        },
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('❌ Image generation failed:', error.message);
      return null;
    }
  }

  /**
   * Process audio
   */
  async processAudio(modelId, audioData, task = 'transcribe') {
    try {
      const formData = new FormData();
      formData.append('inputs', audioData);
      
      const response = await fetch(`https://api-inference.huggingface.co/models/${modelId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.hfApiKey}`
        },
        body: formData
      });

      const data = await response.json();
      
      return {
        modelId,
        task,
        transcription: data.text,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('❌ Audio processing failed:', error.message);
      return null;
    }
  }

  /**
   * Get model information
   */
  async getModelInfo(modelId) {
    try {
      const response = await fetch(`https://huggingface.co/api/models/${modelId}`);
      const data = await response.json();
      
      return {
        modelId,
        name: data.modelId,
        pipelineTag: data.pipeline_tag,
        tags: data.tags,
        likes: data.likes,
        downloads: data.downloads,
        description: data.description,
        language: data.language,
        library_name: data.library_name,
        tags: data.tags
      };
    } catch (error) {
      console.error('❌ Failed to get model info:', error.message);
      return null;
    }
  }

  /**
   * Search models
   */
  async searchModels(query, task = null, library = null) {
    try {
      let url = `https://huggingface.co/api/models?search=${encodeURIComponent(query)}`;
      
      if (task) {
        url += `&pipeline_tag=${task}`;
      }
      
      if (library) {
        url += `&library=${library}`;
      }

      const response = await fetch(url);
      const data = await response.json();
      
      return {
        query,
        task,
        library,
        models: data.slice(0, 20), // Limit to 20 results
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('❌ Model search failed:', error.message);
      return null;
    }
  }

  /**
   * Get integration status
   */
  getStatus() {
    return {
      connected: !!this.hfApiKey,
      availableModels: this.availableModels.length,
      activeModels: this.activeModels.size,
      cacheSize: this.modelCache.size,
      inferenceHistory: this.inferenceHistory.length,
      capabilities: [
        'text_generation',
        'text_classification',
        'sentiment_analysis',
        'question_answering',
        'summarization',
        'translation',
        'code_generation',
        'image_generation',
        'audio_processing',
        'model_search',
        'model_info'
      ],
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = { HuggingFaceIntegration };
