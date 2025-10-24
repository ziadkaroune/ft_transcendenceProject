# ft_transcendence

# To achieve 100% project completion, a minimum of 7 major modules is required

### Done (5.5) : 
-  Minor module:   Tailwind CSS                             (.5)
-  Minor module: Game customization options                 (.5)
-  Minor module: User and Game Stats Dashboard              (.5)
-  Major module: Implementing Advanced 3D Techniques        (1)
-  Minor module: Support on all devices.                    (.5)
-  Minor module: Multiple language support.                 (.5)
-  Major Module : backend (fastify , nodejs)                 (1)
-  Minor Module : database (sqlite3)                         (.5)
- Major module: Designing the Backend as Microservices           (1)
- Minor module: Expanding Browser Compatibility                 (.5)
-- Major module: Introduce an AI opponent. (1)

## need more work:
Major module: Multiple players (1)
Major module: User Management (Standard user management + OAuth 2.0 authentication) (1) - **Login/Registration implemented, OAuth integration pending**

## total
 - (7.5) > mondatory part == 7

## Database Structure
- **players.db**: Tournament players/aliases
- **matches.db**: Match history
- **users.db**: User accounts, authentication, stats, friends (NEW)

## Testing

### Backend Tests

#### Run all tests
```bash
# Users service
cd microservices/users && npm test

# Players service
cd microservices/players && npm test

# Matches service
cd microservices/matches && npm test
```

#### Run tests with coverage
```bash
cd microservices/users && npm run test:coverage
cd microservices/players && npm run test:coverage
cd microservices/matches && npm run test:coverage
```

#### Watch mode (for development)
```bash
cd microservices/users && npm run test:watch
```

### Frontend Tests

#### Run frontend tests
```bash
cd frontend

# Install dependencies first
npm install

# Run tests
npm test
```

#### Run with coverage
```bash
cd frontend && npm run test:coverage
```

#### Watch mode
```bash
cd frontend && npm run test:watch
```

#### Test Coverage
- ✅ User authentication (login/registration)
- ✅ Dashboard rendering and data display
- ✅ Profile updating functionality
- ✅ Match history display
- ✅ Logout functionality
- ✅ Error handling

**Note**: Make sure all microservices are running before running integration tests.

```bash
# Start all services
docker-compose up -d

# Or start individually
cd microservices/users && npm start
cd microservices/players && npm start
cd microservices/matches && npm start
```

## next 
-- ✅ Login/Registration system with user authentication
-- ✅ User dashboard with stats and match history
-- ✅ Profile-based gameplay with score tracking
-- ✅ Match results connected to user accounts
-- integrate OAuth 2.0 (Google/42) with users service
-- profile page with editable avatar and display name

## Troubleshooting

### Node.js Version Issues

If you encounter errors during `npm install`, ensure you're using Node.js version 18 or higher:

```bash
node --version  # Should be v18.x.x or higher
```

If you need to upgrade Node.js:
```bash
# Using nvm (recommended)
nvm install 20
nvm use 20

# Or download from https://nodejs.org/
```

### Fresh Installation

If you continue to have issues, try a fresh installation:

```bash
# Remove node_modules and package-lock
cd frontend
rm -rf node_modules package-lock.json

# Clean npm cache
npm cache clean --force

# Reinstall
npm install
```

### Docker Build Issues

If Docker builds fail:

```bash
# Clean Docker build cache
docker system prune -a

# Rebuild without cache
docker-compose build --no-cache

# Rebuild specific service
docker-compose build --no-cache frontend
```