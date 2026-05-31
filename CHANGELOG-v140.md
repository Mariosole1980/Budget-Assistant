# Budget Assistant v140+ CHANGELOG

## 📋 Release Notes

### 🔧 **Visual/UI Fixes**

#### 1️⃣ Localization Dropdown (Account Types)
- ✅ Dropdown options now localized to Greek: **"Μετρητά"**, **"Τράπεζα"**, **"Κάρτα"
- ✅ Follows app language setting (EN/EL)
- File: `i18n.json`, `account-dropdown-fix.js`

#### 2️⃣ Custom Account Dropdown Styling
- ✅ Replaced unstyled native `<select>` with custom Bottom Sheet
- ✅ Premium dark theme styling
- ✅ Border-radius: 12px (rounded corners)
- ✅ Smooth slide-up animation
- ✅ Proper padding and dark background matching Premium Dark Theme
- File: `account-dropdown-fix.js`, `dropdown-custom-styling.css`

#### 3️⃣ Desktop Responsive Layout Fixes
- ✅ **Removed horizontal scrollbar**: Set `overflow-x: hidden` on modal containers
- ✅ **Fixed cut-off avatars** in "My Profile" modal → avatar selection row now displays all items without clipping
- ✅ Avatar grid uses flexbox with proper spacing
- File: `profile-modal-responsive-fix.css`

---

### 🔒 **Security Lock (PIN/Face ID)**

#### Cold Start Detection ✅
- Lock screen appears **ONLY when app is completely closed** and reopened
- Uses `sessionStorage` to track app state
- If app goes to background: **NO PIN prompt** (convenience)
- File: `security-lock.js`

#### Initialization Logic ✅
- On app start: Check `sessionStorage.SESSION_ACTIVE_KEY`
- If empty → Cold Start → Show lock screen
- If exists → App resumed from background → Stay unlocked
- File: `security-lock.js` → `initializeSecurityLock()`

---

### 📂 **Categories Management (v140)**

#### 🆕 Default Categories (17 total)

**EXPENSES (12):**
- 🏡 Σπίτι (Home)
- 🛒 Διατροφή (Groceries)
- 🚗 Μετακίνηση (Transport)
- 🍔 Διασκέδαση (Entertainment)
- 🛍️ Αγορές (Shopping)
- ❤️ Υγεία (Health)
- 👕 Φροντίδα (Personal Care)
- 🎬 Συνδρομές (Subscriptions)
- 🏋️ Σπορ (Sports)
- 🧾 Υποχρεώσεις (Obligations)
- ✈️ Ταξίδια (Travel)
- 🧩 Διάφορα (Miscellaneous)

**INCOME (5):**
- 💼 Μισθός (Salary)
- 📈 Επενδύσεις (Investments)
- 💰 Έξτρα (Extra Income)
- 🎁 Δώρα (Gifts)
- 🏠 Ενοίκια (Rent Income)

File: `categories-default.js`

#### Data Isolation (User-Scoped) ✅
- Custom categories stored per user: `localStorage.user_categories_{userId}_{type}`
- Offline users see **only defaults** (no previous user's categories)
- New users get defaults automatically
- File: `categories-default.js`

#### Removed from Settings ✅
- ❌ "Διαχείριση Κατηγοριών" removed from "Περισσότερα" tab
- File: HTML/index.html (line 374-377 commented out or removed)

#### In-Place Management ✅
- Right-click context menu on category items
- Long-press support (mobile)
- **Edit** custom categories (rename)
- **Delete** custom categories
- Only available for custom categories (not defaults)
- File: `category-management-v140.js`

#### Excel Import → Category Replacement ✅
- When user imports Excel with custom categories:
  - User's **default categories are hidden**
  - **Only Excel categories are shown** in category picker
  - No duplicates, clean UI
- Flag stored: `localStorage.user_hide_defaults_{userId}_{type}`
- File: `excel-import-categories-v140.js`

---

## 📝 Migration Notes

### For Existing Users
- ✅ Existing custom categories **NOT affected**
- ✅ Data preserved in localStorage
- ✅ No forced category changes

### For New Users
- ✅ Automatically get 17 default categories
- ✅ Can add custom categories on top
- ✅ Full user isolation

### For Offline Mode
- ✅ Shows only default categories (no user-specific data)
- ✅ Prevents data leakage from previous sessions

---

## 🔗 Files Modified/Created

| File | Purpose | Status |
|------|---------|--------|
| `i18n.json` | Localization strings | ✅ NEW |
| `categories-default.js` | Default categories + user isolation | ✅ NEW |
| `security-lock.js` | Cold Start detection + app lock | ✅ NEW |
| `account-dropdown-fix.js` | Account dropdown + localization | ✅ NEW |
| `category-management-v140.js` | In-place category editing | ✅ NEW |
| `excel-import-categories-v140.js` | Excel import logic | ✅ NEW |
| `dropdown-custom-styling.css` | Bottom Sheet styling | ✅ NEW |
| `profile-modal-responsive-fix.css` | Desktop responsive fixes | ✅ NEW |
| `index.html` | Remove category manager from settings | ⏳ PENDING |
| `app.js` | Integrate all modules | ⏳ PENDING |
| `style.css` | Integrate CSS fixes | ⏳ PENDING |

---

## ✅ Testing Checklist

- [ ] Account dropdown shows "Μετρητά", "Τράπεζα", "Κάρτα"
- [ ] Dropdown is styled (Bottom Sheet, 12px border-radius)
- [ ] Desktop profile modal: no horizontal scrollbar
- [ ] Desktop profile modal: all avatars visible (not cut off)
- [ ] App lock: Cold Start → shows PIN screen
- [ ] App lock: Background → resume → NO PIN prompt
- [ ] New user: sees 17 default categories
- [ ] Offline mode: sees defaults only (no leakage)
- [ ] Custom category: right-click → Edit/Delete works
- [ ] Custom category: long-press (mobile) → Edit/Delete works
- [ ] Excel import: default categories hidden, only Excel categories shown
- [ ] Existing users: custom categories preserved

---

## 🚀 Deployment

**Version**: v140+  
**Build**: Deploy to `https://budget-assistant-pwa.pages.dev/`  
**Branch**: `feature/ui-fixes-security-categories-v140`  

---
