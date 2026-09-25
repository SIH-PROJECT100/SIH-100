import jwt from 'jsonwebtoken';
import { config } from '../src/config.js';

const officerToken = 'Bearer ' + jwt.sign({ id: 'user-officer-001', role: 'officer' }, config.JWT_SECRET);

async function test() {
  const enRes = await fetch('http://localhost:4000/tenders/tender-001/award', {
    method: 'POST',
    headers: {
      'Authorization': officerToken,
      'Content-Type': 'application/json',
      'Accept-Language': 'en'
    },
    body: JSON.stringify({
      winningBidderId: 'bidder-001',
      justification: 'Too short justification for award.'
    })
  });
  console.log('=== EN RESPONSE ===');
  console.log('Status: HTTP/1.1', enRes.status, enRes.statusText);
  console.log('Body:');
  console.log(JSON.stringify(await enRes.json(), null, 2));

  const hiRes = await fetch('http://localhost:4000/tenders/tender-001/award', {
    method: 'POST',
    headers: {
      'Authorization': officerToken,
      'Content-Type': 'application/json',
      'Accept-Language': 'hi'
    },
    body: JSON.stringify({
      winningBidderId: 'bidder-001',
      justification: 'Too short justification for award.'
    })
  });
  console.log('\n=== HI RESPONSE ===');
  console.log('Status: HTTP/1.1', hiRes.status, hiRes.statusText);
  console.log('Body:');
  console.log(JSON.stringify(await hiRes.json(), null, 2));
}

test().catch(console.error);
