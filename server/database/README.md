## How to run database:

```bash
# create database
psql -U <username>
CREATE DATABASE nextalk;
\q
# run migrations and seed
node ace migration:run
node ace db:seed
```

If already exists

```bash
DROP DATABASE IF EXISTS nextalk;
CREATE DATABASE nextalk;
```
