# VELT Platform Foundation

**Product:** VELT  
**Technology owner:** Suppple Group Plc  
**Source:** fork of GizzZmo/Cassanova  
**Implementation branch:** `feature/velt-platform-foundation`

## Current implementation status

This repository is an inherited demonstration casino application. Its existing screens and API must not be interpreted as evidence of a production-ready gambling operator, wallet, payment service or certified game platform.

### Security controls applied in this foundation branch

- Deposit submission now creates a **pending request only**. It does not credit the user's balance.
- A pending deposit is not treated as proof of payment. Balance crediting is reserved for a future provider callback with signature verification, idempotency, reconciliation and an auditable settlement record.
- Withdrawals fail closed until payout execution, balance reservation, provider callbacks, reversals and reconciliation are implemented.
- The deposit interface explicitly tells users that no payment provider is connected and that no funds are charged or credited.

## Target architecture

1. **Experience layer:** VELT web application, responsive game lobby, account, cashier and responsible-gaming interfaces.
2. **Identity and access:** secure sessions, verified email, MFA, role-based access control, admin audit trail and account-risk controls.
3. **Wallet and ledger:** integer minor-unit amounts, immutable double-entry ledger, idempotency keys, transactional posting, reconciliation and explicit pending/settled/reversed states.
4. **Payments:** provider adapters with signed webhook verification, replay protection, provider reference uniqueness, settlement reconciliation and payout controls.
5. **Game platform:** server-authoritative game sessions, provider adapters, round lifecycle, recorded outcomes, configurable limits and independently testable game mathematics.
6. **Compliance control plane:** jurisdiction allow/deny rules, product permissions, age and identity verification, AML controls, geolocation where legally required, self-exclusion, limits and operator licence evidence.
7. **Operations:** structured logs, monitoring, alerting, incident response, backups, disaster recovery and release approvals.

## Non-negotiable release gates

- No real-money play until the operator, product and target jurisdiction are legally authorised and the controls are independently reviewed.
- No balance credit from a client request, browser redirect or unverified webhook.
- No withdrawal without reserved funds, verified beneficiary, approval policy and reconciled provider settlement.
- No game advertised as playable until the game engine or licensed provider launch flow is implemented and tested end to end.
- No RTP, fairness, certification or provider partnership claims without documentary evidence.
- All wallet and game-round writes must be idempotent and auditable.
- CI must include backend tests, frontend lint/build, security checks and integration tests.

## Next engineering sequence

1. Replace the mutable user balance model with a ledger-backed wallet and migration plan.
2. Add payment-provider interfaces and a signed, replay-protected webhook pipeline; keep adapters disabled until credentials and commercial agreements exist.
3. Implement RBAC and enforce administrator permissions on every management endpoint.
4. Build VELT Originals in practice mode first, beginning with deterministic test harnesses and server-side outcome generation.
5. Build jurisdiction-aware launch controls and responsible-gaming enforcement.
6. Add integration, concurrency, abuse and security tests; deploy only after all release gates pass.

## Known gaps not yet resolved

- MongoDB document balance is still the legacy balance source; a double-entry ledger has not yet been implemented.
- No live PSP or payout integration is configured.
- No production game provider adapter or certified game engine is configured.
- The existing game detail page still requires a real launch/session flow.
- The legacy user balance remains present and is not yet reconciled against the new ledger; the ledger is not yet the production wallet source.
- Browser token storage, distributed rate limiting, trusted-proxy configuration, secrets management, KYC workflows and a full security review remain outstanding.
- No successful build or test run is claimed by this document.


## Progress update — engineering phase 2

### Implemented in the feature branch

- Added multi-currency ledger account and immutable journal-entry models.
- Added a transaction-based double-entry transfer service using integer minor units, exact debit/credit balancing, account-state checks, insufficient-funds checks and idempotency-key conflict detection.
- Added unit tests for journal balance invariants using Node's built-in test runner.
- Added provider-neutral payment and game-provider adapter contracts. Provider registries are intentionally empty; no live integration is represented.
- Added a deduplicated payment-event inbox model. This is storage infrastructure, not a live webhook or settlement integration.
- Added a jurisdiction-policy model defaulting to disabled.
- Added player/support/compliance/admin roles and enforced admin-only access for game and promotion creation.
- Removed the hardcoded JWT fallback. Login and authenticated requests fail closed when `JWT_SECRET` is not configured.
- Restricted browser CORS origins to the configured allowlist.
- Added a VELT Originals Dice practice endpoint and frontend page. Outcomes are generated server-side with Node's cryptographic random integer generator and stored as practice rounds. There are no wagers, wallet debits or prizes.

### Important constraints

- The ledger service requires MongoDB transaction support (replica set or compatible managed cluster). It is not yet wired as the authoritative replacement for the legacy `User.balance` field.
- There is no PSP webhook endpoint, provider signature verification, settlement posting or payout integration yet.
- There is no third-party game provider configured.
- The Dice practice mechanic is not independently certified and must not be offered for real-money play.
- Jurisdiction policy and real-money denial controls are foundations only; trusted geolocation, licence evidence and complete KYC/AML enforcement remain to be integrated.
- Existing accounts default to the `player` role. Administrator provisioning must be handled through a controlled operational process, not public registration.


## Progress update — engineering phase 3

- Added baseline HTTP security headers and disabled Express's identifying `X-Powered-By` header.
- Limited JSON and URL-encoded request bodies to 1 MB.
- Added a per-IP authentication-route rate limiter with 15-minute windows and standard rate-limit response headers.
- The limiter is intentionally process-local. It is suitable only as an interim control for a single API instance; production horizontal scaling requires a shared rate-limit store and deliberate trusted-proxy configuration.
- These controls do not replace a full security assessment, WAF/edge protection, distributed abuse detection, or secure deployment configuration.


### Phase 3 validation coverage

- Added automated tests for the interim rate limiter's allow/block behavior and the baseline response security headers.
- The rate limiter is process-local and resets on process restart. Do not rely on it as the sole production abuse-control mechanism.


## Delivery update — wallet, settlement and Originals

### Wallet migration and ledger

- Ledger posting now applies accounting normal-balance rules: asset accounts increase on debit; player-wallet and bonus liabilities increase on credit.
- Added an immutable per-player migration snapshot and an idempotent migration service for legacy cash and bonus balances.
- Added `npm run migrate:wallets`. It requires an explicit `LEGACY_BALANCE_CURRENCY`; without `--apply` it performs a dry run. With `--apply`, it posts opening entries into the ledger and records a per-user snapshot.
- Added a controlled `WALLET_LEDGER_READS_ENABLED` cutover. Do not enable it until the migration report has been reviewed and balances reconciled.
- Migration creates a migration-clearing asset account. This is a reconciliation suspense balance, not proof of safeguarded cash. Reconcile it against bank/payment statements before enabling withdrawals or wagering.
- The migration has not been executed against a production database in this environment. The dry-run mode is read-only; apply mode must be run during a wallet-write freeze with a verified backup.

### Payment settlement

- Added a raw-body webhook endpoint, HMAC-SHA256 signature verification, timestamp tolerance, payload fingerprinting, provider-event deduplication and idempotent ledger posting.
- Added payment-intent and settlement event records, with settlement, failure, refund and reversal handling.
- The HMAC adapter defines a VELT canonical gateway contract. It is not an adapter for a named PSP. A provider-backed deposit-intent route and admin reconciliation exception report are present, but the deposit-intent route remains behind the fail-closed real-money authorisation middleware. No provider API credentials or provider-specific webhook specification have been supplied, so actual deposit-intent creation and payouts remain unconnected.
- Full and partial refunds are supported against the remaining settled intent amount. Refunds that cannot be debited from the player's available wallet are held for reconciliation rather than silently creating a negative balance.

### VELT Originals

- Added practice-mode Dice, Mines (5x5), Plinko (8 rows) and Crash endpoints, plus round history.
- Server-side outcomes use Node cryptographic randomness. Mines hides its board until picks are made; Plinko uses an eight-row binomial distribution with 99% theoretical return; Crash uses a capped 99% theoretical-return distribution.
- Added a four-game frontend at `/originals`.
- All four games remain non-monetary practice games. The probability models are implementation estimates and require independent RNG/game-math certification before any real-money deployment.

### Release blockers

- No real PSP is integrated; no deposit API or payout API is configured.
- No production wallet migration has been run or reconciled.
- No jurisdictional licence evidence, geolocation provider, KYC/AML integration, self-exclusion enforcement, age verification, limits enforcement or independent game certification has been verified.
- South African remote interactive casino gaming is not enabled by this change. Jurisdiction and product authorisation must be established before any real-money switch is considered.


- Dice now uses an over/under target mechanic on a 0.00–99.99 scale with server-generated rolls and a 1% theoretical house edge.
- The consolidated practice interface is available at `/originals`; the standalone Dice page remains at `/originals/dice`.


- The provider event inbox records verified callbacks and retries incomplete processing idempotently. Provider settlement statements and bank files still need an operational reconciliation process.
- Withdrawals and wagering are deliberately not activated. The payout adapter contract exists, but no payout provider, payout status callback, or licensed wagering flow is connected.


## VELT Arcade and provider API integration

- Added `/arcade` with a self-contained Snake game (Easy, Hard and Expert speed profiles) and Klondike Solitaire (Draw 1 and Draw 3). These are original implementations, free-to-play, with no wallet or prize integration.
- Added Casino, Arcade and Originals navigation links and updated the global metadata to VELT.
- Added a Flutterwave v3 adapter for hosted Standard checkout (`POST /v3/payments`), webhook secret-hash verification, server-to-server transaction verification (`GET /v3/transactions/:id/verify`), and bank-transfer payout initiation (`POST /v3/transfers`) using a provider beneficiary ID resolved through the Beneficiaries API.
- Flutterwave is registered only when `PAYMENT_PROVIDER_ID=flutterwave`, `FLW_SECRET_KEY` and `FLW_WEBHOOK_SECRET_HASH` are configured. The webhook route uses Flutterwave's documented `verif-hash` header.
- Amount conversion is explicitly limited to configured two-decimal currencies: ZAR, NGN, GHS, KES, TZS, USD, GBP and EUR. Other currencies fail closed pending an explicit minor-unit map.
- The payout adapter is an API integration primitive, not a complete withdrawal product. Beneficiary ownership, KYC/AML, payout approval, wallet reservation/debit, transfer callback reconciliation, provider account enablement and jurisdiction authorization remain release gates.
- The adapter requires real Flutterwave test/live credentials and merchant onboarding. No credentials have been supplied and no external payment or payout has been initiated.


## Expanded payment, compliance and fairness workstream (November 2026)

### PSPs
- Added Paystack adapter for server-side transaction initialization, transaction verification, raw-body HMAC-SHA512 webhook validation, timestamped `Paystack-Signature` validation using a dedicated webhook secret, transfer-recipient creation and transfer submission.
- Paystack transfer callbacks are verified against the Transfer Verify API before payout settlement. Supported recipient types are deliberately limited to NGN/NUBAN, GHS/GHIPSS and ZAR/BASA in this adapter.
- Flutterwave beneficiary creation now uses the v3 Beneficiaries API and returns the provider-resolved beneficiary name. Transfer execution fetches the stored beneficiary and uses its returned bank code and account details.
- Provider webhooks are routed independently at `/api/payments/webhooks/flutterwave` and `/api/payments/webhooks/paystack`; default deposit provider selection remains `PAYMENT_PROVIDER_ID`.
- Paystack and Flutterwave have test modes. No sandbox keys have been supplied and no provider API call has been executed from this environment.

### Withdrawal lifecycle
- Added verified beneficiary storage with provider reference hidden from normal model projections.
- Beneficiary creation requires KYC approval and AML clearance, provider account-name resolution, and a strict match to the player's verified legal name.
- Withdrawal requests reserve funds by double-entry posting from player wallet liability to withdrawal liability.
- Independent admin approval enforces maker-checker separation; the requester cannot approve their own payout.
- Provider submission creates a payout instruction. Final success/failure callbacks are verified server-to-server and reconciled idempotently. Failed payouts release reserved funds back to the player's wallet; successful payouts reduce withdrawal liability and payment clearing.
- Ambiguous provider submission outcomes are held in `review` and must be reconciled before any retry. No blind payout retry is permitted.
- Payout callback settlement and bank reconciliation still require live/sandbox end-to-end tests and finance sign-off.

### KYC, AML and jurisdiction
- Added Sumsub signed API client, applicant creation, short-lived WebSDK access tokens, HMAC-signed raw-body webhook verification and timestamp-ordered applicant review updates.
- Sumsub KYC GREEN does not automatically clear AML. AML rechecks and explicit compliance-officer dispositions are separately recorded in an immutable compliance decision log.
- Real-money payment/withdrawal routes use a fail-closed eligibility gate requiring KYC verified, AML clear, 18+, no active self-exclusion, trusted geolocation, and an enabled jurisdiction policy for the named operator and casino product.
- Geolocation is delegated to a configured trusted service with an explicit response contract; no client-supplied country headers are trusted. This endpoint, token, and operator policy must be provisioned and tested before any market is enabled.
- Sumsub and geolocation provider credentials are not present. KYC/AML and jurisdiction flows are implemented as integration paths but not operationally activated.

### Wallet migration and reconciliation
- Added a read-only per-user reconciliation command: `npm run reconcile:wallets`.
- It compares legacy cash/bonus balances, migration snapshots and per-user ledger wallet/bonus balances; exits non-zero on mismatch.
- `WALLET_LEDGER_READS_ENABLED` remains false. Migration must be run with explicit currency, backup, dry-run review, applied opening journals, reconciliation and Finance sign-off before enabling ledger reads or any wagering.

### Game fairness and certification
- Added HMAC-SHA256 counter-mode commit/reveal entropy for practice Dice, Mines, Plinko and Crash rounds, persisting algorithm version, client seed, nonce, server-seed commitment and practice seed reveal.
- Added unit tests for commitment verification, bounded integer generation and Paystack webhook signatures.
- Internal math tests are not independent certification. RNG/game mathematics certification by an accredited test laboratory, game-specific RTP/house-edge approval, operational controls and jurisdiction approval remain mandatory before real-money release.
