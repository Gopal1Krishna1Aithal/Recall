async function testFetch() {
  const username = 'Gopal Krishna';
  console.log(`Testing LeetCode GraphQL fetch for username: ${username}...`);
  const query = `
    query userSubmissionStats($username: String!) {
      matchedUser(username: $username) {
        username
      }
    }
  `;

  try {
    const response = await fetch('https://leetcode.com/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Referer': 'https://leetcode.com',
        'Origin': 'https://leetcode.com'
      },
      body: JSON.stringify({
        query,
        variables: {
          username
        },
        operationName: "userSubmissionStats"
      })
    });

    console.log('Status:', response.status);
    const result = await response.json();
    console.log('Data:', JSON.stringify(result));
  } catch (error) {
    console.error('Fetch Error:', error);
  }
}

testFetch();
