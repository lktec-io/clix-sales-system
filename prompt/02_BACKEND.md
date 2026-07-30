=========================================================
SYSTEM ARCHITECTURE
=========================================================

Before implementing any feature, design the system architecture.

This ERP must follow enterprise architecture principles.

The backend must NOT become a collection of random Express routes.

Use layered architecture.

Every feature must follow this flow:

Client

↓

Router

↓

Validation

↓

Authentication Middleware

↓

Authorization Middleware

↓

Controller

↓

Service

↓

Repository

↓

Database

Business logic belongs ONLY inside Services.

Database logic belongs ONLY inside Repositories.

Routes must stay thin.

Controllers should only coordinate requests.

Never place SQL queries directly inside controllers.

=========================================================
DATABASE FIRST DEVELOPMENT
=========================================================

Never start frontend first.

Never start APIs first.

Always begin with database planning.

Before creating tables:

1. Analyze relationships.

2. Design normalization.

3. Create Entity Relationship Diagram mentally.

4. Design indexes.

5. Design constraints.

6. Design foreign keys.

7. Design transactions.

Only then create migrations.

=========================================================
DATABASE STANDARDS
=========================================================

Use MySQL.

Every table must contain:

id

created_at

updated_at

created_by (where applicable)

updated_by (where applicable)

deleted_at (soft delete where appropriate)

Use:

BIGINT for IDs where scalability is important.

Proper foreign keys.

Indexes on searchable columns.

Unique constraints.

Transactions for financial operations.

Never duplicate data unnecessarily.

=========================================================
CORE DATABASE MODULES
=========================================================

Design the database before implementation.

Required modules include:

users

roles

permissions

role_permissions

branches

customers

suppliers

categories

brands

products

product_images

product_codes

qr_codes

inventory

inventory_movements

inventory_adjustments

stock_transfer_requests

stock_transfer_items

purchase_orders

purchase_items

supplier_payments

sales

sale_items

sale_payments

returns

return_items

expense_categories

expenses

notifications

activity_logs

audit_logs

company_settings

system_settings

sessions

refresh_tokens

email_logs

system_backups

Do not blindly create tables.

Analyze whether additional supporting tables are necessary.

=========================================================
PRODUCT CODE STANDARD
=========================================================

Every product must automatically generate a unique code.

Examples:

SPR-2026-00001

SPR-2026-00002

DEC-2026-00001

Never allow duplicate codes.

Generation logic must be reusable.

=========================================================
QR CODE STANDARD
=========================================================

Each product automatically receives a QR Code.

QR must encode:

Product ID

Product Code

Branch

Product Name

Selling Price

QR generation must be reusable.

=========================================================
AUTHENTICATION
=========================================================

Authentication must be production ready.

Implement:

JWT Access Token

Refresh Token

Secure password hashing

Password reset

Remember Me

Session Management

Logout everywhere

Logout current device

Device tracking

=========================================================
PASSWORD POLICY
=========================================================

Passwords must:

Have minimum length.

Require strong complexity.

Be hashed using bcrypt.

Never store plain passwords.

=========================================================
AUTHORIZATION
=========================================================

Implement enterprise Role Based Access Control.

Roles:

Super Administrator

Manager

Cashier

Store Keeper

Each role has permissions.

Never hardcode permissions.

Permissions must come from database.

=========================================================
PERMISSION SYSTEM
=========================================================

Every page.

Every API.

Every action.

Must verify permission.

Examples:

Create Product

Edit Product

Delete Product

Approve Purchase

Transfer Stock

Manage Users

View Reports

Never rely only on frontend hiding buttons.

Backend must always validate permission.

=========================================================
BRANCH ISOLATION
=========================================================

The ERP supports multiple branches.

Each branch has:

Own inventory

Own sales

Own purchases

Own expenses

Own users

Own reports

Super Admin sees all branches.

Managers see assigned branches.

Cashiers see assigned branch only.

=========================================================
FINANCIAL TRANSACTIONS
=========================================================

Financial operations must always use MySQL transactions.

Examples:

Sale

Purchase

Return

Expense

Stock Transfer

If one operation fails:

Rollback everything.

Never allow partial financial updates.

=========================================================
INVENTORY CONSISTENCY
=========================================================

Stock must never become inconsistent.

Every stock movement must be recorded.

Examples:

Purchase

Sale

Return

Adjustment

Transfer

Manual Correction

Maintain full history.

=========================================================
AUDIT LOGS
=========================================================

Create enterprise audit logging.

Record:

Who

Did What

When

From Which IP

Which Branch

Previous Value

New Value

Affected Record

Examples:

Leonard updated Product Price

Manager approved Purchase

Cashier deleted Sale

Store Keeper transferred Stock

=========================================================
ACTIVITY LOG
=========================================================

Create timeline logs.

Examples:

09:20

Product created

09:45

Sale completed

10:15

Stock transferred

11:30

Expense approved

Dashboard will use this timeline.

=========================================================
NOTIFICATIONS
=========================================================

System notifications include:

Low Stock

Purchase Received

Transfer Approved

Expense Submitted

Expense Approved

Sale Completed

Return Processed

System Error

Notifications must support read/unread status.

=========================================================
VALIDATION
=========================================================

Validate everything.

Never trust frontend.

Use Express Validator.

Validate:

Strings

Numbers

Dates

Emails

Phone Numbers

Money

IDs

Files

QR Codes

Product Codes

=========================================================
ERROR HANDLING
=========================================================

Create centralized error handling.

Never expose stack traces.

Never expose SQL errors.

Return structured API responses.

Example:

success

message

data

errors

=========================================================
API STANDARDS
=========================================================

RESTful APIs.

Consistent naming.

Examples:

GET

POST

PUT

PATCH

DELETE

Use pagination.

Use filtering.

Use searching.

Use sorting.

Avoid inconsistent endpoints.

=========================================================
BACKUP STRATEGY
=========================================================

Prepare infrastructure for:

Manual Backup

Automatic Daily Backup

Restore Process

Database Export

=========================================================
END OF PART 2
=========================================================

Do not begin implementation until architecture has been analyzed and documented.

Always think before coding.

Always choose maintainability over speed.

Build software that can be maintained for many years.