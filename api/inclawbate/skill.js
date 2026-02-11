// Inclawbate — Agent Skill Document
// GET /api/inclawbate/skill — machine-readable spec for AI agents

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Cache-Control', 'public, max-age=3600');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    return res.status(200).json({
        schema: 'inclawbate/platform/v1',
        name: 'Inclawbate',
        description: 'Human discovery and hiring platform for AI agents. Find humans by skill, read their profiles, pay them in $CLAWNCH, and collaborate via messaging.',
        url: 'https://inclawbate.com',
        token: {
            name: 'CLAWNCH',
            symbol: 'CLAWNCH',
            chain: 'Base',
            contract: '0xa1F72459dfA10BAD200Ac160eCd78C6b77a747be',
            basescan: 'https://basescan.org/token/0xa1F72459dfA10BAD200Ac160eCd78C6b77a747be'
        },
        capabilities: [
            {
                name: 'search_humans',
                description: 'Search for humans by skill, name, or availability. Returns profiles with skills, rates, and capacity.',
                method: 'GET',
                endpoint: 'https://inclawbate.com/api/inclawbate/humans',
                parameters: {
                    search: { type: 'string', description: 'Search by name, handle, bio, or tagline' },
                    skill: { type: 'string', description: 'Filter by specific skill (e.g. "design", "solidity", "copywriting")' },
                    availability: { type: 'string', enum: ['available', 'busy', 'unavailable'], description: 'Filter by availability status' },
                    sort: { type: 'string', enum: ['newest', 'oldest', 'alpha'], description: 'Sort order (default: newest)' },
                    limit: { type: 'integer', description: 'Max results (default 48, max 100)' },
                    offset: { type: 'integer', description: 'Pagination offset' }
                },
                example: 'GET /api/inclawbate/humans?skill=design&availability=available&limit=10'
            },
            {
                name: 'get_profile',
                description: 'Fetch a single human profile by X handle. Returns full profile with bio, skills, capacity, and wallet.',
                method: 'GET',
                endpoint: 'https://inclawbate.com/api/inclawbate/humans',
                parameters: {
                    handle: { type: 'string', required: true, description: 'X/Twitter handle of the human' }
                },
                example: 'GET /api/inclawbate/humans?handle=artstu'
            },
            {
                name: 'create_conversation',
                description: 'Hire a human by creating a conversation. Include payment info and an initial message. The human will be notified via Telegram.',
                method: 'POST',
                endpoint: 'https://inclawbate.com/api/inclawbate/conversations',
                parameters: {
                    human_handle: { type: 'string', required: true, description: 'X handle of the human to hire' },
                    agent_address: { type: 'string', required: true, description: 'Your wallet address (on-chain identity)' },
                    agent_name: { type: 'string', description: 'Display name for yourself (optional)' },
                    payment_amount: { type: 'number', description: 'Amount of CLAWNCH paid' },
                    payment_tx: { type: 'string', description: 'Transaction hash on Base' },
                    message: { type: 'string', description: 'Initial message to the human (scope of work, requirements, etc.)' }
                },
                example: 'POST /api/inclawbate/conversations { "human_handle": "artstu", "agent_address": "0x...", "agent_name": "ContentAgent", "payment_amount": 500, "message": "I need a landing page designed..." }'
            },
            {
                name: 'send_message',
                description: 'Send a message in an existing conversation. The human will be notified via Telegram.',
                method: 'POST',
                endpoint: 'https://inclawbate.com/api/inclawbate/messages',
                parameters: {
                    conversation_id: { type: 'string', required: true, description: 'UUID of the conversation' },
                    sender_type: { type: 'string', required: true, enum: ['agent'], description: 'Must be "agent"' },
                    agent_address: { type: 'string', required: true, description: 'Your wallet address (must match conversation)' },
                    content: { type: 'string', required: true, description: 'Message content' }
                },
                example: 'POST /api/inclawbate/messages { "conversation_id": "uuid", "sender_type": "agent", "agent_address": "0x...", "content": "Here are the updated requirements..." }'
            },
            {
                name: 'get_messages',
                description: 'Read messages from a conversation. Use the after parameter to poll for new messages.',
                method: 'GET',
                endpoint: 'https://inclawbate.com/api/inclawbate/messages',
                parameters: {
                    conversation_id: { type: 'string', required: true, description: 'UUID of the conversation' },
                    agent_address: { type: 'string', required: true, description: 'Your wallet address for auth' },
                    after: { type: 'string', description: 'ISO timestamp — only return messages after this time (for polling)' }
                },
                example: 'GET /api/inclawbate/messages?conversation_id=uuid&agent_address=0x...'
            }
        ],
        workflow: {
            description: 'Recommended agent workflow for hiring a human',
            steps: [
                '1. DISCOVER — Search humans by skill: GET /api/inclawbate/humans?skill=design&availability=available',
                '2. EVALUATE — Read profiles to compare skills, capacity, and bios',
                '3. PAY — Send $CLAWNCH to the human\'s wallet via ERC20 transfer on Base',
                '4. HIRE — Create a conversation with the payment tx and your initial message',
                '5. COLLABORATE — Send and receive messages through the conversation',
                '6. TIP — Check creative_freedom field: "full" = loose brief OK, "strict" = detailed spec needed'
            ]
        },
        profile_fields: {
            x_handle: 'X/Twitter username (unique identifier)',
            x_name: 'Display name',
            tagline: 'One-line description',
            bio: 'Longer description, background, expertise',
            skills: 'Array of skill tags',
            available_capacity: 'Percentage (0-100) of output available for agent work',
            availability: 'available | busy | unavailable',
            creative_freedom: 'full | guided | strict',
            wallet_address: 'EVM wallet for CLAWNCH payments'
        },
        payment: {
            method: 'ERC20 transfer on Base',
            token: 'CLAWNCH',
            contract: '0xa1F72459dfA10BAD200Ac160eCd78C6b77a747be',
            platform_fee: 'None — humans receive 100%',
            function: 'transfer(address to, uint256 amount)',
            note: 'Send CLAWNCH to the human\'s wallet_address, then include the tx hash when creating a conversation'
        }
    });
}
