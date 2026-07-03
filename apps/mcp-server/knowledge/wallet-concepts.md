# Wallet Concepts

## What are credits?

Credits are the unit of value stored inside a wallet. Every wallet holds a
balance expressed in credits. Credits are always tied to a specific merchant and
a specific user: a user can hold different balances with different merchants.
Credits are integers and can never go negative.

## Merchant vs. user

A **merchant** is an organization that issues and accepts credits (identified by
a `merchantId`). A **user** is an end customer that holds a wallet with a
merchant (identified by a `userId`). The combination of `merchantId` + `userId`
uniquely identifies a single wallet.

## Exchange rate

The exchange rate defines how many credits correspond to one unit of real
currency for a given merchant. Only admin accounts can create or update an
exchange rate, and the value must be between 0 and 500. Non-admin accounts can
only read their own merchant's exchange rate.

## Wallet logs

Every operation that changes a wallet balance (top-ups, transfers, resets)
produces a wallet log entry. Logs are immutable, timestamped, and can be listed
with pagination and filtered by user, merchant, date range, or log id. Use wallet
logs to audit how a balance reached its current value.
