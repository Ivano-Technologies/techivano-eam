# Offline Mode Usage Guide - NRCS EAM System

**Nigerian Red Cross Society**  
**Enterprise Asset Management System**  
**Working Without Connectivity**

---

## Introduction

Field work often takes you to locations with poor or no internet connectivity. The NRCS EAM system is specifically designed to work offline, allowing you to continue your work seamlessly regardless of network conditions. This guide explains how offline mode works, what you can do without connectivity, and how to ensure your data syncs properly when you return online.

---

## Understanding Offline Mode

### How It Works

The NRCS EAM system uses **Progressive Web App (PWA)** technology with sophisticated offline capabilities:

**Service Worker:**
- Runs in the background
- Caches critical app files and data
- Intercepts network requests
- Serves cached content when offline

**Local Storage:**
- Stores your recent actions
- Queues changes for sync
- Maintains offline queue
- Preserves work across app restarts

**IndexedDB:**
- Stores photos taken offline
- Caches asset data
- Maintains scan history
- Holds work order information

### Automatic Detection

The app automatically detects your connection status:

**When You Go Offline:**
- Banner appears at top: "Working Offline"
- Icon changes to indicate offline status
- App switches to cached data
- All actions are queued for sync

**When You Come Back Online:**
- Banner shows "Syncing..."
- Queued actions sync automatically
- Photos upload in background
- Banner disappears when sync complete

**No Action Required:** The app handles everything automatically.

---

## What Works Offline

### ✅ Fully Functional Features

These features work completely without internet:

#### 1. Asset Scanning
- **QR Code Scanner:** Works normally
- **Barcode Scanner:** Recognizes all formats
- **Cached Assets:** Recently viewed assets load instantly
- **Asset Details:** View complete information
- **Photos:** View previously loaded photos

#### 2. Work Order Management
- **View Work Orders:** See your assigned tasks
- **Start Work Orders:** Change status to "In Progress"
- **Add Notes:** Document your work
- **Take Photos:** Capture images (stored locally)
- **Complete Work Orders:** Mark as complete (syncs later)
- **Update Status:** Change work order status

#### 3. Asset Updates
- **Status Changes:** Update asset status
- **Quick Updates:** Use floating action button
- **Add Notes:** Document changes
- **Location Updates:** GPS coordinates captured

#### 4. Navigation
- **Browse Cached Pages:** Access recently viewed pages
- **Search History:** Find previously accessed items
- **Menu Navigation:** All menus work normally
- **Back/Forward:** Navigation history maintained

#### 5. Viewing Data
- **Dashboard:** View cached metrics
- **Asset Lists:** See recently loaded assets
- **Work Order Lists:** View your assignments
- **Maintenance History:** Review past work
- **Financial Data:** View cached transactions

### ❌ Requires Internet Connection

These features need connectivity:

#### 1. Real-Time Data
- **Live Search:** Searching all assets requires database
- **New Asset Creation:** Creating new assets needs server
- **User Management:** Adding/editing users
- **Report Generation:** PDF/Excel exports need processing

#### 2. Synchronization
- **Immediate Sync:** Changes sync when online
- **Notifications:** Push notifications delivered online
- **Real-Time Updates:** Live data from other users

#### 3. Advanced Features
- **Map Loading:** Google Maps tiles require connection
- **Voice Transcription:** Speech-to-text needs internet
- **External Links:** Links to external resources

---

## Offline Workflows

### Workflow 1: Routine Maintenance Round

**Scenario:** You're doing daily equipment checks at a remote site with no connectivity.

**Before Leaving (Online):**
1. Open NRCS EAM app
2. Go to "My Work" and view your assigned work orders
3. Tap each work order to cache the details
4. View the assets you'll be checking (caches them)
5. Wait for all data to load completely

**At Remote Site (Offline):**
1. Open app - see "Working Offline" banner
2. Scan first asset QR code
3. Asset details load from cache
4. Open associated work order
5. Tap "Start Work Order"
6. Perform maintenance
7. Take photos (stored locally)
8. Add notes about work performed
9. Tap "Complete Work Order"
10. Repeat for all assets

**Back at Office (Online):**
1. Connect to WiFi
2. App automatically syncs
3. "Syncing..." banner appears
4. All work orders update on server
5. Photos upload automatically
6. Banner disappears when complete
7. Check Offline Queue to confirm sync

**Result:** All your work is recorded as if you were online the entire time.

### Workflow 2: Emergency Repair in Field

**Scenario:** You receive a call about a broken generator at a site with poor connectivity.

**En Route (Possibly Offline):**
1. Open app (may show offline banner)
2. Search for generator asset (if online) or use scan history
3. Review asset details and maintenance history
4. Check for spare parts in inventory (cached data)

**At Site (Offline):**
1. Scan generator QR code
2. Tap "Report Issue" or open existing work order
3. Document the problem:
   - Take photos of issue
   - Add detailed notes
   - List parts needed
4. Perform repair
5. Take after photos
6. Update work order status to "Complete"
7. Add completion notes

**Return Journey (Coming Online):**
1. Phone reconnects to network
2. App syncs automatically
3. Manager receives notification of completion
4. Photos appear in work order
5. Parts usage recorded

**Result:** Complete documentation of emergency repair, synced seamlessly.

### Workflow 3: Multi-Day Field Assignment

**Scenario:** You're deployed to a remote location for 3 days with intermittent connectivity.

**Day 1 - Preparation (Online):**
1. Review all assigned work orders
2. View all assets at deployment location
3. Download any reference documents
4. Check inventory for parts you might need
5. Let app cache all relevant data

**Days 1-3 - Field Work (Mostly Offline):**
1. Work normally despite offline status
2. Complete work orders as assigned
3. Take hundreds of photos
4. Update asset statuses
5. Create new work orders for issues discovered
6. All actions queued in Offline Queue

**Day 3 - Return (Online):**
1. Connect to reliable WiFi
2. Open Offline Queue page
3. See all pending changes (may be 50+ items)
4. Tap "Sync All"
5. Watch progress as items sync
6. Large photos may take several minutes
7. Verify all items show "Synced" status

**Result:** Three days of work uploaded in one batch, all properly timestamped and documented.

---

## Managing the Offline Queue

### Accessing the Offline Queue

**Navigation:**
1. Tap **"More"** in bottom navigation
2. Select **"Offline Queue"**
3. See list of pending changes

**What You'll See:**
- Number of pending items
- Type of each change (work order, photo, status update)
- Timestamp of when action was taken
- Sync status (Pending, Syncing, Failed, Synced)

### Queue Item Types

| Type | Icon | Description |
|------|------|-------------|
| **Work Order Update** | 📋 | Work order started, completed, or modified |
| **Photo Upload** | 📷 | Photo taken and waiting for upload |
| **Status Change** | 🔄 | Asset status updated |
| **New Work Order** | ➕ | Work order created offline |
| **Asset Update** | 🏗️ | Asset information modified |

### Managing Queue Items

**Automatic Sync:**
- Happens automatically when connection restored
- No action required from you
- Progress shown in real-time

**Manual Sync:**
- Tap **"Retry All"** to force sync
- Use when automatic sync fails
- Useful after connectivity issues

**Individual Item Actions:**
- Tap item to see details
- **Retry:** Try syncing this item again
- **View:** See the change details
- **Delete:** Remove from queue (use cautiously!)

**Clearing Failed Items:**
- Review error message
- Fix issue if possible (e.g., missing required field)
- Retry sync
- If unfixable, delete and recreate action when online

---

## Offline Best Practices

### Before Going Offline

**Preparation Checklist:**

✅ **Cache Your Work:**
1. Open app while connected
2. View all work orders assigned to you
3. Open each asset you'll be working on
4. Let pages load completely
5. Check that photos and documents load

✅ **Check Battery:**
1. Ensure phone is fully charged
2. Bring portable charger for long shifts
3. Enable battery saver if needed

✅ **Verify App Version:**
1. Ensure app is up to date
2. Latest version has best offline support
3. Update before going to remote locations

✅ **Test Offline Mode:**
1. Turn off WiFi and mobile data
2. Try scanning an asset
3. Complete a test work order
4. Verify everything works
5. Turn connectivity back on

### While Offline

**Working Efficiently:**

✅ **Trust the System:**
- Don't worry about the offline banner
- Work normally as if you were online
- All actions are being saved

✅ **Take Plenty of Photos:**
- Photos are compressed automatically
- Stored locally until you're online
- No limit on number of photos

✅ **Add Detailed Notes:**
- Text syncs easily (small data size)
- Be thorough in documentation
- Notes help when reviewing work later

✅ **Check Queue Periodically:**
- Open Offline Queue to see what's pending
- Verify your actions are being recorded
- Gives peace of mind

**Avoiding Problems:**

❌ **Don't Clear App Data:**
- Clears offline queue
- Loses unsync'd work
- Only clear as last resort

❌ **Don't Uninstall App:**
- Same as clearing data
- Sync first if you must reinstall

❌ **Don't Force Close App:**
- Let it run in background
- Helps with automatic sync
- Force close only if app is frozen

❌ **Don't Ignore Sync Errors:**
- Check Offline Queue for failed items
- Retry or fix issues promptly
- Don't let queue grow too large

### After Returning Online

**Sync Verification:**

✅ **Monitor Sync Progress:**
1. Watch for "Syncing..." banner
2. Open Offline Queue to see progress
3. Wait for all items to show "Synced"
4. May take several minutes for many photos

✅ **Verify Important Changes:**
1. Check that critical work orders updated
2. Verify photos uploaded correctly
3. Confirm status changes took effect

✅ **Handle Sync Failures:**
1. Review failed items in Offline Queue
2. Read error messages
3. Retry sync
4. Contact support if issues persist

✅ **Clear Old Queue Items:**
1. Successfully synced items auto-clear after 24 hours
2. Manually clear if you want immediate cleanup
3. Keep queue manageable

---

## Troubleshooting Offline Issues

### Common Problems

**Problem: "Working Offline" banner won't go away**
- **Cause:** Phone thinks it's offline when it's actually online
- **Solution:**
  1. Check phone's WiFi/mobile data settings
  2. Toggle airplane mode on and off
  3. Restart app
  4. Check if other apps can connect

**Problem: Offline Queue items won't sync**
- **Cause:** Network issue, server problem, or data error
- **Solution:**
  1. Verify internet connection is stable
  2. Open Offline Queue
  3. Tap "Retry All"
  4. Check individual items for error messages
  5. Fix data issues if indicated
  6. Contact support if problem persists

**Problem: Photos taken offline are missing**
- **Cause:** Photos still in upload queue or sync failed
- **Solution:**
  1. Open Offline Queue
  2. Look for photo upload items
  3. Check sync status
  4. Retry if failed
  5. Photos may take time to upload on slow connections

**Problem: Work order shows old status**
- **Cause:** Status update still in queue or sync failed
- **Solution:**
  1. Check Offline Queue for pending update
  2. Retry sync
  3. Refresh page after sync completes
  4. If still wrong, update again when online

**Problem: App says "Cache Full"**
- **Cause:** Too much cached data (rare)
- **Solution:**
  1. Go to Settings → Storage
  2. Clear old cached data
  3. Keep recent work orders and assets
  4. Restart app

**Problem: Offline mode not working at all**
- **Cause:** Service worker not registered or browser issue
- **Solution:**
  1. Ensure you're using a supported browser (Chrome, Safari, Edge)
  2. Reinstall app (sync first!)
  3. Clear browser cache
  4. Contact support

### When to Contact Support

**Contact support if:**
- Offline Queue items fail repeatedly
- Photos are lost after sync
- Work orders disappear
- App crashes when going offline
- Sync takes more than 30 minutes

**What to Include:**
- Screenshot of Offline Queue
- Description of what you were doing
- Error messages (if any)
- Phone model and OS version
- Time when problem occurred

---

## Advanced Offline Features

### Offline Storage Limits

**Current Limits:**
- **Service Worker Cache:** 50MB (app files and data)
- **IndexedDB:** 500MB (photos and large data)
- **localStorage:** 10MB (queue and settings)

**What This Means:**
- You can store hundreds of work orders
- Thousands of photos (compressed to 1MB each)
- Weeks of offline work if needed

**Monitoring Storage:**
1. Go to Settings → Storage
2. See current usage
3. Clear old data if approaching limits

### Offline-First Strategy

The app is designed with an **offline-first** approach:

**What This Means:**
1. **App loads from cache first** (instant startup)
2. **Then checks for updates** (in background)
3. **Works immediately** (no waiting for network)
4. **Syncs when possible** (automatic)

**Benefits:**
- Fast app startup (even online)
- Seamless offline transition
- No interruption to workflow
- Reliable in any network condition

### Conflict Resolution

**What if two people edit the same asset offline?**

The system handles conflicts automatically:

1. **Last Write Wins:** Most recent change is kept
2. **Notification:** Both users notified of conflict
3. **History Preserved:** All changes logged in audit trail
4. **Manual Review:** Manager can review if needed

**Best Practice:** Coordinate with team to avoid editing same assets simultaneously.

---

## Offline Mode FAQ

**Q: How long can I work offline?**
**A:** Indefinitely. The offline queue has no time limit. You can work offline for days or weeks if needed.

**Q: Will I lose data if my phone dies while offline?**
**A:** No. All data is saved to local storage continuously. When you charge and restart your phone, the offline queue will still be there.

**Q: Can I work on multiple devices offline?**
**A:** Yes, but each device has its own offline queue. Sync each device separately when back online.

**Q: What happens if I create a work order offline and someone else creates one for the same asset?**
**A:** Both work orders are created. They'll both appear when you sync. No conflict.

**Q: How much data does syncing use?**
**A:** Text data is tiny (few KB). Photos are compressed to 1MB each. A typical day's work might use 10-50MB.

**Q: Can I force the app to stay offline?**
**A:** Not directly, but you can enable airplane mode on your phone. The app will work in offline mode.

**Q: What if I need to access an asset I haven't cached?**
**A:** You can scan it, but details won't load until you're online. The scan is queued and will process when connection returns.

**Q: How do I know if my work synced successfully?**
**A:** Check the Offline Queue. Items show "Synced" status when successful. The queue auto-clears synced items after 24 hours.

---

## Conclusion

Offline mode is one of the most powerful features of the NRCS EAM system. It ensures you can continue working productively regardless of network conditions, which is essential for field work in remote locations across Nigeria.

**Key Takeaways:**

1. **Offline mode is automatic** - no setup required
2. **Most features work offline** - scanning, work orders, photos, updates
3. **Sync happens automatically** - when connection returns
4. **Offline Queue shows pending changes** - gives you visibility and control
5. **Data is safe** - stored locally until synced
6. **No time limit** - work offline as long as needed

By understanding how offline mode works and following the best practices in this guide, you can work confidently in any location, knowing your data is safe and will sync automatically when you return to connectivity.

**Remember:** The system is designed to handle offline work seamlessly. Trust it, work normally, and let it handle the synchronization in the background.

---

**Document Version:** 1.0  
**Last Updated:** January 24, 2026  
**Author:** NRCS IT Department  
**For Questions:** support@nrcs.org.ng
