# SQLDrift

A CLI tool for running SQL migrations against MySQL databases with tracking.

## Installation

```bash
npm install -g sqldrift
```

Or run directly with npx:

```bash
npx sqldrift path/to/your/migrations.sql
```

## Usage

### Basic Usage

```bash
sqldrift path/to/migrations.sql
```

### With Custom Configuration

```bash
sqldrift path/to/migrations.sql --config=custom.cnf
```

## How It Works

1. **First Run**: SQLDrift creates a default configuration file at `~/.sqldrift/default.conf` with default MySQL connection settings.

2. **SQL Parsing**: It parses your SQL file and splits it into individual statements.

3. **History Tracking**: For each SQL file, it maintains a history file at `~/.sqldrift/[filename]-history.json` to track which statements have been executed.

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

## Features

- ✅ **Incremental Execution**: Only runs new SQL statements
- ✅ **History Tracking**: Maintains execution history per SQL file
- ✅ **Transaction Safety**: Rollback on failure
- ✅ **User Confirmation**: Prompts before execution
- ✅ **Custom Configuration**: Support for multiple database configurations
- ✅ **Relative/Absolute Paths**: Works with both relative and absolute file paths

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
History updated: /Users/username/.sqldrift/migrations.sql-history.json
```

Second run (after adding new statements to the file):
```bash
$ sqldrift migrations.sql

No new SQL statements to execute.
```

## Requirements

- Node.js >= 18.0.0
- MySQL database

## License

MIT