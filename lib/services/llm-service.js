const axios = require('axios')
const chalk = require('chalk')

class LLMService {
  constructor(apiKey, model = 'anthropic/claude-3.5-sonnet') {
    this.apiKey = apiKey
    this.model = model
    this.baseURL = 'https://openrouter.ai/api/v1'
  }

  async splitSqlFile(sqlContent) {
    const prompt = `You are an expert SQL parser. Your task is to split the following SQL content into individual, complete SQL statements.

Rules:
1. Each statement must be syntactically complete and valid
2. Preserve all original content including comments within statements
3. Handle multi-line statements correctly
4. Handle stored procedures, functions, triggers, and complex statements
5. Return ONLY a JSON array of strings, where each string is a complete SQL statement
6. Do not include empty statements
7. Remove standalone comments that are not part of a statement

SQL Content:
\`\`\`sql
${sqlContent}
\`\`\`

Return format: ["statement1", "statement2", "statement3"]`

    try {
      const response = await this.makeRequest(prompt)
      const content = response.choices[0].message.content.trim()
      
      // Extract JSON from the response
      const jsonMatch = content.match(/\[[\s\S]*\]/)
      if (!jsonMatch) {
        throw new Error('LLM did not return valid JSON array')
      }
      
      const statements = JSON.parse(jsonMatch[0])
      
      if (!Array.isArray(statements)) {
        throw new Error('LLM response is not an array')
      }
      
      return statements.filter(stmt => stmt.trim().length > 0)
    } catch (error) {
      throw new Error(`Failed to split SQL file using LLM: ${error.message}`)
    }
  }

  async validateSqlStatement(sqlStatement) {
    const prompt = `You are an expert SQL validator. Analyze the following SQL statement for syntax errors, potential issues, and best practices.

SQL Statement:
\`\`\`sql
${sqlStatement}
\`\`\`

Respond with a JSON object in this exact format:
{
  "isValid": true/false,
  "issues": ["list of issues if any"],
  "recommendations": ["list of recommendations if any"],
  "severity": "low/medium/high" (only if isValid is false)
}

Focus on:
1. Syntax correctness
2. Potential runtime errors
3. Security concerns (SQL injection risks)
4. Performance issues
5. Best practices violations

If the statement is valid, set isValid to true and leave issues empty.
If there are critical errors that would prevent execution, set isValid to false.`

    try {
      const response = await this.makeRequest(prompt)
      const content = response.choices[0].message.content.trim()
      
      // Extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error('LLM did not return valid JSON object')
      }
      
      const validation = JSON.parse(jsonMatch[0])
      
      // Validate the response structure
      if (typeof validation.isValid !== 'boolean') {
        throw new Error('Invalid validation response structure')
      }
      
      return validation
    } catch (error) {
      throw new Error(`Failed to validate SQL statement using LLM: ${error.message}`)
    }
  }

  async makeRequest(prompt) {
    if (!this.apiKey) {
      throw new Error('OpenRouter API key is required. Please configure it in your .sqldrift/default.conf file under [openrouter] section.')
    }

    try {
      const response = await axios.post(
        `${this.baseURL}/chat/completions`,
        {
          model: this.model,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.1, // Low temperature for consistent, deterministic responses
          max_tokens: 4000
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://github.com/yourusername/sqldrift',
            'X-Title': 'SqlDrift CLI Tool'
          },
          timeout: 30000 // 30 second timeout
        }
      )

      if (!response.data || !response.data.choices || response.data.choices.length === 0) {
        throw new Error('Invalid response from OpenRouter API')
      }

      return response.data
    } catch (error) {
      if (error.response) {
        const status = error.response.status
        const message = error.response.data?.error?.message || error.response.statusText
        
        if (status === 401) {
          throw new Error('Invalid OpenRouter API key. Please check your configuration.')
        } else if (status === 429) {
          throw new Error('Rate limit exceeded. Please try again later.')
        } else if (status === 402) {
          throw new Error('Insufficient credits. Please check your OpenRouter account balance.')
        } else {
          throw new Error(`OpenRouter API error (${status}): ${message}`)
        }
      } else if (error.code === 'ECONNABORTED') {
        throw new Error('Request timeout. Please check your internet connection.')
      } else {
        throw new Error(`Network error: ${error.message}`)
      }
    }
  }

  // Test the connection and configuration
  async testConnection() {
    try {
      const testPrompt = 'Respond with exactly: "Connection successful"'
      const response = await this.makeRequest(testPrompt)
      const content = response.choices[0].message.content.trim()
      
      if (content.includes('Connection successful')) {
        return { success: true, message: 'LLM service connection successful' }
      } else {
        return { success: false, message: 'Unexpected response from LLM service' }
      }
    } catch (error) {
      return { success: false, message: error.message }
    }
  }
}

module.exports = LLMService