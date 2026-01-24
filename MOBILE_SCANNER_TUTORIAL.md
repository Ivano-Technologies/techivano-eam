# Mobile Scanner Tutorial - NRCS EAM System

**Nigerian Red Cross Society**  
**Enterprise Asset Management System**  
**Advanced Scanner Guide for Field Technicians**

---

## Introduction

The Smart Scanner is the most powerful feature of the NRCS EAM mobile app. It allows you to instantly access asset information, complete work orders, and update status by simply pointing your camera at a QR code or barcode. This tutorial covers everything you need to know to master the scanner and work efficiently in the field.

---

## Scanner Overview

### What the Scanner Can Do

The NRCS EAM Smart Scanner supports multiple code types and automatically routes you to the correct information:

| Code Type | Prefix | Destination | Use Case |
|-----------|--------|-------------|----------|
| **Asset QR Code** | AST- | Asset Details | View asset info, history, work orders |
| **Inventory QR Code** | INV- | Inventory Item | Check stock levels, reorder info |
| **Work Order QR Code** | WO- | Work Order | Open specific work order directly |
| **EAN Barcode** | Various | Inventory Search | Scan product barcodes for parts |
| **Code128 Barcode** | Various | Asset/Inventory | Industrial equipment barcodes |
| **UPC Barcode** | Various | Inventory Search | Consumer product codes |

### Scanner Features

**Intelligent Recognition:**
- Automatically detects code type (QR or barcode)
- Recognizes prefix and routes appropriately
- Works in various lighting conditions
- Supports damaged or partially obscured codes

**Scan History:**
- Keeps track of recently scanned items
- Quick access to frequently scanned assets
- Helps you resume work after interruptions

**Offline Capability:**
- Scanner works without internet connection
- Cached asset data loads instantly
- New scans queued for sync when online

---

## Getting Started with the Scanner

### Accessing the Scanner

There are three ways to open the Smart Scanner:

**Method 1: Bottom Navigation (Fastest)**
1. Look at the bottom of your screen
2. Tap the **Scanner FAB** (floating action button in the center)
3. Scanner opens immediately

**Method 2: Dashboard Quick Action**
1. From the Dashboard
2. Scroll to "Quick Actions" section
3. Tap **"Scan Asset"**

**Method 3: Direct Navigation**
1. Tap **"More"** in bottom navigation
2. Select **"Smart Scanner"** from the menu

**Tip:** The FAB method is fastest for field work - one tap and you're scanning.

### First-Time Setup

**Grant Camera Permission:**

When you first use the scanner, you'll be asked to allow camera access:

1. Tap **"Allow"** when prompted
2. If you accidentally denied permission:
   - Go to phone Settings → Apps → NRCS EAM
   - Tap **"Permissions"**
   - Enable **"Camera"**
   - Restart the app

**Test the Scanner:**

1. Open the scanner
2. Point at any QR code (even non-NRCS codes work for testing)
3. You should see a green box around recognized codes
4. For NRCS codes, you'll be automatically routed to the asset

---

## Scanning Techniques

### Optimal Scanning Position

**Distance:**
- Hold phone **6-12 inches** (15-30 cm) from the code
- Too close: Code won't fit in frame
- Too far: Camera can't resolve details

**Angle:**
- Keep phone **parallel** to the code surface
- Avoid extreme angles (causes distortion)
- Slight tilt is okay if code is flat

**Lighting:**
- **Natural light:** Best results
- **Indoor lighting:** Usually sufficient
- **Direct sunlight:** Avoid glare - cast shadow with your hand
- **Dark conditions:** Use phone flashlight

### Handling Difficult Scans

**Dirty or Worn Codes:**
1. Wipe code surface with cloth
2. Try different angles to avoid glare from scratches
3. If still fails, manually enter asset tag

**Damaged Codes:**
1. Scanner can read partially damaged codes
2. Ensure undamaged portion is clearly visible
3. Hold steady for 2-3 seconds
4. Report damaged codes to supervisor for replacement

**Reflective Surfaces:**
1. Tilt phone slightly to avoid reflection
2. Cast shadow over code with your hand
3. Use flashlight to overpower ambient reflections

**Small Codes:**
1. Move closer (4-6 inches)
2. Ensure code fills at least 1/3 of screen
3. Hold very steady (use both hands if needed)

---

## Scanning Workflows

### Workflow 1: Quick Asset Lookup

**Scenario:** You need to check an asset's status or history quickly.

**Steps:**
1. Tap Scanner FAB
2. Point camera at asset QR code
3. Wait for recognition (usually instant)
4. Asset details open automatically
5. Scroll to see:
   - Current status
   - Maintenance history
   - Assigned work orders
   - Photos and documents

**Time:** 5-10 seconds total

### Workflow 2: Starting a Work Order

**Scenario:** You're assigned to service an asset and need to start the work order.

**Steps:**
1. Scan the asset QR code
2. Asset page opens
3. Scroll to "Active Work Orders" section
4. Tap your assigned work order
5. Tap **"Start Work Order"**
6. Status changes to "In Progress"
7. Add notes and photos as you work
8. Tap **"Complete"** when done

**Tip:** You can also scan the work order QR code directly if it's printed on your assignment sheet.

### Workflow 3: Reporting an Issue

**Scenario:** You discover a problem with an asset during rounds.

**Steps:**
1. Scan the asset QR code
2. Asset page opens
3. Tap **"Report Issue"** (quick action button)
4. Fill in the form:
   - Title: Brief description
   - Priority: Select urgency
   - Description: Detailed explanation
   - Type: Corrective or Emergency
5. Take photos of the issue
6. Tap **"Create Work Order"**
7. Issue is immediately reported

**Time:** 2-3 minutes including photos

### Workflow 4: Inventory Stock Check

**Scenario:** You need to check if a part is in stock before starting a repair.

**Steps:**
1. Scan the part's barcode or QR code
2. Inventory item page opens
3. Check:
   - Current quantity
   - Location (which site has stock)
   - Reorder status
4. If low stock, note to order more
5. Return to work order to document part usage

**Tip:** You can scan product barcodes on packaging - the system will match them to inventory items.

### Workflow 5: Batch Scanning (Multiple Assets)

**Scenario:** You're doing rounds and need to check multiple assets quickly.

**Steps:**
1. Open Scanner
2. Scan first asset
3. Review quickly
4. Tap **back button** (returns to scanner)
5. Scan next asset
6. Repeat for all assets
7. Scanner history shows all scanned items

**Tip:** Use "Scan History" to return to any asset you scanned during your rounds.

---

## Advanced Scanner Features

### Scan History

The scanner keeps track of your recent scans for quick access:

**Accessing History:**
1. Open Smart Scanner
2. Look below the camera view
3. See "Recent Scans" section
4. Tap any item to open it again

**History Features:**
- Shows last 20 scans
- Includes timestamp of each scan
- Persists across app sessions
- Syncs across devices (when online)

**Use Cases:**
- Return to an asset you scanned earlier
- Review your daily scan activity
- Quickly access frequently checked assets

### Flashlight Control

For scanning in dark conditions:

**Enabling Flashlight:**
1. Open Scanner
2. Look for flashlight icon (top-right)
3. Tap to toggle on/off
4. Flashlight stays on while scanner is open
5. Automatically turns off when you close scanner

**Tip:** Flashlight drains battery quickly - only use when necessary.

### Manual Entry Fallback

If scanning fails, you can manually enter codes:

**Manual Entry:**
1. In Scanner view, look for "Manual Entry" button
2. Tap to open input field
3. Type the asset tag (e.g., AST-001, VEH-AMB-001)
4. Tap **"Go"** or press Enter
5. System routes you to the asset

**When to Use:**
- QR code is damaged beyond recognition
- Code is inaccessible (behind equipment)
- Camera malfunction
- Testing without physical codes

---

## Barcode Scanning

The scanner supports multiple barcode formats for inventory management:

### Supported Formats

| Format | Common Use | Example |
|--------|------------|---------|
| **EAN-13** | Retail products | 5901234123457 |
| **EAN-8** | Small products | 12345670 |
| **UPC-A** | North American products | 012345678905 |
| **UPC-E** | Compact UPC | 01234565 |
| **Code 128** | Industrial equipment | Variable length |
| **Code 39** | Older equipment | Variable length |

### Barcode Scanning Tips

**For Best Results:**
- Barcodes require **more light** than QR codes
- Hold phone **perpendicular** to barcode lines
- Ensure entire barcode is in frame
- Move slightly closer than you would for QR codes

**If Barcode Won't Scan:**
1. Check lighting - add more light if possible
2. Ensure barcode isn't wrinkled or torn
3. Try rotating phone 90 degrees (some barcodes scan better in landscape)
4. Manually enter the number below the barcode

### Inventory Barcode Workflow

**Scenario:** Checking if a part is in inventory by scanning its product barcode.

**Steps:**
1. Open Scanner
2. Point at product barcode on packaging
3. Scanner reads barcode number
4. System searches inventory for matching item
5. If found: Inventory item opens
6. If not found: "Item not in inventory" message
7. Option to add new inventory item with this barcode

---

## Offline Scanning

The scanner is designed to work without internet connectivity:

### How Offline Scanning Works

**When You're Offline:**
1. Scanner continues to function normally
2. Recently viewed assets load from cache
3. New scans are queued for processing
4. You can still complete work orders
5. Photos are stored locally

**What Happens:**
- **Cached Assets:** Load instantly from local storage
- **New Assets:** Queued for lookup when connection returns
- **Work Orders:** Saved locally, synced later
- **Photos:** Stored in IndexedDB, uploaded automatically

### Offline Scanning Best Practices

**Before Going Offline:**
1. Open the app while online
2. View assets you'll be working on (caches them)
3. Check your assigned work orders
4. Let the app sync fully

**While Offline:**
1. Scan assets normally
2. Complete work orders as usual
3. Take photos (they'll upload later)
4. Don't worry if some assets show "Loading..." - they'll sync

**After Reconnecting:**
1. App automatically syncs queued scans
2. Photos upload in background
3. Work order updates are sent
4. Check Offline Queue to confirm sync

**Tip:** The scanner shows a small "offline" indicator when you're not connected.

---

## Troubleshooting

### Common Scanner Issues

**Problem: Camera shows black screen**
- **Cause:** Camera permission denied or camera in use by another app
- **Solution:** 
  1. Close other apps using camera
  2. Check Settings → Apps → NRCS EAM → Permissions → Camera (enabled)
  3. Restart app

**Problem: Scanner doesn't recognize QR code**
- **Cause:** Poor lighting, damaged code, or wrong distance
- **Solution:**
  1. Improve lighting (use flashlight)
  2. Move to 6-12 inches from code
  3. Clean code surface
  4. Try different angle
  5. Use manual entry if code is damaged

**Problem: Wrong asset opens after scan**
- **Cause:** Scanner read wrong code (multiple codes in view)
- **Solution:**
  1. Ensure only target code is in camera view
  2. Cover other codes with your hand
  3. Move closer to target code

**Problem: Scanner is slow or laggy**
- **Cause:** Low phone performance or many apps running
- **Solution:**
  1. Close other apps
  2. Restart NRCS EAM app
  3. Clear app cache (Settings → Apps → NRCS EAM → Clear Cache)
  4. Restart phone if problem persists

**Problem: Barcode won't scan but QR codes work**
- **Cause:** Insufficient lighting or barcode format not supported
- **Solution:**
  1. Add more light (barcodes need more light than QR codes)
  2. Ensure barcode is flat and unobstructed
  3. Try manual entry of barcode number

**Problem: Flashlight won't turn on**
- **Cause:** Another app is using flashlight or permission issue
- **Solution:**
  1. Close other apps
  2. Toggle flashlight off and on again
  3. Restart app

### Getting Help

**In-App Help:**
- Tap **"?"** icon in scanner for quick tips
- Access full tutorial from More → Help

**Contact Support:**
- Email: support@nrcs.org.ng
- Phone: +234-1-2614009
- Include screenshot of issue if possible

---

## Scanner Best Practices

### Do's ✅

- ✅ **Keep codes clean** - wipe dirty QR codes before scanning
- ✅ **Use good lighting** - natural light or flashlight in dark areas
- ✅ **Hold steady** - wait for recognition, don't move phone
- ✅ **Check scan history** - review what you've scanned during your shift
- ✅ **Report damaged codes** - so they can be replaced
- ✅ **Practice scanning** - get comfortable with different code types
- ✅ **Use offline mode** - don't let poor connectivity slow you down

### Don'ts ❌

- ❌ **Don't scan in direct sunlight** - causes glare, use shadow
- ❌ **Don't hold too close** - 6-12 inches is optimal
- ❌ **Don't scan at extreme angles** - keep phone parallel to code
- ❌ **Don't give up quickly** - try different positions and lighting
- ❌ **Don't ignore manual entry** - use it when scanning fails
- ❌ **Don't scan random codes** - only scan NRCS asset codes
- ❌ **Don't forget to sync** - check Offline Queue after field work

---

## Advanced Tips

### Speed Scanning

For experienced users who need maximum efficiency:

**Technique:**
1. Hold phone at ready position (6-8 inches from typical code location)
2. Approach asset with camera already open
3. Quick scan (usually recognizes in <1 second)
4. Review asset info while walking to next asset
5. Use back button to return to scanner
6. Repeat

**Pro Tip:** Enable haptic feedback (Settings → Accessibility) to feel when scan succeeds without looking at screen.

### Batch Work Orders

When you have multiple work orders at the same site:

**Workflow:**
1. Scan first asset
2. Complete work order
3. Use scan history to quickly access next asset
4. Or use back button to return to scanner
5. Scan next asset
6. Repeat

**Time Saved:** 30-40% faster than navigating through menus

### Creating Custom QR Codes

For assets without QR codes:

**Steps:**
1. Navigate to asset in app
2. Tap **"Generate QR Code"**
3. Print or save QR code image
4. Attach to asset with laminated label
5. Now you can scan this asset

**Tip:** Use waterproof laminated labels for outdoor assets.

---

## Scanner Shortcuts

### Quick Reference

| Action | Shortcut |
|--------|----------|
| **Open Scanner** | Tap center FAB button |
| **Toggle Flashlight** | Tap flashlight icon (top-right) |
| **Manual Entry** | Tap "Manual Entry" button |
| **View History** | Scroll down in scanner view |
| **Return to Scanner** | Tap back button from asset page |
| **Close Scanner** | Swipe down or tap X |

---

## Conclusion

The Smart Scanner is your most powerful tool for efficient field work. By mastering scanning techniques, understanding offline capabilities, and using advanced features like scan history and batch workflows, you can dramatically increase your productivity.

**Key Takeaways:**

1. **Scanner FAB** is the fastest way to access the scanner
2. **6-12 inches** is the optimal scanning distance
3. **Good lighting** is essential for reliable scans
4. **Offline mode** works seamlessly - don't worry about connectivity
5. **Scan history** helps you work faster with frequently accessed assets
6. **Manual entry** is always available as a fallback

Practice these techniques during your next shift, and you'll soon be scanning assets faster than you can walk between them!

---

**Document Version:** 1.0  
**Last Updated:** January 24, 2026  
**Author:** NRCS IT Department  
**For Questions:** support@nrcs.org.ng
