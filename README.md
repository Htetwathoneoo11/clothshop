# Clothshop

Clothshop is a coursework e-commerce application for browsing clothing products, managing a cart, and placing orders.  
It is built as a Laravel backend API with a React single-page frontend.

## What This Project Does

- Public product catalog with search, filtering, and sorting
- Product detail pages with size/color variant selection
- User authentication (register, login, logout, current user)
- Authenticated cart operations (add, update quantity, remove)
- Checkout flow with delivery details and payment method selection
- Order creation with stock checks and stock decrement in a transaction
- Profile page with avatar upload/remove and order history

## Tech Stack

- Backend: Laravel 10, PHP 8.1+, Sanctum (session auth), Eloquent ORM
- Frontend: React, React Router, Vite, Axios, Lucide icons
- Database: MySQL (default local setup), sqlite in-memory for tests
- Testing: PHPUnit feature/unit tests via `php artisan test`

## Project Structure

- `routes/web.php`: catch-all route that serves the SPA shell
- `routes/api.php`: JSON API routes for auth, products, cart, checkout, profile, orders
- `app/Http/Controllers/Api`: API controllers
- `app/Models`: domain models (`Product`, `ProductVariant`, `Cart`, `Order`, etc.)
- `resources/js/spa`: React SPA pages/components
- `resources/views/spa.blade.php`: SPA entry view
- `tests/Feature`: API and auth feature tests

## Footer Information Block

The SPA includes a global footer shown across pages with the following content groups:

- **Brand**: Clothshop + short brand message
- **Shop**: links to Shop, Cart, Checkout, and Profile
- **Help**: links to Contact, Shipping & Delivery, Returns, and FAQ pages
- **Legal**: links to Privacy Policy and Terms of Service pages
- **Follow**: external links to Instagram, Facebook, and TikTok
- **Trust**: secure checkout note
- **Copyright**: `© 2026 Clothshop. All rights reserved.`

Footer-linked internal pages are routed in the SPA as:

- `/contact`
- `/shipping-delivery`
- `/returns`
- `/faq`
- `/privacy-policy`
- `/terms-of-service`

## Main API Endpoints

Public:

- `POST /api/auth/login`
- `POST /api/auth/register`
- `GET /api/products`
- `GET /api/products/{product}`

Authenticated (`auth:sanctum`):

- `GET /api/me`
- `POST /api/auth/logout`
- `POST /api/me/avatar`
- `DELETE /api/me/avatar`
- `GET /api/orders`
- `GET /api/cart`
- `POST /api/cart`
- `PATCH /api/cart/{cartItem}`
- `DELETE /api/cart/{cartItem}`
- `POST /api/checkout`

## Local Setup

1. Clone the repository and move into the project root.
2. Install PHP dependencies:

   ```bash
   composer install
   ```

3. Install JS dependencies:

   ```bash
   npm install
   ```

4. Create and configure environment file:

   ```bash
   cp .env.example .env
   # On Windows PowerShell, use:
   # copy .env.example .env
   php artisan key:generate
   ```

5. Update database credentials in `.env` (MySQL by default).
6. Run migrations and seed sample products:

   ```bash
   php artisan migrate --seed
   ```

7. Link storage for uploaded avatars:

   ```bash
   php artisan storage:link
   ```

8. Run the application:

   ```bash
   php artisan serve
   npm run dev
   ```

Open the app in your browser (using your local Laravel URL).  
The SPA is configured with a base path of `/clothshop`.

## Running Tests

Run all tests:

```bash
php artisan test
```

## Current Limitations

- Payment is modeled as on-delivery options only (`cash_on_delivery`, `card_on_delivery`).
- No admin dashboard for product/order management.
- README documents current implementation only; deployment instructions are not included.

## License

This project is intended for educational/coursework use.
