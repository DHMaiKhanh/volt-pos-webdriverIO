---
title: '[DEMO] QR Payment - Spec & Requirements'
source: https://linear.app/fastboy/document/demo-qr-payment-spec-and-requirements-c421e841d51e
linear_id: 3040e00f-e02c-4879-9973-04a731aa18d0
team: VOLT
updated: 2026-06-11T09:58:41.547Z
---

# [DEMO] QR Payment - Spec & Requirements

## Overview

This is the **PO spec document** for the QR Payment Q2 feature. In the proposed Linear refactor, this is where Loan (PO) would write requirements that span multiple repos.

Authors of this kind of document: **Loan (PO)** — supported by Tien for clarifications.

---

## 1\. Background

Customers currently pay by cash or card. We want to enable **QR-based payments** (VietQR / MoMo / ZaloPay scan-to-pay) at point of sale.

## 2\. User Stories

### Cashier (POS app)

- As a cashier, I want to display a QR code on the customer-facing screen so customers can scan and pay.
- As a cashier, I want to see real-time confirmation when payment is received.

### Customer

- As a customer, I want to scan a single QR and choose my payment app.

### Merchant Admin (Portal)

- As a merchant admin, I want to enable/disable QR payment for my store.
- As a merchant admin, I want to configure which QR providers to accept.

## 3\. Scope by Squad

| Squad                | Repo             | Work                                                                                                         |
| -------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------ |
| **BE** (Trịnh)       | `volt-pos-api`   | New endpoints: `POST /payments/qr/generate`, webhook `/payments/qr/callback`. DB schema for QR transactions. |
| **FE POS** (Việt)    | `volt-pos`       | QR display screen, polling for payment confirmation, success/fail UI.                                        |
| **FE Portal** (Thơm) | `fastboy-portal` | Settings page: toggle QR payment per store, select QR providers.                                             |
| **QC** (Hưng)        | —                | Test end-to-end across 3 repos.                                                                              |

## 4\. Acceptance Criteria

- [ ] Cashier can generate QR for any order amount
- [ ] Payment confirmation appears within 5 seconds of customer scan
- [ ] Merchant admin can toggle QR per store, settings persist
- [ ] All 3 QR providers tested end-to-end
- [ ] Failed payments show clear error to cashier

## 5\. Out of Scope

- Refund flow for QR payments (Q3)
- Multi-currency support (Q3)

---

## How this Document fits the refactor

- **This document lives in the Initiative**, not in any project.
- All 3 squad leads can read it without subscribing to other squads' projects.
- When the spec is ready, leads break it into issues in their respective projects (linked below as [VP-1241](https://linear.app/fastboy/issue/VP-1241), [VP-1242](https://linear.app/fastboy/issue/VP-1242), [VP-1243](https://linear.app/fastboy/issue/VP-1243)).
- This Document is the **single source of truth** for the feature — when scope changes, update here.
