
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
