# FGCScout

## Docker development

Start the development stack once:

```powershell
docker compose up --build
```

The automatically loaded `docker-compose.override.yml` mounts the frontend and
backend source folders into their containers. Next.js and `dotnet watch` reload
the application after a file is saved, so ordinary source changes do not require
another Docker build.

Rebuild only after changing dependencies, a Dockerfile, or Compose configuration.
