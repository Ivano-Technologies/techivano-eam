# NRCS EAM System - Quick Start Guide for Field Technicians

**Nigerian Red Cross Society**  
**Enterprise Asset Management System**  
**Version 1.0 - January 2026**

---

## Welcome to NRCS EAM

The Nigerian Red Cross Society Enterprise Asset Management (EAM) system is your mobile-first tool for managing assets, completing work orders, and tracking maintenance activities in the field. This guide will help you get started quickly and work efficiently, even when offline.

---

## Getting Started

### Installing the App

The NRCS EAM system works as a **Progressive Web App (PWA)**, which means it can be installed on your device like a native app and works offline.

#### On Mobile Devices (Android/iOS)

**Android (Chrome):**
1. Open Chrome browser and navigate to the NRCS EAM website
2. Tap the menu (three dots) in the top-right corner
3. Select **"Add to Home Screen"** or **"Install App"**
4. Confirm the installation
5. The NRCS EAM icon will appear on your home screen

**iOS (Safari):**
1. Open Safari and navigate to the NRCS EAM website
2. Tap the Share button (square with arrow pointing up)
3. Scroll down and tap **"Add to Home Screen"**
4. Name the app "NRCS EAM" and tap **"Add"**
5. The app icon will appear on your home screen

#### On Windows Desktop

**Chrome/Edge:**
1. Open the NRCS EAM website in Chrome or Edge
2. Look for the install icon in the address bar (computer with down arrow)
3. Click **"Install"** when prompted
4. The app will open in its own window
5. A desktop shortcut will be created automatically

### First-Time Login

1. Open the NRCS EAM app from your home screen or desktop
2. Click **"Login"** on the welcome screen
3. Enter your NRCS email address and password
4. Complete the authentication process
5. You'll be taken to your personalized dashboard

### Setting Up Biometric Login (Mobile)

For faster access on mobile devices, enable biometric authentication:

1. Tap your profile picture in the top-right corner
2. Select **"Profile"** from the menu
3. Tap **"Biometric Authentication"**
4. Follow the prompts to enroll your fingerprint or Face ID
5. Next time, you can log in with just your biometric data

---

## Understanding the Interface

### Mobile Navigation

The mobile interface uses a **bottom navigation bar** with five main sections:

| Icon | Section | Purpose |
|------|---------|---------|
| 🏠 Dashboard | **Dashboard** | View summary metrics and quick actions |
| 📦 My Work | **My Work** | See your assigned work orders and tasks |
| 🔍 Scanner (FAB) | **Smart Scanner** | Scan QR codes to access assets instantly |
| 📋 Orders | **Work Orders** | Browse all work orders and create new ones |
| ⋯ More | **More Menu** | Access settings, reports, and additional features |

The **Scanner button** (center, with floating action button) is your quickest way to access assets in the field.

### Desktop Navigation

On desktop, you'll see a **sidebar on the left** with all menu options:

- **Dashboard:** Overview and key metrics
- **Assets:** Complete asset inventory
- **Work Orders:** All maintenance tasks
- **Maintenance:** Preventive maintenance schedules
- **Inventory:** Parts and supplies tracking
- **Financial:** Cost tracking and budgeting
- **Sites:** Location management
- **Reports:** Generate PDF and Excel reports

---

## Core Workflows

### 1. Scanning an Asset

The Smart Scanner is your primary tool for quickly accessing asset information in the field.

**Step-by-Step:**

1. **Open the Scanner**
   - Tap the **Scanner button** (center of bottom navigation)
   - Or navigate to Dashboard → Smart Scanner

2. **Grant Camera Permission**
   - First time: Allow camera access when prompted
   - This is required for QR code scanning

3. **Scan the QR Code**
   - Point your camera at the asset's QR code
   - Hold steady until the code is recognized
   - The system will automatically detect the code type

4. **Automatic Routing**
   - **AST-** prefix: Opens asset details
   - **INV-** prefix: Opens inventory item
   - **WO-** prefix: Opens work order

5. **View Asset Information**
   - See complete asset details instantly
   - Check maintenance history
   - View assigned work orders
   - Access photos and documents

**Tip:** The scanner also supports barcodes (EAN, UPC, Code128) for inventory items.

### 2. Completing a Work Order

Work orders are your daily tasks. Here's how to complete them efficiently:

**Step-by-Step:**

1. **Find Your Work Order**
   - Tap **"My Work"** in the bottom navigation
   - Or scan the asset's QR code and tap the work order

2. **Review the Details**
   - Read the work order description
   - Check the priority level (Critical, High, Medium, Low)
   - Note any special instructions

3. **Start Working**
   - Tap **"Start Work Order"** to change status to "In Progress"
   - This timestamps when you began

4. **Add Photos**
   - Tap the **camera icon** or **"Add Photo"** button
   - Take before/during/after photos
   - Photos are automatically compressed to save bandwidth
   - If offline, photos are queued for upload when connection returns

5. **Record Your Work**
   - Tap **"Add Notes"** to document what you did
   - List any parts used
   - Note any issues discovered

6. **Complete the Work Order**
   - Tap **"Complete Work Order"**
   - Enter actual time spent and costs (if applicable)
   - Add completion notes
   - Tap **"Submit"**
   - You'll see a success animation confirming completion

**Offline Note:** All actions are saved locally if you're offline. They'll sync automatically when you reconnect.

### 3. Updating Asset Status

Keep asset information current by updating status in the field:

**Step-by-Step:**

1. **Access the Asset**
   - Scan the QR code or search for the asset
   - Tap to open asset details

2. **Quick Update (Mobile)**
   - Tap the **floating action button** (bottom-right)
   - Select **"Quick Update"**
   - Choose new status: Operational, Maintenance, Repair, Retired

3. **Add Context**
   - Enter notes explaining the status change
   - Add photos if relevant
   - Tap **"Save"**

4. **Automatic Notifications**
   - Managers are notified of status changes
   - Work orders may be auto-generated for maintenance/repair status

### 4. Reporting an Issue

Found a problem with an asset? Create a work order immediately:

**Step-by-Step:**

1. **From Asset Page**
   - Scan or navigate to the asset
   - Tap **"Report Issue"** in the quick actions

2. **Fill in Details**
   - **Title:** Brief description (e.g., "Generator won't start")
   - **Priority:** Select urgency level
   - **Description:** Detailed explanation of the problem
   - **Type:** Corrective, Emergency, or Inspection

3. **Add Evidence**
   - Take photos of the issue
   - Record any error codes or symptoms

4. **Submit**
   - Tap **"Create Work Order"**
   - The issue is immediately reported to your manager
   - You'll receive a work order number for tracking

---

## Working Offline

The NRCS EAM system is designed for field work where internet connectivity may be unreliable or unavailable.

### What Works Offline

✅ **View Asset Information:** All recently viewed assets are cached  
✅ **Complete Work Orders:** Actions are queued for sync  
✅ **Add Photos:** Images stored locally until connection returns  
✅ **Update Asset Status:** Changes saved and synced later  
✅ **View Maintenance History:** Cached data remains accessible  
✅ **Scan QR Codes:** Scanner works without internet  

### What Requires Connection

❌ **Creating New Assets:** Requires database access  
❌ **Generating Reports:** Needs server processing  
❌ **Real-Time Notifications:** Delivered when online  
❌ **Searching All Assets:** Search requires database query  

### Offline Workflow

1. **Work Normally**
   - The app detects when you're offline
   - A banner shows "Working Offline" status
   - Continue scanning, updating, and completing work orders

2. **Check Offline Queue**
   - Tap **More → Offline Queue** to see pending changes
   - View what will sync when connection returns
   - See status of each queued item

3. **Automatic Sync**
   - When connection is restored, sync happens automatically
   - You'll see a notification when sync completes
   - Offline banner disappears

4. **Manual Retry**
   - If sync fails, retry manually from Offline Queue page
   - Tap **"Retry All"** to attempt sync again
   - Individual items can be retried or cleared

### Best Practices for Offline Work

**Before Going to the Field:**
- Open the app and let it load recent data
- View assets you'll be working on (caches them)
- Check your assigned work orders

**While Offline:**
- Complete work orders as normal
- Take photos (they'll upload later)
- Don't worry about the offline banner - it's working

**After Returning Online:**
- Wait for automatic sync to complete
- Check Offline Queue to confirm all items synced
- Review any sync errors and retry if needed

---

## Mobile Features

### Pull-to-Refresh

On mobile, you can refresh data by pulling down on list pages:

- **Assets page:** Pull down to refresh asset list
- **Work Orders page:** Pull down to get latest work orders
- **Inventory page:** Pull down to update stock levels

You'll see a loading animation while data refreshes.

### Haptic Feedback

The app provides tactile feedback for important actions:

- **Success:** Light vibration when completing work orders
- **Error:** Different vibration pattern for errors
- **Scan:** Feedback when QR code is recognized

### GPS Auto-Capture

When you scan an asset, your GPS location is automatically captured:

- **Location Button:** Tap to view asset location on map
- **Accuracy:** Shows GPS accuracy indicator
- **Privacy:** Location only captured when you scan (not continuous tracking)

### Voice Input

On work order forms, you can use voice input for descriptions:

1. Tap the **microphone icon** in the description field
2. Speak your notes
3. Tap again to stop recording
4. Text appears automatically (requires internet for transcription)

---

## Tips for Efficient Field Work

### Scanning Tips

**For Best Results:**
- Hold your phone 6-12 inches from the QR code
- Ensure good lighting (use phone flashlight if needed)
- Keep the code flat and unobstructed
- Clean dirty or damaged codes before scanning

**If Scanning Fails:**
- Manually enter the asset tag in the search box
- Use the barcode scanner for inventory items
- Report damaged QR codes so they can be replaced

### Battery Management

**Extend Battery Life:**
- Enable dark mode (Settings → Theme → Dark)
- Reduce screen brightness in the field
- Close the app when not in use (it syncs in background)
- Carry a portable charger for long field days

### Photo Tips

**Take Quality Photos:**
- Use good lighting (avoid direct sunlight glare)
- Get close-up shots of issues
- Take multiple angles for context
- Photos are auto-compressed to 1MB (saves data and storage)

**Photo Organization:**
- Add captions to photos when possible
- Take before/after photos for repairs
- Include serial number plates in photos

### Time Management

**Work Efficiently:**
- Start your day by checking "My Work" for assigned tasks
- Prioritize Critical and High priority work orders
- Complete quick tasks first to clear your queue
- Use downtime to sync offline changes

---

## Common Tasks Reference

### Quick Actions Cheat Sheet

| Task | Steps |
|------|-------|
| **Scan Asset** | Tap Scanner FAB → Point at QR code → Auto-opens asset |
| **Complete Work Order** | My Work → Select order → Start → Add notes/photos → Complete |
| **Report Issue** | Scan asset → Report Issue → Fill form → Submit |
| **Update Status** | Scan asset → FAB → Quick Update → Select status → Save |
| **Add Photo** | Open asset/work order → Camera icon → Take photo → Save |
| **Check Offline Queue** | More → Offline Queue → View pending items |
| **View Maintenance History** | Scan asset → Scroll to History section |
| **Search Assets** | Dashboard → Search bar → Enter asset tag or name |

### Status Meanings

| Status | Meaning | Your Action |
|--------|---------|-------------|
| **Operational** | Asset working normally | No action needed |
| **Maintenance** | Scheduled maintenance due | Complete PM work order |
| **Repair** | Asset broken, needs fixing | Complete corrective work order |
| **Retired** | Asset no longer in service | No action (informational) |
| **Disposed** | Asset removed from inventory | No action (informational) |

### Priority Levels

| Priority | Response Time | Examples |
|----------|---------------|----------|
| **Critical** | Immediate (same day) | Ambulance breakdown, generator failure |
| **High** | Within 24 hours | AC failure in medical clinic, vehicle brake issues |
| **Medium** | Within 1 week | Routine maintenance, minor repairs |
| **Low** | Flexible | Cosmetic issues, non-urgent inspections |

---

## Troubleshooting

### Common Issues

**Problem: Camera won't open for scanning**
- **Solution:** Check app permissions in phone settings → Allow camera access

**Problem: Photos won't upload**
- **Solution:** Check internet connection → Photos will upload automatically when online

**Problem: Can't find an asset**
- **Solution:** Use search instead of browse → Enter asset tag or serial number

**Problem: Work order won't complete**
- **Solution:** Fill all required fields → Check for error messages → Try again

**Problem: Offline changes not syncing**
- **Solution:** Check Offline Queue → Tap "Retry All" → Contact support if still failing

**Problem: App running slowly**
- **Solution:** Close and reopen app → Clear browser cache → Reinstall if needed

### Getting Help

**In-App Support:**
- Tap **More → Help** for FAQs and tutorials
- Use **Contact Support** to report issues

**Emergency Contact:**
- Call your site manager for urgent issues
- Email: support@nrcs.org.ng
- Phone: +234-1-2614009 (HQ)

---

## Best Practices Summary

### Do's ✅

- ✅ Scan assets whenever possible (faster than searching)
- ✅ Add photos to work orders (documents your work)
- ✅ Complete work orders promptly (keeps data current)
- ✅ Work offline without worry (syncs automatically)
- ✅ Report issues immediately (prevents bigger problems)
- ✅ Keep your profile updated (correct contact info)

### Don'ts ❌

- ❌ Don't skip required fields in work orders
- ❌ Don't forget to mark work orders complete
- ❌ Don't ignore sync errors (check Offline Queue)
- ❌ Don't share your login credentials
- ❌ Don't delete the app without syncing offline changes
- ❌ Don't work on assets without creating/updating work orders

---

## Next Steps

### After Reading This Guide

1. **Install the App** on your mobile device and desktop
2. **Set Up Biometric Login** for quick access
3. **Practice Scanning** a few assets to get comfortable
4. **Complete a Test Work Order** to learn the workflow
5. **Try Offline Mode** by turning off WiFi and working normally
6. **Explore the Dashboard** to see your metrics and stats

### Additional Training

- **Mobile Scanner Tutorial:** Detailed guide to QR/barcode scanning
- **Offline Mode Guide:** Advanced offline workflows
- **Video Tutorials:** Available in the Help section
- **Manager Training:** Contact your supervisor for role-specific training

---

## Conclusion

The NRCS EAM system is designed to make your field work easier, faster, and more reliable. With mobile-first design, offline capabilities, and smart scanning, you can focus on maintaining assets rather than managing paperwork. 

Start by installing the app, scanning a few assets, and completing a work order. You'll quickly see how the system streamlines your daily tasks and keeps you connected to the team, even when working offline.

**Welcome to the future of asset management at NRCS!**

---

**Document Version:** 1.0  
**Last Updated:** January 24, 2026  
**Author:** NRCS IT Department  
**For Questions:** support@nrcs.org.ng
