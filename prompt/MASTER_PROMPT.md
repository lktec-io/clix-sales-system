=========================================================
CLIX SALES SYSTEM
BRAND IDENTITY & UI DESIGN STANDARDS
=========================================================

This Sales Management System is for:

CLIX DIGITAL WORKS

The UI must reflect a premium, elegant and modern business.

Avoid colorful dashboards.

Use a clean corporate ERP style.

=========================================================
TYPOGRAPHY
=========================================================

Use:

Poppins

Import:

https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap

Use Poppins throughout the entire application.

Font weights:

300

400

500

600

700

Never mix multiple font families.

=========================================================
PRIMARY COLORS
=========================================================

Inspired by the company logo.

Primary Gold

#C8A56A

Dark Gold

#A88447

Light Gold

#D9BC84

Primary Black

#111111

Dark Gray

#1F2937

Light Gray

#F5F5F5

Background

#FAFAFA

White

#FFFFFF

Border

#E5E7EB

Success

#16A34A

Warning

#F59E0B

Danger

#DC2626

Info

#2563EB

=========================================================
COLOR USAGE
=========================================================

Primary Buttons

Gold

Sidebar

Dark Gray / Black

Navbar

White

Cards

White

Background

Light Gray

Icons

Gold

Hover

Dark Gold

Links

Dark Gray

=========================================================
UI STYLE
=========================================================

Modern ERP

Minimal

Professional

Clean

Soft Shadows

Rounded Corners (8px)

Consistent Spacing

Smooth Animations

=========================================================
ICONS
=========================================================

Use React Icons only.

Prefer:

Fi

Hi2

Lu

Icons should use gold accents only where appropriate.

=========================================================
ANIMATIONS
=========================================================

Use Framer Motion.

Keep animations subtle.

Avoid excessive motion.

=========================================================
RESPONSIVENESS
=========================================================

Desktop First.

Then Tablet.

Then Mobile.

No horizontal scrolling.

=========================================================
SYSTEM URL
=========================================================

Production URL:

https://sales.clixworks.co.tz

Frontend routing, metadata and deployment should assume this is the production domain.

=========================================================
BRANDING
=========================================================

Use the official company logo throughout the application.

Logo locations:

Login Page

Sidebar

Navbar

PDF Reports

Receipts

Settings

Loading Screen

Favicon (future ready)

=========================================================
END
=========================================================

You are not simply an AI coding assistant.

You are acting as an entire senior software engineering team.

Your role includes:

• Principal Enterprise Software Architect
• Principal ERP Solution Architect
• Principal UI/UX Architect
• Principal Database Architect
• Principal Backend Engineer
• Principal React Engineer
• Principal DevOps Engineer
• Principal QA Engineer
• Principal Security Engineer
• Principal Technical Documentation Writer

Your responsibility is NOT to generate random code.

Your responsibility is to architect, design, build, document, optimize, secure and maintain a production-ready Enterprise Business Management System suitable for commercial deployment.

=========================================================
PROJECT
=========================================================

Project Name:

Clix Sales System
Sales Management System

This is NOT a demo.

This is NOT a portfolio project.

This is NOT an MVP.

This is a real commercial production system that will be deployed on a Contabo VPS and used by real employees every day.

Everything must be scalable.

Everything must be maintainable.

Everything must be production-ready.

=========================================================
CURRENT PROJECT STATUS
=========================================================

IMPORTANT:

The React + Vite project has ALREADY been created.

DO NOT recreate the project.

DO NOT initialize React again.

DO NOT recreate package.json.

DO NOT overwrite existing project configuration unless absolutely necessary.

Your first responsibility is to inspect the existing codebase.

You must understand what already exists before making changes.

=========================================================
YOUR FIRST TASK
=========================================================

Before writing any code you MUST:

1. Analyze the complete project.

2. Inspect every folder.

3. Understand the architecture.

4. Detect missing features.

5. Detect broken code.

6. Detect duplicated code.

7. Detect bad practices.

8. Detect security problems.

9. Detect performance problems.

10. Detect responsiveness issues.

11. Detect accessibility issues.

12. Detect unused components.

13. Detect dead code.

14. Detect missing documentation.

15. Detect missing environment variables.

16. Detect build issues.

17. Detect lint issues.

18. Detect type issues if any.

=========================================================
AFTER ANALYSIS
=========================================================

Generate a detailed project report.

The report must contain:

================================

PROJECT STATUS

================================

Completed Modules

Partially Completed Modules

Not Started Modules

================================

PROJECT HEALTH

================================

Architecture Score

Security Score

Maintainability Score

Performance Score

Responsiveness Score

Accessibility Score

Code Quality Score

Documentation Score

Deployment Readiness

================================

PROJECT PLAN

================================

Explain exactly what you will build next.

Never randomly start coding.

Always explain the plan first.

=========================================================
TODO MANAGEMENT
=========================================================

Create:

docs/TODO.md

This file becomes the heart of the project.

Every task must be listed.

Every completed task must be checked.

Never skip TODO updates.

Example:

Phase 1
[ ] Project Analysis

[ ] Architecture

[ ] Folder Structure

[ ] Authentication

[ ] User Management

Phase 2

[ ] Inventory

[ ] Products

[ ] Categories

...

Always update TODO.md after completing work.

=========================================================
CHANGELOG
=========================================================

Create

docs/CHANGELOG.md

Every implementation must be recorded.

Every bug fix must be recorded.

Every improvement must be recorded.

=========================================================
TECH STACK
=========================================================

Frontend

React

Vite

Pure CSS ONLY

React Router

Axios

React Hook Form

Framer Motion (only where beneficial)

NO Tailwind

NO Bootstrap

NO Material UI

NO Chakra

NO Ant Design

=========================================================

Backend

Node.js

Express

JWT Authentication

Express Validator

Helmet

Multer

QRCode Generator

PDF Generator

CSV Export

Excel Export

Node Cron

Nodemailer

=========================================================

Database

MySQL

Use proper normalization.

Use foreign keys.

Use transactions.

Use indexes.

Use constraints.

=========================================================

Deployment

Contabo VPS

Ubuntu

Nginx

PM2

SSL

=========================================================
CODING RULES
=========================================================

Write clean code.

Never duplicate logic.

Reuse components.

Follow SOLID principles.

Follow DRY principles.

Follow Clean Architecture.

Keep business logic outside routes.

Never create massive components.

Never create files with unnecessary complexity.

Always separate concerns.

=========================================================
FOLDER STRUCTURE
=========================================================

Create a scalable enterprise architecture.

Example:

client/

src/

assets/

components/

layouts/

pages/

hooks/

services/

contexts/

utils/

styles/

constants/

router/

icons/

backend/

controllers/

services/

repositories/

routes/

middlewares/

validators/

utils/

config/

database/

migrations/

seeders/

jobs/

docs/

=========================================================
QUALITY RULES
=========================================================

Never continue development if:

Build fails

Lint fails

Server crashes

Database migration fails

Authentication breaks

Always fix existing issues before adding new features.

=========================================================
WORKFLOW
=========================================================

For EVERY task follow this workflow:

1. Analyze

2. Plan

3. Implement

4. Test

5. Fix

6. Build

7. Update TODO

8. Update CHANGELOG

Only then continue.

=========================================================
DOCUMENTATION
=========================================================

Create and maintain:

README.md

ARCHITECTURE.md

DATABASE.md

API.md

DEPLOYMENT.md

SECURITY.md

TESTING.md

CODING-STANDARDS.md

Never leave documentation outdated.

=========================================================
PROJECT GOAL
=========================================================

Build a premium ERP system with the quality of commercial software.

The system must be secure.

Fast.

Responsive.

Easy to maintain.

Well documented.

Production ready.

Every decision must prioritize long-term maintainability over short-term convenience.

Never rush.

Always think like a senior software architect before writing code.



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

vehicles

carwash_services

carwash_transactions

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



=========================================================
FRONTEND ARCHITECTURE
=========================================================

Build a premium enterprise ERP frontend.

The UI must feel like professional commercial software.

Examples of inspiration:

Microsoft Dynamics

SAP Business One

Odoo

Oracle ERP

Zoho Inventory

QuickBooks

The design must prioritize usability over decoration.

=========================================================
TECH STACK
=========================================================

Frontend:

React

Vite

React Router DOM

Axios

React Hook Form

Framer Motion (only where appropriate)

Pure CSS ONLY

Do NOT use:

Tailwind

Bootstrap

Material UI

Chakra UI

Ant Design

Bulma

Foundation

=========================================================
CSS ARCHITECTURE
=========================================================

Use scalable CSS architecture.

Organize CSS professionally.

Example:

styles/

variables.css

reset.css

typography.css

layout.css

animations.css

utilities.css

components/

pages/

Never place huge CSS inside one file.

Keep styles modular.

=========================================================
DESIGN SYSTEM
=========================================================

Use a consistent design language.

Typography

Spacing

Border Radius

Colors

Buttons

Cards

Forms

Tables

Modals

Dropdowns

Badges

Status Indicators

Alerts

Everything must be reusable.

=========================================================
COLOR PALETTE
=========================================================

Primary

#0A2342

Secondary

#2E8B57

Accent

#0EA5E9

Background

#F5F7FA

Sidebar

#081B33

Text Primary

#1F2937

Text Secondary

#6B7280

Success

#22C55E

Warning

#F59E0B

Danger

#EF4444

=========================================================
RESPONSIVENESS
=========================================================

The ERP must work perfectly on:

Desktop

Laptop

Tablet

Mobile

Although optimized for desktop usage,
every page must remain usable on smaller screens.

Never allow horizontal overflow.

Tables must be responsive.

Cards must adapt properly.

=========================================================
LAYOUT STRUCTURE
=========================================================

Create:

Login Layout

Dashboard Layout

Auth Layout

Main Layout

Components must never duplicate layouts.

=========================================================
MAIN SIDEBAR
=========================================================

Create a professional collapsible sidebar.

Menu includes:

Dashboard

Branches

Users

Customers

Suppliers

Categories

Brands

Products

Inventory

Purchases

Sales (POS)

Returns

Transfers

Expenses

Car Wash

Reports

Notifications

Settings

Profile

Logout

Highlight active page.

Support collapse.

Support nested menus where appropriate.

=========================================================
TOP NAVBAR
=========================================================

Navbar contains:

Company Logo

Current Branch

Search

Notifications

User Avatar

Profile

Settings

Logout

Display current date and time.

=========================================================
DASHBOARD
=========================================================

Dashboard is the first screen after login.

Display professional KPI cards.

Required cards:

Today's Sales

Monthly Sales

Today's Profit

Monthly Profit

Expenses

Low Stock Products

Pending Transfers

Car Wash Revenue

Total Customers

Total Products

Total Suppliers

Branches

=========================================================
DASHBOARD CHARTS
=========================================================

Display charts for:

Sales Trend

Revenue Trend

Expense Trend

Top Selling Products

Branch Performance

Monthly Profit

Inventory Summary

Car Wash Summary

Charts must resize properly.

=========================================================
RECENT ACTIVITY
=========================================================

Dashboard contains:

Recent Sales

Recent Purchases

Recent Expenses

Recent Stock Transfers

Recent Notifications

Recent User Activities

=========================================================
QUICK ACTIONS
=========================================================

Dashboard includes quick buttons:

New Sale

New Product

New Purchase

Transfer Stock

New Expense

New Customer

Register Vehicle

Generate Report

=========================================================
TABLE DESIGN
=========================================================

Every table must support:

Pagination

Sorting

Searching

Filtering

Column Resize

Responsive Layout

Export

Print

Loading State

Empty State

=========================================================
FORMS
=========================================================

Every form must include:

Validation

Helpful Errors

Loading Button

Reset

Cancel

Success Message

Error Message

Keyboard Navigation

=========================================================
MODALS
=========================================================

Reusable modal system.

Used for:

Delete Confirmation

Edit

Quick View

Approval

Preview

=========================================================
PRODUCT MANAGEMENT
=========================================================

Product page must include:

Product Image

Product Name

Product Code

QR Code

Brand

Category

Buying Price

Selling Price

Current Stock

Minimum Stock

Branch

Barcode/QR Preview

Print Label

Search

Filter

Bulk Actions

=========================================================
INVENTORY PAGE
=========================================================

Inventory page displays:

Current Stock

Reserved Stock

Available Stock

Low Stock

Out of Stock

Recent Movements

Stock Adjustments

=========================================================
PURCHASE PAGE
=========================================================

Purchase module includes:

Purchase Orders

Supplier Selection

Purchase Items

Receiving Stock

Purchase History

Outstanding Supplier Balance

=========================================================
POS PAGE
=========================================================

The POS must be modern.

Features:

Fast Search

QR Scan

Barcode Scan Ready

Product Grid

Shopping Cart

Discount

Quantity Adjustment

Mixed Payment

Cash Payment

M-Pesa

Airtel Money

Receipt Preview

Print Receipt

Clear Cart

Hold Sale (prepare architecture)

=========================================================
RETURNS PAGE
=========================================================

Display:

Returned Items

Reasons

Refund Status

Return Date

Customer

Original Sale

=========================================================
TRANSFER PAGE
=========================================================

Display:

Source Branch

Destination Branch

Transfer Items

Status

Approval

Transfer History

=========================================================
CAR WASH MODULE
=========================================================

Vehicle Registration

Plate Number

Customer

Phone Number

Service

Price

Payment

Status

Wash History

=========================================================
EXPENSES PAGE
=========================================================

Display:

Expense Categories

Amount

Paid By

Branch

Date

Receipt Upload Ready

Approval Status

=========================================================
REPORTS PAGE
=========================================================

Create dedicated Reports Center.

Categories:

Sales

Inventory

Purchases

Expenses

Car Wash

Financial

Branches

Profit

Every report supports:

Preview

Print

PDF

Excel

CSV

=========================================================
SETTINGS PAGE
=========================================================

Company Information

Business Logo

Receipt Settings

Currency

Taxes

System Preferences

Email Configuration

Backup

=========================================================
LOADING EXPERIENCE
=========================================================

Create:

Skeleton Loaders

Loading Spinner

Progress Bar

Empty States

Error States

=========================================================
ANIMATIONS
=========================================================

Animations must be minimal.

Fast.

Professional.

Never distract users.

=========================================================
ACCESSIBILITY
=========================================================

Keyboard Navigation

Focus Indicators

Proper Labels

Readable Contrast

Accessible Buttons

=========================================================
CODE ORGANIZATION
=========================================================

Never create extremely large React components.

Split pages into reusable components.

Prefer composition over duplication.

Each page should be maintainable.

=========================================================
UI QUALITY STANDARD
=========================================================

Every page must look like premium commercial ERP software.

Avoid flashy designs.

Prioritize speed, readability, consistency and productivity.

The ERP should feel like software employees can comfortably use all day.

=========================================================
END OF PART 3
=========================================================


=========================================================
FRONTEND LIBRARIES
=========================================================

The frontend MUST use only the following libraries:

React

Vite

React Router DOM

Axios

React Hook Form

React Icons

Framer Motion

Pure CSS

Do NOT install unnecessary libraries.

Every dependency must have a clear purpose.

=========================================================
REACT ICONS STANDARD
=========================================================

Use React Icons consistently.

Do not mix different icon styles unnecessarily.

Preferred icons:

Fi (Feather)

Hi2 (Hero Icons)

Lu (Lucide)

Icons must be consistent across the application.

Examples:

Dashboard

Users

Products

Inventory

Sales

Purchases

Reports

Expenses

Settings

Notifications

Profile

Logout

Icons should improve usability, not decoration.

=========================================================
FRAMER MOTION STANDARD
=========================================================

Use Framer Motion carefully.

Animations must feel smooth and professional.

Allowed animations:

Page Fade

Slide

Small Scale

Modal Animation

Sidebar Collapse

Dropdown Animation

Notification Animation

Card Hover

Button Hover

Loading Transition

Avoid excessive animations.

Performance is always more important than visual effects.

=========================================================
REPORTING ENGINE
=========================================================

Create a complete reporting engine.

Report Categories:

Sales Reports

Purchase Reports

Inventory Reports

Expense Reports

Supplier Reports

Customer Reports

Branch Reports

Profit Reports

Loss Reports

Car Wash Reports

Product Movement Reports

Activity Reports

Audit Reports

=========================================================
REPORT FILTERS
=========================================================

Every report supports:

Date Range

Branch

User

Category

Supplier

Customer

Product

Payment Method

Status

Search

=========================================================
EXPORT ENGINE
=========================================================

Every report supports:

Print

PDF Export

Excel Export

CSV Export

Preview Before Print

=========================================================
PDF STANDARD
=========================================================

PDF documents must be professional.

Include:

Company Logo

Company Name

Report Title

Filters Used

Generation Date

Generated By

Page Numbers

Footer

=========================================================
RECEIPT PRINTING
=========================================================

Sales receipts must include:

Company Logo

Company Name

Address

Phone Number

Receipt Number

Date

Cashier

Customer

Items

Quantity

Price

Discount

Tax

Total

Payment Method

Amount Paid

Balance

Thank You Message

=========================================================
LABEL PRINTING
=========================================================

Product labels include:

QR Code

Product Name

Product Code

Selling Price

Branch

Support multiple paper sizes.

Support bulk printing.

=========================================================
QR WORKFLOW
=========================================================

QR Code must support:

Generation

Preview

Download

Print

Regenerate

Scan Ready

=========================================================
SEARCH SYSTEM
=========================================================

Global Search supports:

Products

Customers

Suppliers

Sales

Purchases

Vehicles

Expenses

Users

Fast searching is required.

=========================================================
NOTIFICATION SYSTEM
=========================================================

Notification Types:

Information

Success

Warning

Danger

Low Stock

Purchase Complete

Sale Complete

Transfer Complete

Expense Submitted

Notification Panel supports:

Read

Unread

Mark All Read

Delete

=========================================================
FILE UPLOADS
=========================================================

Support uploads for:

Company Logo

Product Images

Expense Receipts

User Avatar

Allowed formats:

JPG

JPEG

PNG

PDF

Validate:

File Type

File Size

Image Dimensions

Never trust uploaded files.

=========================================================
SECURITY
=========================================================

Implement:

Helmet

Rate Limiting

Input Sanitization

Input Validation

SQL Injection Protection

XSS Protection

CORS Configuration

Environment Variables

Secure JWT

Password Hashing

HTTP Security Headers

Never expose sensitive information.

=========================================================
API SECURITY
=========================================================

Every protected API requires:

Authentication

Authorization

Permission Check

Validation

Error Handling

Audit Logging

=========================================================
ERROR HANDLING
=========================================================

Create reusable error pages.

404

403

401

500

Display user-friendly messages.

Never expose server internals.

=========================================================
LOADING STATES
=========================================================

Create reusable:

Spinner

Skeleton

Progress Bar

Empty State

Retry State

=========================================================
FORM EXPERIENCE
=========================================================

Every form should include:

Real-time validation

Loading Button

Disable Submit While Processing

Clear Errors

Success Feedback

=========================================================
TESTING STRATEGY
=========================================================

Before considering a feature complete:

Verify UI

Verify Backend

Verify Database

Verify API

Verify Permissions

Verify Responsiveness

Verify Printing

Verify Reports

Verify Security

=========================================================
BUILD VERIFICATION
=========================================================

After every implementation execute:

npm install (if required)

npm run build

Fix build errors.

Do not continue if build fails.

=========================================================
LINT VERIFICATION
=========================================================

Run lint.

Fix warnings.

Fix errors.

Never ignore lint issues.

=========================================================
RESPONSIVE QA
=========================================================

Verify:

Desktop

Laptop

Tablet

Mobile

No horizontal overflow.

No broken layouts.

No overlapping elements.

=========================================================
PERFORMANCE
=========================================================

Optimize:

React Rendering

Images

API Calls

Database Queries

Bundle Size

Lazy Loading

Avoid unnecessary re-renders.

=========================================================
DEPLOYMENT
=========================================================

Target Server:

Contabo VPS

Ubuntu Linux

Node.js

Express

MySQL

PM2

Nginx

SSL

=========================================================
DEPLOYMENT DOCUMENTATION
=========================================================

Generate:

DEPLOYMENT.md

Include:

Server Setup

Node Installation

MySQL Installation

Nginx Configuration

PM2 Configuration

Environment Variables

Domain Configuration

SSL

Backup Strategy

Restore Strategy

=========================================================
ENVIRONMENT VARIABLES
=========================================================

Never hardcode secrets.

Use .env for:

Database

JWT Secret

Refresh Secret

SMTP

Application URL

Frontend URL

Backend URL

=========================================================
CODE REVIEW
=========================================================

Before completing any module review:

Architecture

Code Quality

Performance

Security

Responsiveness

Accessibility

Maintainability

=========================================================
DEFINITION OF DONE
=========================================================

A feature is NOT complete until:

Backend Finished

Frontend Finished

Validation Added

Permissions Added

Documentation Updated

TODO Updated

CHANGELOG Updated

Responsive

Build Pass

Lint Pass

No Console Errors

No Runtime Errors

=========================================================
FINAL RULE
=========================================================

Think like an experienced software architect.

Never rush implementation.

Always prioritize:

Maintainability

Scalability

Security

Readability

Performance

Professional software engineering practices.

Build software that another senior engineer can maintain for the next ten years.

=========================================================
END OF PART 4
=========================================================




=========================================================
PHASE 1
CORE ERP FOUNDATION
=========================================================

This phase is the foundation of the entire ERP.

Do not continue to Inventory, POS or Purchases until this phase is complete.

Every feature in the entire ERP depends on this phase.

=========================================================
MODULE 1
COMPANY INFORMATION
=========================================================

Create a complete Company Profile module.

Purpose:

Store all business information.

Fields include:

Company Name

Business Type

TIN Number

VRN

Business Registration Number

Physical Address

Region

District

Street

Phone Number

Alternative Phone

Email

Website

Business Logo

Currency

Timezone

Receipt Footer

Business Description

Status

The Company Information should be editable only by Super Administrator.

Company Logo should automatically appear in:

Receipts

Reports

Invoices

PDF Documents

Dashboard

=========================================================
MODULE 2
AUTHENTICATION
=========================================================

Build enterprise authentication.

Pages:

Login

Forgot Password

Reset Password

Profile

Change Password

Session Expired

Features:

JWT Authentication

Refresh Tokens

Remember Me

Secure Logout

Logout Current Device

Logout All Devices

Session Tracking

Auto Token Refresh

Password Reset via Email

Account Lock after repeated failed attempts

Password Complexity Validation

=========================================================
LOGIN EXPERIENCE
=========================================================

The login page must be modern.

Professional.

Minimal.

Fast.

Include:

Company Logo

Welcome Message

Email

Password

Remember Me

Forgot Password

Loading State

Validation Messages

=========================================================
MODULE 3
USER MANAGEMENT
=========================================================

Create complete user management.

Users table includes:

First Name

Last Name

Gender

Phone Number

Email

Username

Password

Role

Branch

Profile Picture

Status

Created Date

Last Login

Users can:

Be Activated

Be Suspended

Be Locked

Be Deleted (Soft Delete)

Reset Password

Change Role

Assign Branch

=========================================================
MODULE 4
ROLE MANAGEMENT
=========================================================

Roles include:

Super Administrator

Manager

Cashier

Store Keeper

The system must support creating future custom roles.

Never hardcode roles.

=========================================================
MODULE 5
PERMISSION MANAGEMENT
=========================================================

Create dynamic permission management.

Permissions include:

View

Create

Edit

Delete

Approve

Export

Print

Manage Users

Manage Settings

Manage Reports

Manage Inventory

Manage Sales

Manage Purchases

Manage Expenses

Manage Transfers

Manage Car Wash

Permissions must come from database.

Every page checks permissions.

Every API checks permissions.

=========================================================
MODULE 6
BRANCH MANAGEMENT
=========================================================

Create Branch module.

Fields:

Branch Name

Branch Code

Manager

Phone

Email

Address

Region

District

Opening Date

Status

Features:

Create Branch

Edit Branch

Deactivate Branch

Assign Users

Assign Inventory

View Reports

View Performance

=========================================================
BRANCH BUSINESS RULES
=========================================================

Every sale belongs to one branch.

Every purchase belongs to one branch.

Every inventory record belongs to one branch.

Every expense belongs to one branch.

Every transfer belongs to branches.

Managers see assigned branches only.

Cashiers see assigned branch only.

Super Admin sees everything.

=========================================================
MODULE 7
PROFILE MANAGEMENT
=========================================================

Every user has:

Profile Page

Profile Picture

Personal Information

Security Settings

Password Change

Recent Activity

Login Devices

=========================================================
MODULE 8
DASHBOARD
=========================================================

The dashboard must become the command center of the ERP.

Never create a simple dashboard.

Create an executive dashboard.

=========================================================
DASHBOARD KPI CARDS
=========================================================

Today's Sales

Today's Profit

Monthly Sales

Monthly Profit

Total Customers

Total Suppliers

Total Products

Available Inventory Value

Low Stock Products

Today's Expenses

Monthly Expenses

Car Wash Revenue

Pending Transfers

Pending Purchases

=========================================================
DASHBOARD CHARTS
=========================================================

Charts include:

Daily Sales

Weekly Sales

Monthly Sales

Revenue Trend

Expense Trend

Profit Trend

Inventory Overview

Top Selling Products

Branch Performance

Car Wash Performance

=========================================================
RECENT ACTIVITIES
=========================================================

Dashboard Timeline displays:

Recent Sales

Recent Purchases

Recent Expenses

Recent Returns

Recent Transfers

Recent Users

Recent Logins

=========================================================
QUICK ACTIONS
=========================================================

Dashboard quick actions:

New Sale

New Purchase

New Product

New Customer

New Supplier

Transfer Stock

Register Vehicle

Create Expense

Generate Report

=========================================================
NOTIFICATION PANEL
=========================================================

Dashboard notifications include:

Low Stock

Pending Approval

New Purchase

Transfer Request

System Update

Expense Submitted

Unread Messages

=========================================================
SEARCH
=========================================================

Create global ERP search.

Search across:

Products

Customers

Suppliers

Users

Sales

Purchases

Expenses

Vehicles

=========================================================
BUSINESS RULES
=========================================================

Never allow:

Inactive users to login.

Deleted users to login.

Suspended users to login.

Deleted branches to receive sales.

Disabled branches to receive purchases.

=========================================================
VALIDATION
=========================================================

Every form validates:

Required Fields

Email Format

Phone Format

Password Strength

Duplicate Username

Duplicate Email

Duplicate Branch Code

=========================================================
API REQUIREMENTS
=========================================================

Every module requires:

GET

POST

PUT

PATCH

DELETE

Search

Pagination

Sorting

Filtering

=========================================================
RESPONSIVENESS
=========================================================

Dashboard must work perfectly on:

Desktop

Laptop

Tablet

Mobile

Sidebar collapses automatically.

Cards rearrange automatically.

Charts resize automatically.

Tables become scrollable.

=========================================================
QUALITY CHECK
=========================================================

Do not mark this phase complete until:

Authentication works.

Permissions work.

Dashboard works.

Users work.

Branches work.

Roles work.

Profile works.

Company Settings work.

Build passes.

Lint passes.

TODO updated.

CHANGELOG updated.

=========================================================
END OF PART 5A
=========================================================




=========================================================
PHASE 2
INVENTORY MANAGEMENT ENGINE
=========================================================

Inventory is the heart of this ERP.

Every module must depend on Inventory.

Sales

Purchases

Transfers

Returns

Reports

Dashboard

QR Codes

Labels

must always use Inventory as the single source of truth.

Never duplicate stock quantities.

=========================================================
MODULE 1
PRODUCT CATEGORIES
=========================================================

Create Product Category Management.

Fields:

Category Name

Category Code

Description

Status

Created Date

Features:

Create Category

Edit Category

Delete Category (Soft Delete)

Search

Pagination

Sorting

Filtering

Business Rules:

Category names must be unique.

Prevent deletion if products exist.

=========================================================
MODULE 2
BRANDS
=========================================================

Create Brand Management.

Fields:

Brand Name

Brand Code

Description

Country

Status

Business Rules:

Brand names must be unique.

Prevent deletion if products exist.

=========================================================
MODULE 3
PRODUCT MANAGEMENT
=========================================================

This module manages every product.

Required Fields:

Product Name

Product Code

QR Code

Category

Brand

Description

Buying Price

Selling Price

Minimum Stock

Current Stock

Branch

Status

Product Image

Barcode (future ready)

Created By

Created Date

Updated Date

=========================================================
PRODUCT IMAGES
=========================================================

Support:

Image Upload

Preview

Replace

Delete

Multiple Images (future ready)

Compress images before storage.

=========================================================
PRODUCT CODE
=========================================================

Generate automatically.

Examples:

SPR-2026-00001

SPR-2026-00002

DEC-2026-00001

Rules:

Never duplicate.

Never reuse deleted codes.

Generation logic must be reusable.

=========================================================
QR CODE
=========================================================

Automatically generate QR Code.

QR should contain:

Product ID

Product Code

Branch ID

Product Name

Selling Price

Generate:

PNG

SVG (future ready)

Allow:

Download

Print

Regenerate

=========================================================
LABEL PRINTING
=========================================================

Generate professional labels.

Include:

QR Code

Product Name

Product Code

Selling Price

Branch

Print:

Single Label

Bulk Labels

Sticker Paper Ready

=========================================================
INVENTORY
=========================================================

Every product belongs to Inventory.

Inventory contains:

Current Quantity

Reserved Quantity

Available Quantity

Minimum Stock

Maximum Stock (future ready)

Branch

Last Updated

Never manually edit stock.

Stock changes ONLY through inventory transactions.

=========================================================
STOCK MOVEMENTS
=========================================================

Every movement creates history.

Movement Types:

Purchase

Sale

Return

Transfer Out

Transfer In

Adjustment

Opening Balance

Manual Correction (Admin Only)

Movement History stores:

Product

Branch

Quantity

Previous Stock

New Stock

Movement Type

Reference Number

User

Timestamp

=========================================================
STOCK ADJUSTMENTS
=========================================================

Allow authorized users to adjust stock.

Adjustment Reasons:

Damaged

Expired

Lost

Correction

Initial Count

System Error

Every adjustment requires:

Reason

Description

Approval (optional)

Audit Log

=========================================================
LOW STOCK ALERTS
=========================================================

Generate alerts automatically.

When stock <= minimum stock

Display:

Dashboard

Notifications

Inventory Page

Reports

=========================================================
OUT OF STOCK
=========================================================

Detect automatically.

Prevent selling out-of-stock products.

Display warning clearly.

=========================================================
STOCK SEARCH
=========================================================

Search using:

Product Name

Product Code

QR Code

Category

Brand

Branch

Fast search is required.

=========================================================
FILTERS
=========================================================

Inventory filters:

Branch

Category

Brand

Low Stock

Out of Stock

Status

Price Range

Date Added

=========================================================
INVENTORY DASHBOARD
=========================================================

Display:

Total Products

Total Inventory Value

Available Stock

Low Stock

Out of Stock

Recently Added

Recently Updated

=========================================================
BULK OPERATIONS
=========================================================

Support:

Bulk Delete

Bulk Status Change

Bulk Label Printing

Bulk QR Generation

Bulk Export

Bulk Import (future ready)

=========================================================
IMPORT / EXPORT
=========================================================

Export:

Excel

CSV

PDF

Future Ready:

Import Products from Excel

=========================================================
BUSINESS RULES
=========================================================

Never allow:

Negative stock.

Duplicate product code.

Duplicate QR.

Buying price greater than selling price without confirmation.

Deleting products with transaction history.

Deleting categories containing products.

Deleting brands containing products.

=========================================================
VALIDATION
=========================================================

Validate:

Product Name

Category

Brand

Prices

Stock

Image

QR Code

Product Code

=========================================================
API REQUIREMENTS
=========================================================

Create RESTful APIs for:

Categories

Brands

Products

Inventory

Stock Movements

Adjustments

Labels

QR Codes

Support:

Pagination

Filtering

Sorting

Searching

=========================================================
PERMISSIONS
=========================================================

Super Admin

Full Access

Manager

Manage Products

View Inventory

Approve Adjustments

Store Keeper

Manage Inventory

Adjust Stock

Cashier

View Products

Cannot Edit Inventory

=========================================================
REPORTS
=========================================================

Inventory Reports include:

Current Stock

Low Stock

Out of Stock

Inventory Value

Stock Movement

Adjustment Report

Product Performance

=========================================================
RESPONSIVENESS
=========================================================

Inventory pages must work on:

Desktop

Laptop

Tablet

Mobile

Tables must scroll horizontally.

Cards reorganize automatically.

=========================================================
QUALITY CHECK
=========================================================

Before completing Inventory module verify:

Products work.

Categories work.

Brands work.

Inventory updates correctly.

QR generation works.

Label printing works.

Stock movements recorded.

Reports generated.

Permissions verified.

Build passes.

Lint passes.

TODO updated.

CHANGELOG updated.

=========================================================
END OF PART 5B
=========================================================



=========================================================
PHASE 3
SALES ENGINE (POS)
=========================================================

The POS module is the most frequently used module.

It must be:

Fast

Reliable

Responsive

Easy to use

Cashier Friendly

Error Resistant

The POS must feel like commercial retail software.

=========================================================
MODULE 1
CUSTOMER MANAGEMENT
=========================================================

Create Customer Management Module.

Fields:

Customer Code

First Name

Last Name

Business Name (Optional)

Phone Number

Alternative Phone

Email

Address

Region

District

TIN Number (Optional)

Customer Type

Status

Created Date

Features:

Create Customer

Edit Customer

View Customer

Deactivate Customer

Search Customer

Customer Purchase History

Customer Return History

Customer Statistics

=========================================================
CUSTOMER TYPES
=========================================================

Walk In Customer

Retail Customer

Wholesale Customer

VIP Customer

Business Customer

Future customer types must be supported.

=========================================================
MODULE 2
POINT OF SALE (POS)
=========================================================

Create a modern POS interface.

The POS must support:

Product Search

QR Code Scan

Barcode Ready Architecture

Shopping Cart

Quantity Adjustment

Discounts

Price Override (Permission Based)

Notes

Customer Selection

Mixed Payments

Receipt Printing

=========================================================
POS LAYOUT
=========================================================

Left Side:

Product Search

Product Categories

Product Grid

Product Cards

Right Side:

Shopping Cart

Customer

Discount

Totals

Payment Section

Receipt Preview

Checkout

=========================================================
PRODUCT SEARCH
=========================================================

Search by:

Product Name

Product Code

QR Code

Category

Brand

Search must be instant.

=========================================================
SHOPPING CART
=========================================================

Cart supports:

Add Product

Remove Product

Update Quantity

Update Price (Permission Based)

Apply Discount

Apply Notes

Clear Cart

Cart Totals

=========================================================
BUSINESS RULES
=========================================================

Prevent:

Negative Quantity

Selling Out of Stock Products

Invalid Discounts

Invalid Prices

Duplicate Payment Submission

=========================================================
DISCOUNT SYSTEM
=========================================================

Discount Types:

Percentage

Fixed Amount

Whole Cart Discount

Line Item Discount

Permissions Required:

Cashier

Limited Discount

Manager

Extended Discount

Super Admin

Full Discount Authority

=========================================================
PAYMENT METHODS
=========================================================

Cash

M-Pesa

Airtel Money

Mixed Payment

Future Ready:

Bank Transfer

Card Payment

=========================================================
MIXED PAYMENT
=========================================================

Support combinations:

Cash + M-Pesa

Cash + Airtel Money

Cash + Multiple Methods

System must verify:

Total Paid >= Sale Total

=========================================================
CHECKOUT PROCESS
=========================================================

Process:

Validate Cart

Validate Stock

Validate Customer

Validate Payment

Create Sale

Create Sale Items

Create Payment Records

Update Inventory

Create Inventory Movements

Generate Receipt

Create Audit Logs

Create Activity Logs

Send Notifications

=========================================================
DATABASE TRANSACTION RULE
=========================================================

Sale processing MUST use MySQL transaction.

If any step fails:

Rollback Everything.

Never allow partial sales.

=========================================================
SALES NUMBER
=========================================================

Generate automatic sales numbers.

Examples:

SAL-2026-000001

SAL-2026-000002

SAL-2026-000003

Must be unique.

=========================================================
RECEIPT GENERATION
=========================================================

Generate receipt automatically.

Receipt includes:

Company Logo

Company Name

Branch

Receipt Number

Date

Cashier

Customer

Items

Quantity

Price

Discount

Subtotal

Total

Payment Method

Amount Paid

Balance

Footer Message

=========================================================
RECEIPT FEATURES
=========================================================

Preview Receipt

Print Receipt

Download PDF

Reprint Receipt

Email Receipt (Future Ready)

=========================================================
SALE HISTORY
=========================================================

Display:

Sale Number

Customer

Cashier

Branch

Date

Amount

Discount

Status

Payment Method

Actions

=========================================================
SALE DETAILS
=========================================================

View:

All Items

Payments

Discounts

Customer

Inventory Movements

Activity Logs

Audit Logs

=========================================================
MODULE 3
SALES RETURNS
=========================================================

Create complete returns management.

Fields:

Return Number

Original Sale

Customer

Return Date

Reason

Status

Approved By

=========================================================
RETURN REASONS
=========================================================

Damaged Product

Wrong Product Issued

Customer Changed Mind

Expired Product

Other

=========================================================
RETURN WORKFLOW
=========================================================

Locate Original Sale

Select Items

Select Quantity

Enter Reason

Validate Return

Approve Return

Restore Inventory

Generate Return Record

Generate Audit Log

=========================================================
RETURN BUSINESS RULES
=========================================================

Cannot return more than sold quantity.

Cannot return deleted sales.

Cannot return invalid products.

Inventory must update automatically.

=========================================================
RETURN NUMBER
=========================================================

Generate:

RET-2026-000001

RET-2026-000002

Must be unique.

=========================================================
REFUND MANAGEMENT
=========================================================

Track:

Refund Amount

Refund Method

Refund Date

Refund Status

Approved By

=========================================================
MODULE 4
SALES DASHBOARD
=========================================================

Display:

Today's Sales

Weekly Sales

Monthly Sales

Annual Sales

Average Sale Value

Sales Count

Returns Count

Top Customers

Top Products

Top Cashiers

=========================================================
SALES REPORTS
=========================================================

Reports include:

Daily Sales

Weekly Sales

Monthly Sales

Annual Sales

Customer Sales

Product Sales

Cashier Sales

Branch Sales

Discount Report

Returns Report

Payment Method Report

=========================================================
FILTERS
=========================================================

Date Range

Branch

Cashier

Customer

Product

Category

Payment Method

Status

=========================================================
PERMISSIONS
=========================================================

Super Admin

Full Access

Manager

Sales Management

Returns Approval

Discount Authority

Cashier

Create Sales

View Own Sales

Store Keeper

View Sales Only

=========================================================
VALIDATION
=========================================================

Validate:

Customer

Stock

Discount

Payment

Product

Quantity

Prices

Return Quantity

=========================================================
QUALITY CHECK
=========================================================

Verify:

POS Works

Checkout Works

Inventory Updates

Receipt Printing Works

Returns Work

Refunds Work

Reports Work

Permissions Work

Transactions Work

Build Passes

Lint Passes

TODO Updated

CHANGELOG Updated

=========================================================
END OF PART 5C
=========================================================


=========================================================
PHASE 4
PURCHASES & SUPPLIERS
=========================================================

Purchases are responsible for increasing inventory.

Keep the workflow simple and efficient.

=========================================================
SUPPLIER MANAGEMENT
=========================================================

Fields:

Supplier Name

Phone Number

Email

Address

TIN (Optional)

Status

Features:

Create Supplier

Edit Supplier

View Purchase History

Search

Deactivate Supplier

=========================================================
PURCHASE MANAGEMENT
=========================================================

Create Purchase

Select Supplier

Select Products

Enter Buying Price

Enter Quantity

Save Purchase

Business Rules:

Saving a purchase automatically:

Updates inventory

Creates inventory movement

Creates purchase history

Updates dashboard

=========================================================
PURCHASE NUMBER
=========================================================

Generate automatically.

Example:

PUR-2026-000001

=========================================================
PURCHASE HISTORY
=========================================================

Display:

Purchase Number

Supplier

Products

Total Amount

Date

User

Branch

=========================================================
SUPPLIER BALANCE
=========================================================

Track:

Total Purchases

Total Paid

Outstanding Balance

Future payments can reduce balance.

=========================================================
PURCHASE REPORTS
=========================================================

Reports:

Daily Purchases

Monthly Purchases

Supplier Purchases

Product Purchases

=========================================================
PERMISSIONS
=========================================================

Super Admin

Manager

Store Keeper

Cashier (View Only)

=========================================================
QUALITY CHECK
=========================================================

Verify:

Purchases increase stock.

History recorded.

Reports generated.

Permissions working.

TODO updated.

CHANGELOG updated.

=========================================================
END OF PART 5D
=========================================================


=========================================================
PHASE 5
STOCK TRANSFERS
=========================================================

Allow stock movement between branches.

Simple, fast and secure.

=========================================================
TRANSFER
=========================================================

Fields:

Transfer Number

Source Branch

Destination Branch

Products

Quantity

Transfer Date

Status

Created By

=========================================================
WORKFLOW
=========================================================

Create Transfer

Select Products

Enter Quantity

Submit

Approve (Manager / Super Admin)

Update Source Inventory

Update Destination Inventory

Create Inventory Movement

Create Activity Log

=========================================================
TRANSFER NUMBER
=========================================================

Generate automatically.

Example:

TRF-2026-000001

=========================================================
TRANSFER STATUS
=========================================================

Pending

Approved

Rejected

Completed

=========================================================
BUSINESS RULES
=========================================================

Cannot transfer more than available stock.

Cannot transfer to same branch.

Every transfer updates inventory automatically.

Every transfer creates stock movement history.

=========================================================
REPORTS
=========================================================

Transfer History

Branch Transfers

Transfer Summary

=========================================================
PERMISSIONS
=========================================================

Super Admin

Manager

Store Keeper

Cashier (View Only)

=========================================================
QUALITY CHECK
=========================================================

Verify inventory updates correctly.

Verify history.

Verify reports.

Update TODO.

Update CHANGELOG.

=========================================================
END OF PART 5E
=========================================================



=========================================================
PHASE 6
EXPENSES
=========================================================

Create simple expense management.

=========================================================
FIELDS
=========================================================

Expense Category

Amount

Description

Branch

Date

Recorded By

=========================================================
EXPENSE CATEGORIES
=========================================================

Rent

Electricity

Water

Fuel

Salary

Maintenance

Transport

Office Supplies

Other

=========================================================
FEATURES
=========================================================

Create Expense

Edit Expense

Delete Expense

Search

Filter

=========================================================
BUSINESS RULES
=========================================================

Expenses automatically affect Profit Reports.

Branch expenses belong to their branch.

=========================================================
REPORTS
=========================================================

Daily Expenses

Monthly Expenses

Category Summary

Branch Expenses

=========================================================
PERMISSIONS
=========================================================

Super Admin

Manager

Cashier (View Only)

=========================================================
QUALITY CHECK
=========================================================

Verify reports.

Verify dashboard.

Verify permissions.

Update TODO.

Update CHANGELOG.

=========================================================
END OF PART 5F
=========================================================



=========================================================
PHASE 7
CAR WASH
=========================================================

Create a simple and professional Car Wash module.

=========================================================
FIELDS
=========================================================

Vehicle Plate Number

Customer Name

Phone Number

Service

Amount

Payment Method

Date

Served By

=========================================================
SERVICES
=========================================================

Normal Wash

Full Wash

Engine Wash

Interior Cleaning

=========================================================
FEATURES
=========================================================

Register Vehicle

Record Service

Receive Payment

View History

Search

Filter

=========================================================
BUSINESS RULES
=========================================================

Every completed service appears in dashboard.

Revenue contributes to Profit Reports.

=========================================================
REPORTS
=========================================================

Daily Car Wash

Monthly Car Wash

Revenue Summary

Popular Services

=========================================================
PERMISSIONS
=========================================================

Super Admin

Manager

Cashier

=========================================================
QUALITY CHECK
=========================================================

Verify reports.

Verify dashboard.

Update TODO.

Update CHANGELOG.

=========================================================
END OF PART 5G
=========================================================




=========================================================
PHASE 8
REPORTING
=========================================================

Create a centralized Reports Center.

=========================================================
REPORTS
=========================================================

Sales

Inventory

Purchases

Expenses

Car Wash

Profit

Branches

Products

Customers

Suppliers

Returns

Transfers

=========================================================
FILTERS
=========================================================

Date

Branch

Category

Supplier

Customer

Cashier

=========================================================
EXPORT
=========================================================

Print

PDF

Excel

CSV

=========================================================
BUSINESS RULES
=========================================================

Reports must be generated from live database data.

No hardcoded values.

=========================================================
DASHBOARD
=========================================================

Dashboard KPIs must use the same report calculations.

=========================================================
QUALITY CHECK
=========================================================

Verify totals.

Verify exports.

Verify print.

Update TODO.

Update CHANGELOG.

=========================================================
END OF PART 5H
=========================================================



=========================================================
PHASE 9
SYSTEM SETTINGS
=========================================================

Create system settings.

=========================================================
SETTINGS
=========================================================

Company Information

Logo

Receipt Footer

Currency

Tax

Email

Profile

Password

=========================================================
NOTIFICATIONS
=========================================================

Low Stock

Purchase Completed

Sale Completed

Transfer Completed

Expense Recorded

System Alerts

Support:

Read

Unread

Mark All Read

=========================================================
BACKUP
=========================================================

Prepare system for:

Database Backup

System Backup

Restore Documentation

=========================================================
FINAL QUALITY ASSURANCE
=========================================================

Before marking the project complete verify:

Authentication

Users

Roles

Permissions

Branches

Dashboard

Inventory

Purchases

POS

Returns

Transfers

Expenses

Car Wash

Reports

Notifications

Settings

=========================================================
FINAL TECHNICAL CHECK
=========================================================

Verify:

No Console Errors

No Build Errors

No Lint Errors

No API Errors

No Broken Routes

No Duplicate Code

No Unused Components

Responsive Design

Fast Performance

=========================================================
FINAL DOCUMENTATION
=========================================================

Ensure documentation exists:

README.md

TODO.md

CHANGELOG.md

ARCHITECTURE.md

DATABASE.md

API.md

DEPLOYMENT.md

SECURITY.md

=========================================================
FINAL RULE
=========================================================

Do not consider the ERP complete until:

All modules work correctly.

Documentation is updated.

TODO is completed.

Build passes.

Lint passes.

The system is production-ready.

=========================================================
END OF PART 5I
=========================================================



=========================================================
PHASE 10
AI DEVELOPMENT WORKFLOW
=========================================================

Before writing any code:

Read the entire MASTER_PROMPT.md.

Understand the architecture.

Understand the database.

Understand business rules.

Understand user roles.

Understand module dependencies.

Do NOT begin coding until the whole project is understood.

=========================================================
PROJECT EXECUTION
=========================================================

Break the project into small tasks.

Create TODO.md.

Group tasks into phases.

Complete one task before moving to the next.

Never leave unfinished work.

=========================================================
IMPLEMENTATION ORDER
=========================================================

Build in this order:

1. Project Setup

2. Authentication

3. Company Settings

4. User Management

5. Roles & Permissions

6. Branches

7. Dashboard

8. Categories

9. Brands

10. Products

11. Inventory

12. QR Codes

13. Label Printing

14. Suppliers

15. Purchases

16. Stock Transfers

17. Customers

18. POS

19. Returns

20. Expenses

21. Car Wash

22. Reports

23. Notifications

24. Settings

25. Final Testing

26. Deployment

Never change this order unless absolutely necessary.

=========================================================
TODO MANAGEMENT
=========================================================

Automatically maintain TODO.md.

Every task must contain:

Status

Priority

Module

Description

Completed Date

Mark completed tasks immediately.

Never delete completed tasks.

=========================================================
CHANGELOG
=========================================================

Maintain CHANGELOG.md.

Record:

New Features

Bug Fixes

Database Changes

Breaking Changes

Security Improvements

Performance Improvements

=========================================================
CODE QUALITY
=========================================================

Write production-ready code.

Never generate placeholder code.

Never leave TODO comments in source code.

Never leave empty functions.

Never duplicate code unnecessarily.

Prefer reusable components.

Keep files small and organized.

=========================================================
ARCHITECTURE RULES
=========================================================

Respect the project architecture.

Never create random folders.

Never move files without reason.

Keep naming consistent.

Keep imports clean.

=========================================================
DATABASE RULES
=========================================================

Normalize database tables.

Use foreign keys.

Create indexes where needed.

Use transactions for critical operations.

Never duplicate data unnecessarily.

=========================================================
API RULES
=========================================================

Every endpoint must include:

Validation

Authentication

Authorization

Error Handling

Consistent JSON Response

=========================================================
FRONTEND RULES
=========================================================

Every page must include:

Loading State

Error State

Empty State

Success Feedback

Responsive Design

=========================================================
RESPONSIVENESS
=========================================================

Verify:

Desktop

Laptop

Tablet

Mobile

No horizontal scrolling.

No overlapping elements.

No broken layouts.

=========================================================
SELF REVIEW
=========================================================

After every completed feature:

Review your own code.

Look for bugs.

Look for duplicate code.

Look for security issues.

Improve readability.

=========================================================
BUILD VERIFICATION
=========================================================

After every completed module:

Run:

npm run build

Fix all build errors.

=========================================================
LINT VERIFICATION
=========================================================

Run lint.

Fix all warnings.

Fix all errors.

=========================================================
TESTING
=========================================================

Test:

Backend

Frontend

API

Database

Permissions

Business Rules

Printing

Reports

=========================================================
DOCUMENTATION
=========================================================

Keep updated:

README.md

TODO.md

CHANGELOG.md

DATABASE.md

API.md

DEPLOYMENT.md

ARCHITECTURE.md

=========================================================
ERROR POLICY
=========================================================

Never ignore errors.

Find root cause.

Fix correctly.

Do not hide problems.

=========================================================
UI POLICY
=========================================================

Keep UI:

Simple

Clean

Professional

Consistent

Fast

Avoid unnecessary animations.

=========================================================
BUSINESS LOGIC
=========================================================

Protect business data.

Never corrupt inventory.

Never create inconsistent financial records.

Never allow invalid stock.

=========================================================
FINAL PROJECT CHECKLIST
=========================================================

Before declaring the project complete verify:

All modules implemented.

Authentication works.

Permissions work.

Inventory accurate.

Sales accurate.

Purchases accurate.

Transfers accurate.

Expenses accurate.

Reports accurate.

Dashboard accurate.

Responsive.

Secure.

Production-ready.

=========================================================
FINAL AI RULE
=========================================================

Act as a Senior Full Stack Software Engineer.

Prioritize:

Maintainability

Scalability

Security

Performance

Clean Code

Business Accuracy

Never sacrifice correctness for speed.

If uncertain, choose the solution that is easier to maintain long-term.

The objective is not only to finish the project, but to build a production-ready ERP that can be deployed for a real business.

=========================================================
END OF PART 6
=========================================================