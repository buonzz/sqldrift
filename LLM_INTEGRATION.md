# LLM Integration for SqlDrift

SqlDrift now **requires** intelligent SQL parsing and validation using Large Language Models (LLMs) through OpenRouter.ai. The basic SQL parsing has been replaced with LLM-powered parsing for better accuracy and validation.

## Features

### 🧠 Intelligent SQL Parsing
- **Smart Statement Splitting**: LLM analyzes the entire SQL file and intelligently splits it into valid, complete SQL statements
- **Complex Statement Support**: Handles stored procedures, functions, triggers, and multi-line statements correctly
- **Comment Preservation**: Maintains comments that are part of statements while removing standalone comments
- **Required Integration**: LLM configuration is mandatory for all SQL parsing operations

### ✅ SQL Statement Validation
- **Syntax Validation**: Checks each SQL statement for syntax errors before execution
- **Security Analysis**: Identifies potential SQL injection risks and security concerns
- **Performance Recommendations**: Suggests optimizations and best practices
- **Error Prevention**: Halts execution if critical issues are detected, preventing database corruption

### 🛡️ Error Handling
- **Strict Validation**: Requires LLM service to be properly configured and available
- **Detailed Error Reports**: Provides specific issue descriptions and recommendations
- **Execution Control**: Stops processing on validation failures without updating history

## Configuration

### 1. OpenRouter Setup
1. Sign up for an account at [OpenRouter.ai](https://openrouter.ai/)
2. Generate an API key from your dashboard
3. Choose a model (default: `anthropic/claude-3.5-sonnet`)

### 2. Configuration File
Add the following section to your `~/.sqldrift/default.conf` file:

```ini
[openrouter]
api_key = "your_openrouter_api_key_here"
model = "anthropic/claude-3.5-sonnet"
```

### 3. Available Models
Popular models you can use:
- `anthropic/claude-3.5-sonnet` (recommended)
- `anthropic/claude-3-haiku`
- `openai/gpt-4o`
- `openai/gpt-4o-mini`
- `meta-llama/llama-3.1-8b-instruct`

## Usage

### Basic Usage
```bash
# Run with LLM integration (if configured)
sqldrift path/to/migrations.sql

# The tool will automatically:
# 1. Use LLM to parse SQL statements intelligently
# 2. Validate each statement before execution
# 3. Provide detailed feedback on any issues
```

### Example Output
```
[12:34:56] LLM service initialized with OpenRouter
[12:34:57] Using LLM to parse SQL file...
[12:34:58] Found 8 new SQL statement(s) to execute against database: mydb
[12:34:59] [1/8] Validating: CREATE TABLE users (id INT AUTO_INCREMENT PRIMARY KEY...
[12:35:00] [1/8] Executing: CREATE TABLE users (id INT AUTO_INCREMENT PRIMARY KEY...
[12:35:01] [2/8] Validating: CREATE TABLE posts (id INT AUTO_INCREMENT PRIMARY KEY...
[12:35:02] [2/8] Recommendations: Consider adding an index on created_at for better performance
[12:35:03] [2/8] Executing: CREATE TABLE posts (id INT AUTO_INCREMENT PRIMARY KEY...
```

### Error Example
```
[12:34:56] [3/8] Validating: SELCT * FROM users WHERE id = 1...
[12:34:57] ❌ SQL Statement validation failed:
Statement: SELCT * FROM users WHERE id = 1
Severity: high

Issues found:
  1. Syntax error: 'SELCT' is not a valid SQL keyword, did you mean 'SELECT'?
  2. Missing semicolon at end of statement

Recommendations:
  1. Correct the typo: Change 'SELCT' to 'SELECT'
  2. Add semicolon at the end of the statement

Error: Execution halted due to SQL validation failure. Please fix the issues and try again.
```

## Benefits

### 🎯 Improved Accuracy
- **Context-Aware Parsing**: Understands SQL context better than simple regex splitting
- **Complex Statement Handling**: Properly handles stored procedures, functions, and triggers
- **Delimiter Management**: Correctly processes DELIMITER statements and custom delimiters

### 🔒 Enhanced Security
- **Pre-execution Validation**: Catches issues before they reach the database
- **SQL Injection Detection**: Identifies potential security vulnerabilities
- **Best Practice Enforcement**: Suggests improvements following SQL best practices

### 🚀 Better Performance
- **Optimization Suggestions**: Recommends indexes and query improvements
- **Resource Usage**: Analyzes potential performance bottlenecks
- **Execution Planning**: Helps optimize statement execution order

### 🛠️ Developer Experience
- **Detailed Feedback**: Clear error messages with specific recommendations
- **Educational Value**: Learn SQL best practices through LLM suggestions
- **Confidence**: Execute migrations with greater confidence in their correctness

## Troubleshooting

### LLM Service Not Configured
If LLM service is not configured:
```
Error: LLM service configuration is required. Please configure OpenRouter API key in your ~/.sqldrift/default.conf file under [openrouter] section.
```
The tool will not proceed without proper LLM configuration.

### API Key Issues
```
Error: Invalid OpenRouter API key. Please check your configuration.
```
- Verify your API key is correct in the configuration file
- Check that your OpenRouter account has sufficient credits
- Ensure the API key has the necessary permissions

### Rate Limiting
```
Error: Rate limit exceeded. Please try again later.
```
- Wait a few minutes before retrying
- Consider upgrading your OpenRouter plan for higher limits
- Use a different model with lower usage

### Network Issues
```
Error: Request timeout. Please check your internet connection.
```
- Check your internet connection
- Verify OpenRouter.ai is accessible from your network
- Try again after a few minutes

## Cost Considerations

- LLM usage incurs costs based on your OpenRouter plan
- Costs depend on the model chosen and the size of SQL files
- Consider using smaller, faster models for development
- Use more powerful models for production deployments

## Migration from Basic Parsing

**Breaking Change**: Starting with this version, SqlDrift requires LLM configuration to function. The basic SQL parsing has been removed in favor of more accurate LLM-powered parsing.

### Required Actions:
1. Configure OpenRouter API key in your `~/.sqldrift/default.conf` file
2. Ensure you have sufficient credits in your OpenRouter account
3. Your existing history files and workflows remain unchanged

### Benefits of This Change:
- **Improved Accuracy**: LLM parsing handles complex SQL statements much better than regex-based parsing
- **Better Validation**: Each statement is validated before execution, preventing database corruption
- **Enhanced Security**: SQL injection detection and security analysis
- **Performance Insights**: Optimization recommendations for better query performance