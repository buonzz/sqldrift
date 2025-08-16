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
model = "deepseek/deepseek-r1:free"
```

### 3. Available Models
The model value should be the model ID from the OpenRouter URL. For example:
- URL: `https://openrouter.ai/anthropic/claude-3.5-sonnet` → Model: `anthropic/claude-3.5-sonnet`
- URL: `https://openrouter.ai/deepseek/deepseek-r1:free` → Model: `deepseek/deepseek-r1:free`

Popular models you can use:
- `deepseek/deepseek-r1:free` (free tier available - recommended for getting started)
- `anthropic/claude-3.5-sonnet` (excellent for accuracy, paid)
- `anthropic/claude-3-haiku` (faster, lower cost)
- `openai/gpt-4o` (high quality, paid)
- `openai/gpt-4o-mini` (balanced cost/performance)
- `meta-llama/llama-3.1-8b-instruct` (open source)
- `google/gemini-pro` (Google's model)

**How to find model IDs:**
1. Visit [OpenRouter Models](https://openrouter.ai/models)
2. Click on any model you're interested in
3. The model ID is the part after `openrouter.ai/` in the URL
4. Use that exact string as your model configuration value

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
[12:34:56] 🚀 Initializing LLM service with OpenRouter...
[12:34:57] 🔗 Testing LLM connection...
[12:34:58] ⏳ Processing with LLM...
[12:34:59] ✅ LLM processing completed
[12:35:00] ✅ LLM service ready
[12:35:01] 📡 Sending SQL file to LLM for intelligent parsing...
[12:35:02] ⏳ Processing with LLM...
[12:35:03] ✅ LLM processing completed
[12:35:04] Found 8 new SQL statement(s) to execute against database: mydb
[12:35:05] [1/8] 🔍 Validating SQL statement with LLM...
[12:35:06] ⏳ Processing with LLM...
[12:35:07] ✅ LLM processing completed
[12:35:08] [1/8] Executing: CREATE TABLE users (id INT AUTO_INCREMENT PRIMARY KEY...
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
- **Progress Indicators**: Real-time feedback during LLM processing with animated progress dots
- **Detailed Feedback**: Clear error messages with specific recommendations
- **Educational Value**: Learn SQL best practices through LLM suggestions
- **Confidence**: Execute migrations with greater confidence in their correctness
- **Visual Feedback**: Emojis and clear status messages for better user experience

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