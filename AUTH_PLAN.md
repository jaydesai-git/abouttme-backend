# SaaS Backend Specification (NestJS + Prisma + PostgreSQL)

## Tech Stack

- NestJS
- Prisma ORM
- PostgreSQL
- JWT (Access + Refresh)
- Google OAuth
- Swagger

- Argon2
- class-validator

---

# 1. Core Architecture

## Modules

```text
src/
├── auth/
├── users/
├── oauth/
├── sessions/
├── profiles/
├── onboarding/
├── common/
│   ├── guards/
│   ├── decorators/
│   ├── filters/
│   ├── interceptors/
│   └── dto/
└── prisma/
```

---

# 2. Database Schema

## Users

Authentication identity only.

| Field         | Type     | Nullable | Notes                        |
| ------------- | -------- | -------- | ---------------------------- |
| id            | UUID     | No       | Primary key                  |
| email         | String   | No       | Unique                       |
| passwordHash  | String   | Yes      | Null for social login        |
| emailVerified | Boolean  | No       | Default false                |
| status        | Enum     | No       | ACTIVE / SUSPENDED / DELETED |
| createdAt     | DateTime | No       | Default now                  |
| updatedAt     | DateTime | No       | Auto update                  |
| deletedAt     | DateTime | Yes      | Soft delete                  |

### Prisma

```prisma
model User {
  id             String   @id @default(uuid())
  email          String   @unique
  passwordHash   String?
  emailVerified  Boolean  @default(false)
  status         UserStatus @default(ACTIVE)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  deletedAt      DateTime?

  oauthAccounts  OauthAccount[]
  sessions       Session[]
  profile        Profile?
  onboarding     Onboarding?
}

enum UserStatus {
  ACTIVE
  SUSPENDED
  DELETED
}
```

> **Future (pricing / limits):** Plan and usage limits (e.g. how many bio links, business cards, QR codes) will live on the user — not a separate workspace. Defer until billing is introduced.

---

## OAuth Accounts

Supports Google, Apple, GitHub, Microsoft.

| Field          | Type     | Notes                                 |
| -------------- | -------- | ------------------------------------- |
| id             | UUID     | PK                                    |
| userId         | UUID     | FK users                              |
| provider       | Enum     | GOOGLE / APPLE / Instagram / Facebook |
| providerUserId | String   | Unique with provider                  |
| email          | String   | Provider email                        |
| avatar         | String   | Provider avatar                       |
| createdAt      | DateTime |                                       |

### Prisma

```prisma
model OauthAccount {
  id             String   @id @default(uuid())
  userId         String
  provider       OauthProvider
  providerUserId String
  email          String?
  avatar          String?
  createdAt       DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerUserId])
  @@index([userId])
}

enum OauthProvider {
  GOOGLE
  APPLE
  GITHUB
  MICROSOFT
}
```

---

## Sessions

Refresh token storage.

| Field            | Type     | Notes          |
| ---------------- | -------- | -------------- |
| id               | UUID     | PK             |
| userId           | UUID     | FK users       |
| refreshTokenHash | String   | Hashed token   |
| device           | String   | Optional       |
| ip               | String   | Optional       |
| userAgent        | String   | Optional       |
| expiresAt        | DateTime | 30 days        |
| revokedAt        | DateTime | Null if active |
| createdAt        | DateTime |                |

### Prisma

```prisma
model Session {
  id               String   @id @default(uuid())
  userId           String
  refreshTokenHash String
  device           String?
  ip               String?
  userAgent        String?
  expiresAt        DateTime
  revokedAt        DateTime?
  createdAt        DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([expiresAt])
}
```

---

## Profiles

Public profile. Owned by the user.

| Field       | Type     | Notes                 |
| ----------- | -------- | --------------------- |
| id          | UUID     | PK                    |
| userId      | UUID     | Unique FK             |
| username    | String   | Global unique         |
| displayName | String   |                       |
| bio         | String   | Optional              |
| avatar      | String   | Optional              |
| theme       | Enum     | LIGHT / DARK / SYSTEM |
| timezone    | String   | Default UTC           |
| locale      | String   | Default en            |
| createdAt   | DateTime |                       |
| updatedAt   | DateTime |                       |

### Prisma

```prisma
model Profile {
  id          String   @id @default(uuid())
  userId      String   @unique
  username    String   @unique
  displayName String
  bio         String?
  avatar      String?
  theme       Theme @default(SYSTEM)
  timezone    String @default("UTC")
  locale      String @default("en")
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

enum Theme {
  LIGHT
  DARK
  SYSTEM
}
```

---

## Onboarding

Resumable onboarding flow. Owned by the user.

| Field       | Type     | Notes         |
| ----------- | -------- | ------------- |
| id          | UUID     | PK            |
| userId      | UUID     | Unique FK     |
| currentStep | Int      | Default 1     |
| completed   | Boolean  | Default false |
| completedAt | DateTime | Nullable      |
| createdAt   | DateTime |               |
| updatedAt   | DateTime |               |

### Prisma

```prisma
model Onboarding {
  id          String   @id @default(uuid())
  userId      String   @unique
  currentStep Int      @default(1)
  completed   Boolean  @default(false)
  completedAt DateTime?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

---

# 3. Authentication Flow

## Email Signup

```text
POST /auth/signup
    ↓
Validate email/password
    ↓
Create User
    ↓
Create Profile
    ↓
Create Onboarding
    ↓
Create Session
    ↓
Return access + refresh token
```

---

## Google Login

```text
GET /auth/google
    ↓
Google OAuth
    ↓
Callback
    ↓
Check oauth_accounts
    ↓
If exists → login
Else
    ↓
Find user by email
    ↓
Link account OR create new user
    ↓
Create profile/onboarding
    ↓
Create session
    ↓
Return tokens
```

---

# 4. JWT Configuration

## Access Token

- Expiry: 15 minutes
- Contains: userId

## Refresh Token

- Expiry: 30 days
- Stored hashed in DB
- Rotated on every refresh

---

# 5. Refresh Token Rotation

## Request

```http
POST /auth/refresh
Authorization: Bearer <refresh_token>
```

## Logic

```text
Verify JWT
    ↓
Find session
    ↓
Check revokedAt
    ↓
Check expiresAt
    ↓
Verify hash
    ↓
Revoke old session
    ↓
Create new session
    ↓
Return new access + refresh token
```

### Important

- Never reuse old refresh token.
- If old token reused → revoke all sessions for user.

---

# 6. API Endpoints

## Auth

| Method | Endpoint              |
| ------ | --------------------- |
| POST   | /auth/signup          |
| POST   | /auth/login           |
| POST   | /auth/refresh         |
| POST   | /auth/logout          |
| POST   | /auth/logout-all      |
| GET    | /auth/me              |
| GET    | /auth/google          |
| GET    | /auth/google/callback |

---

# 7. DTOs

## Signup DTO

```ts
export class SignupDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d).+$/)
  password: string;
}
```

---

## Login DTO

```ts
export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  password: string;
}
```

---

# 8. Onboarding Steps

## Step 1 - Use Case

### Endpoint

```http
PATCH /onboarding/step-1
```

### Body

```json
{
  "useCase": "CREATOR"
}
```

### Allowed Values

- CREATOR
- BUSINESS
- AGENCY
- DEVELOPER
- FREELANCER
- PERSONAL

---

## Step 2 - Display Name

### Endpoint

```http
PATCH /onboarding/step-2
```

### Body

```json
{
  "displayName": "Jay Rabari"
}
```

### Validation

- 2-40 chars
- Letters, numbers, spaces only

---

## Step 3 - Username

### Endpoint

```http
PATCH /onboarding/step-3
```

### Body

```json
{
  "username": "jay"
}
```

### Validation

- 3-30 chars
- a-z, 0-9, underscore, hyphen
- Global unique
- Reserved words blocked

### Reserved Usernames

- admin
- api
- support
- help
- pricing
- login
- signup
- dashboard
- settings
- www

---

## Step 4 - Social Links (Optional)

### Endpoint

```http
PATCH /onboarding/step-4
```

### Body

```json
{
  "links": [
    {
      "platform": "INSTAGRAM",
      "url": "https://instagram.com/jay"
    }
  ]
}
```

---

## Step 5 - AI Preferences

### Endpoint

```http
PATCH /onboarding/step-5
```

### Body

```json
{
  "tone": "PROFESSIONAL",
  "industry": "TECH"
}
```

---

## Step 6 - Finish

### Endpoint

```http
POST /onboarding/finish
```

### Response

```json
{
  "success": true,
  "message": "Onboarding completed"
}
```

---

# 9. Onboarding Rules

## Cannot Skip Steps

If currentStep = 2

Requesting step-4 returns:

```json
{
  "statusCode": 400,
  "message": "Complete previous onboarding steps first"
}
```

---

## Resume Flow

```http
GET /onboarding/status
```

### Response

```json
{
  "completed": false,
  "currentStep": 3
}
```

Frontend redirects to step 3.

---

# 10. Swagger Standards

Every endpoint must include:

```ts
@ApiTags('Auth')
@ApiOperation({
  summary: 'Login user',
  description: 'Authenticate using email and password'
})
@ApiBody({ type: LoginDto })
@ApiOkResponse({ type: AuthResponseDto })
@ApiUnauthorizedResponse({
  description: 'Invalid credentials'
})
```

Protected endpoints:

```ts
@ApiBearerAuth()
```

---

# 11. Global Validation

```ts
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: {
      enableImplicitConversion: true,
    },
  }),
);
```

---

# 12. Error Responses

## Standard Format

```json
{
  "success": false,
  "message": "Username already taken",
  "errors": [
    {
      "field": "username",
      "message": "This username is already in use"
    }
  ]
}
```

---

# 13. Prisma Commands

Use ONLY migrations.

```json
{
  "db:generate": "prisma generate",
  "db:migrate": "prisma migrate dev",
  "db:setup": "prisma generate && prisma migrate dev && prisma db seed",
  "db:reset": "prisma migrate reset --force",
  "db:studio": "prisma studio",
  "db:seed": "prisma db seed"
}
```

### Never Use

```bash
prisma db push
```

---

# 14. Initial Migration Order

```bash
npx prisma migrate dev --name init_users
npx prisma migrate dev --name add_oauth_accounts
npx prisma migrate dev --name add_sessions
npx prisma migrate dev --name add_profiles
npx prisma migrate dev --name add_onboarding
```

---

# 15. Frontend Redirect Logic (Ignore this step for backend development)

## After Login

```text
GET /auth/me
    ↓
GET /onboarding/status
    ↓
completed = false ?
    ↓
/onboarding/step-{currentStep}
    ↓
else
    ↓
/dashboard
```

---

# 16. Public Profile URL

```text
https://yourapp.com/jay
```

Query flow:

```text
username
    ↓
profiles
    ↓
links
    ↓
render page
```

---

# 17. Production Checklist

- UUID everywhere
- Soft delete users
- Hash refresh tokens
- Rotate refresh tokens
- Global validation pipe
- Swagger complete
- Rate limiting
- CORS configured
- Helmet enabled
- Compression enabled
- E2E tests for auth
- No prisma db push

In short DB design ke baad kuch below jesa dikhega bhavishya mein

```text
User (Identity)
│
├── OAuth Accounts
├── Sessions
├── Profile / Bio Pages (many — limited by plan later)
│      ├── username (global unique)
│      └── links
│
├── Business Cards (many — limited by plan later)
│      └── slug/publicId
│
├── QR Codes (many — limited by plan later)
│      └── publicId
│
├── Email Signatures (many)
│
├── Meeting Backgrounds (many)
│
└── AI Assets / Templates
```

Plan / pricing decides create limits (bio pages, cards, QR, etc.) on the user — no workspace container.
