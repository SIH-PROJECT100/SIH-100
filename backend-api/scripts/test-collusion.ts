import 'dotenv/config';
import jwt from 'jsonwebtoken';

async function main() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('No JWT_SECRET in env');
  const token = jwt.sign(
    { id: 'user-officer-001', email: 'priya.sharma@gem.gov.in', role: 'officer' },
    secret,
    { expiresIn: '1h' }
  );

  console.log('Sending request to POST /tenders/tender-001/detect-collusion ...');
  const res = await fetch('http://127.0.0.1:4000/tenders/tender-001/detect-collusion', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ forceFresh: true })
  });

  const body = await res.json();
  console.log('STATUS:', res.status);
  console.log('BODY:', JSON.stringify(body, null, 2));
}

main().catch(console.error);
