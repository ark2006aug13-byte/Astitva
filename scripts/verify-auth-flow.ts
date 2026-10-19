import http from 'http';
import { app } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { encryptForVault, decryptFromVault } from '../src/lib/security/vault-crypto';
import { validateResumeBuffer } from '../src/lib/security/file-validator';

// ANSI Colors for output formatting
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;
const cyan = (s: string) => `\x1b[36m${s}\x1b[0m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(red(`❌ ASSERTION FAILED: ${message}`));
    throw new Error(message);
  }
  console.log(green(`  ✔ ${message}`));
}

async function runVerification() {
  console.log(bold(cyan('\n========================================================================')));
  console.log(bold(cyan('🧪 SentinelApply Step A1 & A2 End-to-End Verification Suite')));
  console.log(bold(cyan('========================================================================\n')));

  // Clean test tables to ensure a clean slate before test
  // (Preserving schema, removing any previous test runs)
  await prisma.securityAuditLog.deleteMany({});
  await prisma.refreshTokenSession.deleteMany({});
  await prisma.encryptedVaultItem.deleteMany({});
  await prisma.resume.deleteMany({});
  await prisma.guestResumeSession.deleteMany({});
  await prisma.otpVerification.deleteMany({});
  await prisma.user.deleteMany({});
  console.log(yellow('🧹 Database cleaned: zero mock records, clean state initialized.\n'));

  // 1. Start test server on dynamic port
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as { port: number };
  const baseUrl = `http://localhost:${address.port}/api/v1`;
  console.log(cyan(`📡 Test HTTP Server listening at ${baseUrl}\n`));

  try {
    // -------------------------------------------------------------------------
    // TEST 0: Cryptographic Vault AES-256-GCM Verification
    // -------------------------------------------------------------------------
    console.log(bold('👉 [Test 0] AES-256-GCM Vault Encryption & Decryption'));
    const secretSessionToken = JSON.stringify({
      portal: 'GREENHOUSE',
      sessionCookie: 'gh_sess_9a8b7c6d5e4f3a2b1c',
      expiresAt: '2026-12-31T23:59:59Z',
    });
    const encrypted = encryptForVault(secretSessionToken);
    assert(!!encrypted.encryptedPayload, 'Encrypted payload generated');
    assert(encrypted.iv.length === 24, '12-byte IV generated (24 hex chars)');
    assert(encrypted.authTag.length === 32, '16-byte Auth Tag generated (32 hex chars)');

    const decrypted = decryptFromVault(encrypted);
    assert(decrypted === secretSessionToken, 'Decrypted vault payload matches original plaintext exactly');
    console.log(green('  ✔ AES-256-GCM authenticated vault verified.\n'));

    // -------------------------------------------------------------------------
    // TEST 1: File Validator - Magic Bytes Inspection
    // -------------------------------------------------------------------------
    console.log(bold('👉 [Test 1] Magic Byte & File Validator Verification'));
    // Valid PDF buffer (%PDF-1.4 ...)
    const validPdfBuffer = Buffer.from(
      '%PDF-1.4\n%âãÏÓ\n1 0 obj\n<< /Title (Aryan Raj - Full Stack & AI Agent Engineer) /Keywords (TypeScript, React, Node.js, Python, PostgreSQL, Docker, AWS) >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF',
      'utf-8'
    );
    const validResult = validateResumeBuffer(validPdfBuffer, 'Aryan_Raj_Resume.pdf', 'application/pdf');
    assert(validResult.isValid, 'Valid PDF buffer with %PDF- header accepted');
    assert(validResult.detectedMimeType === 'application/pdf', 'Correct MIME type detected');
    assert(!!validResult.sha256Hash, `SHA-256 Checksum: ${validResult.sha256Hash.substring(0, 16)}...`);

    // Invalid buffer (pretending to be PDF but actually an executable / script)
    const spoofedBuffer = Buffer.from('MZ\x90\x00\x03\x00\x00\x00 Fake Exe Payload', 'utf-8');
    const spoofedResult = validateResumeBuffer(spoofedBuffer, 'malicious.pdf', 'application/pdf');
    assert(!spoofedResult.isValid, 'Spoofed file correctly rejected by magic byte signature check');
    console.log(green('  ✔ Magic byte validator successfully guards against spoofing.\n'));

    // -------------------------------------------------------------------------
    // TEST 2: Step A1/A2 Hook - Upload Guest Resume (Unauthenticated)
    // -------------------------------------------------------------------------
    console.log(bold('👉 [Test 2] POST /api/v1/auth/guest-resume (Anonymous Upload)'));
    const guestUploadRes = await fetch(`${baseUrl}/auth/guest-resume`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName: 'Aryan_Raj_Resume.pdf',
        fileMimeType: 'application/pdf',
        fileBase64: validPdfBuffer.toString('base64'),
      }),
    });

    const guestUploadData = await guestUploadRes.json();
    assert(guestUploadRes.status === 201, `Status 201 Created (got ${guestUploadRes.status})`);
    assert(!!guestUploadData.guestToken, 'Signed guestToken issued');
    assert(guestUploadData.session.fileSha256Hash === validResult.sha256Hash, 'File SHA-256 hash verified');
    assert(guestUploadData.session.parseStatus === 'STAGED', 'Parse status is STAGED');
    assert(Array.isArray(guestUploadData.session.extractedSkillPreview.topSkills), 'Skill preview extracted topSkills');

    const guestToken = guestUploadData.guestToken;
    console.log(cyan(`  Staged Guest Token: ${guestToken.substring(0, 24)}...`));
    console.log(cyan(`  Extracted Skills Preview: ${guestUploadData.session.extractedSkillPreview.topSkills.join(', ')}`));
    console.log(green('  ✔ Guest Resume staging completed.\n'));

    // -------------------------------------------------------------------------
    // TEST 3: Step A1 - Phone Auth Step 1: Send OTP
    // -------------------------------------------------------------------------
    console.log(bold('👉 [Test 3] POST /api/v1/auth/otp/send'));
    const testPhone = '+919876543210';
    const sendOtpRes = await fetch(`${baseUrl}/auth/otp/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: testPhone }),
    });

    const sendOtpData = await sendOtpRes.json();
    assert(sendOtpRes.status === 200, `Status 200 OK (got ${sendOtpRes.status})`);
    assert(!!sendOtpData.devOtpPreview, `Captured devOtpPreview: ${sendOtpData.devOtpPreview}`);

    const devOtp = sendOtpData.devOtpPreview;
    console.log(green(`  ✔ OTP sent to ${testPhone} with dev OTP ${devOtp}\n`));

    // Verify OTP record in database is hashed (NOT plain text)
    const dbOtp = await prisma.otpVerification.findFirst({
      where: { phone: testPhone },
      orderBy: { createdAt: 'desc' },
    });
    assert(!!dbOtp, 'OTP Verification record created in DB');
    assert(dbOtp!.otpHash !== devOtp, 'Database stores HMAC-SHA256 hash, NEVER plain text');
    assert(dbOtp!.otpHash.length === 64, 'HMAC-SHA256 hex length is exactly 64 chars');
    console.log(green('  ✔ Stored OTP hash integrity verified.\n'));

    // -------------------------------------------------------------------------
    // TEST 4: Phone Auth Step 2 - Intentionally Wrong OTP (Brute-force counter)
    // -------------------------------------------------------------------------
    console.log(bold('👉 [Test 4] POST /api/v1/auth/otp/verify with WRONG OTP'));
    const wrongOtpRes = await fetch(`${baseUrl}/auth/otp/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: testPhone,
        otp: '000000',
        guestToken,
      }),
    });

    const wrongOtpData = await wrongOtpRes.json();
    assert(wrongOtpRes.status === 401, `Status 401 Unauthorized (got ${wrongOtpRes.status})`);
    assert(wrongOtpData.remainingAttempts === 4, `Remaining attempts correctly decremented to 4 (got ${wrongOtpData.remainingAttempts})`);

    const dbOtpAfterFail = await prisma.otpVerification.findUnique({
      where: { id: dbOtp!.id },
    });
    assert(dbOtpAfterFail?.attempts === 1, 'Database attempts counter incremented to 1');
    console.log(green('  ✔ Brute force protection & attempt counter verified.\n'));

    // -------------------------------------------------------------------------
    // TEST 5: Phone Auth Step 2 - Correct OTP + Atomic Guest Resume Claim
    // -------------------------------------------------------------------------
    console.log(bold('👉 [Test 5] POST /api/v1/auth/otp/verify with CORRECT OTP & Guest Token'));
    const verifyRes = await fetch(`${baseUrl}/auth/otp/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: testPhone,
        otp: devOtp,
        guestToken,
      }),
    });

    const verifyData = await verifyRes.json();
    assert(verifyRes.status === 200, `Status 200 OK (got ${verifyRes.status})`);
    assert(verifyData.success === true, 'Verification success true');
    assert(verifyData.resumeClaimed === true, 'Atomic guest resume handshake executed successfully');
    assert(verifyData.user.phoneVerified === true, 'user.phoneVerified is true');
    assert(
      verifyData.user.onboardingStep === 'A3_MASTER_PROFILE',
      `user.onboardingStep directly advanced to A3_MASTER_PROFILE (got ${verifyData.user.onboardingStep})`
    );
    assert(!!verifyData.accessToken, 'Access Token issued');
    assert(!!verifyData.refreshToken, 'Refresh Token issued');

    const accessToken = verifyData.accessToken;
    const refreshToken = verifyData.refreshToken;
    const userId = verifyData.user.id;
    console.log(green(`  ✔ Verified! User ID: ${userId}, Onboarding: ${verifyData.user.onboardingStep}\n`));

    // Verify in Database: Permanent Resume Record Created and linked to User
    const userResumes = await prisma.resume.findMany({
      where: { userId },
    });
    assert(userResumes.length === 1, `Permanent Resume table contains 1 record for user (got ${userResumes.length})`);
    assert(userResumes[0].isPrimary === true, 'Resume marked as isPrimary: true');
    assert(userResumes[0].fileSha256Hash === validResult.sha256Hash, 'Resume SHA-256 matches staged file');

    // Verify GuestResumeSession was marked claimed
    const guestSessionInDb = await prisma.guestResumeSession.findUnique({
      where: { id: guestUploadData.session.id },
    });
    assert(guestSessionInDb?.claimedByUserId === userId, 'GuestResumeSession.claimedByUserId matches user');
    console.log(green('  ✔ Atomic transaction & database persistence verified.\n'));

    // -------------------------------------------------------------------------
    // TEST 6: Protected Session Hydrator - GET /api/v1/auth/me
    // -------------------------------------------------------------------------
    console.log(bold('👉 [Test 6] GET /api/v1/auth/me (Protected Hydrator)'));
    const meRes = await fetch(`${baseUrl}/auth/me`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const meData = await meRes.json();
    assert(meRes.status === 200, `Status 200 OK (got ${meRes.status})`);
    assert(meData.user.id === userId, 'Hydrated user.id matches');
    assert(meData.user.agentMode === 'COPILOT', 'Default safety agentMode is COPILOT');
    assert(meData.user.autoApplyThreshold === 80, 'Default autoApplyThreshold is 80');
    assert(meData.user.dailyApplicationCap === 5, 'Default dailyApplicationCap is 5');
    assert(meData.user.killSwitchActive === false, 'killSwitchActive is false');
    assert(meData.resume !== null, 'Primary resume attached to user profile');
    assert(meData.resume.fileName === 'Aryan_Raj_Resume.pdf', 'Attached resume filename matches');
    assert(meData.security.activeSessionsCount >= 1, `Active sessions count: ${meData.security.activeSessionsCount}`);
    assert(meData.security.totalAuditEventsLogged >= 3, `Audit events logged: ${meData.security.totalAuditEventsLogged}`);

    console.log(cyan('\n--- Hydrated Session Dump ---'));
    console.log(JSON.stringify(meData, null, 2));
    console.log(green('  ✔ Session Hydrator verified.\n'));

    // -------------------------------------------------------------------------
    // TEST 7: Rotating Refresh Token - POST /api/v1/auth/refresh
    // -------------------------------------------------------------------------
    console.log(bold('👉 [Test 7] POST /api/v1/auth/refresh (Token Rotation)'));
    const refreshRes = await fetch(`${baseUrl}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    const refreshData = await refreshRes.json();
    assert(refreshRes.status === 200, `Status 200 OK (got ${refreshRes.status})`);
    assert(!!refreshData.accessToken, 'New Access Token rotated');
    assert(!!refreshData.refreshToken, 'New Refresh Token rotated');
    assert(refreshData.refreshToken !== refreshToken, 'New Refresh Token is distinct from old Refresh Token');

    // Try reusing the old refresh token (should be revoked)
    const replayRes = await fetch(`${baseUrl}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    assert(replayRes.status === 401, 'Replay of revoked refresh token rejected with 401');
    console.log(green('  ✔ Refresh token rotation & replay prevention verified.\n'));

    // -------------------------------------------------------------------------
    // TEST 8: Step A2 Skip - POST /api/v1/auth/resume/skip
    // -------------------------------------------------------------------------
    console.log(bold('👉 [Test 8] POST /api/v1/auth/resume/skip (Skip Option)'));
    // Create a secondary user without resume to test skip
    const user2Phone = '+919123456789';
    const sendRes2 = await fetch(`${baseUrl}/auth/otp/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: user2Phone }),
    });
    const sendData2 = await sendRes2.json();
    assert(sendRes2.status === 200, `OTP sent for secondary user (got ${sendRes2.status})`);
    const verifyUser2Res = await fetch(`${baseUrl}/auth/otp/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: user2Phone, otp: sendData2.devOtpPreview }),
    });
    const verifyUser2Data = await verifyUser2Res.json();
    assert(
      verifyUser2Data.user.onboardingStep === 'A2_RESUME',
      `User without resume staged lands in A2_RESUME (got ${verifyUser2Data.user.onboardingStep})`
    );

    // Call skip
    const skipRes = await fetch(`${baseUrl}/auth/resume/skip`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${verifyUser2Data.accessToken}`,
      },
    });
    const skipData = await skipRes.json();
    assert(skipRes.status === 200, 'Skip endpoint returned 200 OK');
    assert(skipData.onboardingStep === 'A3_MASTER_PROFILE', 'Onboarding step advanced to A3_MASTER_PROFILE');
    assert(skipData.resumePending === true, 'resumePending flagged as true');
    console.log(green('  ✔ Step A2 Resume skip capability verified.\n'));

    // -------------------------------------------------------------------------
    // TEST 9: Audit Trail Inspection
    // -------------------------------------------------------------------------
    console.log(bold('👉 [Test 9] Security Audit Trail Inspection'));
    const auditLogs = await prisma.securityAuditLog.findMany({
      orderBy: { createdAt: 'asc' },
    });
    console.log(cyan(`  Total Security Audit Events Recorded: ${auditLogs.length}`));
    auditLogs.forEach((log, idx) => {
      console.log(`    ${idx + 1}. [${log.eventType}] User: ${log.userId || 'Anonymous'} - Time: ${log.createdAt.toISOString()}`);
    });
    assert(auditLogs.some((l) => l.eventType === 'GUEST_RESUME_STAGED'), 'Audit trail includes GUEST_RESUME_STAGED');
    assert(auditLogs.some((l) => l.eventType === 'OTP_SENT'), 'Audit trail includes OTP_SENT');
    assert(auditLogs.some((l) => l.eventType === 'OTP_FAILED'), 'Audit trail includes OTP_FAILED');
    assert(auditLogs.some((l) => l.eventType === 'OTP_VERIFIED'), 'Audit trail includes OTP_VERIFIED');
    assert(auditLogs.some((l) => l.eventType === 'GUEST_RESUME_CLAIMED'), 'Audit trail includes GUEST_RESUME_CLAIMED');
    console.log(green('  ✔ Audit trail comprehensive & verified.\n'));

    console.log(bold(green('========================================================================')));
    console.log(bold(green('🎉 ALL VERIFICATION TESTS PASSED SUCCESSFULLY! ZERO ERRORS.')));
    console.log(bold(green('========================================================================\n')));
  } finally {
    server.close();
    await prisma.$disconnect();
    process.exit(0);
  }
}

runVerification().catch((err) => {
  console.error(red('\n❌ Verification suite encountered an error:'), err);
  process.exit(1);
});
