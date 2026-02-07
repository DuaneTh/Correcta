/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    return {
      name: "correcta",
      removal: input?.stage === "production" ? "retain" : "remove",
      home: "aws",
      providers: {
        aws: {
          region: "eu-west-3",
        },
      },
    };
  },
  async run() {
    // --- Secrets ---
    const databaseUrl = new sst.Secret("DatabaseUrl");
    const openaiApiKey = new sst.Secret("OpenaiApiKey");
    const nextauthSecret = new sst.Secret("NextauthSecret");
    const csrfSecret = new sst.Secret("CsrfSecret");
    const institutionCookieSecret = new sst.Secret("InstitutionCookieSecret");
    const minioAccessKey = new sst.Secret("MinioAccessKey");
    const minioSecretKey = new sst.Secret("MinioSecretKey");

    // --- S3 Bucket for exam assets ---
    const assetsBucket = new sst.aws.Bucket("ExamAssets", {
      access: "public",
    });

    // --- Migration Lambda (invoke after deploy) ---
    new sst.aws.Function("MigrateDb", {
      handler: "scripts/migrate-handler.handler",
      timeout: "120 seconds",
      memory: "512 MB",
      environment: {
        DATABASE_URL: databaseUrl.value,
      },
      copyFiles: [
        { from: "prisma", to: "prisma" },
        { from: "prisma.config.ts" },
        { from: "node_modules/.prisma", to: "node_modules/.prisma" },
        { from: "node_modules/prisma", to: "node_modules/prisma" },
        { from: "node_modules/@prisma", to: "node_modules/@prisma" },
      ],
    });

    // --- Next.js Site ---
    new sst.aws.Nextjs("CorrectaSite", {
      link: [assetsBucket],
      domain: {
        name: "correcta.app",
        dns: false,
        cert: "arn:aws:acm:us-east-1:533232489617:certificate/f50cf5ec-fa62-4c5f-bd20-376f8a23e5bc",
      },
      server: {
        timeout: "30 seconds",
        memory: "1024 MB",
      },
      environment: {
        // Database
        DATABASE_URL: databaseUrl.value,

        // Auth
        NEXTAUTH_URL: "https://correcta.app",
        NEXTAUTH_SECRET: nextauthSecret.value,

        // CSRF
        CSRF_SECRET: csrfSecret.value,
        CSRF_ENABLED: "true",

        // Institution cookie
        INSTITUTION_COOKIE_SECRET: institutionCookieSecret.value,

        // AI
        OPENAI_API_KEY: openaiApiKey.value,

        // S3 storage (via minio client)
        MINIO_ENDPOINT: "s3.eu-west-3.amazonaws.com",
        MINIO_PORT: "443",
        MINIO_USE_SSL: "true",
        MINIO_ACCESS_KEY: minioAccessKey.value,
        MINIO_SECRET_KEY: minioSecretKey.value,
        MINIO_BUCKET: assetsBucket.name,

        // Feature flags — disable features requiring Redis
        RATE_LIMIT_ENABLED: "false",
        ENABLE_GRADING_QUEUE: "false",
        ATTEMPT_INTEGRITY_REQUIRED: "false",

        // Security
        CSP_ENFORCE: "false",
        NODE_ENV: "production",
      },
    });
  },
});
