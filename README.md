# CEditor - Browser-Based Code Editor with Microservices Architecture

> A production-ready code editor with contest security, real-time collaboration, and enterprise-grade microservices architecture.

[![Docker](https://img.shields.io/badge/Docker-Ready-blue)](https://www.docker.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org/)
[![Better-Auth](https://img.shields.io/badge/Better--Auth-OAuth-green)](https://better-auth.com/)

---

## 📑 Table of Contents

- [Architecture Overview](#-architecture-overview)
- [Services](#-services)
- [Tech Stack](#-tech-stack)
- [Quick Start](#-quick-start)
- [Environment Setup](#-environment-setup)
- [API Documentation](#-api-documentation)
- [Design Patterns](#-design-patterns)
- [Security](#-security)
- [Deployment](#-deployment)

---

## 🏗️ Architecture Overview

### High-Level System Architecture

```mermaid
graph TB
    subgraph Client["🌐 Browser Layer"]
        User["User Browser"]
        Cookies["First-Party Cookies<br/>(Vercel Domain)"]
    end

    subgraph Vercel["⚡ Frontend & BFF (Vercel)"]
        FE["Next.js App"]
        Proxy["BFF Proxy<br/>/api/* & /api/auth/*"]
    end

    subgraph Render["🚀 Backend Infrastructure (Render)"]
        AG["API Gateway<br/>• Circuit Breaker<br/>• Auth Offloading"]
        subgraph Services["Microservices"]
            Auth["Auth Service"]
            UserSvc["User Service"]
            Code["Code Service"]
        end
    end

    subgraph Infra["💾 Data Layer"]
        Mongo[("MongoDB Atlas")]
        Redis[("Redis Caching")]
        Kafka[("Kafka Events")]
    end

    User --> FE
    FE --"Relative API Calls"--> Proxy
    Proxy --"Secure Tunnel"--> AG
    
    AG --> Auth
    AG --> UserSvc
    AG --> Code
    
    Auth & UserSvc & Code --> Mongo
    Auth & Code --> Redis
    Auth --"Events"--> Kafka
    UserSvc & Code --"Listen"--> Kafka

    style Vercel fill:#f0f0f0,stroke:#333
    style Render fill:#e1f5ff,stroke:#007bff
    style Client fill:#fff3cd,stroke:#856404
```

### Service-Level Architecture Breakdown

```mermaid
graph LR
    subgraph AG["API Gateway :3000"]
        Router["Express Router"]
        CircuitB["Circuit Breaker<br/>(Opossum)"]
        RateLimit["Rate Limiter"]
        AuthMW["Auth Middleware"]
    end

    subgraph AuthSvc["Auth Service :3001"]
        BetterAuth["Better-Auth"]
        GoogleOAuth["Google OAuth"]
        EmailPwd["Email/Password"]
        SessionMgr["Session Manager"]
    end

    subgraph UserSvc["User Service :3002"]
        ProfileAPI["Profile API"]
        KafkaConsumer1["Kafka Consumer"]
        UserDB[("user_db")]
    end

    subgraph CodeSvc["Code Service :3003"]
        ProjectAPI["Project API"]
        Sanitizer["Code Sanitizer"]
        RedisBuffer["Redis Buffer"]
        Flusher["Flusher Worker"]
        Janitor["Janitor Worker"]
        CodeDB[("code_db")]
    end

    Router --> CircuitB
    CircuitB --> AuthMW
    AuthMW --> RateLimit
    
    RateLimit --"/auth/*"--> BetterAuth
    RateLimit --"/user/*"--> ProfileAPI
    RateLimit --"/code/*"--> ProjectAPI
    
    BetterAuth --> GoogleOAuth
    BetterAuth --> EmailPwd
    BetterAuth --> SessionMgr
    
    ProfileAPI --> UserDB
    KafkaConsumer1 --> UserDB
    
    ProjectAPI --> Sanitizer
    Sanitizer --> RedisBuffer
    RedisBuffer --> Flusher
    Flusher --> CodeDB
    Janitor --> CodeDB
```

### Data Flow: User Registration (Saga Pattern)

```mermaid
sequenceDiagram
    participant Client
    participant AG as API Gateway
    participant Auth as Auth Service (Better Auth)
    participant Saga as Saga Coordinator
    participant User as User Service
    participant Code as Code Service
    participant Kafka
    participant DB as MongoDB

    Client->>+AG: POST /api/auth/sign-up/email
    AG->>+Auth: Proxy Request
    Auth->>DB: Create User Account
    Auth->>Saga: Initialize Registration Saga
    
    Saga->>User: Step 1: Create Profile
    User->>DB: Save Profile
    User-->>Saga: Profile Created ✓
    Saga->>Kafka: Publish 'user-registered' Event
    
    Saga->>Code: Step 2: Initialize Starter Project
    Code->>DB: Create Base Project
    Code-->>Saga: Project Created ✓
    Saga->>Kafka: Publish 'saga-completed' Event
    
    Saga-->>Auth: Saga Success ✓
    Auth-->>AG: 200 OK + Session Cookie
    AG-->>-Client: Registration Complete 🎉
    
    Note over Saga,Code: On any step failure, Saga<br/>triggers compensation (rollback)
```

### Social Auth Flow: Google OAuth (BFF Pattern)

```mermaid
sequenceDiagram
    participant User
    participant Vercel as Next.js BFF (Vercel)
    participant Render as API Gateway (Render)
    participant Auth as Auth Service
    participant Google as Google OAuth

    User->>Vercel: Click "Continue with Google"
    Vercel->>Render: Proxy GET /api/auth/login/google
    Render->>Auth: Forward to Better Auth
    Auth-->>User: Redirect to Google Consent
    User->>Google: Authenticate
    Google-->>Auth: Callback with Code
    Auth->>Google: Exchange Code for Token
    Auth-->>Vercel: Redirect with Session Cookie
    Vercel-->>User: Redirect to /editor (First-Party Cookie Set)
```

### Code Persistence: Multi-Layer Strategy

```mermaid
graph LR
    subgraph Editor["Monaco Editor"]
        E["Code Changes"]
    end

    subgraph L1["L1: Client RAM"]
        Memory["Editor State<br/>Instant"]
    end

    subgraph L2["L2: IndexedDB"]
        IDB["Browser Storage<br/>Every 2s"]
    end

    subgraph L3["L3: Redis"]
        RedisHash["Fragment Buffer<br/>Debounced 1.5s"]
    end

    subgraph L4["L4: MongoDB"]
        Mongo["Persistent DB<br/>Every 60s"]
    end

    E --> Memory
    Memory --"Auto-save"--> IDB
    Memory --"PATCH /sync"--> RedisHash
    RedisHash --"Flusher Worker"--> Mongo
    
    style L1 fill:#e3f2fd
    style L2 fill:#f3e5f5
    style L3 fill:#fff3e0
    style L4 fill:#e8f5e9
```

---

## 🔧 Services

### 1. **API Gateway** (Port 3000)

**Responsibilities:**
- Request routing and load balancing
- Authentication verification
- Circuit breaker pattern (prevents cascade failures)
- Rate limiting (100 req/min per IP)
- CORS handling
- Request/response logging

**Key Features:**
- Better-auth session verification
- x-user-id header injection for downstream services
- Aggregator pattern for dashboard endpoint
- Health check aggregation

**Technologies:** Express, Opossum (Circuit Breaker), Express-rate-limit

---

### 2. **Auth Service** (Port 3001)

**Responsibilities:**
- User registration and login
- Session management (Better-Auth)
- OAuth integration (Google)
- Password reset flows
- Token generation and validation

**Authentication Methods:**
1. **Email/Password** - Traditional auth with bcrypt
2. **Google OAuth** - Social login integration

**Key Features:**
- Better-auth social & email/password providers
- Distributed registration sagas (Saga Coordinator)
- MongoDB session & adapter storage
- HTTP-only secure cookies
- Automatic session expiry (7 days)
- Rate limiting on auth endpoints
- Email verification support (Resend)

**Technologies:** Better-Auth, Mongoose, Resend, Kafka Producer, Saga Coordination Logic

---

### 3. **User Service** (Port 3002)

**Responsibilities:**
- User profile CRUD operations
- Profile data management
- Kafka event consumption for user sync

**API Endpoints:**
- `GET /profile` - Get user profile
- `POST /profile` - Create profile (saga-triggered)
- `DELETE /profile/:userId` - Delete profile (compensation)

**Technologies:** Express, Mongoose, Kafka Consumer

---

### 4. **Code Service** (Port 3003)

**Responsibilities:**
- Project CRUD operations
- Code fragment storage and assembly
- Redis write-behind caching
- Snapshot versioning
- Background workers (Flusher, Janitor)

**API Endpoints:**
- `GET /` - List all user projects
- `GET /:projectId` - Get project by ID
- `POST /save` - Create/update project
- `PATCH /sync/:projectId` - Incremental sync (RFC6902 patches)
- `GET /preview/:projectId` - Generate HTML preview
- `POST /submit` - Contest submission
- `DELETE /:projectId` - Delete project

**Background Workers:**
1. **Flusher** - Syncs Redis buffer to MongoDB every 60s
2. **Janitor** - Cleans up stale/expired projects daily

**Technologies:** Express, Mongoose, Redis (ioredis), Kafka Consumer, fast-json-patch

---

## 💻 Tech Stack

### Frontend
- **Framework:** Next.js 15 (App Router)
- **Editor:** Monaco Editor
- **Styling:** Tailwind CSS
- **State:** React Hooks
- **Storage:** IndexedDB (idb library)
- **HTTP Client:** Fetch API

### Backend
| Layer | Technologies |
|-------|-------------|
| **Runtime** | Node.js 20, TypeScript 5 |
| **Web Framework** | Express 5 |
| **Authentication** | Better-Auth (OAuth + Email) |
| **Database** | MongoDB Atlas (Mongoose ODM) |
| **Caching** | Redis (ioredis) |
| **Messaging** | Kafka.js |
| **Logging** | Winston |
| **Validation** | Zod |
| **Sanitization** | isomorphic-dompurify |

### Infrastructure
- **Containerization:** Docker + Docker Compose
- **Reverse Proxy:** API Gateway (Express)
- **Message Broker:** Apache Kafka 3.7
- **Cache Store:** Redis Stack 6.2
- **Database:** MongoDB Atlas

### DevOps
- **CI/CD:** Docker multi-stage builds
- **Logging:** Structured JSON logs (Winston)
- **Monitoring:** Health check endpoints
- **Process Management:** Graceful shutdown handlers

---

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose
- Node.js 20+ (for local development)
- MongoDB Atlas account (or local MongoDB)
- Google Cloud Console account (for OAuth)

### 1. Clone Repository
```bash
git clone https://github.com/yourusername/browser-editor.git
cd browser-editor
```

### 2. Environment Configuration
```bash
# Copy environment template
cp .env.example .env

# Edit .env with your credentials
nano .env
```

**Required credentials:**
- MongoDB Atlas connection strings (3 databases)
- Better-Auth secret (32+ chars)
- Redis password
- Google OAuth credentials (optional)  
- Resend API key (optional, for emails)

### 3. Start with Docker
```bash
# Build and start all services
docker-compose up --build

# Or run in detached mode
docker-compose up -d

# View logs
docker-compose logs -f
```

### 4. Access Services
- **Frontend:** http://localhost:3005
- **API Gateway:** http://localhost:3000
- **Kafka UI:** http://localhost:8080
- **Redis Insight:** http://localhost:8001

---

## ⚙️ Environment Setup

### Complete Environment Variables

Copy `.env.example` to `.env` and configure:

#### Database Connections
```bash
# MongoDB Atlas (create 3 separate databases)
AUTH_DATABASE_URL=mongodb+srv://user:pass@cluster.mongodb.net/ceditor_auth
USER_DATABASE_URL=mongodb+srv://user:pass@cluster.mongodb.net/ceditor_user
CODE_DATABASE_URL=mongodb+srv://user:pass@cluster.mongodb.net/ceditor_code
```

#### Redis Configuration
```bash
REDIS_PASSWORD=your-strong-password-here
```

#### Authentication Secrets
```bash
# Generate with: openssl rand -base64 32
BETTER_AUTH_SECRET=your-secret-min-32-chars
BETTER_AUTH_URL=http://localhost:3000

# x-user-id Header (API Gateway -> Services)
# Ensure API Gateway is configured with the same secret if using legacy JWT verification
```

#### Google OAuth (Optional)
Get credentials from [Google Cloud Console](https://console.cloud.google.com/):

1. Create OAuth 2.0 Client ID
2. Application type: Web application
3. Authorized redirect URIs:
   - Development: `http://localhost:3000/api/auth/callback/google`
   - Production: `https://yourdomain.com/api/auth/callback/google`

```bash
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
```

#### Email Service (Optional)
```bash
# Get from https://resend.com/api-keys
RESEND_API_KEY=re_your_api_key
```

---

## 📡 API Documentation

### Base URLs
- **Vercel (Frontend & BFF):** `https://browser-editor-cyan.vercel.app`
- **Render (API Gateway):** `https://api-gateway-rq2x.onrender.com`

> [!IMPORTANT]
> **BFF Pattern**: All client browser requests MUST be made to relative paths (e.g., `/api/v1/...`). They are proxied through Vercel to the Render Gateway. This ensures first-party cookie stability.

### Authentication Endpoints

#### Register with Email
```http
POST /api/auth/sign-up/email
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "name": "John Doe"
}
```

#### Login with Email
```http
POST /api/auth/sign-in/email
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

#### Google OAuth Login
```http
GET /api/auth/login/google
# Redirects to Google OAuth consent screen
```

#### Get Current Session
```http
GET /api/auth/session
Cookie: better-auth.session_token=xxx
```

### User Endpoints

#### Get Profile
```http
GET /api/v1/user/profile
Cookie: better-auth.session_token=xxx
```

### Code/Project Endpoints

#### List Projects
```http
GET /api/v1/code
Cookie: better-auth.session_token=xxx
```

#### Create Project
```http
POST /api/v1/code/save
Content-Type: application/json
Cookie: better-auth.session_token=xxx

{
  "name": "My Project",
  "html": "<h1>Hello World</h1>",
  "css": "body { margin: 0; }",
  "js": "console.log('Hi');"
}
```

#### Get Project
```http
GET /api/v1/code/:projectId
Cookie: better-auth.session_token=xxx
```

#### Incremental Sync (Delta Updates)
```http
PATCH /api/v1/code/sync/:projectId
Content-Type: application/json
Cookie: better-auth.session_token=xxx

{
  "html": "<h1>Updated</h1>",
  "css": "body { margin: 20px; }"
}
```

#### Dashboard (Aggregator)
```http
GET /api/v1/dashboard
Cookie: better-auth.session_token=xxx

# Returns:
{
  "user": { /* user profile */ },
  "projects": [ /* projects array */ ],
  "timestamp": "2026-01-30T12:00:00Z"
}
```

---

## 🎨 Design Patterns

### 1. **Saga Pattern** (Distributed Transactions)
**Location:** `auth-service/src/sagas/`

**Purpose:** Ensure data consistency across microservices during user registration.

**Flow:**
1. Create user in auth-service
2. Create profile in user-service
3. Create default project in code-service
4. On failure: automatic compensation (rollback)

### 2. **Circuit Breaker Pattern**
**Location:** `api-gateway/src/config/services.ts`

**Purpose:** Prevent cascade failures when downstream services are unavailable.

**Configuration:**
- Timeout: 5000ms
- Error threshold: 50%
- Reset timeout: 30s
- Fallback responses provided

### 3. **Aggregator Pattern**
**Location:** `api-gateway/src/app.ts` (Dashboard endpoint)

**Purpose:** Combine data from multiple services into a single response.

**Example:** Dashboard endpoint fetches user profile + projects in parallel.

### 4. **Write-Behind Caching**
**Location:** `code-service/src/routes/code.route.ts`

**Purpose:** Reduce database I/O by buffering writes in Redis.

**Flow:**
1. Client updates → Redis hash
2. Background worker (every 60s) → MongoDB
3. Cache invalidation on read

---

## 🔐 Security

### Authentication
- ✅ HTTP-only secure cookies (Better-Auth)
- ✅ Session expiry (7 days)
- ✅ Cookie cache (5 minutes)
- ✅ CSRF protection
- ✅ Bcrypt password hashing

### API Security
- ✅ Rate limiting (100 req/min)
- ✅ Helmet.js security headers
- ✅ CORS configured
- ✅ Input validation (Zod)
- ✅ XSS protection (DOMPurify)

### Infrastructure
- ✅ Redis authentication
- ✅ MongoDB Atlas network isolation
- ✅ No hardcoded credentials
- ✅ Environment variable isolation
- ✅ Docker secret management

### Contest Security (Frontend)
- ✅ Fullscreen lock
- ✅ Tab switch detection
- ✅ DevTools detection
- ✅ Clipboard restrictions
- ✅ Strike system (3 warnings → disqualification)

---

## 📂 Project Structure

```
browser-editor/
├── api-gateway/              # API Gateway service
│   ├── src/
│   │   ├── app.ts           # Express app with routing
│   │   ├── config/
│   │   │   ├── services.ts  # Circuit breaker config
│   │   │   └── logger.ts    # Winston logger
│   │   └── middlewares/
│   │       ├── auth.middleware.ts
│   │       └── correlation.middleware.ts
│   └── Dockerfile
│
├── auth-service/             # Authentication service
│   ├── src/
│   │   ├── app.ts
│   │   ├── lib/
│   │   │   └── auth.ts      # Better-Auth configuration
│   │   ├── sagas/           # Saga pattern implementation
│   │   │   ├── saga-coordinator.ts
│   │   │   └── user-registration.saga.ts
│   │   └── routes/
│   └── Dockerfile
│
├── user-service/             # User profile service
│   ├── src/
│   │   ├── app.ts
│   │   ├── models/
│   │   │   └── user.model.ts
│   │   ├── routes/
│   │   │   └── user.route.ts
│   │   └── events/
│   │       └── consumer.ts   # Kafka consumer
│   └── Dockerfile
│
├── code-service/             # Code/project service
│   ├── src/
│   │   ├── app.ts
│   │   ├── models/
│   │   │   ├── project.model.ts
│   │   │   └── submission.model.ts
│   │   ├── routes/
│   │   │   └── code.route.ts
│   │   ├── scripts/
│   │   │   ├── flusher.worker.ts  # Redis→MongoDB sync
│   │   │   └── janitor.worker.ts  # Cleanup worker
│   │   └── middlewares/
│   │       ├── sanitizer.middleware.ts
│   │       └── lock.middleware.ts
│   └── Dockerfile
│
├── frontend/                 # Next.js frontend
│   ├── app/
│   │   ├── (auth)/          # Auth pages
│   │   ├── editor/          # Code editor
│   │   └── profile/         # User profile
│   ├── components/
│   ├── hooks/
│   │   └── useProjectManager.ts
│   └── lib/
│       └── auth-client.ts   # Better-Auth client
│
├── docker-compose.yml        # Service orchestration
├── .env.example              # Environment template
└── README.md
```

---

### BFF Split Deployment (Vercel + Render)

Our architecture is optimized for a split deployment:
1. **Frontend (Vercel)**: Static hosting + Next.js API Routes acting as a BFF Proxy.
2. **Backend (Render)**: API Gateway + Microservices.

> [!TIP]
> **Cookie Persistence**: To ensure cookies work across the split, `BETTER_AUTH_URL` on the Render backend should be set to the Vercel domain.

### Cloud Deployment Checklist

- [ ] Set up MongoDB Atlas production cluster
- [ ] Configure Redis with persistence
- [ ] Set up Kafka cluster (AWS MSK / Confluent Cloud)
- [ ] Enable HTTPS/TLS
- [ ] Configure proper CORS origins
- [ ] Set up monitoring (Prometheus/Grafana)
- [ ] Configure log aggregation
- [ ] Set up backup strategy
- [ ] Enable auto-scaling for code-service
- [ ] Configure CDN for frontend assets

---

## 🧪 Testing

### API Endpoint Testing
```bash
# Run automated test script
bash test-api-endpoints.sh
```

### Manual Testing
```bash
# Health check
curl http://localhost:3000/health

# Register user
curl -X POST http://localhost:3000/api/auth/sign-up/email \\
  -H "Content-Type: application/json" \\
  -H "Origin: http://localhost:3000" \\
  -d '{"email":"test@example.com","password":"Test1234!","name":"Test User"}'

# List projects
curl http://localhost:3000/api/v1/code \\
  -b cookies.txt
```

---

## 📊 Monitoring

### Health Checks
- API Gateway: `GET /health`
- Auth Service: `GET /health`
- User Service: `GET /health`
- Code Service: `GET /health`

### Metrics to Monitor
- Request rate (API Gateway)
- Error rate per service
- Response time (P50, P95, P99)
- Redis cache hit ratio
- Kafka consumer lag
- MongoDB connection pool usage

---

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

---

## 📄 License

MIT License - see LICENSE file for details

---

## 🆘 Troubleshooting

### Service won't start
```bash
# Check logs
docker-compose logs -f <service-name>

# Restart specific service
docker-compose restart <service-name>
```

### Kafka connection errors
Kafka takes ~20-30 seconds to initialize on cold start. This is normal behavior.

### better-auth CORS errors
Ensure `Origin` header is set in requests. Browser automatically sends this; curl requires manual `-H "Origin: http://localhost:3000"`.

### Google OAuth Redirect Failures
1. Ensure `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are correct in `.env`.
2. Verify that `http://localhost:3000/api/auth/callback/google` is added as an Authorized Redirect URI in the Google Cloud Console.
3. Check `BETTER_AUTH_URL` in `auth-service` environment; it should point to the API Gateway (`http://localhost:3000`).

### Frontend shows "Service Degraded"
Circuit breaker has tripped. Check if backend services are running: `docker ps`

---

## 📧 Contact

For support or questions, please open an issue on GitHub.

---

**Built with ❤️ using TypeScript, Next.js, and Docker**
