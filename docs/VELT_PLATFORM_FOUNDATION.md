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
- Existing JWT, browser token storage, CORS, admin authorisation, secrets management and KYC workflows require a full security review.
- No successful build or test run is claimed by this document.
