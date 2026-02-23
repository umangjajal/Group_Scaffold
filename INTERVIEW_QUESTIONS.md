# Realtime Group App Interview Question Bank

This file contains a comprehensive set of interview questions for the `realtime_group_app_scaffold` project.  
Each primary question includes sub-questions for deeper evaluation.

## 1. System Design and Architecture

### 1.1 Explain the end-to-end flow for a user sending a group message.
- Which frontend component starts the action?
- Which socket event is emitted and where is it handled?
- How is membership validated before persistence?
- How is the response broadcast back to group members?
- What can fail at each layer and how should it be surfaced?

### 1.2 Why does this project use both REST and Socket.IO?
- Which operations are better suited to REST and why?
- Which operations require low-latency pub/sub behavior?
- How do you keep REST and socket state consistent?
- What anti-patterns happen when everything is put in sockets?

### 1.3 Describe the main bounded contexts in this app.
- How do you separate auth, group management, chat, collaboration, calls, and admin?
- Which models belong to each context?
- Where do context boundaries currently leak?
- How would you refactor module ownership for long-term growth?

### 1.4 What data is persisted vs kept in memory?
- Which states are in MongoDB?
- Which states are currently stored in process memory maps?
- What breaks when you scale to multiple backend instances?
- Which in-memory states should move to Redis first?

### 1.5 If you had to draw the architecture diagram, what are the critical components?
- Which frontend pages map to which backend routes/events?
- Where do auth and authorization checks happen?
- Which services are external dependencies (SMTP, Twilio, Docker, Git)?
- Where are the biggest single points of failure?

## 2. Authentication, Identity, and Session Security

### 2.1 Walk through the access token and refresh token lifecycle.
- How are tokens issued on login/register?
- How does the frontend interceptor handle 401 responses?
- What are the risks of storing tokens in localStorage?
- How would you migrate to safer token storage?

### 2.2 Evaluate the JWT middleware.
- How is `Bearer` token parsing handled?
- What claims are trusted from JWT vs re-fetched from DB?
- How do you handle token revocation?
- How would you add device/session-level invalidation?

### 2.3 How is role-based access enforced for admin routes?
- Where is `requireRole` applied?
- What happens if an admin token is used by a suspended user?
- How would you enforce least privilege for admin actions?
- How would you audit sensitive admin operations?

### 2.4 Explain OTP verification and forgot-password flows.
- How are OTP codes generated and stored?
- How is expiration enforced?
- How is OTP replay prevented?
- What abuse protections are missing?

### 2.5 What security issues exist in default admin bootstrap logic?
- Why is creating a predictable default admin credential risky?
- What should happen in production environments?
- How would you implement one-time bootstrap securely?
- How do you detect if bootstrap was tampered with?

### 2.6 How would you harden authentication for production?
- Add login rate limiting by IP and account?
- Add account lockouts and cooldown windows?
- Add MFA for admin roles?
- Add anomaly detection for impossible travel/session hijacking?

## 3. Authorization, Plans, and Group Membership

### 3.1 Explain plan-gated constraints in this app.
- Where are create/join limits enforced?
- How are limits derived from `Plan.js`?
- Why does returning HTTP 402 have tradeoffs?
- How would you make plan limits dynamic without redeploy?

### 3.2 How do you enforce group membership before data access?
- Which routes call membership checks?
- Which socket events validate membership?
- Where are gaps that could allow unauthorized room joins?
- How would you centralize authorization policy?

### 3.3 Evaluate private room code join flow.
- How is room code generated?
- Is 6-digit entropy enough for public internet exposure?
- What protections exist against brute force attempts?
- How would you add code expiration/rotation?

### 3.4 Discuss role handling inside a group.
- How are `member`, `moderator`, and `owner` roles used?
- Which operations require elevated group roles?
- Where should permission checks be added for collab edits?
- How would you implement per-file ACL enforcement?

### 3.5 How would you handle plan downgrade edge cases?
- What if a user exceeds new limits after downgrade?
- How do you preserve access without breaking data?
- What should be blocked immediately vs gradually?
- How would you communicate policy decisions in API responses?

## 4. Data Modeling and Consistency (MongoDB/Mongoose)

### 4.1 Explain key model relationships.
- How do `User`, `Group`, `Membership`, and `Message` connect?
- How do collaboration models relate to group and user?
- Which relations should be embedded vs referenced?
- Which queries are currently N+1 prone?

### 4.2 Evaluate unique index usage and race conditions.
- Where are unique constraints declared?
- What happens on concurrent creates for same membership/file name?
- How do you handle duplicate key errors gracefully?
- Should any operations be wrapped in transactions?

### 4.3 Assess denormalized counters like `memberCount`.
- Why can this value drift from actual memberships?
- Which operations mutate it?
- How would you repair and monitor drift?
- Would you keep it denormalized or compute on demand?

### 4.4 Review quota data keyed by YYYY-MM-DD.
- What timezone assumptions are implicit?
- How can users near midnight be affected?
- How would you make quota windows timezone-safe?
- What schema changes are needed for hourly quotas?

### 4.5 Discuss growth and retention for `CollabVersion` and `ActivityLog`.
- How fast can snapshots grow under frequent edits?
- What indexing strategy is required for history retrieval?
- How would you archive old versions/logs?
- How do you balance auditability vs storage cost?

### 4.6 Where should transactions be introduced first?
- Group creation + owner membership write?
- Membership add/remove + counter update?
- Version restore + log creation?
- Call session end + quota increments for participants?

## 5. Realtime Messaging and Presence

### 5.1 Explain the socket flow for `message:send`.
- Which validations happen before message insert?
- How are daily quotas checked and incremented?
- How is event payload shaped for clients?
- How do you make this flow idempotent?

### 5.2 How would you prevent duplicate message delivery?
- Can reconnects cause duplicated emits?
- Should server assign client-generated dedupe keys?
- How does client-side reconciliation work?
- What test cases prove correctness?

### 5.3 Evaluate presence tracking.
- How are online users tracked for admin dashboard?
- What happens with multiple tabs/devices per user?
- How is `lastSeen` updated today?
- How would you make presence accurate in distributed deployments?

### 5.4 Discuss typing/read receipts design.
- Are these events reliable or best effort?
- How do you avoid noisy broadcast traffic?
- How do you avoid read status races?
- What privacy settings might be required?

### 5.5 What are abuse and spam risks in realtime chat?
- Message flood and bot behavior?
- Mention spam?
- Profanity/moderation pipeline?
- How would you add adaptive throttling by risk score?

## 6. Collaboration Engine (Files, Patches, Versions, Comments)

### 6.1 Explain current text patch strategy.
- How does delta `{from,to,text}` apply to content?
- Why can full-text replacement be expensive?
- What conflict issues appear with concurrent edits?
- How would you evolve this toward OT or CRDT?

### 6.2 How is spreadsheet cell locking handled?
- Where are locks stored and how long do they last?
- What happens if lock owner disconnects unexpectedly?
- How do you avoid stale lock denial?
- How would you persist locks for multi-instance safety?

### 6.3 Walk through file version creation.
- When is `latestVersion` incremented?
- How are parent version and branch tracked?
- What can go wrong if two patches arrive simultaneously?
- How would optimistic concurrency be added?

### 6.4 Evaluate restore-from-version behavior.
- How is restored state written to file content?
- How is restore lineage represented?
- Can restore operations race with active patches?
- How would you prevent accidental destructive restores?

### 6.5 Discuss comments and mention notifications.
- How are mention user IDs extracted in frontend?
- What validation should backend apply to mentions?
- How are notifications persisted and pushed?
- How would you add unread counts efficiently?

### 6.6 What is missing for per-file authorization?
- Are editors/viewers permissions enforced today?
- How would you gate edit vs comment vs read operations?
- How do you map group roles to file permissions?
- How would you expose this in API and socket contracts?

### 6.7 How would you scale high-frequency patch traffic?
- Event coalescing and debounce on client?
- Server-side batching windows?
- Snapshot checkpoints vs operation logs?
- Backpressure strategy when clients lag?

### 6.8 How would you test realtime collaboration correctness?
- Two clients editing same range simultaneously?
- Out-of-order event delivery?
- Reconnect and snapshot rehydration?
- Long-running session memory leak checks?

## 7. File Upload, Binary Handling, and Content Safety

### 7.1 Explain upload validation design.
- How are allowed extensions enforced?
- Why check MIME in addition to extension?
- What payload size limits are active?
- What bypass attempts should be tested?

### 7.2 Discuss binary vs text storage approach.
- Why are some files stored as text content and some metadata-only?
- What are tradeoffs of storing content in MongoDB?
- When should object storage be introduced?
- How do you support large files and streaming upload?

### 7.3 How would you protect against malicious uploads?
- Add antivirus scanning?
- Add content disarm and reconstruction?
- Add extension spoofing detection?
- Add quarantine and moderation workflow?

## 8. Terminal and Code Execution Security

### 8.1 Evaluate integrated terminal (`node-pty`) design.
- What are the risks of exposing host shell over socket?
- How should command scope and working directory be restricted?
- How do you isolate sessions per user/group?
- What audit logs are required?

### 8.2 Explain Docker-based code run endpoint.
- Which controls are already present (cpu, memory, timeout, no network)?
- Which controls are still missing (seccomp, readonly fs, user remap)?
- How would you prevent container escape impact?
- How would you support multiple languages safely?

### 8.3 What failure modes should this endpoint handle?
- Docker binary missing?
- Timeout and max buffer exceeded?
- OOM kill?
- Image pull latency or untrusted image mutation?

### 8.4 How would you meter and bill code execution usage?
- What usage units should be tracked?
- How do you attach usage to plan limits?
- How to avoid quota bypass via retries?
- What reports should admin see?

## 9. Git Integration and Supply Chain Risk

### 9.1 Walk through `/collab/git/push` flow.
- Why is membership role checked before push?
- What risks exist with `git add .` on server repo?
- How do you avoid committing unrelated server files?
- How would you isolate per-group repositories?

### 9.2 How would you secure automated git push?
- Enforce branch allowlist?
- Sign commits with bot identity?
- Protect against malicious commit messages?
- Add dry-run and pre-push policy checks?

### 9.3 What observability is needed around git operations?
- Which logs are security-sensitive?
- Which metrics indicate failure trends?
- How should transient network errors be retried?
- How do you expose actionable error messages to user?

## 10. WebRTC Calling and Random Matching

### 10.1 Describe call session lifecycle.
- How is a call requested, accepted, and ended?
- What statuses exist in `CallSession`?
- How is duration calculated?
- How are quotas incremented for participants?

### 10.2 Evaluate signaling event contract consistency.
- Are frontend emitted events aligned with backend listeners?
- How would you detect contract drift automatically?
- Should event payloads be schema-validated?
- How do you version socket event contracts?

### 10.3 Discuss call quota enforcement.
- Where is quota checked before call start?
- Is quota re-checked during long calls?
- Could users exceed limits by concurrent sessions?
- How would you enforce hard real-time cutoffs?

### 10.4 Analyze random match queue strategy.
- Why FIFO is simple but limited?
- How do you handle disconnected sockets in queue?
- How would you match by filters safely?
- How do you prevent abuse and repeated same-user matching?

### 10.5 P2P vs SFU tradeoffs for this app.
- At what participant count should mode switch?
- How does plan tier influence routing mode?
- What infra is required for SFU rollout?
- How do bandwidth/cost/quality tradeoffs change?

### 10.6 Anonymous call mode privacy questions.
- What metadata is still visible to server?
- How long should match data be retained?
- How do you support abuse reporting while preserving anonymity?
- How do you prevent deanonymization in logs?

### 10.7 What happens on disconnect mid-call?
- How do peers learn remote left?
- How do you avoid orphaned active sessions?
- How should reconnect within grace period behave?
- How do you finalize duration and quota reliably?

## 11. Frontend Architecture, State, and UX

### 11.1 Review auth state management in `AuthContext`.
- What source of truth is used for user data?
- How do token refresh and context sync interact?
- What edge cases happen on stale localStorage values?
- How would you centralize auth state updates?

### 11.2 Evaluate API client interceptor logic.
- How are retries prevented from looping forever?
- What happens when multiple requests fail 401 simultaneously?
- How would you implement a refresh request queue?
- How do you preserve original request bodies safely?

### 11.3 Assess socket management across pages.
- Where are dedicated sockets created vs shared singleton socket?
- What issues can come from multiple concurrent socket connections?
- How do you ensure proper listener cleanup?
- How would you standardize socket usage across features?

### 11.4 Collaboration page state handling.
- Which states are server-owned vs UI-owned?
- How can rapid patch updates cause stale closures?
- How would you split this large page into reusable hooks/components?
- How do you avoid over-rendering on high-frequency events?

### 11.5 Accessibility and usability gaps.
- Keyboard accessibility across critical actions?
- Error messaging clarity and recovery paths?
- Mobile behavior for terminal and collaboration editor?
- Internationalization and locale-safe formatting?

### 11.6 Frontend security questions.
- Risks of rendering unsanitized content from messages/comments?
- How to prevent XSS in rich text/comment features?
- How to protect against clickjacking and mixed content?
- How to manage CSP with CDN-loaded scripts?

## 12. Performance, Scalability, and Reliability

### 12.1 What changes are required for horizontal socket scaling?
- Why is Redis adapter needed for Socket.IO?
- Which events break without shared pub/sub?
- How do you deploy sticky sessions with load balancers?
- How do you validate cross-instance event delivery?

### 12.2 Identify likely memory leak points.
- In-memory maps for cursors, locks, tasks, queues, online users?
- Are cleanup paths complete on disconnect/error?
- How would you add periodic TTL sweeps?
- Which metrics help detect leaks early?

### 12.3 Database indexing and query performance.
- Which high-volume queries need explicit indexes?
- How to verify index usage with explain plans?
- What write amplification comes from snapshot versioning?
- How would you partition/archive large collections?

### 12.4 Reliability patterns for critical flows.
- Where should idempotency keys be added?
- Which operations need retry with backoff?
- How do you avoid duplicate side effects on retries?
- What failure modes need circuit breakers?

### 12.5 Backpressure and event storm handling.
- How do you protect server from client flood events?
- How do you cap per-socket event rates?
- How do you degrade gracefully under overload?
- What user-facing behavior should occur when throttled?

## 13. Security Deep Dive

### 13.1 Evaluate CORS and origin validation strategy.
- How are allowed origins parsed?
- How do you safely support multiple environments?
- What are risks of misconfigured wildcard origins?
- How do you test CORS behavior in CI?

### 13.2 Sensitive data exposure review.
- Are error messages leaking internals?
- Are JWT payload fields minimal and safe?
- Are logs storing PII or secrets?
- How do you classify and redact logs by policy?

### 13.3 Endpoint abuse hardening.
- Where are route-level limits applied today?
- Which endpoints lack rate limiting?
- How would you protect OTP, login, and join-by-code routes?
- How would you add IP/device fingerprint signals?

### 13.4 Dependency and runtime hardening.
- How do you handle vulnerable package alerts?
- What Node runtime flags/policies should be enabled?
- How do you pin and verify Docker base images?
- How do you secure CI/CD secrets and deployment credentials?

## 14. Testing Strategy

### 14.1 What unit tests are highest priority first?
- Auth helpers (name/phone validation)?
- Delta application logic?
- Plan gate calculations?
- Permission checks?

### 14.2 Integration tests for REST APIs.
- Auth register/login/refresh flow?
- Group create/join and role checks?
- Collaboration file lifecycle?
- Git push and code-run failure handling?

### 14.3 Realtime contract tests.
- Message send/receive with quota boundaries?
- Collaboration patch order and snapshot sync?
- Call signaling and session status transitions?
- Notification delivery and mark-read behavior?

### 14.4 End-to-end tests.
- New user onboarding through first message?
- Creating private room and joining by code?
- Collaborative editing between two browser sessions?
- Admin moderation actions affecting user experience?

### 14.5 Non-functional test strategy.
- Load test targets (concurrent sockets, patch throughput)?
- Soak tests for memory growth?
- Chaos tests for DB/socket interruptions?
- Security tests (auth bypass, injection, brute force)?

## 15. Observability and Operations

### 15.1 What should be logged at info/warn/error levels?
- Which events are high-value for incident triage?
- Which logs should include correlation IDs?
- How do you avoid log noise from expected disconnects?
- How do you structure logs for searchability?

### 15.2 Metrics and dashboards for this app.
- Core SLOs for API latency and socket delivery?
- Business metrics (DAU, messages/day, call minutes)?
- Collaboration metrics (patch rate, restore actions)?
- Alert thresholds and on-call runbooks?

### 15.3 Incident response scenario.
- API healthy but socket events delayed: how do you diagnose?
- Collaboration writes succeed but history query is slow: where do you look?
- OTP provider outage: what graceful fallback exists?
- Git push failures spike: how do you contain impact quickly?

### 15.4 Backup and recovery.
- Which collections require point-in-time recovery?
- How do you restore without breaking referential integrity?
- How do you validate recovery drills?
- What RPO/RTO targets are realistic?

## 16. Debugging and Scenario-Based Questions

### 16.1 Messages appear in sender UI but not other members.
- Which joins/rooms/events do you verify first?
- How do you confirm membership and room subscription state?
- Which server logs/metrics isolate the break?
- How would you reproduce with automated tests?

### 16.2 Collaboration history shows duplicate or skipped versions.
- Which increment/write operations are race-prone?
- How do you prove race existence in logs?
- Would optimistic lock or transaction solve this?
- How would you migrate existing inconsistent records?

### 16.3 Random match users get stuck in waiting state.
- How can queue entries become stale?
- How do you handle disconnected sockets in queue?
- What visibility should queue health metrics provide?
- How would you redesign matcher for robustness?

### 16.4 Admin online count is incorrect.
- How do multiple sockets per user affect counts?
- How do server restarts affect in-memory state?
- How do you represent user online status in distributed mode?
- Should status be eventual or strongly consistent?

### 16.5 Git push endpoint starts committing sensitive files.
- What immediate containment action do you take?
- How do you rotate exposed secrets and clean git history?
- How do you redesign push scope to per-workspace allowlist?
- How do you add policy checks to block recurrence?

### 16.6 Terminal feature causes CPU spikes.
- How do you identify abusive sessions quickly?
- What per-session process limits should be enforced?
- How do you force-stop runaway shells safely?
- How do you preserve forensic traces for investigation?

### 16.7 Refresh token loop causes repeated redirects.
- How do you detect concurrent refresh storms?
- How do you serialize refresh requests client-side?
- How do you fail closed without bad UX?
- What telemetry pinpoints root cause fast?

## 17. Project Ownership and Behavioral

### 17.1 If you owned this codebase for 6 months, what would you prioritize?
- Which technical debt has highest risk?
- Which metrics would define success?
- What would be your 30/60/90 day milestones?
- How would you balance features vs reliability work?

### 17.2 Describe a risky production change you would plan carefully.
- What is the rollback strategy?
- What canary signals must stay healthy?
- How do you communicate risk to stakeholders?
- What post-deploy validation is mandatory?

### 17.3 How do you run postmortems for incidents in this system?
- What timeline evidence do you gather?
- How do you separate root cause from contributing factors?
- How do you turn action items into tracked engineering work?
- How do you verify actions actually reduced risk?

### 17.4 How would you mentor a junior engineer on this codebase?
- Which modules are best onboarding entry points?
- Which coding standards are most important here?
- How would you review socket-heavy code effectively?
- How do you teach safe production thinking early?

### 17.5 How do you explain tradeoffs to non-engineering stakeholders?
- Latency vs cost tradeoffs for realtime features?
- Security hardening vs delivery speed tradeoffs?
- Reliability investment vs new feature roadmap?
- How do you communicate uncertainty honestly?

## 18. Practical Hands-On Interview Tasks

### 18.1 Implement idempotent message sending.
- Add a client-generated message UUID.
- Reject duplicate UUIDs per sender/group in a short window.
- Keep UX optimistic while preventing duplicates.
- Add tests proving idempotent behavior.

### 18.2 Add durable collaboration presence with Redis.
- Replace in-memory cursor/presence maps.
- Add TTL-based cleanup.
- Keep event behavior unchanged for clients.
- Add integration test for multi-instance broadcast.

### 18.3 Harden `/collab/code/run`.
- Run container as non-root.
- Add readonly filesystem and seccomp profile.
- Block dangerous runtime flags.
- Add security-focused test cases.

### 18.4 Fix and standardize call signaling contracts.
- Define one event schema for offer/answer/candidate.
- Update frontend and backend to same contract.
- Add runtime payload validation.
- Add compatibility strategy for old clients.

### 18.5 Add per-file ACL enforcement.
- Enforce viewers vs editors in route and socket handlers.
- Add owner/moderator overrides.
- Add API endpoint to manage ACL entries.
- Add tests for unauthorized edit attempts.

### 18.6 Add test coverage for restore race conditions.
- Simulate concurrent patch and restore calls.
- Verify version monotonicity.
- Ensure audit logs remain coherent.
- Add mitigation with optimistic concurrency control.

