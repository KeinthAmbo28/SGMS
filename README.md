# Smart Gym Management System (SGMS)

This is a **fully functional** Smart Gym Management System with:
- **Backend**: Node.js + Express API + JWT authentication
- **Database**: MySQL with phpMyAdmin support (auto-creates database and tables on first run)
- **Frontend**: Static HTML/CSS/JS UI
- **Member Portal**: Members can register/login, check-in/out, and select an available trainer

## Prerequisites

- Node.js (v14 or higher)
- MySQL Server
- phpMyAdmin (optional, for database management)

## Setup

1. **Install MySQL Server** (if not already installed):
   - Download and install MySQL from https://dev.mysql.com/downloads/mysql/
   - Or use XAMPP/WAMP which includes MySQL and phpMyAdmin

2. **Create the database**:
   - Open phpMyAdmin or MySQL command line
   - Run: `CREATE DATABASE smartgym;`

3. **Configure database connection** (optional):
   - Update `backend/src/config.js` if your MySQL credentials differ from defaults
   - Default config: host: 'localhost', user: 'root', password: '', database: 'smartgym', port: 3306

## Run it

1. Install dependencies:

```bash
cd backend
npm install
```

2. Start the server:

```bash
cd backend
npm start
```

3. Open in browser:

- **Admin login**: `http://localhost:5050/login.html`
- **Member login**: `http://localhost:5050/memberLogin.html`   

> If old attendance timestamps were stored with the wrong timezone, you can repair them with:
>
> ```bash
> cd backend
> npm run fix-attendance
> ```
>
> Add `--force` to apply the updates after previewing the changes.

## Admin Login

- **Username**: `admin`
- **Password**: `admin123`

## Testing (Unit Tests)

This project uses Node's built-in test runner.

### What's included
- `backend/test/accountFreeze.test.js`: tests the account-freeze logic (freeze inactive users, respect `include_never_used`, and never freeze `admin` role users).

### Run tests
```bash
cd backend
node --test test/accountFreeze.test.js
```

## Features

### Admin Dashboard
- **Dashboard** (`adminDashboard.html`): KPI cards + Attendance line chart + Membership donut + Payments bar + recent activities
- **Members** (`members.html`): create/update/delete + assign trainer
- **Trainers** (`trainers.html`): create/update/delete
- **Attendance** (`attendance.html`): record check-ins + view recent (includes check-out column with exact timestamps)
- **Payments** (`payments.html`): record payments + view recent
- **Reports** (`reports.html`): payments by method + top members by check-ins
- **Settings** (`settings.html`, admin): manage users, retrieve users, update member assignments/status, reset all passwords, download backup JSON

### Member Portal

- **Register / Login** (`memberLogin.html`): members create an account and log in
- **Member Dashboard** (`memberDashboard.html`):
  - Check-in / check-out (saved to attendance with exact timestamps; visible on admin Attendance page)
  - Select an available trainer (assigns trainer to the member record)
  - View personal attendance history with precise time formatting

## Database

The application automatically creates all necessary MySQL tables and relationships on first run. The database includes:

- `users` - User accounts with roles (admin/member) - **Integer auto-incrementing IDs**
- `members` - Member profiles linked to users - **Integer auto-incrementing IDs**
- `trainers` - Trainer information - **Integer auto-incrementing IDs**
- `attendance` - Check-in/check-out records with precise timestamps - **Integer auto-incrementing IDs**
- `payments` - Payment records - **Integer auto-incrementing IDs**

**Note**: All IDs are now simple integers (1, 2, 3...) instead of random strings, making data management in phpMyAdmin much easier.
- `settings` - Application settings

## Notes

- Member accounts are stored in `users` with role `member`, linked to `members` via `member_id`.
- Attendance records now show exact timestamps including seconds (e.g., "3:05:23 PM").
- If you change the backend port, set `PORT` in your environment before starting.
- Database connection uses mysql2 driver with connection pooling for better performance.

