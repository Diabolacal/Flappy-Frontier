# Docker Operations Skill

This skill covers SSH-based or local Docker container management for the project.

## When to use this skill

- Checking container status and logs
- Restarting or rebuilding services
- Running database queries
- Managing backup and rollback procedures

## Connection

```bash
# Local Docker
docker ps
```

## Common Commands

### Check container status
```bash
docker ps
docker logs <container-name> --tail 100
```

### Rebuild a service
```bash
# 1. BACKUP first (mandatory before changes)
# Run your backup procedure

# 2. Make changes to service files

# 3. Rebuild (ALWAYS use --build to pick up code changes)
cd /path/to/service && docker compose up -d --build --force-recreate

# 4. Sync to version control
git add . && git commit -m "description" && git push
```

## Safety rules
- Always backup before making changes
- Always use `--build` flag when rebuilding after code changes
- Sync edits back to local workspace for version control
- Never store credentials in Docker compose files (use .env or secrets manager)
