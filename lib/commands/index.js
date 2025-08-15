const { Command, Flags } = require('@oclif/core')
const fs = require('fs-extra')
const path = require('path')
const os = require('os')
const mysql = require('mysql2/promise')
const inquirer = require('inquirer')

class SqlDriftCommand extends Command {
  static description = 'Run SQL migrations against MySQL database with tracking'

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
    help: Flags.help({ char: 'h' }),
  }

  static args = [
    {
      name: 'sqlfile',
      description: 'path to SQL file to execute',
      required: true
    }
  ]

  async run() {
    const { args, flags } = await this.parse(SqlDriftCommand)
    
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

      // Get history file path
      const sqlFileName = path.basename(sqlFilePath)
      const historyFilePath = path.join(sqldriftDir, `${flags.environment}-${sqlFileName}-history.json`)

      // Load or create history
      const history = await this.loadHistory(historyFilePath)

      // Parse SQL file
      const sqlStatements = await this.parseSqlFile(sqlFilePath)

      // Find new statements
      const newStatements = this.findNewStatements(sqlStatements, history)

      if (newStatements.length === 0) {
        this.log('No new SQL statements to execute.')
        return
      }

      // Prompt user for confirmation
      const confirmed = await this.confirmExecution(newStatements, config.db)
      
      if (!confirmed) {
        this.log('Execution cancelled.')
        return
      }

      // Execute statements
      await this.executeStatements(newStatements, config, history, historyFilePath)

    } catch (error) {
      this.error(error.message)
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
db = "sqldrift_prod"`

      await fs.writeFile(defaultConfigPath, defaultConfig)
      this.log(`Created default configuration at: ${defaultConfigPath}`)
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

  async parseSqlFile(sqlFilePath) {
    const content = await fs.readFile(sqlFilePath, 'utf8')
    
    // Split by semicolon and filter out empty statements
    const statements = content
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.match(/^\s*--/) && !stmt.match(/^\s*\/\*/))
    
    return statements.map((stmt, index) => ({
      id: index + 1,
      sql: stmt,
      hash: this.generateHash(stmt)
    }))
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
    this.log(`\nFound ${statements.length} new SQL statement(s) to execute against database: ${dbName}`)
    
    statements.forEach((stmt, index) => {
      this.log(`${index + 1}. ${stmt.sql.substring(0, 100)}${stmt.sql.length > 100 ? '...' : ''}`)
    })

    const { confirmed } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmed',
        message: 'Do you want to proceed with executing these statements?',
        default: false
      }
    ])

    return confirmed
  }

  async executeStatements(statements, config, history, historyFilePath) {
    const connection = await mysql.createConnection({
      host: config.host,
      port: parseInt(config.port),
      user: config.user,
      password: config.password,
      database: config.db
    })

    try {
      await connection.beginTransaction()

      for (const statement of statements) {
        this.log(`Executing: ${statement.sql.substring(0, 100)}${statement.sql.length > 100 ? '...' : ''}`)
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
      
      this.log(`\nSuccessfully executed ${statements.length} statement(s)`)
      this.log(`History updated: ${historyFilePath}`)

    } catch (error) {
      await connection.rollback()
      this.error(`Transaction failed and was rolled back: ${error.message}`)
    } finally {
      await connection.end()
    }
  }
}

module.exports = SqlDriftCommand