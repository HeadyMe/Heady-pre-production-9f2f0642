/**
 * 🇷🇺 Yandex AI Integration - Advanced Russian AI Services
 * Integrates Yandex AI for multilingual capabilities and Russian market expertise
 */

class YandexIntegration {
  constructor() {
    this.yandexApiKey = process.env.YANDEX_API_KEY;
    this.yandexCloudId = process.env.YANDEX_CLOUD_ID;
    this.translationHistory = [];
    this.searchHistory = [];
    this.voiceSessions = new Map();
    this.activeModels = new Map();
  }

  /**
   * Initialize Yandex AI integration
   */
  async initialize() {
    console.log('🇷🇺 Initializing Yandex AI Integration...');
    
    if (!this.yandexApiKey) {
      throw new Error('Yandex API key not found in environment variables');
    }

    // Test API connection
    const testResult = await this.testConnection();
    if (!testResult) {
      throw new Error('Failed to connect to Yandex API');
    }

    // Initialize available models
    await this.initializeModels();
    
    console.log('✅ Yandex AI Integration initialized');
    return {
      status: 'connected',
      cloudId: this.yandexCloudId,
      capabilities: [
        'translation',
        'search',
        'voice_recognition',
        'voice_synthesis',
        'text_generation',
        'image_analysis',
        'geocoding',
        'weather_data'
      ]
    };
  }

  /**
   * Test API connection
   */
  async testConnection() {
    try {
      const response = await fetch('https://translate.api.cloud.yandex.net/translate/v2/translate', {
        method: 'POST',
        headers: {
          'Authorization': `Api-Key ${this.yandexApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sourceLanguageCode: 'en',
          targetLanguageCode: 'ru',
          texts: ['test connection']
        })
      });

      const data = await response.json();
      return data.translations && data.translations.length > 0;
    } catch (error) {
      console.error('❌ Yandex connection test failed:', error.message);
      return false;
    }
  }

  /**
   * Initialize available models
   */
  async initializeModels() {
    this.activeModels.set('yandexgpt', {
      name: 'YandexGPT',
      type: 'text_generation',
      maxTokens: 8000,
      languages: ['ru', 'en']
    });

    this.activeModels.set('yart', {
      name: 'YaRT',
      type: 'text_generation',
      maxTokens: 32000,
      languages: ['ru', 'en']
    });

    this.activeModels.set('speechkit', {
      name: 'SpeechKit',
      type: 'voice_processing',
      supportedFormats: ['mp3', 'wav', 'ogg'],
      languages: ['ru', 'en', 'de', 'fr', 'es', 'it']
    });

    this.activeModels.set('vision', {
      name: 'Vision',
      type: 'image_analysis',
      supportedFormats: ['jpg', 'png', 'jpeg'],
      capabilities: ['classification', 'detection', 'ocr']
    });
  }

  /**
   * Translate text
   */
  async translateText(text, sourceLang, targetLang) {
    try {
      const response = await fetch('https://translate.api.cloud.yandex.net/translate/v2/translate', {
        method: 'POST',
        headers: {
          'Authorization': `Api-Key ${this.yandexApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sourceLanguageCode: sourceLang,
          targetLanguageCode: targetLang,
          texts: Array.isArray(text) ? text : [text],
          format: 'PLAIN_TEXT'
        })
      });

      const data = await response.json();
      
      const result = {
        sourceText: text,
        sourceLanguage: sourceLang,
        targetLanguage: targetLang,
        translations: data.translations,
        timestamp: Date.now()
      };

      this.translationHistory.push(result);
      
      // Keep only last 100 translations
      if (this.translationHistory.length > 100) {
        this.translationHistory = this.translationHistory.slice(-100);
      }

      return result;
    } catch (error) {
      console.error('❌ Translation failed:', error.message);
      return null;
    }
  }

  /**
   * Search with Yandex
   */
  async search(query, language = 'ru', count = 10) {
    try {
      const response = await fetch('https://yandex.ru/search/xml', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/xml'
        },
        body: `<?xml version="1.0" encoding="utf-8"?>
          <request>
            <query>${query}</query>
            <page>0</page>
            <groupings>
              <groupby attr="d" mode="deep" groups-on-page="10" docs-in-group="1" />
            </groupings>
            <lr>${language}</lr>
          </request>`
      });

      const data = await response.text();
      
      const result = {
        query,
        language,
        results: this.parseSearchResults(data),
        count,
        timestamp: Date.now()
      };

      this.searchHistory.push(result);
      
      // Keep only last 50 searches
      if (this.searchHistory.length > 50) {
        this.searchHistory = this.searchHistory.slice(-50);
      }

      return result;
    } catch (error) {
      console.error('❌ Search failed:', error.message);
      return null;
    }
  }

  /**
   * Recognize speech
   */
  async recognizeSpeech(audioData, language = 'ru') {
    try {
      const formData = new FormData();
      formData.append('audio', audioData);
      formData.append('config', JSON.stringify({
        specification: {
          languageCode: language,
          model: 'general:latest',
          audioEncoding: 'MP3',
          sampleRateHertz: 48000
        }
      }));

      const response = await fetch('https://stt.api.cloud.yandex.net/speech/v1/stt:recognize', {
        method: 'POST',
        headers: {
          'Authorization': `Api-Key ${this.yandexApiKey}`
        },
        body: formData
      });

      const data = await response.json();
      
      return {
        audioData,
        language,
        transcription: data.result,
        confidence: data.confidence || 0.8,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('❌ Speech recognition failed:', error.message);
      return null;
    }
  }

  /**
   * Synthesize speech
   */
  async synthesizeSpeech(text, voice = 'ermil', emotion = 'neutral', language = 'ru') {
    try {
      const response = await fetch('https://tts.api.cloud.yandex.net/speech/v1/tts:synthesize', {
        method: 'POST',
        headers: {
          'Authorization': `Api-Key ${this.yandexApiKey}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          text,
          voice,
          emotion,
          lang: language,
          format: 'mp3',
          sampleRateHertz: '48000'
        })
      });

      const audioData = await response.arrayBuffer();
      
      return {
        text,
        voice,
        emotion,
        language,
        audioData,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('❌ Speech synthesis failed:', error.message);
      return null;
    }
  }

  /**
   * Generate text with YandexGPT
   */
  async generateText(model, prompt, temperature = 0.3, maxTokens = 1000) {
    try {
      const response = await fetch('https://llm.api.cloud.yandex.net/foundationModels/v1/completion', {
        method: 'POST',
        headers: {
          'Authorization': `Api-Key ${this.yandexApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          modelUri: `gpt://${this.yandexCloudId}/${model}`,
          completionOptions: {
            temperature,
            maxTokens,
            stream: false
          },
          messages: [
            {
              role: 'system',
              text: 'You are an AI assistant integrated with the Heady ecosystem. Provide helpful, accurate responses.'
            },
            {
              role: 'user',
              text: prompt
            }
          ]
        })
      });

      const data = await response.json();
      
      return {
        model,
        prompt,
        response: data.result.alternatives[0].message.text,
        temperature,
        maxTokens,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('❌ Text generation failed:', error.message);
      return null;
    }
  }

  /**
   * Analyze image
   */
  async analyzeImage(imageData, task = 'classification') {
    try {
      const formData = new FormData();
      formData.append('image', imageData);
      formData.append('config', JSON.stringify({
        task,
        features: ['classification', 'detection', 'ocr']
      }));

      const response = await fetch('https://vision.api.cloud.yandex.net/vision/v1/batchAnalyze', {
        method: 'POST',
        headers: {
          'Authorization': `Api-Key ${this.yandexApiKey}`
        },
        body: formData
      });

      const data = await response.json();
      
      return {
        imageData,
        task,
        analysis: data.results,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('❌ Image analysis failed:', error.message);
      return null;
    }
  }

  /**
   * Geocode address
   */
  async geocode(address, language = 'ru') {
    try {
      const response = await fetch(`https://geocode-maps.yandex.ru/1.x/?apikey=${this.yandexApiKey}&geocode=${encodeURIComponent(address)}&format=json&lang=${language}`);
      
      const data = await response.json();
      
      return {
        address,
        language,
        coordinates: data.response.GeoObjectCollection.featureMember[0]?.GeoObject?.Point?.pos,
        description: data.response.GeoObjectCollection.featureMember[0]?.GeoObject?.description,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('❌ Geocoding failed:', error.message);
      return null;
    }
  }

  /**
   * Get weather data
   */
  async getWeather(lat, lon, language = 'ru') {
    try {
      const response = await fetch(`https://api.weather.yandex.ru/v2/forecast?lat=${lat}&lon=${lon}&lang=${language}`, {
        headers: {
          'X-Yandex-API-Key': this.yandexApiKey
        }
      });

      const data = await response.json();
      
      return {
        coordinates: { lat, lon },
        language,
        weather: data,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('❌ Weather data failed:', error.message);
      return null;
    }
  }

  /**
   * Parse search results from XML
   */
  parseSearchResults(xmlData) {
    // Simple XML parsing - in production, use proper XML parser
    const results = [];
    const docMatches = xmlData.match(/<doc[^>]*>[\s\S]*?<\/doc>/g);
    
    if (docMatches) {
      docMatches.forEach(doc => {
        const urlMatch = doc.match(/<url>(.*?)<\/url>/);
        const titleMatch = doc.match(/<title>(.*?)<\/title>/);
        const snippetMatch = doc.match(/<snippet[^>]*>(.*?)<\/snippet>/);
        
        if (urlMatch && titleMatch) {
          results.push({
            url: urlMatch[1],
            title: titleMatch[1],
            snippet: snippetMatch ? snippetMatch[1] : ''
          });
        }
      });
    }
    
    return results;
  }

  /**
   * Get translation history
   */
  getTranslationHistory(limit = 50) {
    return this.translationHistory.slice(-limit);
  }

  /**
   * Get search history
   */
  getSearchHistory(limit = 50) {
    return this.searchHistory.slice(-limit);
  }

  /**
   * Get available models
   */
  getAvailableModels() {
    const models = [];
    
    for (const [modelId, model] of this.activeModels) {
      models.push({
        modelId,
        name: model.name,
        type: model.type,
        capabilities: model
      });
    }

    return models;
  }

  /**
   * Get integration status
   */
  getStatus() {
    return {
      connected: !!this.yandexApiKey,
      cloudId: this.yandexCloudId,
      activeModels: this.activeModels.size,
      translationHistory: this.translationHistory.length,
      searchHistory: this.searchHistory.length,
      voiceSessions: this.voiceSessions.size,
      capabilities: [
        'translation',
        'search',
        'voice_recognition',
        'voice_synthesis',
        'text_generation',
        'image_analysis',
        'geocoding',
        'weather_data',
        'multilingual_support'
      ],
      supportedLanguages: ['ru', 'en', 'de', 'fr', 'es', 'it'],
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = { YandexIntegration };
