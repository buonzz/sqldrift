# SQLDrift

A CLI tool for running and tracking SQL statements against MySQL databases.

## Features
- ✅ **AI-Powered SQL analysis**: It reviews the sql statements for correctness.
- ✅ **Incremental Execution**: Only runs new SQL statements
- ✅ **Environment-Scoped History**: Maintains separate execution history per SQL file and environment
- ✅ **Transaction Safety**: Rollback on failure
- ✅ **User Confirmation**: Prompts before execution
- ✅ **Multi-Environment Support**: Support for multiple database environments (development, staging, production)
- ✅ **Custom Configuration**: Support for multiple database configurations
- ✅ **Relative/Absolute Paths**: Works with both relative and absolute file paths
- ✅ **Record History Only**: Update history file without executing SQL statements using `--record-history`
- ✅ **Clear History**: Delete history file to reset tracking using `--clear-history`

## Installation

```bash
npm install -g sqldrift
```

Or run directly with npx:

```bash
npx sqldrift path/to/your/migrations.sql
```

It also needs Ollama installed locally, to check the sql statements in the SQL file.
Go to https://ollama.com/download and pull the model:

```
ollama pull llama3.2:1b
```

then start Ollama app.


## Usage

### Basic Usage

```bash
sqldrift path/to/migrations.sql
```

### With Custom Configuration

```bash
sqldrift path/to/migrations.sql --config=custom.cnf
```

### Record History Only

```bash
sqldrift path/to/migrations.sql --record-history --environment=development
```

### Clear History

```bash
sqldrift path/to/migrations.sql --clear-history --environment=development
```

## How It Works

1. **First Run**: SQLDrift creates a default configuration file at `~/.sqldrift/default.conf` with default MySQL connection settings.

2. **SQL Parsing**: It parses your SQL file and splits it into individual statements.

3. **History Tracking**: For each SQL file and environment, it maintains a history file at `~/.sqldrift/[environment]-[filename]-history.json` to track which statements have been executed per environment.

4. **New Statement Detection**: Only new statements (not previously executed) are identified for execution.

5. **User Confirmation**: Before executing, it shows you which statements will be run and asks for confirmation.

6. **Transaction Safety**: All statements are executed within a transaction. If any statement fails, all changes are rolled back.

## Configuration

### Default Configuration

The default configuration file is created at `~/.sqldrift/default.conf`:

```ini
[default]
user = "root"
password = "root"
host = "127.0.0.1"
port = "3306"
db = "test"
```

### Custom Configuration

You can create your own configuration file and use it with the `--config` option:

```bash
sqldrift migrations.sql --config=production.cnf
```



## Example

Given a SQL file `migrations.sql`:

```sql
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL
);

INSERT INTO users (name, email) VALUES ('John Doe', 'john@example.com');

CREATE TABLE posts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    title VARCHAR(200) NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

First run:
```bash
$ sqldrift migrations.sql

Found 3 new SQL statement(s) to execute against database: test
1. CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email...
2. INSERT INTO users (name, email) VALUES ('John Doe', 'john@example.com')
3. CREATE TABLE posts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    title VARCHAR(200)...
Do you want to proceed with executing these statements? (y/N): y

Executing: CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email...
Executing: INSERT INTO users (name, email) VALUES ('John Doe', 'john@example.com')
Executing: CREATE TABLE posts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    title VARCHAR(200)...

Successfully executed 3 statement(s)
History updated: /Users/username/.sqldrift/default-migrations.sql-history.json
```

Second run (after adding new statements to the file):
```bash
$ sqldrift migrations.sql

No new SQL statements to execute.
```
## Environment Support

SQLDrift supports multiple environments with separate history tracking for each environment. This ensures that SQL statements executed in one environment don't affect the tracking in another environment.

### Environment-Scoped History

Each environment maintains its own execution history:
- **Development**: `~/.sqldrift/development-migrations.sql-history.json`
- **Staging**: `~/.sqldrift/staging-migrations.sql-history.json`
- **Production**: `~/.sqldrift/production-migrations.sql-history.json`

This means you can run the same SQL file against different environments, and each will track its own execution state independently.

### Usage Examples

Use default environment:
```bash
npx sqldrift path/to/migrations.sql
```

Use production environment:
```bash
npx sqldrift path/to/migrations.sql --environment=production
```

Use custom config with staging environment:
```bash
npx sqldrift path/to/migrations.sql --config=custom.cnf --environment=staging
```

Use record-history mode to update history without executing:
```bash
npx sqldrift path/to/migrations.sql --record-history --environment=development
```

Use clear-history mode to reset tracking:
```bash
npx sqldrift path/to/migrations.sql --clear-history --environment=development
```

### Environment Configuration

The default configuration file includes multiple environment sections:

```ini
[default]
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
```

### Environment Benefits

- **Isolated Tracking**: Each environment tracks its own execution history
- **Safe Deployments**: Run the same migration file across environments without conflicts
- **Environment-Specific Databases**: Connect to different databases per environment
- **Independent State**: Development changes don't affect production tracking

## Record History Mode

The `--record-history` flag allows you to update the history file without actually executing SQL statements against the database. This is useful when:

- SQL statements have already been executed manually against the database
- You want to mark statements as "executed" in your tracking without running them again
- You need to synchronize your history file with the actual database state

### Usage

```bash
sqldrift path/to/migrations.sql --record-history --environment=development
```

### Behavior

When using `--record-history`:

1. **No Database Connection**: The tool will not connect to or execute anything against the database
2. **History Update Only**: New SQL statements are added to the history file with a `recordedOnly: true` flag
3. **Incremental Detection**: Only new statements (not already in history) are recorded
4. **Environment Scoped**: History is updated for the specified environment only

### Example

```bash
$ sqldrift migrations.sql --record-history --environment=development

Recording 3 new SQL statement(s) to history without executing...

1. CREATE TABLE users ( id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100) NOT NULL, email VARCH...
2. INSERT INTO users (name, email) VALUES ('John Doe', 'john@example.com')
3. CREATE TABLE posts ( id INT AUTO_INCREMENT PRIMARY KEY, user_id INT, title VARCHAR(200) NOT NUL...

Successfully recorded 3 statement(s) to history
History updated: /Users/username/.sqldrift/development-migrations.sql-history.json
Note: SQL statements were NOT executed against the database.
```

## Clear History Mode

The `--clear-history` flag allows you to delete the history file for a specific environment and SQL file. This is useful when:

- You want to reset the tracking and start fresh
- You need to re-run all migrations from the beginning
- You want to clean up old history files

### Usage

```bash
sqldrift path/to/migrations.sql --clear-history --environment=development
```

### Behavior

When using `--clear-history`:

1. **No Database Connection**: The tool will not connect to or execute anything against the database
2. **History File Deletion**: The specific history file for the environment and SQL file is deleted
3. **Environment Scoped**: Only the history for the specified environment is cleared
4. **Safe Operation**: If the history file doesn't exist, a friendly message is shown

### Example

```bash
$ sqldrift migrations.sql --clear-history --environment=development

Successfully deleted history file for environment 'development' and file 'migrations.sql'
Deleted: /Users/username/.sqldrift/development-migrations.sql-history.json
Note: No SQL statements were executed against the database.
```

If the history file doesn't exist:

```bash
$ sqldrift migrations.sql --clear-history --environment=development

No history file found for environment 'development' and file 'migrations.sql'
Expected location: /Users/username/.sqldrift/development-migrations.sql-history.json
Note: No SQL statements were executed against the database.
```

## Requirements

- Node.js >= 18.0.0
- MySQL database

## License

MIT
