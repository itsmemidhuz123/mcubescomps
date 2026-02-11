# Auth-Gated App Testing Playbook

## Step 1: Create Test User & Session

For PostgreSQL + Prisma, use this approach:

```javascript
// Create test user and session via API or Prisma Studio
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function createTestUser() {
  const sessionToken = 'test_session_' + Date.now();
  
  // Create user
  const user = await prisma.user.create({
    data: {
      email: 'test.user.' + Date.now() + '@example.com',
      name: 'Test User',
      picture: 'https://via.placeholder.com/150',
      isAdmin: false
    }
  });
  
  // Create session
  const session = await prisma.userSession.create({
    data: {
      userId: user.id,
      sessionToken: sessionToken,
      expiresAt: new Date(Date.now() + 7*24*60*60*1000)
    }
  });
  
  console.log('Session token:', sessionToken);
  console.log('User ID:', user.id);
}

createTestUser();
```

## Step 2: Test Backend API

```bash
# Test auth endpoint
curl -X GET "https://your-app.com/api/auth/me" \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN"

# Test protected endpoints
curl -X GET "https://your-app.com/api/competitions" \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN"
```

## Step 3: Browser Testing

```javascript
// Set cookie and navigate
await page.context.addCookies([{
    "name": "session_token",
    "value": "YOUR_SESSION_TOKEN",
    "domain": "your-app.com",
    "path": "/",
    "httpOnly": true,
    "secure": true,
    "sameSite": "None"
}]);
await page.goto("https://your-app.com");
```

## Quick Debug

```javascript
// Check data format
const users = await prisma.user.findMany({ take: 2 });
const sessions = await prisma.userSession.findMany({ take: 2 });
console.log(users, sessions);

// Clean test data
await prisma.userSession.deleteMany({
  where: { sessionToken: { startsWith: 'test_session' } }
});
await prisma.user.deleteMany({
  where: { email: { contains: 'test.user.' } }
});
```

## Checklist

- [ ] User document has id field (UUID)
- [ ] Session userId matches user's id exactly
- [ ] All queries use proper relations
- [ ] API returns user data (not 401/404)
- [ ] Browser loads dashboard (not login page)

## Success Indicators

✅ /api/auth/me returns user data  
✅ Dashboard loads without redirect  
✅ CRUD operations work  

## Failure Indicators

❌ "User not found" errors  
❌ 401 Unauthorized responses  
❌ Redirect to login page
