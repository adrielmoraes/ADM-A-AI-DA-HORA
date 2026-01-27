# Caixa Ponto

## Overview
A point-of-sale (PDV) web application for managing sales, expenses, production, and daily closings. Built with Next.js 14 App Router and Prisma ORM.

## Tech Stack
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Database**: PostgreSQL (Replit Neon)
- **ORM**: Prisma 6.x
- **Auth**: bcryptjs + jose (JWT)
- **Validation**: Zod

## Project Structure
```
├── prisma/
│   ├── schema.prisma    # Database schema
│   ├── migrations/      # Database migrations
│   └── seed.js          # Seed data
├── src/
│   ├── app/             # Next.js App Router pages
│   └── lib/             # Utilities (db, session, etc.)
├── public/              # Static assets
└── next.config.mjs      # Next.js configuration
```

## Database Models
- **Usuario**: Users with roles (ADMIN/FUNCIONARIO)
- **Turno**: Work shifts
- **Producao**: Production records (paneiros/liters)
- **Venda**: Sales with payment types (PIX, CARTAO, DINHEIRO, ENTREGA, FIADO)
- **ClienteFiado**: Credit customers
- **FiadoLancamento**: Credit transactions
- **Despesa**: Expenses with approval workflow
- **FechamentoDiario**: Daily closing reports
- **ConfigFinanceira**: Financial configuration

## Development
- **Dev Server**: `npm run dev` (runs on port 5000)
- **Database Push**: `npm run db:push`
- **Generate Prisma Client**: `npm run db:generate`
- **Seed Database**: `npm run db:seed`

## Environment Variables
- `DATABASE_URL`: PostgreSQL connection string (auto-configured by Replit)
