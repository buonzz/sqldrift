const { Command, Flags, Args } = require('@oclif/core')
const fs = require('fs-extra')
const path = require('path')
const os = require('os')
const mysql = require('mysql2/promise')
const readline = require('readline')
const chalk = require('chalk')
const cliProgress = require('cli-progress')
const LLMService = require('./services/llm-service')

class SqlDrift extends Command {
  static description = 'Run SQL migrations against MySQL database with tracking'

  // Helper method to get formatted timestamp
  getTimestamp() {
    return new Date().toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  // Override log method to include timestamp
  log(message) {
    const timestamp = chalk.gray(`[${this.getTimestamp()}]`)
    super.log(`${timestamp} ${message}`)
  }

  static examples = [
    '<%= config.bin %> path/to/migrations.sql',
    '<%= config.bin %> path/to/migrations.sql --config=custom.cnf',
    '<%= config.bin %> path/to/migrations.sql --environment=production',
    '<%= config.bin %> path/to/migrations.sql --config=custom.cnf --environment=staging',
  ]

  static flags = {
    config: Flags.string({
      char: 'c',
      description: 'path to configuration file',
      default: path.join(os.homedir(), '.sqldrift', 'default.conf')
    }),
    environment: Flags.string({
      char: 'e',
      description: 'environment to use from configuration file',
      default: 'default'
    }),
    'record-history': Flags.boolean({
      description: 'only update history file without executing SQL statements against the database',
      default: false
    }),
    'clear-history': Flags.boolean({
      description: 'delete the history file for the specified environment without executing SQL statements',
      default: false
    }),
    help: Flags.help({ char: 'h' }),
  }

  static args = {
    sqlfile: Args.string({
      description: 'path to SQL file to execute',
      required: true
    })
  }

  async run() {
    const { args, flags } = await this.parse(SqlDrift)
    
    try {
      // Resolve SQL file path
      const sqlFilePath = path.resolve(args.sqlfile)
      
      if (!await fs.pathExists(sqlFilePath)) {
        this.error(`SQL file not found: ${sqlFilePath}`)
      }

      // Ensure .sqldrift directory exists
      const sqldriftDir = path.join(os.homedir(), '.sqldrift')
      await fs.ensureDir(sqldriftDir)

      // Create default config if it doesn't exist
      await this.ensureDefaultConfig(sqldriftDir)

      // Load configuration
      const config = await this.loadConfig(flags.config, flags.environment)
      
      // Load OpenRouter configuration
      const openRouterConfig = await this.loadOpenRouterConfig(flags.config)
      
      // Initialize LLM service - now required
      if (!openRouterConfig || !openRouterConfig.api_key) {
        this.log(chalk.red('\n❌ LLM service configuration is required'))
        this.log(chalk.white('\nTo use SqlDrift, you need to configure OpenRouter API integration:'))
        this.log(chalk.cyan('1. Sign up at https://openrouter.ai/'))
        this.log(chalk.cyan('2. Get your API key from the dashboard'))
        this.log(chalk.cyan('3. Add the following to your ~/.sqldrift/default.conf file:'))
        this.log(chalk.gray('\n[openrouter]'))
        this.log(chalk.gray('api_key = "your_api_key_here"'))
        this.log(chalk.gray('model = "deepseek/deepseek-r1:free"'))
        this.log(chalk.yellow('\nFor more information, see: LLM_INTEGRATION.md\n'))
        process.exit(1)
      }
      
      const llmService = new LLMService(openRouterConfig.api_key, openRouterConfig.model)
      
      // Test the connection with progress indicator
      this.log(chalk.cyan('🚀 Initializing LLM service with OpenRouter...'))
      try {
        const testResult = await llmService.testConnection(this.log.bind(this))
        if (testResult.success) {
          this.log(chalk.green('✅ LLM service ready'))
        } else {
          this.log(chalk.yellow(`⚠️  LLM service warning: ${testResult.message}`))
        }
      } catch (testError) {
        this.log(chalk.yellow(`⚠️  Could not test LLM connection: ${testError.message}`))
        this.log(chalk.cyan('Proceeding anyway...'))
      }

      // Get history file path
      const sqlFileName = path.basename(sqlFilePath)
      const historyFilePath = path.join(sqldriftDir, `${flags.environment}-${sqlFileName}-history.json`)

      // Handle clear-history mode
      if (flags['clear-history']) {
        await this.clearHistory(historyFilePath, flags.environment, sqlFileName)
        return
      }

      // Load or create history
      const history = await this.loadHistory(historyFilePath)

      // Parse SQL file using LLM
      const sqlStatements = await this.parseSqlFile(sqlFilePath, llmService)

      // Find new statements
      const newStatements = this.findNewStatements(sqlStatements, history)

      if (newStatements.length === 0) {
        this.log(chalk.yellow('No new SQL statements to execute.'))
        return
      }

      // Handle record-history mode
      if (flags['record-history']) {
        await this.recordHistoryOnly(newStatements, history, historyFilePath)
        return
      }

      // Prompt user for confirmation
      const confirmed = await this.confirmExecution(newStatements, config.db)
      
      if (!confirmed) {
        this.log(chalk.yellow('Execution cancelled.'))
        return
      }

      // Execute statements with LLM validation
      await this.executeStatements(newStatements, config, history, historyFilePath, llmService)

    } catch (error) {
      // Handle different types of errors with user-friendly messages
      if (error.message.includes('OpenRouter API')) {
        this.log(chalk.red('\n❌ OpenRouter API Error'))
        this.log(chalk.white(`${error.message}`))
        this.log(chalk.yellow('\nPlease check your API key and account status at https://openrouter.ai/\n'))
      } else if (error.message.includes('LLM')) {
        this.log(chalk.red('\n❌ LLM Service Error'))
        this.log(chalk.white(`${error.message}`))
        this.log(chalk.yellow('\nPlease check your OpenRouter configuration and try again.\n'))
      } else {
        this.log(chalk.red('\n❌ Error'))
        this.log(chalk.white(`${error.message}\n`))
      }
      process.exit(1)
    }
  }

  async ensureDefaultConfig(sqldriftDir) {
    const defaultConfigPath = path.join(sqldriftDir, 'default.conf')
    
    if (!await fs.pathExists(defaultConfigPath)) {
      const defaultConfig = `[default]
user = "root"
password = "root"
host = "127.0.0.1"
port = "3306"
db = "sqldrift"

[development]
user = "root"
password = "root"
host = "127.0.0.1"
port = "3306"
db = "sqldrift_dev"

[staging]
user = "root"
password = "root"
host = "127.0.0.1"
port = "3306"
db = "sqldrift_stage"

[production]
user = "root"
password = "root"
host = "127.0.0.1"
port = "3306"
db = "sqldrift_prod"

[openrouter]
api_key = ""
model = "deepseek/deepseek-r1:free"`

      await fs.writeFile(defaultConfigPath, defaultConfig)
      this.log(chalk.green(`Created default configuration at: ${defaultConfigPath}`))
    }
  }

  async loadConfig(configPath, environment = 'default') {
    if (!await fs.pathExists(configPath)) {
      this.error(`Configuration file not found: ${configPath}`)
    }

    const configContent = await fs.readFile(configPath, 'utf8')
    const config = this.parseIniConfig(configContent)
    
    if (!config[environment]) {
      this.error(`Configuration file must contain a [${environment}] section`)
    }

    return config[environment]
  }

  async loadOpenRouterConfig(configPath) {
    try {
      if (!await fs.pathExists(configPath)) {
        return null
      }

      const configContent = await fs.readFile(configPath, 'utf8')
      const config = this.parseIniConfig(configContent)
      
      return config.openrouter || null
    } catch (error) {
      this.log(chalk.yellow(`Warning: Could not load OpenRouter configuration: ${error.message}`))
      return null
    }
  }

  parseIniConfig(content) {
    const config = {}
    let currentSection = null

    const lines = content.split('\n')
    for (const line of lines) {
      const trimmed = line.trim()
      
      if (trimmed === '' || trimmed.startsWith('#') || trimmed.startsWith(';')) {
        continue
      }

      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        currentSection = trimmed.slice(1, -1)
        config[currentSection] = {}
        continue
      }

      if (currentSection && trimmed.includes('=')) {
        const [key, ...valueParts] = trimmed.split('=')
        const value = valueParts.join('=').trim().replace(/^["']|["']$/g, '')
        config[currentSection][key.trim()] = value
      }
    }

    return config
  }

  async loadHistory(historyFilePath) {
    if (await fs.pathExists(historyFilePath)) {
      return await fs.readJson(historyFilePath)
    }
    return { executed: [] }
  }

  async parseSqlFile(sqlFilePath, llmService) {
    const content = await fs.readFile(sqlFilePath, 'utf8')
    
    try {
      const statements = await llmService.splitSqlFile(content, this.log.bind(this))
      
      return statements.map((stmt, index) => ({
        id: index + 1,
        sql: stmt.trim(),
        hash: this.generateHash(stmt.trim())
      }))
    } catch (error) {
      this.log(chalk.red('\n❌ LLM parsing failed'))
      this.log(chalk.white(`${error.message}`))
      this.log(chalk.yellow('\nPlease check your OpenRouter configuration and try again.\n'))
      process.exit(1)
    }
  }

  generateHash(content) {
    // Simple hash function for tracking statements
    let hash = 0
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return hash.toString()
  }

  findNewStatements(statements, history) {
    const executedHashes = new Set(history.executed.map(item => item.hash))
    return statements.filter(stmt => !executedHashes.has(stmt.hash))
  }

  async confirmExecution(statements, dbName) {
    this.log(chalk.cyan(`\nFound ${statements.length} new SQL statement(s) to execute against database: ${chalk.bold(dbName)}`))
    
    statements.forEach((stmt, index) => {
      const truncatedSql = stmt.sql.substring(0, 100)
      const suffix = stmt.sql.length > 100 ? chalk.dim('...') : ''
      this.log(chalk.blue(`${index + 1}.`) + ` ${chalk.white(truncatedSql)}${suffix}`)
    })

    // Use readline for confirmation
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    })

    return new Promise((resolve) => {
      rl.question(chalk.yellow('Do you want to proceed with executing these statements? (y/N): '), (answer) => {
        rl.close()
        resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes')
      })
    })
  }

  async executeStatements(statements, config, history, historyFilePath, llmService) {
    const connection = await mysql.createConnection({
      host: config.host,
      port: parseInt(config.port),
      user: config.user,
      password: config.password,
      database: config.db
    })

    try {
      await connection.beginTransaction()

      this.log(chalk.cyan(`\nStarting execution of ${statements.length} statement(s)...\n`))

      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i]
        const truncatedSql = statement.sql.substring(0, 100)
        const suffix = statement.sql.length > 100 ? chalk.dim('...') : ''
        
        // Show progress as part of the log message
        const progress = chalk.blue(`[${i + 1}/${statements.length}]`)
        
        // Validate statement with LLM
        try {
          const validation = await llmService.validateSqlStatement(statement.sql, (msg) => {
            this.log(`${progress} ${msg}`)
          })
          
          if (!validation.isValid) {
            await connection.rollback()
            
            this.log(chalk.red(`\n❌ SQL Statement validation failed:`))
            this.log(chalk.white(`Statement: ${statement.sql}`))
            this.log(chalk.red(`Severity: ${validation.severity || 'unknown'}`))
            
            if (validation.issues && validation.issues.length > 0) {
              this.log(chalk.red('\nIssues found:'))
              validation.issues.forEach((issue, idx) => {
                this.log(chalk.red(`  ${idx + 1}. ${issue}`))
              })
            }
            
            if (validation.recommendations && validation.recommendations.length > 0) {
              this.log(chalk.yellow('\nRecommendations:'))
              validation.recommendations.forEach((rec, idx) => {
                this.log(chalk.yellow(`  ${idx + 1}. ${rec}`))
              })
            }
            
            this.error('Execution halted due to SQL validation failure. Please fix the issues and try again.')
          }
          
          // Log any recommendations even for valid statements
          if (validation.recommendations && validation.recommendations.length > 0) {
            this.log(chalk.yellow(`${progress} ${chalk.yellow('Recommendations:')} ${validation.recommendations.join(', ')}`))
          }
          
        } catch (validationError) {
          await connection.rollback()
          this.log(chalk.red('\n❌ LLM validation failed'))
          this.log(chalk.white(`${validationError.message}`))
          this.log(chalk.yellow('\nPlease check your OpenRouter configuration and try again.\n'))
          process.exit(1)
        }
        
        this.log(`${progress} ${chalk.magenta('Executing:')} ${chalk.white(truncatedSql)}${suffix}`)
        
        await connection.execute(statement.sql)
        
        // Add to history
        history.executed.push({
          id: statement.id,
          hash: statement.hash,
          sql: statement.sql,
          executedAt: new Date().toISOString()
        })
      }

      await connection.commit()
      
      // Save updated history
      await fs.writeJson(historyFilePath, history, { spaces: 2 })
      
      this.log(chalk.green(`\nSuccessfully executed ${statements.length} statement(s)`))
      this.log(chalk.gray(`History updated: ${historyFilePath}`))

    } catch (error) {
      await connection.rollback()
      this.error(`Transaction failed and was rolled back: ${error.message}`)
    } finally {
      await connection.end()
    }
  }

  async recordHistoryOnly(statements, history, historyFilePath) {
    this.log(chalk.cyan(`\nRecording ${statements.length} new SQL statement(s) to history without executing...\n`))
    
    statements.forEach((stmt, index) => {
      const truncatedSql = stmt.sql.substring(0, 100)
      const suffix = stmt.sql.length > 100 ? chalk.dim('...') : ''
      this.log(chalk.blue(`${index + 1}.`) + ` ${chalk.white(truncatedSql)}${suffix}`)
    })

    // Add statements to history without executing them
    for (const statement of statements) {
      history.executed.push({
        id: statement.id,
        hash: statement.hash,
        sql: statement.sql,
        executedAt: new Date().toISOString(),
        recordedOnly: true // Flag to indicate this was recorded without execution
      })
    }

    // Save updated history
    await fs.writeJson(historyFilePath, history, { spaces: 2 })
    
    this.log(chalk.green(`\nSuccessfully recorded ${statements.length} statement(s) to history`))
    this.log(chalk.gray(`History updated: ${historyFilePath}`))
    this.log(chalk.yellow('Note: SQL statements were NOT executed against the database.'))
  }

  async clearHistory(historyFilePath, environment, sqlFileName) {
    if (await fs.pathExists(historyFilePath)) {
      await fs.remove(historyFilePath)
      this.log(chalk.green(`Successfully deleted history file for environment '${environment}' and file '${sqlFileName}'`))
      this.log(chalk.gray(`Deleted: ${historyFilePath}`))
    } else {
      this.log(chalk.yellow(`No history file found for environment '${environment}' and file '${sqlFileName}'`))
      this.log(chalk.gray(`Expected location: ${historyFilePath}`))
    }
    this.log(chalk.yellow('Note: No SQL statements were executed against the database.'))
  }
}

module.exports = SqlDrift