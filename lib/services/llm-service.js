const axios = require('axios')
const chalk = require('chalk')
const cliProgress = require('cli-progress')

class LLMService {
  constructor(apiKey = null, model = 'codellama') {
    this.apiKey = apiKey // Not needed for local Ollama
    this.model = model
    this.baseURL = 'http://localhost:11434'
  }

  async splitSqlFile(sqlContent, logger = null) {
    const prompt = `Split this SQL into separate statements. Return as JSON array.

SQL:
${sqlContent}

JSON:`

    try {
      if (logger) {
        logger(chalk.cyan('📡 Sending SQL file to LLM for intelligent parsing...'))
      }
      
      const response = await this.makeRequest(prompt, logger)
      const content = response.choices[0].message.content.trim()
      
      // Extract JSON from the response - try multiple patterns
      let statements
      
      // First try to parse the entire response as JSON (since we asked for JSON only)
      try {
        statements = JSON.parse(content.trim())
      } catch (parseError) {
        // If that fails, try to extract from code blocks
        const codeBlockMatch = content.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/s)
        if (codeBlockMatch) {
          try {
            statements = JSON.parse(codeBlockMatch[1])
          } catch (codeError) {
            // Continue to other methods
          }
        }
        
        // If no code block found, try to find a JSON array in the response
        if (!statements) {
          const jsonMatch = content.match(/\[[\s\S]*?\]/g)
          if (jsonMatch) {
            try {
              // Try the last (most complete) JSON array found
              statements = JSON.parse(jsonMatch[jsonMatch.length - 1])
            } catch (parseError) {
              // If parsing fails, try each match
              for (const match of jsonMatch) {
                try {
                  statements = JSON.parse(match)
                  break
                } catch (e) {
                  continue
                }
              }
            }
          }
        }
      }
      
      // If still no valid JSON, throw error with more context
      if (!statements) {
        throw new Error(`LLM did not return valid JSON array. Response: ${content.substring(0, 500)}...`)
      }
      
      if (!Array.isArray(statements)) {
        throw new Error('LLM response is not an array')
      }
      
      return statements.filter(stmt => typeof stmt === 'string' && stmt.trim().length > 0)
    } catch (error) {
      throw new Error(`Failed to split SQL file using LLM: ${error.message}`)
    }
  }

  async validateSqlStatement(sqlStatement, logger = null) {
    const prompt = `Check if this SQL is valid. Return JSON.

SQL: ${sqlStatement}

JSON:`

    try {
      if (logger) {
        logger(chalk.cyan('🔍 Validating SQL statement with LLM...'))
      }
      
      const response = await this.makeRequest(prompt, logger)
      const content = response.choices[0].message.content.trim()
      
      // Extract JSON from the response - try multiple patterns
      let validation
      
      // First try to parse the entire response as JSON (since we asked for JSON only)
      try {
        validation = JSON.parse(content.trim())
      } catch (parseError) {
        // If that fails, try to extract from code blocks
        const codeBlockMatch = content.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/s)
        if (codeBlockMatch) {
          try {
            validation = JSON.parse(codeBlockMatch[1])
          } catch (codeError) {
            // Continue to other methods
          }
        }
        
        // If no code block found, try to find a JSON object in the response
        if (!validation) {
          const jsonMatch = content.match(/\{[\s\S]*?\}/g)
          if (jsonMatch) {
            try {
              // Try the last (most complete) JSON object found
              validation = JSON.parse(jsonMatch[jsonMatch.length - 1])
            } catch (parseError) {
              // If parsing fails, try each match
              for (const match of jsonMatch) {
                try {
                  validation = JSON.parse(match)
                  if (typeof validation.isValid === 'boolean') {
                    break
                  }
                } catch (e) {
                  continue
                }
              }
            }
          }
        }
      }
      
      // If still no valid JSON, throw error with more context
      if (!validation) {
        throw new Error(`LLM did not return valid JSON object. Response: ${content.substring(0, 500)}...`)
      }
      
      // Validate the response structure
      if (typeof validation.isValid !== 'boolean') {
        throw new Error('Invalid validation response structure')
      }
      
      return validation
    } catch (error) {
      throw new Error(`Failed to validate SQL statement using LLM: ${error.message}`)
    }
  }

  async makeRequest(prompt, logger = null) {
    let progressInterval = null
    
    try {
      // Start progress indicator
      if (logger) {
        let dots = 0
        const maxDots = 3
        progressInterval = setInterval(() => {
          dots = (dots + 1) % (maxDots + 1)
          const dotString = '.'.repeat(dots) + ' '.repeat(maxDots - dots)
          process.stdout.write(`\r${chalk.cyan('⏳ Processing with LLM')}${dotString}`)
        }, 500)
      }
      
      const response = await axios.post(
        `${this.baseURL}/api/generate`,
        {
          model: this.model,
          prompt: prompt,
          stream: false,
          options: {
            temperature: 0.1, // Low temperature for consistent, deterministic responses
            num_predict: 4000
          }
        },
        {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 120000 // 120 second timeout for local processing
        }
      )

      if (!response.data || !response.data.response) {
        throw new Error('Invalid response from Ollama API')
      }

      // Clear progress indicator
      if (progressInterval) {
        clearInterval(progressInterval)
        process.stdout.write('\r' + ' '.repeat(50) + '\r') // Clear the line
        if (logger) {
          logger(chalk.green('✅ LLM processing completed'))
        }
      }

      // Convert Ollama response format to OpenRouter-like format for compatibility
      return {
        choices: [
          {
            message: {
              content: response.data.response
            }
          }
        ]
      }
    } catch (error) {
      // Clear progress indicator on error
      if (progressInterval) {
        clearInterval(progressInterval)
        process.stdout.write('\r' + ' '.repeat(50) + '\r') // Clear the line
      }
      
      if (error.response) {
        const status = error.response.status
        const message = error.response.data?.error || error.response.statusText
        
        if (status === 404) {
          throw new Error(`Model '${this.model}' not found. Please ensure the model is installed in Ollama.`)
        } else if (error.code === 'ECONNREFUSED') {
          throw new Error('Cannot connect to Ollama. Please ensure Ollama is running on localhost:11434.')
        } else {
          throw new Error(`Ollama API error (${status}): ${message}`)
        }
      } else if (error.code === 'ECONNABORTED') {
        throw new Error('Request timeout. The model may be taking too long to respond.')
      } else if (error.code === 'ECONNREFUSED') {
        throw new Error('Cannot connect to Ollama. Please ensure Ollama is running on localhost:11434.')
      } else {
        throw new Error(`Network error: ${error.message}`)
      }
    }
  }

  // Test the connection and configuration
  async testConnection(logger = null) {
    try {
      if (logger) {
        logger(chalk.cyan('🔗 Testing Ollama connection...'))
      }
      
      const testPrompt = 'Respond with exactly: "Connection successful"'
      const response = await this.makeRequest(testPrompt, logger)
      const content = response.choices[0].message.content.trim()
      
      if (content.includes('Connection successful')) {
        return { success: true, message: 'Ollama service connection successful' }
      } else {
        return { success: true, message: 'Ollama service is responding (connection successful)' }
      }
    } catch (error) {
      return { success: false, message: error.message }
    }
  }
}

module.exports = LLMService