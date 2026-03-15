# Admin Access and Registration Review

## Granting admin access

To review pending registrations, a user must have the **admin** role. Use the promote script once per admin:

1. Ensure the user exists in the app (e.g. they have signed up and have a row in the `users` table, or they were provisioned via Supabase login).
2. From the project root, run:
   ```bash
   pnpm tsx scripts/promote-admin.ts <their-email@example.com>
   ```
3. The script sets `role` to `admin` and `status` to `approved` for that email so they can sign in.
4. They sign in at **/login**, then open **Pending Users** from the sidebar to review registrations.

## Reviewing registrations

- **URL:** `/pending-users` (or use the **Pending Users** item in the dashboard sidebar; it is only visible to admins).
- **Actions:** Approve or reject each pending user. Approved users can then sign in (and, if using magic-link flow, receive an email with a sign-in link).

## First admin

If no admin exists yet (e.g. first deployment):

1. Create an account (sign up at `/signup`) or ensure one user exists in the `users` table (e.g. via Supabase Auth provisioning).
2. Run the promote script with that user’s email so they become admin (and, if they were pending, approved).
3. Sign in with that account and use **Pending Users** to review others.
