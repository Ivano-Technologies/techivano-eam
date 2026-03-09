# NRCS Enterprise Asset Management System

> Comprehensive Enterprise Asset Management solution for the Nigerian Red Cross Society

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-blue)](https://react.dev/)

## Overview

The NRCS Enterprise Asset Management (EAM) System is a full-featured web application designed to streamline asset tracking, maintenance management, work order processing, and financial reporting for the Nigerian Red Cross Society. Built with modern web technologies, it provides a robust, scalable solution for managing organizational assets across multiple sites.

## Key Features

### 🏢 Asset Management
- Complete asset lifecycle tracking from acquisition to disposal
- QR code generation and scanning for quick asset identification
- Asset categorization with custom fields
- Depreciation tracking with multiple calculation methods
- Photo documentation and file attachments
- GPS location tracking and mapping
- Asset transfer workflow with approval system

### 🔧 Maintenance Management
- Preventive maintenance scheduling
- Work order creation and assignment
- Priority-based task management
- Maintenance history timeline
- Automated reminders and notifications
- Mobile-friendly scanner interface

### 📊 Financial Tracking
- Cost tracking for assets and maintenance
- Revenue and expense management
- Depreciation calculations (straight-line, declining balance)
- Budget tracking and reporting
- QuickBooks integration for accounting sync

### 📍 Multi-Site Management
- Support for multiple locations/branches
- Site-specific asset tracking
- Cross-site reporting and analytics
- Interactive map view with asset markers

### 👥 User Management
- Role-based access control (Admin, Manager, Technician, User)
- Stockholm-style user verification system
- Admin approval workflow for new registrations
- Bulk user management capabilities

### 📈 Reporting & Analytics
- Comprehensive dashboard with KPIs
- Customizable reports (PDF/Excel export)
- Asset inventory reports
- Maintenance cost analysis
- Compliance audit trails
- Financial summaries

### 🔔 Notifications
- Custom email notification system
- In-app notification center
- Automated alerts for maintenance due dates
- Low stock inventory warnings
- Work order assignment notifications

### 📱 Progressive Web App
- Installable on desktop and mobile devices
- Offline capability with automatic sync
- Responsive design for all screen sizes
- Native app-like experience

## Technology Stack

### Frontend
- **React 19** - Modern UI library
- **TypeScript** - Type-safe development
- **Tailwind CSS 4** - Utility-first styling
- **shadcn/ui** - High-quality UI components
- **tRPC** - End-to-end typesafe APIs
- **Wouter** - Lightweight routing

### Backend
- **Node.js** - Runtime environment
- **Express 4** - Web server framework
- **tRPC 11** - Type-safe API layer
- **Drizzle ORM** - Database toolkit
- **MySQL/TiDB** - Relational database

### Infrastructure
- **Vite** - Fast build tool
- **pnpm** - Efficient package manager
- **Vitest** - Unit testing framework
- **Google Maps API** - Location services
- **S3** - File storage
- **Service Workers** - Offline support

## Getting Started

### Prerequisites

- Node.js 22.x or higher
- pnpm 9.x or higher
- MySQL 8.x or TiDB database
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Kezi3/nrcs-eam-system.git
   cd nrcs-eam-system
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Configure environment variables**
   
   Create a `.env` file in the root directory with the following variables:
   
   ```env
   # Database
   DATABASE_URL=mysql://user:password@host:port/database
   
   # Authentication
   JWT_SECRET=your-jwt-secret-key
   OAUTH_SERVER_URL=https://api.manus.im
   VITE_OAUTH_PORTAL_URL=https://portal.manus.im
   VITE_APP_ID=your-app-id
   
   # Owner Information
   OWNER_OPEN_ID=owner-open-id
   OWNER_NAME=Administrator Name
   
   # S3 Storage (optional)
   S3_BUCKET=your-bucket-name
   S3_REGION=your-region
   S3_ACCESS_KEY=your-access-key
   S3_SECRET_KEY=your-secret-key
   
   # QuickBooks Integration (optional)
   QUICKBOOKS_CLIENT_ID=your-client-id
   QUICKBOOKS_CLIENT_SECRET=your-client-secret
   QUICKBOOKS_REDIRECT_URI=https://your-domain.com/api/quickbooks/callback
   
   # Google Maps (optional)
   GOOGLE_MAPS_API_KEY=your-maps-api-key
   
   # Built-in Services
   BUILT_IN_FORGE_API_URL=https://forge.manus.im
   BUILT_IN_FORGE_API_KEY=your-forge-api-key
   VITE_FRONTEND_FORGE_API_URL=https://forge.manus.im
   VITE_FRONTEND_FORGE_API_KEY=your-frontend-forge-key
   ```

4. **Set up the database**
   ```bash
   pnpm db:push
   ```

5. **Start the development server**
   ```bash
   pnpm dev
   ```

6. **Access the application**
   
   Open your browser and navigate to `http://localhost:3000`

### Building for Production

```bash
# Build the application
pnpm build

# Preview the production build
pnpm preview
```

## Project Structure

```
nrcs-eam-system/
├── client/                 # Frontend application
│   ├── src/
│   │   ├── pages/         # Page components
│   │   ├── components/    # Reusable UI components
│   │   ├── lib/           # Utilities and tRPC client
│   │   ├── contexts/      # React contexts
│   │   ├── hooks/         # Custom React hooks
│   │   ├── App.tsx        # Main app component with routing
│   │   ├── main.tsx       # Application entry point
│   │   └── index.css      # Global styles
│   ├── public/            # Static assets
│   └── index.html         # HTML template
├── server/                # Backend application
│   ├── routers.ts         # tRPC API routes
│   ├── db.ts              # Database query helpers
│   ├── passwordAuth.ts    # Password authentication
│   ├── quickbooksIntegration.ts  # QuickBooks sync
│   ├── storage.ts         # S3 file storage
│   └── _core/             # Core server utilities
├── drizzle/               # Database schema and migrations
│   └── schema.ts          # Database table definitions
├── shared/                # Shared types and constants
├── storage/               # S3 storage helpers
├── tests/                 # Test files
└── package.json           # Project dependencies
```

## Database Schema

The system uses a comprehensive database schema with the following main tables:

- **users** - User accounts and authentication
- **assets** - Asset inventory and details
- **categories** - Asset categories
- **sites** - Physical locations/branches
- **work_orders** - Maintenance and repair tasks
- **maintenance_schedules** - Preventive maintenance plans
- **inventory_items** - Parts and supplies
- **vendors** - Supplier information
- **financial_transactions** - Cost and revenue tracking
- **compliance_records** - Regulatory compliance
- **notifications** - User notifications
- **audit_logs** - System activity tracking

## User Roles

The system supports four user roles with different permission levels:

| Role | Permissions |
|------|-------------|
| **Admin** | Full system access, user management, system configuration |
| **Manager** | Asset management, work order approval, reporting |
| **Technician** | Work order execution, asset updates, maintenance logging |
| **User** | View-only access, basic asset information |

## Testing

Run the test suite:

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:coverage
```

### Staging Tenant Isolation Verification

Run read-only tenant-isolation checks against staging:

```bash
# ensure DATABASE_URL points to staging before running
pnpm test:tenant-isolation:staging
```

Optional manual SQL checks:

```bash
psql "$DATABASE_URL" -f docs/scripts/tests/tenant-isolation-staging.sql
```

What this validates:
- Org-scoped RLS is enabled and policy-backed for key tables (`organizations`, `organization_members`, `assets`, `documents`)
- A user from Org A cannot read Org B asset rows
- Encrypted document retrieval is blocked unless `organization_id` matches membership context

Expected output:
- `PASS` for all checks in healthy staging with representative Org B fixtures
- Optional `SKIP` when there is no active cross-org fixture pair or Org B fixture rows are missing
- Process exits with status `1` on any `FAIL`

Failure interpretation:
- `Org RLS policy visibility checks` fail: missing/disabled RLS or missing policy on one or more required tables
- `Org A cannot read Org B rows` fail: cross-organization asset leakage exists
- `Encrypted doc retrieval requires matching organization_id` fail: encrypted document access is not properly tenant-scoped

Reference SQL (for manual inspection / psql runs):
- `docs/scripts/tests/tenant-isolation-staging.sql`

## Deployment

### Manus Platform (Recommended)

This application is optimized for deployment on the Manus platform:

1. Create a checkpoint in the Manus interface
2. Click the "Publish" button
3. Configure your custom domain (optional)
4. Your application is live!

### Self-Hosted Deployment

For self-hosted deployment:

1. Build the application: `pnpm build`
2. Set up a MySQL/TiDB database
3. Configure environment variables
4. Deploy to your hosting provider (Vercel, Railway, etc.)
5. Run database migrations: `pnpm db:push`

## Configuration

### QuickBooks Integration

To enable QuickBooks integration:

1. Create a QuickBooks Developer account
2. Create an app and obtain Client ID and Secret
3. Configure OAuth redirect URI
4. Add credentials to environment variables
5. Navigate to Settings → QuickBooks in the app
6. Click "Connect to QuickBooks" and authorize

### Email Notifications

Configure email notifications through the admin panel:

1. Navigate to Settings → Notifications
2. Configure SMTP settings or use built-in email service
3. Customize email templates
4. Set up notification preferences

## Security

- All passwords are hashed using bcrypt
- JWT-based authentication with secure cookies
- Role-based access control (RBAC)
- SQL injection protection via Drizzle ORM
- XSS protection with React's built-in escaping
- CSRF protection on all state-changing operations
- Environment variables for sensitive data
- Regular security audits

## Performance

- Lazy loading for routes and components
- Image optimization and lazy loading
- Database query optimization with indexes
- Caching strategies for frequently accessed data
- Service worker for offline functionality
- Code splitting for faster initial load

## Browser Support

- Chrome/Edge (latest 2 versions)
- Firefox (latest 2 versions)
- Safari (latest 2 versions)
- Mobile browsers (iOS Safari, Chrome Mobile)

## Contributing

This is a private repository for the Nigerian Red Cross Society. For internal contributions:

1. Create a feature branch from `main`
2. Make your changes with clear commit messages
3. Write or update tests as needed
4. Submit a pull request for review
5. Ensure all tests pass before merging

## License

Copyright © 2026 Nigerian Red Cross Society. All rights reserved.

This software is proprietary and confidential. Unauthorized copying, distribution, or use is strictly prohibited.

## Support

For technical support or questions:

- **Email**: kezieokpala@gmail.com
- **Project Manager**: Kezie Okpala
- **Organization**: Nigerian Red Cross Society

## Acknowledgments

- Built with [Manus](https://manus.im) - AI-powered development platform
- UI components from [shadcn/ui](https://ui.shadcn.com/)
- Icons from [Lucide](https://lucide.dev/)
- Maps powered by Google Maps API

---

**Version:** 1.0.0  
**Last Updated:** February 2026  
**Status:** Production Ready
