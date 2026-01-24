# Sample Data Documentation

**Date:** January 24, 2026  
**System:** NRCS Enterprise Asset Management System  
**Version:** b939478c

---

## Overview

The NRCS EAM system has been populated with comprehensive sample data representing realistic Nigerian Red Cross Society operations across multiple locations. This data demonstrates the full capabilities of the system and provides a foundation for training and testing.

---

## Sample Data Summary

### Current Database Contents

| Entity | Count | Description |
|--------|-------|-------------|
| **Sites** | 10 | NRCS locations across Nigeria (Lagos HQ, Abuja, Kano, Port Harcourt, Ibadan, Kaduna, Enugu, Maiduguri, Calabar, Jos) |
| **Vendors** | 7 | Equipment suppliers, maintenance providers, and service contractors |
| **Asset Categories** | 6 | Medical Equipment, Vehicles, IT Equipment, Generators, Office Equipment, Communication Equipment |
| **Assets** | 62 | Mix of vehicles, generators, medical equipment, IT infrastructure, and office equipment |
| **Work Orders** | 25 | Preventive, corrective, inspection, and emergency maintenance tasks |
| **Maintenance Schedules** | Multiple | Recurring maintenance tasks for critical assets |
| **Financial Transactions** | 30 | Purchase records, maintenance expenses, and repair costs |

---

## Detailed Sample Data

### 1. Sites (10 Locations)

The system includes 10 NRCS locations across Nigeria, representing the organization's national presence:

#### Headquarters & Regional Offices
- **NRCS Headquarters** - Lagos (Victoria Island)
  - Contact: Dr. Abubakar Ibrahim
  - GPS: 6.4281°N, 3.4219°E
  - Primary hub for national operations

- **Abuja Regional Office** - FCT (Central Business District)
  - Contact: Mrs. Fatima Mohammed
  - GPS: 9.0765°N, 7.3986°E
  - Federal capital operations center

#### State Branches
- **Kano State Branch** - Northern Nigeria
- **Port Harcourt Office** - Rivers State (South-South)
- **Ibadan Zonal Office** - Oyo State (South-West)
- **Kaduna Branch** - Kaduna State (North-West)
- **Enugu State Office** - Enugu State (South-East)
- **Maiduguri Emergency Center** - Borno State (North-East)
- **Calabar Coastal Office** - Cross River State (South-South)
- **Jos Plateau Office** - Plateau State (North-Central)

Each site has complete contact information, GPS coordinates for mapping, and assigned assets.

---

### 2. Vendors (7 Service Providers)

#### Medical Equipment
- **Global Medical Supplies Ltd** (Lagos)
  - Contact: Mr. John Adeyemi
  - Specialization: Medical equipment and supplies

#### IT & Technology
- **TechFix Solutions** (Ikeja, Lagos)
  - Contact: Eng. Sarah Okonkwo
  - Specialization: IT services and support

- **SecureNet Technologies** (Abuja)
  - Contact: Dr. Amina Hassan
  - Specialization: Security systems and network infrastructure

#### Vehicle & Equipment Maintenance
- **AutoCare Nigeria** (Abuja)
  - Contact: Mr. Ahmed Bello
  - Specialization: Vehicle maintenance and repairs

- **PowerGen Systems** (Lagos)
  - Contact: Mrs. Blessing Obi
  - Specialization: Generator maintenance and power systems

#### General Supplies
- **OfficeMax Supplies** (Lagos)
  - Contact: Mr. Tunde Bakare
  - Specialization: Office supplies and equipment

- **CleanPro Services** (Yaba, Lagos)
  - Contact: Mr. Chukwuma Eze
  - Specialization: Cleaning and facility maintenance

---

### 3. Assets (62 Items)

The asset inventory includes a diverse mix of equipment types distributed across all sites:

#### Asset Categories Breakdown
- **Medical Equipment:** Ambulance stretchers, first aid kits, medical refrigerators, blood pressure monitors, oxygen concentrators
- **Vehicles:** Ambulances, pickup trucks, SUVs, vans, motorcycles
- **IT Equipment:** Desktop computers, laptops, printers, servers, network routers
- **Generators:** 5KVA, 10KVA, 15KVA, and 20KVA power generators
- **Office Equipment:** Desks, filing cabinets, conference tables, air conditioners, projectors
- **Communication Equipment:** Two-way radios, satellite phones, mobile phones, walkie-talkies

#### Asset Details
Each asset includes:
- Unique asset tag (e.g., NRCS-MED-0001, NRCS-VEH-0015)
- Complete specifications (manufacturer, model, serial number)
- Financial data (acquisition cost, current value, depreciation)
- Location assignment (site and GPS coordinates where applicable)
- Status tracking (operational, maintenance, retired)
- Warranty information
- QR code and barcode for mobile scanning

#### Sample Assets by Type
- **Ambulances:** Toyota, equipped for emergency response
- **Generators:** Mikano, Caterpillar, various capacities
- **Medical Equipment:** Philips, Medtronic diagnostic and life support
- **IT Infrastructure:** Dell servers, HP computers, network equipment
- **Office Equipment:** Samsung, various manufacturers

---

### 4. Work Orders (25 Active Tasks)

Work orders represent the full spectrum of maintenance activities:

#### Work Order Types
- **Preventive Maintenance:** Scheduled routine maintenance (oil changes, inspections, calibrations)
- **Corrective Maintenance:** Repairs for identified issues
- **Inspections:** Safety and compliance checks
- **Emergency Repairs:** Urgent critical repairs

#### Priority Levels
- **Critical:** Immediate action required (safety-critical issues)
- **High:** Important but not immediately dangerous
- **Medium:** Standard priority maintenance
- **Low:** Can be scheduled flexibly

#### Status Tracking
- **Pending:** Awaiting assignment or approval
- **In Progress:** Currently being worked on
- **Completed:** Finished with documentation
- **Cancelled:** No longer required

#### Sample Work Orders
- Vehicle routine services (50,000km service intervals)
- Generator load bank testing
- Medical equipment calibration
- IT system maintenance
- Building inspections
- Emergency repairs (brake systems, AC units, fuel systems)

Each work order includes:
- Unique work order number (WO-00001, WO-00002, etc.)
- Detailed description of work required
- Asset and site assignment
- Scheduled dates and estimated costs
- Assignment to technicians
- Completion tracking with actual costs

---

### 5. Maintenance Schedules

Recurring maintenance tasks are scheduled for critical assets:

#### Frequency Options
- **Monthly:** Medical equipment inspections, vehicle checks
- **Quarterly:** Generator load testing, IT system maintenance
- **Annually:** Major equipment calibration, building inspections

#### Scheduled Maintenance Examples
- **Ambulances:** Every 3 months routine service
- **Generators:** Quarterly load bank testing
- **Medical Equipment:** Annual calibration by certified technicians
- **IT Servers:** Quarterly system updates and diagnostics

Each schedule includes:
- Task name and description
- Frequency and next due date
- Last performed date
- Estimated duration and cost
- Active/inactive status

---

### 6. Financial Transactions (30 Records)

Financial data tracks all asset-related expenses:

#### Transaction Types
- **Purchase:** Capital expenditure for new assets
- **Maintenance:** Routine maintenance costs
- **Repair:** Corrective repair expenses
- **Depreciation:** Asset value tracking

#### Categories
- Vehicle Maintenance
- Equipment Maintenance
- Medical Equipment
- IT Maintenance
- Building Maintenance
- Capital Expenditure

#### Sample Transactions
- Ambulance purchases (₦28,500,000 - ₦45,000,000)
- Generator maintenance (₦55,000 - ₦285,000)
- Medical equipment purchases (₦850,000 - ₦12,500,000)
- IT infrastructure (₦2,800,000 - ₦4,500,000)
- Routine vehicle services (₦78,500 - ₦180,000)

Each transaction includes:
- Transaction date and amount (in Nigerian Naira)
- Asset and vendor linkage
- Category and description
- Type classification

---

## Data Quality & Realism

### Nigerian Context
- **Currency:** All financial amounts in Nigerian Naira (₦)
- **Locations:** Real Nigerian cities and states
- **Names:** Nigerian names reflecting cultural diversity
- **Contact Info:** Nigerian phone number format (+234)
- **Addresses:** Realistic Nigerian addresses

### Realistic Scenarios
- **Asset Distribution:** Appropriate equipment for each site type
- **Maintenance Patterns:** Realistic service intervals and costs
- **Work Order Mix:** Balance of preventive and corrective maintenance
- **Financial Data:** Market-appropriate pricing for Nigerian context
- **Status Distribution:** Mix of operational, maintenance, and retired assets

### Data Relationships
- Assets linked to sites and categories
- Work orders linked to assets and sites
- Financial transactions linked to assets and vendors
- Maintenance schedules linked to assets
- All entities have proper timestamps and audit trails

---

## Using the Sample Data

### For Training
1. **Dashboard Overview:** View summary metrics and KPIs
2. **Asset Management:** Browse assets by category, site, or status
3. **Work Orders:** Explore different work order types and workflows
4. **Mobile Scanner:** Scan QR codes on asset detail pages
5. **Financial Reports:** Generate PDF/Excel reports with sample data
6. **Maintenance Scheduling:** View and manage recurring tasks

### For Testing
1. **Search & Filter:** Test search across 62 assets and 10 sites
2. **Workflow Testing:** Complete work orders from creation to closure
3. **Offline Mode:** Test offline queue with sample assets
4. **Reporting:** Generate financial and compliance reports
5. **Mobile Features:** Test scanner, GPS, photo upload with real data
6. **Multi-Site:** Test filtering and reporting across 10 locations

### For Demonstration
1. **Executive Dashboard:** Show KPIs and metrics with real numbers
2. **Field Technician:** Demonstrate mobile scanner and work order completion
3. **Asset Manager:** Show asset lifecycle from purchase to disposal
4. **Financial Officer:** Demonstrate cost tracking and reporting
5. **Compliance Officer:** Show audit trails and maintenance records

---

## Adding More Data

### Manual Entry
Use the web interface to add:
- New assets through Assets page
- Work orders through Work Orders page
- Inventory items through Inventory page
- Sites through Sites management
- Vendors through Vendors page

### Bulk Import
For large datasets:
1. Modify `seed-sample-data.mjs` script
2. Clear existing data if needed
3. Run: `npx tsx seed-sample-data.mjs`

### Data Reset
To start fresh:
1. Use database management tools
2. Truncate tables (preserves structure)
3. Re-run seeding script

---

## Data Integrity

### Constraints Enforced
- ✅ Unique asset tags (no duplicates)
- ✅ Unique work order numbers
- ✅ Valid enum values (status, priority, type)
- ✅ Foreign key relationships (assets → sites, work orders → assets)
- ✅ Required fields validation
- ✅ Timestamp tracking (created, updated)

### Data Validation
- All dates are valid and realistic
- Financial amounts are positive and reasonable
- GPS coordinates are valid for Nigerian locations
- Phone numbers follow Nigerian format
- Email addresses are properly formatted

---

## Next Steps

### Recommended Actions
1. **Explore the Dashboard:** Review summary metrics and charts
2. **Browse Assets:** Filter by category, site, or status
3. **Review Work Orders:** Check pending and in-progress tasks
4. **Test Mobile Features:** Use QR scanner on asset pages
5. **Generate Reports:** Create PDF/Excel exports with sample data
6. **Test Offline Mode:** Simulate field work without connectivity

### Customization
- Modify sample data to match specific use cases
- Add more assets for specific categories
- Create custom work order templates
- Adjust maintenance schedules
- Add more vendors and sites as needed

---

## Conclusion

The NRCS EAM system now contains comprehensive, realistic sample data that demonstrates all system capabilities. This data provides an excellent foundation for training, testing, and demonstrating the system to stakeholders. All data reflects authentic Nigerian Red Cross Society operations and can be easily extended or modified as needed.

**Status:** ✅ **READY FOR DEMONSTRATION**
