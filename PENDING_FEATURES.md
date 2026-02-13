# MCUBES - Pending Features After Core Build

## ✅ COMPLETED (Core Competition System)

1. **Admin Panel** - `/app/admin/page.js`
   - Create competitions with multiple events
   - Free/Paid competition types
   - Pricing models (Flat, Per Event, Base+Extra)
   - Currency selection (INR/USD)
   - Scramble management (5 per event)
   - Competition listing and deletion

2. **Authentication** - FULLY WORKING
   - Email/Password login
   - Google OAuth
   - WCA ID auto-generation
   - Role-based access (Admin/User)

3. **Homepage** - Competition listing
4. **Event System** - All 17 WCA events configured

---

## 🔨 PENDING FEATURES (To be built next)

### 1. Competition Detail Page (`/competition/[competitionId]`)
**Priority: HIGH**
- [ ] Competition intro section (banner, description, rules)
- [ ] Event list display
- [ ] Registration system (event selection)
- [ ] Payment integration (Razorpay)
- [ ] "Start Competition" button (for registered users)
- [ ] Competition status check (UPCOMING/LIVE/ENDED)

### 2. WCA Timer Component
**Priority: HIGH**
- [ ] 15-second inspection countdown
- [ ] Beep at 8s and 5s
- [ ] Auto +2 penalty (15-17s)
- [ ] Auto DNF (>17s)
- [ ] Space bar controls
- [ ] Scramble reveal button
- [ ] Refresh protection (DNF on refresh)
- [ ] Save solve to Firestore
- [ ] Auto-move to next scramble

### 3. Leaderboard Page (`/leaderboard/[competitionId]`)
**Priority: HIGH**
- [ ] Fetch all completed results
- [ ] Calculate Ao5 (drop best/worst)
- [ ] Handle DNF logic
- [ ] Sort by average, then best single
- [ ] Display: Rank, Username, WCA ID, Country, Average, Best
- [ ] Public access (no auth required)

### 4. Enhanced Profile Page (`/profile`)
**Priority: MEDIUM**
- [ ] View own profile
- [ ] Edit: Display Name, Username, Country, Photo
- [ ] Show: WCA ID, Registration Date, Email (read-only)
- [ ] Event-wise best single
- [ ] Event-wise best average
- [ ] Competition history
- [ ] Public profile view (`/profile/[userId]`)

### 5. Payment Integration (Razorpay)
**Priority: MEDIUM**
- [ ] Razorpay checkout integration
- [ ] Order creation API
- [ ] Payment verification (server-side)
- [ ] Payment status in Firestore
- [ ] Access control (only paid users can compete)
- [ ] Payment history in profile
- [ ] Currency conversion (INR/USD)

### 6. Competition Registration
**Priority: HIGH**
- [ ] Event selection UI
- [ ] Calculate total price
- [ ] Prevent duplicate registration
- [ ] Store registration in Firestore
- [ ] Show registered events in competition detail

### 7. Result Calculation (Server-Side)
**Priority: HIGH**
- [ ] API endpoint to calculate Ao5
- [ ] Remove best and worst times
- [ ] Handle DNF cases
- [ ] Update results collection
- [ ] Lock submission permanently

### 8. Security & Validation
**Priority: HIGH**
- [ ] Firestore security rules
  - Only admin can create competitions
  - Users can only write their own solves
  - Prevent editing after submission
  - Protect payment records
- [ ] Server-side validation for all operations
- [ ] Prevent cheating (client-side manipulation)

### 9. Competitions Listing Page (`/competitions`)
**Priority: MEDIUM**
- [ ] List all competitions
- [ ] Filter by status (Upcoming/Live/Ended)
- [ ] Search functionality
- [ ] Pagination

### 10. Currency Switcher
**Priority: LOW**
- [ ] Global currency state
- [ ] Header currency selector
- [ ] Real-time price conversion
- [ ] Store user currency preference

### 11. Branding Cleanup
**Priority: LOW**
- [ ] Remove any external branding
- [ ] Custom 404 page
- [ ] Custom error pages
- [ ] Favicon update

### 12. User Management (Admin)
**Priority: MEDIUM**
- [ ] View all users
- [ ] Ban/unban users
- [ ] Delete users
- [ ] View user solve logs
- [ ] Export user data

### 13. Competition Analytics (Admin)
**Priority: LOW**
- [ ] Participant count
- [ ] Payment analytics
- [ ] Event popularity
- [ ] Export results to CSV

---

## 📦 Additional Enhancements (Future)

- [ ] Email verification on signup
- [ ] Email notifications (competition start/end)
- [ ] Forgot password page
- [ ] Mobile app responsiveness
- [ ] PWA support
- [ ] Real-time leaderboard updates
- [ ] Competition countdown timer
- [ ] Social sharing (share results)
- [ ] Multi-language support

---

## 🔑 Required API Keys

Before payment integration:
1. **Razorpay**
   - Get from: https://dashboard.razorpay.com/app/keys
   - Add `NEXT_PUBLIC_RAZORPAY_KEY_ID` to `.env.local`
   - Add `RAZORPAY_KEY_SECRET` to `.env.local`

2. **Firebase** - Already configured ✓

---

## ⚡ Next Immediate Steps

**Phase 1 (Current):**
1. Build Competition Detail Page
2. Build WCA Timer Component  
3. Build Leaderboard Page

**Phase 2:**
4. Add Payment Integration
5. Build Profile Page
6. Add Firestore Security Rules

**Phase 3:**
7. User Management
8. Analytics
9. Polish & Testing
