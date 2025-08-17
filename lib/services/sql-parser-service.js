const { Parser } = require('node-sql-parser')
const chalk = require('chalk')

class SqlParserService {
  constructor() {
    this.parser = new Parser()
  }

  async splitSqlFile(sqlContent, logger = null) {
    try {
      if (logger) {
        logger(chalk.cyan('📡 Parsing SQL file with node-sql-parser...'))
      }

      // Remove comments and normalize the SQL content
      const cleanedContent = this.cleanSqlContent(sqlContent)
      
      // Split by semicolons but be smart about it
      const statements = this.splitBySemicolon(cleanedContent)
      
      // Filter out empty statements and validate each one
      const validStatements = []
      
      for (const stmt of statements) {
        const trimmedStmt = stmt.trim()
        if (trimmedStmt.length === 0) continue
        
        // Basic validation - try to parse with node-sql-parser
        try {
          // Test if the statement can be parsed (this validates syntax)
          this.parser.parse(trimmedStmt)
          validStatements.push(trimmedStmt)
        } catch (parseError) {
          // If it's a statement type not supported by node-sql-parser (like DELIMITER, stored procedures)
          // but looks like valid SQL, include it anyway
          if (this.looksLikeValidSql(trimmedStmt)) {
            validStatements.push(trimmedStmt)
          } else {
            if (logger) {
              logger(chalk.yellow(`⚠️  Skipping potentially invalid SQL statement: ${trimmedStmt.substring(0, 50)}...`))
            }
          }
        }
      }
      
      if (logger) {
        logger(chalk.green(`✅ Successfully parsed ${validStatements.length} SQL statements`))
      }
      
      return validStatements
    } catch (error) {
      throw new Error(`Failed to parse SQL file: ${error.message}`)
    }
  }

  async validateSqlStatement(sqlStatement, logger = null) {
    try {
      if (logger) {
        logger(chalk.cyan('🔍 Validating SQL statement with node-sql-parser...'))
      }
      
      const trimmedSql = sqlStatement.trim()
      
      // Basic validation object
      const validation = {
        isValid: true,
        severity: 'low',
        issues: [],
        recommendations: []
      }
      
      try {
        // Try to parse the statement
        const ast = this.parser.parse(trimmedSql)
        
        // Additional validation checks
        this.performAdditionalValidation(trimmedSql, ast, validation)
        
      } catch (parseError) {
        // Check if it's a statement type that node-sql-parser doesn't support
        // but might still be valid SQL
        if (this.looksLikeValidSql(trimmedSql)) {
          validation.recommendations.push('Statement type may not be fully supported by parser but appears to be valid SQL')
        } else {
          validation.isValid = false
          validation.severity = 'high'
          validation.issues.push(`Syntax error: ${parseError.message}`)
        }
      }
      
      // Basic SQL injection checks
      this.checkForSqlInjectionPatterns(trimmedSql, validation)
      
      // Performance recommendations
      this.addPerformanceRecommendations(trimmedSql, validation)
      
      if (logger) {
        logger(chalk.green('✅ SQL validation completed'))
      }
      
      return validation
    } catch (error) {
      throw new Error(`Failed to validate SQL statement: ${error.message}`)
    }
  }

  cleanSqlContent(content) {
    // Remove single-line comments (-- comments)
    content = content.replace(/--.*$/gm, '')
    
    // Remove hash-style comments (# comments) - common in MySQL
    content = content.replace(/^#.*$/gm, '')
    
    // Remove multi-line comments (/* comments */)
    content = content.replace(/\/\*[\s\S]*?\*\//g, '')
    
    // Normalize whitespace
    content = content.replace(/\s+/g, ' ').trim()
    
    return content
  }

  splitBySemicolon(content) {
    const statements = []
    let currentStatement = ''
    let inString = false
    let stringChar = null
    let i = 0
    
    while (i < content.length) {
      const char = content[i]
      const nextChar = content[i + 1]
      
      if (!inString) {
        if (char === "'" || char === '"' || char === '`') {
          inString = true
          stringChar = char
          currentStatement += char
        } else if (char === ';') {
          if (currentStatement.trim()) {
            statements.push(currentStatement.trim())
          }
          currentStatement = ''
        } else {
          currentStatement += char
        }
      } else {
        currentStatement += char
        if (char === stringChar) {
          // Check if it's escaped
          if (nextChar === stringChar) {
            // Escaped quote, skip the next character
            i++
            currentStatement += nextChar
          } else {
            inString = false
            stringChar = null
          }
        }
      }
      i++
    }
    
    // Add the last statement if it exists
    if (currentStatement.trim()) {
      statements.push(currentStatement.trim())
    }
    
    return statements
  }

  looksLikeValidSql(statement) {
    const trimmedStmt = statement.trim()
    
    // Skip empty statements and comments
    if (trimmedStmt.length === 0 ||
        trimmedStmt.startsWith('#') ||
        trimmedStmt.startsWith('--') ||
        trimmedStmt.startsWith('/*')) {
      return false
    }
    
    const upperStmt = trimmedStmt.toUpperCase()
    
    // Skip delimiter commands
    if (upperStmt.match(/^END\/\/\s*DELIMITER/i) ||
        upperStmt.match(/^DELIMITER\s*\/\/\s*END/i)) {
      return false
    }
    
    // Common SQL keywords that indicate valid SQL
    const sqlKeywords = [
      'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP', 'ALTER',
      'TRUNCATE', 'GRANT', 'REVOKE', 'COMMIT', 'ROLLBACK', 'START',
      'BEGIN', 'USE', 'SHOW', 'DESCRIBE', 'EXPLAIN',
      'CALL', 'SET', 'DECLARE', 'IF', 'WHILE', 'LOOP', 'REPEAT'
    ]
    
    // Check if it starts with a valid SQL keyword
    const startsWithValidKeyword = sqlKeywords.some(keyword => upperStmt.startsWith(keyword))
    
    // Additional validation: must not be just a keyword without proper structure
    if (startsWithValidKeyword) {
      // Check for some basic SQL structure patterns
      if (upperStmt === 'END' || upperStmt === 'DELIMITER' || upperStmt.match(/^END\/\/|^DELIMITER\s*$/)) {
        return false
      }
    }
    
    return startsWithValidKeyword
  }

  performAdditionalValidation(sql, ast, validation) {
    const upperSql = sql.toUpperCase()
    
    // Check for missing WHERE clause in UPDATE/DELETE
    if (upperSql.includes('UPDATE ') && !upperSql.includes(' WHERE ')) {
      validation.recommendations.push('Consider adding a WHERE clause to UPDATE statement to avoid updating all rows')
    }
    
    if (upperSql.includes('DELETE ') && !upperSql.includes(' WHERE ')) {
      validation.recommendations.push('Consider adding a WHERE clause to DELETE statement to avoid deleting all rows')
    }
    
    // Check for SELECT *
    if (upperSql.includes('SELECT *')) {
      validation.recommendations.push('Consider specifying column names instead of using SELECT * for better performance')
    }
  }

  checkForSqlInjectionPatterns(sql, validation) {
    const suspiciousPatterns = [
      /union\s+select/i,
      /or\s+1\s*=\s*1/i,
      /and\s+1\s*=\s*1/i,
      /'\s*or\s*'.*'=/i,
      /;\s*drop\s+table/i,
      /;\s*delete\s+from/i
    ]
    
    for (const pattern of suspiciousPatterns) {
      if (pattern.test(sql)) {
        validation.issues.push('Potential SQL injection pattern detected')
        validation.severity = 'high'
        break
      }
    }
  }

  addPerformanceRecommendations(sql, validation) {
    const upperSql = sql.toUpperCase()
    
    // Check for LIKE with leading wildcard
    if (upperSql.includes("LIKE '%")) {
      validation.recommendations.push('LIKE with leading wildcard (%) can be slow - consider full-text search or other alternatives')
    }
    
    // Check for functions in WHERE clause
    if (/WHERE\s+\w+\s*\(/i.test(sql)) {
      validation.recommendations.push('Using functions in WHERE clause can prevent index usage - consider alternatives')
    }
  }

  // Test the parser functionality
  async testConnection(logger = null) {
    try {
      if (logger) {
        logger(chalk.cyan('🔗 Testing SQL parser functionality...'))
      }
      
      // Test with a simple SQL statement
      const testSql = 'SELECT 1 as test'
      const ast = this.parser.parse(testSql)
      
      if (ast) {
        return { success: true, message: 'SQL parser is working correctly' }
      } else {
        return { success: false, message: 'SQL parser test failed' }
      }
    } catch (error) {
      return { success: false, message: `SQL parser error: ${error.message}` }
    }
  }
}

module.exports = SqlParserService