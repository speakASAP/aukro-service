# Aukro Service

Aukro.cz marketplace integration service for the unified e-commerce platform.

## Overview

The Aukro Service integrates with the Aukro marketplace platform, managing offers, accounts, and orders. It uses central microservices (catalog, warehouse, order) as the single source of truth.

## Port Configuration

**Port Range**: 37xx

| Service | Subdomain | Port |
|---------|-----------|------|
| aukro-service | aukro.statex.cz | 3700 |
| api-gateway | aukro.statex.cz | 3701 |
| gateway-proxy | aukro.statex.cz | 3704 |

## Features

- Create/update offers on Aukro from catalog products
- Multi-account support
- Subscribe to `stock.updated` events → update Aukro stock
- Receive Aukro orders → forward to order-microservice
- Store Aukro-specific offer data

## Architecture

- Uses `catalog-microservice` (3200) for product data
- Uses `warehouse-microservice` (3201) for stock levels
- Uses `order-microservice` (3203) for order processing
- Subscribes to RabbitMQ `stock.updated` events

## Database

Database: `aukro_db`

**Tables**:
- `AukroAccount` - Aukro account credentials
- `AukroOffer` - Aukro offers linked to catalog products
- `AukroOrder` - Orders received from Aukro

## API Endpoints

Base URL: `https://aukro.statex.cz/api` (or `http://localhost:3701/api` in dev)

- `GET /api/accounts` - List Aukro accounts
- `POST /api/accounts` - Add Aukro account
- `GET /api/offers` - List Aukro offers
- `POST /api/offers` - Create offer on Aukro
- `POST /api/offers/sync` - Sync products from catalog to Aukro
- `GET /api/orders` - List orders from Aukro
- `POST /api/orders/webhook` - Webhook for Aukro order notifications

## Environment Variables

See `.env.example` for required environment variables.

## Deployment

Deploy using `nginx-microservice/scripts/blue-green/deploy-smart.sh`:

```bash
cd /home/statex/aukro-service
./nginx-microservice/scripts/blue-green/deploy-smart.sh
```

## Development

```bash
npm run start:dev
```

