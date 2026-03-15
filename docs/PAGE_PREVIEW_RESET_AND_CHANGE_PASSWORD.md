# Preview: Reset Password & Change Password

## 1. Reset Password page (`/reset-password`)

### When user arrives **with** a valid token (e.g. from email link)

- **Title:** Set New Password  
- **Form:**
  - Label: **New password** — single password field, with **password strength checker** (Weak / Fair / Good / Strong bars) below it  
  - Label: **Confirm new password** — second field  
  - Button: **Set new password** (loading: "Setting password...")  
  - Right-aligned text link: **Back to Login**  
- **Footer:** Terms of Service . Privacy Policy . ©2026 NRCS EAM  
- **Layout:** Same dark Manus-style auth layout (logo, dark card, footer).

### When user arrives **without** a token or with invalid/expired link

- **Title:** Invalid or Expired Link  
- **Description:** This link is invalid or has expired. Request a new reset link below or go back to login.  
- **Actions:**
  - Primary button: **Request new reset link** → goes to `/forgot-password`  
  - Secondary button: **Back to Login** → goes to `/login`  
- **Footer:** Same as above.

### After submitting new password successfully

- **Title:** Password Reset Successful  
- **Description:** Your password has been reset successfully. Redirecting to login...  
- **Button:** Go to Login  
- After a short delay, user is redirected to `/login`.

---

## 2. Profile — Change password (logged-in users)

**Route:** `/profile` (or wherever Profile is mounted; user must be logged in.)

- **Section:** "Change password" card (only visible when Supabase auth is configured).  
- **Header:** Key icon + **Change password**  
- **Description:** Enter your current password and choose a new one. Use at least 8 characters.  
- **Form:**
  - **Current password** — required  
  - **New password** — required, min 8 characters  
  - **Confirm new password** — required, must match new password  
  - **Update password** button (loading: "Updating...")  
- **Feedback:**
  - Error: e.g. "Current password is incorrect." or validation messages.  
  - Success: "Password updated successfully." (inline + toast), form clears.

**Placement:** The card appears between **Quick Settings** (Notification Preferences, Theme Settings, Biometric Authentication) and **Logout**.

---

## Summary

| Feature | Location | Purpose |
|--------|----------|--------|
| **Set new password** | `/reset-password?token=...` | After clicking "Forgot password" email link; set new password once. |
| **Invalid link** | `/reset-password` (no/invalid token) | Explain link is bad; offer "Request new reset link" and "Back to Login". |
| **Change password** | Profile → Change password card | Logged-in user updates password (current + new + confirm). |

To see it live: run the app, open `/reset-password` (with and without `?token=xyz`) and, when logged in, open Profile and scroll to the Change password card.
