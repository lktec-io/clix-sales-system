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