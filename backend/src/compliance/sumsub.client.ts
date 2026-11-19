import { createHmac } from 'crypto';

const baseUrl = 'https://api.sumsub.com';
const token = () => process.env.SUMSUB_APP_TOKEN;
const secret = () => process.env.SUMSUB_SECRET_KEY;

export async function sumsubRequest(method: string, path: string, body?: Record<string, unknown>) {
  if (!token() || !secret()) throw new Error('Sumsub API credentials are not configured');
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const bodyText = body ? JSON.stringify(body) : '';
  const signature = createHmac('sha256', secret()).update(timestamp + method.toUpperCase() + path + bodyText).digest('hex');
  const response = await fetch(baseUrl + path, {
    method, headers: {
      'X-App-Token': token()!, 'X-App-Access-Sig': signature, 'X-App-Access-Ts': timestamp,
      'Content-Type': 'application/json',
    }, ...(body ? { body: bodyText } : {}),
    signal: AbortSignal.timeout(10000),
  });
  const payload = await response.json() as any;
  if (!response.ok) throw new Error('Sumsub API request failed: ' + String(payload?.description || payload?.message || response.status));
  return payload;
}

export async function createSumsubApplicant(input: { userId: string; email: string; firstName?: string; lastName?: string; dateOfBirth?: Date }) {
  const levelName = process.env.SUMSUB_KYC_LEVEL;
  if (!levelName) throw new Error('SUMSUB_KYC_LEVEL is not configured');
  const fixedInfo: Record<string, unknown> = {};
  if (input.firstName) fixedInfo.firstName = input.firstName;
  if (input.lastName) fixedInfo.lastName = input.lastName;
  if (input.dateOfBirth) fixedInfo.dob = input.dateOfBirth.toISOString().slice(0, 10);
  const path = '/resources/applicants?levelName=' + encodeURIComponent(levelName);
  const applicant = await sumsubRequest('POST', path, {
    externalUserId: input.userId, email: input.email, ...(Object.keys(fixedInfo).length ? { fixedInfo } : {}),
  });
  const tokenPath = '/resources/accessTokens/sdk';
  const access = await sumsubRequest('POST', tokenPath, { ttlInSecs: 600, userId: input.userId, levelName });
  if (!applicant?.id || !access?.token) throw new Error('Sumsub did not return applicant ID and SDK access token');
  return { applicantId: String(applicant.id), accessToken: String(access.token), levelName };
}

export async function requestSumsubAmlRecheck(applicantId: string) {
  return sumsubRequest('POST', '/resources/applicants/' + encodeURIComponent(applicantId) + '/recheck/aml', {});
}
