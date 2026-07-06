# Wallet FAQ

## How do transfers work?

A transfer moves credits from a source wallet to a destination wallet in a single
atomic operation. You must provide the source `merchantId`/`userId`, the
destination `merchantId`/`userId`, the amount of credits, and a description for
both sides of the transfer. If the source wallet does not have enough credits,
the transfer is rejected and no balances change.

## Can a balance go negative?

No. Credit balances are always zero or positive. Any operation that would push a
balance below zero is rejected.

## How do I top up a wallet?

Updating a wallet adds the requested number of credits to the user's balance for
that merchant and records the reason in the wallet log via the provided
description.

## What does resetting wallets do?

A reset sets the balance of one or more users (for a given merchant) to a fixed
number of credits. This is typically used for promotional campaigns or to correct
balances in bulk. Every affected wallet gets a log entry describing the reset.

## Refund policy

Refunds are performed as a transfer of credits back from the merchant to the
user, or by topping up the user's wallet with the refunded amount. Always include
a clear description so the refund is traceable in the wallet logs.

## Who can change the exchange rate?

Only admin accounts can create or update an exchange rate. Regular merchant
accounts can read their own rate but cannot modify it. Valid exchange-rate values
range from 0 to 500.
