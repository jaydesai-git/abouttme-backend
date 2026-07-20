# NestJS High-Performance Backend

A production-ready REST API built with NestJS, Fastify, Prisma ORM, and PostgreSQL.

## 🚀 Tech Stack

* **Framework:** [NestJS](https://nestjs.com/) (Node.js)
* **HTTP Engine:** [Fastify](https://www.fastify.io/)
* **Database:** PostgreSQL
* **ORM:** [Prisma](https://www.prisma.io/)
* **Validation:** `class-validator` / `zod`
* **Documentation:** Swagger UI

## 📂 Project Structure

```
abouttme-backend/
├── prisma/
│   ├── schema.prisma          # Single source of truth for your DB
│   ├── migrations/            # Auto-generated SQL migration files
│   └── seed/                  # Modular seeding folder
│       ├── index.ts           # Main seed runner (calls other seeds)
│       ├── roles.seed.ts      # Role seeding logic
│       └── users.seed.ts      # User seeding logic
├── src/
│   ├── common/                # Shared Pipes, Filters, Interceptors
│   ├── config/                # Environment config & Zod validation
│   ├── database/              # Prisma Service & Module
│   ├── modules/               # Feature modules (e.g., users, auth)
│   ├── app.module.ts          # Root module
│   └── main.ts                # App entry point (Fastify & Validation)
├── .env                       # Environment variables (Database URL)
├── .env.example               # Template for environment variables
├── tsconfig.json
└── package.json
```

## 📋 Prerequisites

* Node.js (v18 or higher)
* npm, yarn, or pnpm
* A running PostgreSQL database (Local or Cloud like Neon/Supabase)

## 🛠️ Setup & Installation

**1. Clone the repository and install dependencies**

```bash
git clone <repository-url>
cd abouttme-backend
npm install
```

**2. Configure Environment**

Copy `.env.example` to `.env` and add your PostgreSQL connection URL.

```bash
cp .env.example .env
# Example inside .env: DATABASE_URL="postgresql://user:password@localhost:5432/mydb?schema=public"
```

**3. Automated Database Setup (One-Click)**

To generate the Prisma Client, run all migrations, and populate the database with seed data in one go:

```bash
npm run db:setup
```

**4. Start the Application**

```bash
npm run start:dev
```

The API will be available at http://localhost:3000.  
Swagger API documentation will be available at http://localhost:3000/docs.

## 🤖 Automated Scripts

Your `package.json` contains automated scripts for a frictionless developer experience.

* `npm run start:dev` — Starts the application in watch mode.
* `npm run build` — Builds the application for production.
* `npm run db:setup` — Runs `prisma generate`, then `prisma migrate dev`, and automatically seeds the DB.
* `npm run db:reset` — (Magic Command) Drops the DB, reapplies all migrations from scratch, and runs the seed folder automatically (`prisma migrate reset --force`). Perfect for fixing broken states.
* `npm run db:studio` — Opens Prisma Studio GUI to visually manage your DB.

## ⚙️ Prisma Configuration

To ensure the modular seed folder works correctly, the `package.json` includes the following configuration:

```json
"prisma": {
  "seed": "ts-node --compiler-options {\"module\":\"CommonJS\"} prisma/seed/index.ts"
}
```

## 🏗️ Architecture Note

This project uses a feature-module architecture. Every new domain (e.g., Products, Orders) should live inside `src/modules/` with its own Controller, Service, and DTOs to maintain strict separation of concerns.

## 🌱 Default Seed Data

After `npm run db:setup` or `npm run db:reset`, the following records are created:

| Role  | Email              | Password   |
|-------|--------------------|------------|
| ADMIN | admin@example.com  | Admin123!  |
| USER  | user@example.com   | User123!   |
