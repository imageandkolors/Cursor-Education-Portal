# SmartEdu360 - Educational Platform with License Management

A comprehensive educational platform built with Next.js, TypeScript, and Ionic React, featuring offline-first capabilities and license management for multi-branch schools.

## Features

### Core System
- **Multi-role Support**: Admin, Teacher, Student, Parent, Bursar, Store Manager
- **Multi-branch School Management**: Support for schools with multiple branches
- **Offline-first Architecture**: Works without internet connection
- **Mobile & Desktop Apps**: Built with Ionic + Capacitor
- **License Management**: Comprehensive license verification and management system

### License Engine
- **Offline Verification**: License validation works without internet
- **Device Management**: Track and limit device usage per license
- **Feature-based Licensing**: Granular control over platform features
- **Auto-sync**: Automatic synchronization when online
- **Expiry Management**: Automated license expiry alerts and handling

### Technology Stack
- **Frontend**: React + TypeScript + Tailwind CSS + Ionic React
- **Backend**: Next.js API routes + Serverless functions
- **Database**: PostgreSQL (Vercel-compatible)
- **Mobile**: Capacitor for iOS/Android apps
- **Deployment**: Vercel

## Quick Start

### Prerequisites
- Node.js 18+ 
- PostgreSQL database
- Vercel account (for deployment)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd smartedu360
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   ```
   
   Update `.env.local` with your configuration:
   ```env
   DATABASE_URL="postgresql://username:password@localhost:5432/smartedu360"
   JWT_SECRET="your-super-secret-jwt-key-here"
   LICENSE_SECRET="your-license-encryption-secret-here"
   ```

4. **Set up the database**
   ```bash
   npx prisma generate
   npx prisma db push
   ```

5. **Run the development server**
   ```bash
   npm run dev
   ```

6. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

### Mobile App Setup

1. **Add mobile platforms**
   ```bash
   npx cap add ios
   npx cap add android
   ```

2. **Build and sync**
   ```bash
   npm run build
   npx cap sync
   ```

3. **Run on device**
   ```bash
   npx cap run ios
   npx cap run android
   ```

## Database Schema

### Core Tables
- **School**: School information and settings
- **Branch**: Branch information for multi-branch schools
- **User**: User accounts with role-based access
- **License**: License management and verification
- **AuditLog**: System activity tracking
- **Notification**: User notifications

### Key Features
- UUID primary keys for all entities
- Soft deletes with `isActive` flags
- Audit trail with `created_by` and timestamps
- Branch-specific data isolation
- License device tracking

## License Management

### License Types
- **Educational**: Full access for educational institutions
- **Commercial**: Commercial use with additional features
- **Trial**: Limited-time trial access
- **Demo**: Demonstration purposes only

### Features Control
- Student Management
- Teacher Management
- Parent Portal
- Financial Management
- Store Management
- Reporting
- Offline Mode
- Multi-Branch Support
- Custom Branding
- API Access

### Offline Verification
- License data cached locally
- Offline validation for up to 7 days
- Automatic sync when online
- Device fingerprinting for security

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get current user

### License Management
- `POST /api/license/verify` - Verify license
- `POST /api/license/sync` - Sync license data
- `POST /api/license/create` - Create new license
- `GET /api/license/list` - List licenses
- `POST /api/license/revoke` - Revoke license

## Deployment

### Vercel Deployment

1. **Connect to Vercel**
   ```bash
   npx vercel
   ```

2. **Set environment variables**
   - `DATABASE_URL`: Your PostgreSQL connection string
   - `JWT_SECRET`: Random secret for JWT tokens
   - `LICENSE_SECRET`: Secret for license encryption

3. **Deploy**
   ```bash
   npx vercel --prod
   ```

### Database Setup
- Use Vercel Postgres or any PostgreSQL provider
- Run migrations: `npx prisma db push`
- Seed initial data if needed

## Development

### Project Structure
```
src/
├── app/                 # Next.js app directory
│   ├── api/            # API routes
│   ├── admin/          # Admin pages
│   └── globals.css     # Global styles
├── components/         # React components
├── lib/               # Utilities and configurations
│   ├── auth.ts        # Authentication logic
│   ├── license.ts     # License management
│   └── offline.ts     # Offline functionality
├── types/             # TypeScript type definitions
└── hooks/             # Custom React hooks
```

### Key Commands
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run type-check` - Run TypeScript checks
- `npx prisma studio` - Open database GUI
- `npx cap sync` - Sync with mobile platforms

## Security Features

- JWT-based authentication
- Role-based access control (RBAC)
- License verification and device tracking
- Audit logging for all actions
- Input validation with Zod
- SQL injection protection with Prisma
- XSS protection with React

## Offline Capabilities

- Service worker for caching
- Local storage for data persistence
- Offline license verification
- Background sync when online
- Progressive Web App (PWA) support

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support and questions:
- Create an issue in the repository
- Contact the development team
- Check the documentation

## Roadmap

- [ ] Advanced reporting dashboard
- [ ] Mobile app store deployment
- [ ] Advanced offline sync
- [ ] Multi-language support
- [ ] Advanced analytics
- [ ] Integration with external systems