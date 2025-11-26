# 🛑 Infrastructure Recovery Required

The agent attempted to start the database and Keycloak but failed due to Docker configuration/permission issues on this machine.

**To unblock the project, please:**

1.  **Start the Infrastructure**:
    ```powershell
    cd infra
    docker-compose up -d
    ```
    *(Ensure Docker Desktop is running)*

2.  **Verify Database**:
    Ensure port `5435` is active (as defined in `env_config`).

3.  **Resume Work**:
    Once the DB is up, the "Minimal SSO POC" is ready to test.
    - **Seed Data**: `npx ts-node prisma/seed_sso.ts`
    - **Verify Config**: `npx ts-node verify_sso_config.ts`
    - **Login**: Go to `http://localhost:3000/login` and use `prof@demo-sso.edu`.

## Current State
- **Auth**: "Parked" in a stable state. Login page now falls back to Password if SSO lookup fails.
- **SSO**: Configured and debug-logged, but waiting for Keycloak/DB.
- **Next Step**: Phase 3 (Exam Engine) can start immediately once DB is up.
